// The architecture pass through the browser (docs/ARCHITECTURE.md §G, §I, §K): records have
// addresses (deep links, refresh, Quick Find by short id, side peek ↔ full page), Beranda adapts to
// the role, a Project Admin invites and revokes from Anggota, and a blocker becomes a Keputusan.
// Every write is read back from the database.
import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { addSuperAdmin, adminClient, cleanup, peekOf, run, signIn } from './helpers.ts'

const suffix = `.${run}@e2e.test`
const admin = adminClient()

/** A login for a seeded person, reusing an address on file or adding one (removed afterwards). */
const added: string[] = []
async function openAs(browser: Browser, base: string, legacy: string): Promise<Page> {
  const p = await admin.from('people').select('id').eq('legacy_id', legacy).single()
  const id = p.data?.id ?? ''
  const c = await admin.from('people_contact').select('email').eq('person_id', id).maybeSingle()
  let email = c.data?.email ? String(c.data.email) : ''
  if (!email) {
    email = `${legacy.replace('m-', '')}${suffix}`
    await admin.from('people_contact').insert({ person_id: id, email })
    added.push(id)
  }
  const page = await browser.newPage()
  await signIn(page, admin, email, base)
  return page
}

test.afterAll(async () => {
  await cleanup(admin, { emailSuffix: suffix })
  if (added.length) await admin.from('people_contact').delete().in('person_id', added)
})

async function subTaskOfYani() {
  const mb = await admin.from('projects').select('id').eq('legacy_id', 'samb-timeline').single()
  const pkg = await admin.from('tasks').select('id, title').eq('project_id', mb.data?.id ?? '').eq('ref', 'MB05').single()
  const sub = await admin.from('tasks').select('id, ref, title').eq('parent_task_id', pkg.data?.id ?? '').eq('ref', 'MB05.1').single()
  expect(pkg.data && sub.data, 'MB05 and its sub-task MB05.1 from the structure extraction').toBeTruthy()
  return { projectId: mb.data?.id ?? '', pkg: pkg.data!, sub: sub.data! }
}

test('records have addresses: deep link, refresh, Quick Find, peek and full page', async ({ browser, baseURL }) => {
  const base = baseURL ?? 'http://localhost:5173'
  const { pkg, sub } = await subTaskOfYani()
  const page = await openAs(browser, base, 'm-yani')

  // A direct link opens the full record; refresh keeps it.
  await page.goto(`${base}/#/p/MB/t/MB05`)
  await expect(page.getByRole('heading', { level: 1, name: pkg.title })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: pkg.title })).toBeVisible()

  // Quick Find ranks the exact short id first; Enter opens it in the side peek with its own URL.
  await page.keyboard.press('/')
  const find = page.getByRole('dialog', { name: 'Cari cepat' })
  await find.getByLabel('Cari', { exact: true }).fill('MB05.1')
  await expect(find.locator('.qf-hit').first()).toContainText('MB05.1')
  await page.keyboard.press('Enter')
  await expect(peekOf(page)).toContainText(sub.title)
  await expect(page).toHaveURL(/\?peek=MB\/t\/MB05\.1$/)

  // Esc closes the peek; the page underneath stays.
  await page.keyboard.press('Escape')
  await expect(peekOf(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: pkg.title })).toBeVisible()

  // From the package's sub-task list to the peek, then to the sub-task's own page.
  await page.locator('.li', { hasText: sub.title }).first().click()
  await peekOf(page).getByRole('button', { name: 'Buka halaman penuh' }).click()
  await expect(page).toHaveURL(/#\/p\/MB\/t\/MB05\.1$/)
  await expect(page.getByRole('heading', { level: 1, name: sub.title })).toBeVisible()
})

test('Beranda adapts to the role: personal attention first, oversight only for admins', async ({ browser, baseURL }) => {
  const base = baseURL ?? 'http://localhost:5173'
  const yani = await openAs(browser, base, 'm-yani')
  await yani.goto(`${base}/#/`)
  await expect(yani.getByRole('heading', { name: /^Perlu tindakan/ })).toBeVisible()
  await expect(yani.getByRole('heading', { name: /^Kerja saya/ })).toBeVisible()
  await expect(yani.getByText('Pengawasan portofolio')).toHaveCount(0)
  await expect(yani.getByText('Project yang kamu kelola')).toHaveCount(0)
  await expect(yani.getByRole('navigation', { name: 'Menu utama' }).getByRole('button', { name: 'Admin' })).toHaveCount(0)

  const people = [await addSuperAdmin(admin, `Owner ${run}`, `owner${suffix}`)]
  try {
    const owner = await browser.newPage()
    await signIn(owner, admin, `owner${suffix}`, base)
    await owner.goto(`${base}/#/`)
    await expect(owner.getByText('Pengawasan portofolio')).toBeVisible()
    await expect(owner.getByRole('navigation', { name: 'Menu utama' }).getByRole('button', { name: 'Admin' })).toBeVisible()
  } finally {
    await cleanup(admin, { people, emailSuffix: `owner${suffix}` })
  }
})

test('a Project Admin invites from Anggota (Member/Viewer only) and revokes', async ({ browser, baseURL }) => {
  const base = baseURL ?? 'http://localhost:5173'
  const { projectId } = await subTaskOfYani()
  const email = `tamu${suffix}`
  const david = await openAs(browser, base, 'm-david')
  david.on('dialog', (d) => void d.accept())
  try {
    await david.goto(`${base}/#/p/MB/anggota`)
    await david.getByRole('button', { name: 'Undang lewat email' }).click()
    const dlg = david.getByRole('dialog').filter({ has: david.getByRole('heading', { name: 'Undang anggota' }) })
    await dlg.getByLabel('Email kantor').fill(email)
    await dlg.getByLabel('Nama tampilan (opsional)').fill(`Tamu ${run}`)
    const role = dlg.getByLabel('Peran di Project Margin Bridge')
    await expect(role.locator('option')).toHaveText(['Member', 'Viewer'])
    await role.selectOption('viewer')
    await dlg.getByRole('button', { name: 'Lanjut' }).click()
    await david.getByRole('button', { name: 'Kirim undangan' }).click()
    await expect(david.getByRole('heading', { name: 'Undangan dibuat' })).toBeVisible()

    const inv = await admin.from('invitations').select('id, status, person_id').eq('email', email).single()
    expect(inv.data?.status).toBe('pending')
    const ip = await admin.from('invitation_projects').select('project_id, project_role').eq('invitation_id', inv.data?.id ?? '')
    expect(ip.data).toEqual([{ project_id: projectId, project_role: 'viewer' }])
    const member = await admin.from('project_members').select('role').eq('project_id', projectId).eq('person_id', inv.data?.person_id ?? '')
    expect(member.data).toEqual([{ role: 'viewer' }])

    await david.getByRole('button', { name: 'Tutup' }).click()
    await david.locator('.li', { hasText: email }).getByRole('button', { name: 'Cabut' }).click()
    await expect.poll(async () => (await admin.from('invitations').select('status').eq('id', inv.data?.id ?? '').single()).data?.status).toBe('revoked')
    const after = await admin.from('project_members').select('role').eq('project_id', projectId).eq('person_id', inv.data?.person_id ?? '')
    expect(after.data).toEqual([])
  } finally {
    const p = await admin.from('people').select('id').eq('display_name', `Tamu ${run}`)
    await admin.from('invitations').delete().eq('email', email)
    if (p.data?.length) await admin.from('people').delete().in('id', p.data.map((x) => x.id))
  }
})

test('a blocker on a sub-task is raised, lifted to a Keputusan and resolved', async ({ browser, baseURL }) => {
  const base = baseURL ?? 'http://localhost:5173'
  const { sub } = await subTaskOfYani()
  const yani = await openAs(browser, base, 'm-yani')
  let askId = ''
  try {
    await yani.goto(`${base}/#/p/MB/t/MB05?peek=MB/t/MB05.1`)
    const peek = peekOf(yani)
    await expect(peek).toContainText(sub.title)
    await peek.getByRole('button', { name: 'Tandai terhambat' }).click()
    const raise = yani.getByRole('dialog').filter({ has: yani.getByRole('heading', { name: 'Tandai terhambat' }) })
    await raise.locator('#bReason').fill(`Ekstrak SAP belum ada ${run}`)
    await raise.getByRole('button', { name: 'Tandai terhambat' }).click()
    await expect(peek.getByText(`Ekstrak SAP belum ada ${run}`).first()).toBeVisible()
    const open = await admin.from('task_blockers').select('id, resolved_at').eq('task_id', sub.id).is('resolved_at', null).single()
    expect(open.data).toBeTruthy()

    await peek.getByRole('button', { name: 'Angkat menjadi Keputusan' }).click()
    const lift = yani.getByRole('dialog').filter({ has: yani.getByRole('heading', { name: 'Angkat menjadi Keputusan' }) })
    await lift.getByLabel('Apa yang harus diputuskan').fill(`Pakai data September dulu? ${run}`)
    await lift.getByRole('button', { name: 'Catat Keputusan' }).click()
    await expect.poll(async () => (await admin.from('task_blockers').select('ask_id').eq('id', open.data?.id ?? '').single()).data?.ask_id).toBeTruthy()
    const blocker = await admin.from('task_blockers').select('ask_id').eq('id', open.data?.id ?? '').single()
    askId = blocker.data?.ask_id ?? ''
    const link = await admin.from('ask_tasks').select('task_id').eq('ask_id', askId)
    expect(link.data).toEqual([{ task_id: sub.id }])

    await peek.getByRole('button', { name: 'Hambatan selesai' }).click()
    await yani.getByRole('button', { name: 'Tandai selesai' }).click()
    await expect.poll(async () => (await admin.from('task_blockers').select('resolved_at').eq('id', open.data?.id ?? '').single()).data?.resolved_at).toBeTruthy()
  } finally {
    await admin.from('task_blockers').delete().eq('task_id', sub.id)
    if (askId) await admin.from('asks').delete().eq('id', askId)
  }
})
