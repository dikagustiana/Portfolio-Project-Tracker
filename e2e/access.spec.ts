// M3 gate (BRIEF §10): the owner adds a person and grants Margin Bridge and MAM only, in the admin
// screens; signed in, that person sees exactly those two projects and cannot open a third.
import { expect, test } from '@playwright/test'
import { addPerson, adminClient, cleanup, run, signIn } from './helpers.ts'

const suffix = `.${run}@e2e.test`

test('owner grants Margin Bridge and MAM only; the person sees exactly those', async ({ browser, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const projects: string[] = []
  const people: string[] = []
  try {
    for (const [name, entity] of [[`MAM e2e ${run}`, 'MAM'], [`BMG e2e ${run}`, 'BMG']] as const) {
      const p = await admin.from('projects').insert({ name, entity_code: entity }).select('id').single()
      if (p.error) throw new Error(p.error.message)
      projects.push(p.data.id)
    }
    const mb = await admin.from('projects').select('id, name').eq('legacy_id', 'samb-timeline').single()
    expect(mb.data, 'the Margin Bridge seed is imported').toBeTruthy()

    // An owner to act as (independent of whoever else is on file).
    people.push(await addPerson(admin, `Owner ${run}`, `owner${suffix}`))
    const ownerPage = await browser.newPage()
    const ownerLogin = await admin.auth.admin.createUser({ email: `owner${suffix}`, email_confirm: true })
    await admin.from('app_roles').insert({ user_id: ownerLogin.data.user?.id ?? '', role: 'owner' })
    await signIn(ownerPage, admin, `owner${suffix}`, base)

    // Admin → Orang: add the person with an office e-mail.
    const name = `David ${run}`
    await ownerPage.goto(`${base}/#/admin/orang`)
    await ownerPage.getByLabel('Nama', { exact: true }).fill(name)
    await ownerPage.getByLabel('Jabatan', { exact: true }).fill('GM')
    await ownerPage.getByLabel('Email', { exact: true }).fill(`david${suffix}`)
    await ownerPage.getByRole('button', { name: '+ Tambah orang' }).click()
    await expect(ownerPage.getByText(`${name} ditambahkan`)).toBeVisible()

    // Admin → Akses project: PM on Margin Bridge and on MAM, nothing on BMG.
    await ownerPage.goto(`${base}/#/admin/akses`)
    await ownerPage.getByLabel('Pilih orang').selectOption({ label: name })
    await ownerPage.getByLabel(`Peran ${name} di ${mb.data?.name ?? ''}`).selectOption('pm')
    await expect(ownerPage.getByText(`${name}: Project Manager di ${mb.data?.name ?? ''}`)).toBeVisible()
    await ownerPage.getByLabel(`Peran ${name} di MAM e2e ${run}`).selectOption('pm')
    await expect(ownerPage.getByText(`${name}: Project Manager di MAM e2e ${run}`)).toBeVisible()
    const david = await admin.from('people').select('id').eq('display_name', name).single()
    people.push(david.data?.id ?? '')

    // Signed in as that person (the login an invitation creates).
    const davidPage = await browser.newPage()
    await signIn(davidPage, admin, `david${suffix}`, base)
    const list = davidPage.getByRole('navigation', { name: 'Daftar project' })
    await expect(list.getByRole('button')).toHaveCount(2)
    await expect(list).toContainText(mb.data?.name ?? '')
    await expect(list).toContainText(`MAM e2e ${run}`)
    await expect(list).not.toContainText('BMG')

    // A direct link to the BMG project shows nothing of it.
    await davidPage.goto(`${base}/#/p/${projects[1] ?? ''}/milestone`)
    await expect(davidPage.locator('h1').first()).toHaveText('Portofolio project SAMB Group')
    await expect(davidPage.getByText(`BMG e2e ${run}`)).toHaveCount(0)
  } finally {
    await cleanup(admin, { projects, people, emailSuffix: suffix })
  }
})
