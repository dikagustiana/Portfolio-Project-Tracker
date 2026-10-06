// BRIEF §5 through the UI: the PIC (an officer) commits dates and submits with evidence; the
// pemeriksa finds it in "Minggu ini" and accepts it. Each step is read back from the database.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminClient, cleanup, run, signIn } from './helpers.ts'

test('officer commits and submits; the validator accepts from Minggu ini', async ({ browser, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const mb = await admin.from('projects').select('id').eq('legacy_id', 'samb-timeline').single()
  const muti = await admin.from('people').select('id, user_id').eq('legacy_id', 'm-muti').single()
  const task = await admin
    .from('tasks')
    .select('id, title, stage, committed, committed_at, committed_by, start_date, end_date, validator_person_id')
    .eq('project_id', mb.data?.id ?? '')
    .eq('assignee_person_id', muti.data?.id ?? '')
    .eq('stage', 'todo')
    .limit(1)
    .single()
  expect(task.data, 'a seeded task of Muti').toBeTruthy()
  const t = task.data!
  const validator = await admin.from('people').select('id, display_name').eq('id', t.validator_person_id ?? '').single()

  // Logins as the invitations would create them (reusing any existing address on file).
  const suffix = `.${run}@e2e.test`
  const added: string[] = []
  const loginOf = async (personId: string, nick: string): Promise<string> => {
    const c = await admin.from('people_contact').select('email').eq('person_id', personId).maybeSingle()
    if (c.data?.email) return String(c.data.email)
    const email = `${nick}${suffix}`
    await admin.from('people_contact').insert({ person_id: personId, email })
    added.push(personId)
    return email
  }
  const open = async (email: string): Promise<Page> => {
    const page = await browser.newPage()
    await signIn(page, admin, email, base)
    return page
  }

  try {
    // 1. Muti opens her task from the checklist: as an officer she gets the detail dialog.
    const mutiPage = await open(await loginOf(muti.data?.id ?? '', 'muti'))
    await mutiPage.goto(`${base}/#/p/${mb.data?.id ?? ''}/list`)
    await mutiPage.getByLabel('Cari task').fill(t.title.slice(0, 40))
    await mutiPage.locator('.trow .open', { hasText: t.title }).first().click()
    const dlg = mutiPage.getByRole('dialog')
    await expect(dlg.getByRole('button', { name: 'Edit task' })).toHaveCount(0)
    await dlg.getByRole('button', { name: 'Komit tanggal' }).click()
    await expect(mutiPage.getByText(/Tanggal dikomit/)).toBeVisible()
    await expect.poll(async () => (await admin.from('tasks').select('committed').eq('id', t.id).single()).data?.committed).toBe(true)

    // 2. Ticking the box submits with evidence.
    await mutiPage.locator('.trow', { hasText: t.title }).first().locator('button.ck').click()
    await mutiPage.locator('#sEv').fill('https://drive.example/bukti-e2e')
    await mutiPage.getByRole('button', { name: 'Ajukan ke pemeriksa' }).click()
    await expect.poll(async () => (await admin.from('tasks').select('stage').eq('id', t.id).single()).data?.stage).toBe('review')

    // 3. The pemeriksa accepts it from "Minggu ini".
    const valPage = await open(await loginOf(validator.data?.id ?? '', 'pemeriksa'))
    await valPage.goto(`${base}/#/minggu`)
    await valPage.locator('.dl-item', { hasText: t.title }).filter({ hasText: 'Periksa' }).first().click()
    await valPage.getByRole('dialog').getByRole('button', { name: 'Terima' }).click()
    await expect.poll(async () => (await admin.from('tasks').select('stage, accepted_by').eq('id', t.id).single()).data).toEqual({
      stage: 'done',
      accepted_by: validator.data?.id,
    })
  } finally {
    await admin
      .from('tasks')
      .update({
        stage: t.stage,
        committed: t.committed,
        committed_at: t.committed_at,
        committed_by: t.committed_by,
        evidence: null,
        submitted_at: null,
        submitted_by: null,
        accepted_at: null,
        accepted_by: null,
        done_at: null,
      })
      .eq('id', t.id)
    await cleanup(admin, { emailSuffix: suffix })
    if (added.length) await admin.from('people_contact').delete().in('person_id', added)
  }
})
