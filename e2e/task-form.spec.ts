// BRIEF §6.7 regression: the prototype's task form saved the chosen pemeriksa into a stray field, so
// changes never persisted. Change the validator in the real form, save, and read the row back.
import { expect, test } from '@playwright/test'
import { addPerson, adminClient, cleanup, run, signIn } from './helpers.ts'

const suffix = `.${run}@e2e.test`

test('changing the pemeriksa in the task form changes validator_person_id', async ({ page, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const people: string[] = []
  const mb = await admin.from('projects').select('id').eq('legacy_id', 'samb-timeline').single()
  const pm = (legacy: string) => admin.from('people').select('id, display_name').eq('legacy_id', legacy).single()
  const [dika, david] = await Promise.all([pm('m-dika'), pm('m-david')])
  // A not-yet-submitted task that Dika checks and David is not PIC of.
  const task = await admin
    .from('tasks')
    .select('id, title, validator_person_id')
    .eq('project_id', mb.data?.id ?? '')
    .eq('validator_person_id', dika.data?.id ?? '')
    .neq('assignee_person_id', david.data?.id ?? '')
    .in('stage', ['todo', 'progress'])
    .not('milestone_id', 'is', null)
    .limit(1)
    .single()
  expect(task.data, 'a seeded task checked by Dika').toBeTruthy()
  const t = task.data!
  try {
    people.push(await addPerson(admin, `Owner ${run}`, `owner${suffix}`))
    const login = await admin.auth.admin.createUser({ email: `owner${suffix}`, email_confirm: true })
    await admin.from('app_roles').insert({ user_id: login.data.user?.id ?? '', role: 'owner' })
    await signIn(page, admin, `owner${suffix}`, base)

    await page.goto(`${base}/#/p/${mb.data?.id ?? ''}/list`)
    await page.getByLabel('Cari task').fill(t.title.slice(0, 40))
    await page.locator('.trow .open', { hasText: t.title }).first().click()
    await expect(page.getByRole('dialog')).toContainText('Edit task')
    await page.locator('#tVal').selectOption(david.data?.id ?? '')
    await page.getByRole('dialog').getByRole('button', { name: 'Simpan', exact: true }).click()
    await expect(page.getByText('Task disimpan')).toBeVisible()

    const after = await admin.from('tasks').select('validator_person_id').eq('id', t.id).single()
    expect(after.data?.validator_person_id).toBe(david.data?.id)
  } finally {
    await admin.from('tasks').update({ validator_person_id: t.validator_person_id }).eq('id', t.id)
    await cleanup(admin, { people, emailSuffix: suffix })
  }
})
