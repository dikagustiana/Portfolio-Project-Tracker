// Access (docs/ARCHITECTURE.md §C): the super admin adds a person and, in the access matrix, makes
// them Project Admin of Margin Bridge and Member of MAM. Signed in, that person sees exactly those
// two projects — in the sidebar, Portofolio and Quick Find — a direct link to a third looks like a
// project that does not exist, and on their own project they manage only Member/Viewer.
import { expect, test } from '@playwright/test'
import { addSuperAdmin, adminClient, cleanup, run, signIn } from './helpers.ts'

const suffix = `.${run}@e2e.test`

test('super admin grants Margin Bridge and MAM only; the person sees exactly those', async ({ browser, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const projects: string[] = []
  const people: string[] = []
  try {
    for (const [name, entity] of [[`MAM e2e ${run}`, 'MAM'], [`BMG e2e ${run}`, 'BMG']] as const) {
      const p = await admin.from('projects').insert({ name, entity_code: entity }).select('id, code').single()
      if (p.error) throw new Error(p.error.message)
      projects.push(p.data.id)
    }
    const bmg = await admin.from('projects').select('code').eq('id', projects[1] ?? '').single()
    const mb = await admin.from('projects').select('id, name, code').eq('legacy_id', 'samb-timeline').single()
    expect(mb.data, 'the Margin Bridge seed is imported').toBeTruthy()

    people.push(await addSuperAdmin(admin, `Owner ${run}`, `owner-access${suffix}`))
    const ownerPage = await browser.newPage()
    await signIn(ownerPage, admin, `owner-access${suffix}`, base)

    // Admin → Orang & akun: add the person with an office e-mail.
    const name = `David ${run}`
    await ownerPage.goto(`${base}/#/admin/orang`)
    await ownerPage.getByLabel('Nama', { exact: true }).fill(name)
    await ownerPage.getByLabel('Jabatan', { exact: true }).fill('GM')
    await ownerPage.getByLabel('Email', { exact: true }).fill(`david${suffix}`)
    await ownerPage.getByRole('button', { name: '+ Tambah orang' }).click()
    await expect(ownerPage.getByText(`${name} ditambahkan`)).toBeVisible()
    const david = await admin.from('people').select('id').eq('display_name', name).single()
    people.push(david.data?.id ?? '')

    // Admin → Matriks akses: Project Admin on Margin Bridge, Member on MAM, nothing on BMG.
    await ownerPage.goto(`${base}/#/admin/akses`)
    await ownerPage.getByLabel(`Peran ${name} di ${mb.data?.name ?? ''}`).selectOption('project_admin')
    await expect(ownerPage.getByText('Peran diubah menjadi Project Admin')).toBeVisible()
    await ownerPage.getByLabel(`Peran ${name} di MAM e2e ${run}`).selectOption('member')
    await expect(ownerPage.getByText('Peran diubah menjadi Member')).toBeVisible()

    // Signed in as that person (the login an invitation creates).
    const davidPage = await browser.newPage()
    await signIn(davidPage, admin, `david${suffix}`, base)
    const list = davidPage.getByRole('navigation', { name: 'Daftar project' })
    await expect(list.getByRole('button')).toHaveCount(2)
    await expect(list).toContainText(mb.data?.name ?? '')
    await expect(list).toContainText(`MAM e2e ${run}`)
    await expect(list).not.toContainText('BMG')

    // Portofolio counts and lists only those two.
    await davidPage.goto(`${base}/#/portofolio`)
    await expect(davidPage.locator('.ptable button.prow')).toHaveCount(2)
    await expect(davidPage.getByText('Kamu memiliki akses ke')).toContainText('2 project')

    // Quick Find cannot find it.
    await davidPage.keyboard.press('/')
    await davidPage.getByRole('dialog', { name: 'Cari cepat' }).getByLabel('Cari', { exact: true }).fill(`BMG e2e ${run}`)
    await expect(davidPage.getByText('Tidak ada yang cocok di project yang bisa kamu lihat.')).toBeVisible()
    await davidPage.keyboard.press('Escape')

    // A direct link to the BMG project (by code or by id) shows nothing of it.
    for (const ref of [bmg.data?.code ?? '', projects[1] ?? '']) {
      await davidPage.goto(`${base}/#/p/${ref}`)
      await expect(davidPage.getByRole('heading', { name: 'Tidak ditemukan' })).toBeVisible()
      await expect(davidPage.getByText(`BMG e2e ${run}`)).toHaveCount(0)
    }

    // On Margin Bridge, a Project Admin manages Member and Viewer, never Project Admin.
    await davidPage.goto(`${base}/#/p/${mb.data?.code ?? ''}/anggota`)
    const muti = davidPage.getByLabel('Peran Muti')
    await expect(muti).toBeVisible()
    await expect(muti.locator('option')).toHaveText(['Member', 'Viewer'])
    await expect(davidPage.getByLabel('Peran Dika')).toHaveCount(0)
  } finally {
    await cleanup(admin, { projects, people, emailSuffix: suffix })
  }
})
