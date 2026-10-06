// M3 (BRIEF §10): invite-only sign-in. The owner-only invite-person Edge Function creates the login
// and returns a one-time link; the login links to its person by e-mail; nobody else may invite.
// Needs a local stack with the function reachable at INVITE_URL (default SUPABASE_URL/functions/v1/invite-person).
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/data/database.types.ts'

const url = process.env.SUPABASE_URL ?? ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const fnUrl = process.env.INVITE_URL ?? `${url}/functions/v1/invite-person`
const local = /^http:\/\/(127\.0\.0\.1|localhost):/.test(url) && !!service && !!anonKey

const run = Math.random().toString(36).slice(2, 8)
const mail = (n: string) => `${n}.${run}@undangan.test`

describe.skipIf(!local)('invite-person (owner-only invitations)', () => {
  let admin: SupabaseClient<Database>
  const tokens = { owner: '', officer: '' }
  const people = { owner: '', officer: '', guest: '', noMail: '' }

  const person = async (name: string, email: string | null) => {
    const p = await admin.from('people').insert({ display_name: `${name} ${run}`, job_title: 'Uji' }).select('id').single()
    if (p.error) throw new Error(p.error.message)
    if (email) await admin.from('people_contact').insert({ person_id: p.data.id, email })
    return p.data.id
  }
  const login = async (email: string) => {
    const password = `Pw-${run}-${Math.random().toString(36).slice(2)}`
    const u = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (u.error || !u.data.user) throw new Error(u.error?.message ?? 'createUser')
    const c = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const s = await c.auth.signInWithPassword({ email, password })
    if (s.error) throw new Error(s.error.message)
    return { id: u.data.user.id, token: s.data.session.access_token }
  }
  const invite = async (token: string, personId: string, mode: 'link' | 'email' = 'link') => {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_id: personId, mode, redirect_to: 'http://localhost:5173' }),
    })
    return { status: res.status, body: (await res.json()) as { link?: string; type?: string; error?: string } }
  }

  beforeAll(async () => {
    admin = createClient<Database>(url, service, { auth: { persistSession: false } })
    people.owner = await person('Owner', mail('owner'))
    people.officer = await person('Officer', mail('officer'))
    people.guest = await person('Tamu', mail('tamu'))
    people.noMail = await person('Tanpa email', null)
    const owner = await login(mail('owner'))
    await admin.from('app_roles').insert({ user_id: owner.id, role: 'owner' })
    tokens.owner = owner.token
    tokens.officer = (await login(mail('officer'))).token
  })

  afterAll(async () => {
    if (!admin) return
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data.users.filter((x) => x.email?.endsWith(`.${run}@undangan.test`))) {
      await admin.from('app_roles').delete().eq('user_id', u.id).eq('role', 'group_viewer')
      // The owner role row goes with the user (cascade) once another owner exists.
      await admin.auth.admin.deleteUser(u.id).catch(() => undefined)
    }
    await admin.from('people').delete().in('id', Object.values(people))
  })

  it('the owner gets a one-time invite link; the new login links to the person', async () => {
    const r = await invite(tokens.owner, people.guest)
    expect(r.status, r.body.error).toBe(200)
    expect(r.body.type).toBe('invite')
    expect(r.body.link).toMatch(/\/auth\/v1\/verify\?token=/)
    const p = await admin.from('people').select('user_id').eq('id', people.guest).single()
    expect(p.data?.user_id).toBeTruthy()
  })

  it('a second link for someone who already has a login is a magic link', async () => {
    const r = await invite(tokens.owner, people.guest)
    expect(r.status).toBe(200)
    expect(r.body.type).toBe('magiclink')
  })

  it('a person without an office e-mail cannot be invited', async () => {
    const r = await invite(tokens.owner, people.noMail)
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('belum punya email kantor')
  })

  it('nobody but the owner may invite', async () => {
    const r = await invite(tokens.officer, people.noMail)
    expect(r.status).toBe(403)
    const anon = await invite(anonKey, people.noMail)
    expect(anon.status).toBe(403)
  })
})
