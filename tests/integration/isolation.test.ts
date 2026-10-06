// Definition of done (BRIEF §13): a PM granted Margin Bridge and MAM only cannot obtain any row of
// another project through the REST API or Realtime. Runs against a local Supabase stack with real
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
  const ids = { mb: '', mam: '', bmg: '', person: '', bmgTask: '', mbTask: '' }

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
    await admin.from('project_members').insert([
      { project_id: ids.mb, person_id: ids.person, role: 'pm' },
      { project_id: ids.mam, person_id: ids.person, role: 'pm' },
    ])
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
    await admin.from('asks').insert({ project_id: ids.bmg, question: 'Rahasia?' })
    david = await signIn(admin, email('david'))
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('projects').delete().in('id', [ids.mb, ids.mam, ids.bmg])
    await admin.from('people').delete().eq('id', ids.person)
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
    for (const t of ['tasks', 'milestones', 'asks', 'decisions', 'reminders', 'project_members', 'task_deps'] as const) {
      const { data, error } = await david.from(t).select('*').eq('project_id', ids.bmg)
      expect(error, t).toBeNull()
      expect(data, t).toEqual([])
    }
    const byId = await david.from('tasks').select('*').eq('id', ids.bmgTask)
    expect(byId.data).toEqual([])
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
