// BRIEF §5 through the UI: the PIC (a Member) opens a sub-task from the checklist in the side peek,
// commits its dates and submits it with evidence; the pemeriksa (inherited from the package) finds
// it under "Perlu tindakan" in Minggu ini and accepts it in the peek. Each step is read back from
// the database.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminClient, cleanup, peekOf, run, signIn } from './helpers.ts'

test('member commits and submits a sub-task; the pemeriksa accepts from Minggu ini', async ({ browser, baseURL }) => {
  const admin = adminClient()
  const base = baseURL ?? 'http://localhost:5173'
  const mb = await admin.from('projects').select('id, code').eq('legacy_id', 'samb-timeline').single()
  const muti = await admin.from('people').select('id, user_id').eq('legacy_id', 'm-muti').single()
  // A sub-task of Muti without prerequisites, not started (the leaf is where work is accepted).
  const subs = await admin
    .from('tasks')
    .select('id, title, stage, committed, committed_at, committed_by, start_date, end_date, validator_person_id, parent_task_id')
    .eq('project_id', mb.data?.id ?? '')
    .eq('assignee_person_id', muti.data?.id ?? '')
    .eq('stage', 'todo')
    .not('parent_task_id', 'is', null)
  const deps = await admin.from('task_deps').select('task_id').in('task_id', (subs.data ?? []).map((x) => x.id))
  const t = (subs.data ?? []).find((x) => !(deps.data ?? []).some((d) => d.task_id === x.id))
  expect(t, 'a seeded sub-task of Muti without prerequisites').toBeTruthy()
  if (!t) return
  // Pemeriksa: the sub-task's own, else its package's.
  const parent = await admin.from('tasks').select('validator_person_id').eq('id', t.parent_task_id ?? '').single()
  const validatorId = t.validator_person_id ?? parent.data?.validator_person_id ?? ''
  const validator = await admin.from('people').select('id, display_name').eq('id', validatorId).single()

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
    // 1. Muti opens her sub-task from the checklist; it opens in the side peek with its own address.
    const mutiPage = await open(await loginOf(muti.data?.id ?? '', 'muti'))
    await mutiPage.goto(`${base}/#/p/${mb.data?.code ?? ''}/list`)
    await mutiPage.getByLabel('Cari task').fill(t.title.slice(0, 40))
    await mutiPage.locator('.trow .open', { hasText: t.title }).first().click()
    const peek = peekOf(mutiPage)
    await expect(peek).toContainText(t.title)
    await expect(mutiPage).toHaveURL(/\?peek=/)
    await peek.getByRole('button', { name: 'Komit tanggal' }).click()
    await expect(mutiPage.getByText(/Tanggal dikomit/)).toBeVisible()
    await expect.poll(async () => (await admin.from('tasks').select('committed').eq('id', t.id).single()).data?.committed).toBe(true)

    // 2. Submitting asks for evidence.
    await peek.getByRole('button', { name: 'Ajukan selesai' }).click()
    await mutiPage.locator('#sEv').fill('https://drive.example/bukti-e2e')
    await mutiPage.getByRole('button', { name: 'Ajukan ke pemeriksa' }).click()
    await expect.poll(async () => (await admin.from('tasks').select('stage').eq('id', t.id).single()).data?.stage).toBe('review')

    // 3. The pemeriksa finds it under "Perlu tindakan" in Minggu ini and accepts it in the peek.
    const valPage = await open(await loginOf(validator.data?.id ?? '', 'pemeriksa'))
    await valPage.goto(`${base}/#/minggu`)
    await valPage.locator('.li', { hasText: t.title }).first().click()
    await peekOf(valPage).getByRole('button', { name: 'Terima' }).click()
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
