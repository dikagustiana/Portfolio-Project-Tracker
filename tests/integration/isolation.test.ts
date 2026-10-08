// Definition of done (BRIEF §13, ARCHITECTURE §C "no membership = the project does not exist"): a
// Project Admin granted Margin Bridge and MAM only cannot obtain any row of another project, or
// anyone who only works there, through the REST API, RPCs or Realtime. Runs against a local Supabase stack with real
// sign-ins (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_PUBLISHABLE_KEY); skipped otherwise.
import { createClient, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/data/database.types.ts'

const url = process.env.SUPABASE_URL ?? ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const local = /^http:\/\/(127\.0\.0\.1|localhost):/.test(url) && !!service && !!anonKey

type Client = SupabaseClient<Database>
const run = Math.random().toString(36).slice(2, 8)
const email = (n: string) => `${n}.${run}@isolasi.test`

async function signIn(admin: Client, mail: string): Promise<Client> {
  const password = `Pw-${run}-${Math.random().toString(36).slice(2)}`
  const { data: u, error } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true })
  if (error || !u.user) throw new Error(error?.message ?? 'createUser failed')
  const c = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const s = await c.auth.signInWithPassword({ email: mail, password })
  if (s.error) throw new Error(s.error.message)
  // Realtime needs the user's token to evaluate RLS for each change.
  await c.realtime.setAuth(s.data.session.access_token)
  return c
}

describe.skipIf(!local)('project isolation through the API and Realtime', () => {
  let admin: Client
  let david: Client
  const ids = { mb: '', mam: '', bmg: '', person: '', outsider: '', bmgTask: '', mbTask: '' }

  beforeAll(async () => {
    admin = createClient<Database>(url, service, { auth: { persistSession: false } })
    const person = await admin.from('people').insert({ display_name: `David ${run}`, job_title: 'GM' }).select('id').single()
    if (person.error) throw new Error(person.error.message)
    ids.person = person.data.id
    await admin.from('people_contact').insert({ person_id: ids.person, email: email('david') })
    for (const [k, name, entity] of [['mb', 'MB', 'SAMB'], ['mam', 'MAM', 'MAM'], ['bmg', 'BMG', 'BMG']] as const) {
      const p = await admin.from('projects').insert({ name: `Isolasi ${name} ${run}`, entity_code: entity }).select('id').single()
      if (p.error) throw new Error(p.error.message)
      ids[k] = p.data.id
    }
    const outsider = await admin.from('people').insert({ display_name: `Orang BMG ${run}`, job_title: 'BMG' }).select('id').single()
    if (outsider.error) throw new Error(outsider.error.message)
    ids.outsider = outsider.data.id
    await admin.from('people_contact').insert({ person_id: ids.outsider, email: email('bmg') })
    const m = await admin.from('project_members').insert([
      { project_id: ids.mb, person_id: ids.person, role: 'project_admin' },
      { project_id: ids.mam, person_id: ids.person, role: 'project_admin' },
      { project_id: ids.bmg, person_id: ids.outsider, role: 'member' },
    ])
    if (m.error) throw new Error(m.error.message)
    const t = await admin
      .from('tasks')
      .insert([
        { project_id: ids.bmg, title: 'Rahasia BMG', start_date: '2026-10-07', end_date: '2026-10-09' },
        { project_id: ids.mb, title: 'Task MB', start_date: '2026-10-07', end_date: '2026-10-09' },
      ])
      .select('id, project_id')
    if (t.error) throw new Error(t.error.message)
    ids.bmgTask = t.data.find((x) => x.project_id === ids.bmg)?.id ?? ''
    ids.mbTask = t.data.find((x) => x.project_id === ids.mb)?.id ?? ''
    const ask = await admin.from('asks').insert({ project_id: ids.bmg, question: 'Rahasia?' }).select('id').single()
    if (ask.error) throw new Error(ask.error.message)
    // History, blockers and discussion in BMG: none of it may leak either.
    await admin.from('comments').insert({ project_id: ids.bmg, task_id: ids.bmgTask, author_person_id: ids.outsider, body: 'Rahasia komentar' })
    await admin.from('task_blockers').insert({ project_id: ids.bmg, task_id: ids.bmgTask, reason: 'Rahasia hambatan', raised_by: ids.outsider })
    await admin.from('ask_tasks').insert({ project_id: ids.bmg, ask_id: ask.data.id, task_id: ids.bmgTask })
    david = await signIn(admin, email('david'))
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('projects').delete().in('id', [ids.mb, ids.mam, ids.bmg])
    await admin.from('people').delete().in('id', [ids.person, ids.outsider])
    const { data } = await admin.auth.admin.listUsers()
    for (const u of data.users.filter((x) => x.email?.endsWith(`.${run}@isolasi.test`))) await admin.auth.admin.deleteUser(u.id)
    await david?.removeAllChannels()
  })

  it('REST: projects are exactly the two granted', async () => {
    const { data, error } = await david.from('projects').select('id')
    expect(error).toBeNull()
    expect(new Set(data?.map((p) => p.id))).toEqual(new Set([ids.mb, ids.mam]))
  })

  it('REST: no table returns a row of the other project, even when asked for it by id', async () => {
    const tables = [
      'tasks',
      'milestones',
      'asks',
      'decisions',
      'reminders',
      'project_members',
      'task_deps',
      'ask_tasks',
      'task_reviews',
      'task_commitments',
      'task_blockers',
      'comments',
      'project_events',
      'migration_flags',
      'invitation_projects',
    ] as const
    for (const t of tables) {
      const { data, error } = await david.from(t).select('*').eq('project_id', ids.bmg)
      expect(error, t).toBeNull()
      expect(data, t).toEqual([])
    }
    const byId = await david.from('tasks').select('*').eq('id', ids.bmgTask)
    expect(byId.data).toEqual([])
    // The BMG project produced events (task created, comment, blocker); none are readable.
    const ev = await admin.from('project_events').select('id').eq('project_id', ids.bmg)
    expect(ev.data?.length ?? 0).toBeGreaterThan(0)
  })

  it('REST: people who only work in the other project are not visible, nor their e-mail', async () => {
    const pe = await david.from('people').select('id').eq('id', ids.outsider)
    expect(pe.data).toEqual([])
    const c = await david.from('people_contact').select('*').eq('person_id', ids.outsider)
    expect(c.data).toEqual([])
  })

  it('RPC: reading or acting on the other project\'s records looks like they do not exist', async () => {
    const block = await david.rpc('raise_blocker', { p_task: ids.bmgTask, p_reason: 'x' })
    expect(block.error?.code).toBe('P0002')
    const cmt = await david.rpc('add_comment', { p_target: 'task', p_id: ids.bmgTask, p_body: 'x' })
    expect(cmt.error?.code).toBe('P0002')
    const role = await david.rpc('set_member_role', { p_project: ids.bmg, p_person: ids.person, p_role: 'member' })
    expect(role.error?.code).toBe('P0002')
  })

  it('RPC: writing into the other project looks like it does not exist', async () => {
    const { error } = await david.rpc('save_task', { p: { project_id: ids.bmg, title: 'x', start_date: '2026-10-07', end_date: '2026-10-07' } })
    expect(error?.code).toBe('P0002')
  })

  it('Realtime: changes in the other project are never delivered; own project changes are', async () => {
    const seen: string[] = []
    const channel = david.channel(`isolasi-${run}`)
    await new Promise<void>((resolve, reject) => {
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => {
          const row = (p.new ?? p.old) as { id?: string; title?: string }
          seen.push(row.title ?? row.id ?? '?')
        })
        .subscribe((status) => {
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) resolve()
          if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) reject(new Error(status))
        })
    })
    const waitFor = async (title: string, ms: number) => {
      const deadline = Date.now() + ms
      while (!seen.includes(title) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200))
      return seen.includes(title)
    }
    // Warm-up: keep touching our own task until Realtime delivers (cold starts take a moment).
    for (let i = 0; i < 20 && !(await waitFor(`probe ${i - 1}`, 1000)); i++)
      await admin.from('tasks').update({ title: `probe ${i}` }).eq('id', ids.mbTask)
    // Changes are delivered in commit order: the BMG change, if it leaked, would arrive first.
    await admin.from('tasks').update({ title: 'Rahasia BMG diubah' }).eq('id', ids.bmgTask)
    await admin.from('tasks').update({ title: 'Task MB diubah' }).eq('id', ids.mbTask)
    expect(await waitFor('Task MB diubah', 10_000)).toBe(true)
    expect(seen.some((x) => x.includes('Rahasia'))).toBe(false)
  }, 45_000)
})
