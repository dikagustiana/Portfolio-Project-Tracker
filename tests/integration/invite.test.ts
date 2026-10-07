// Invite-only sign-in (docs/ARCHITECTURE.md §K). The invite-person Edge Function creates the login
// and returns a one-time link, but only after the database (login_link_target, called with the
// caller's own JWT) agrees: the super admin for anyone, a Project Admin only for someone with a
// pending invitation to one of their projects, nobody for a revoked invitation.
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

type Client = SupabaseClient<Database>

describe.skipIf(!local)('invite-person (login links decided by the database)', () => {
  let admin: Client
  let paClient: Client
  const tokens = { superAdmin: '', projectAdmin: '', member: '' }
  const people = { superAdmin: '', projectAdmin: '', member: '', guest: '', noMail: '' }
  let projectId = ''

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
    return { id: u.data.user.id, token: s.data.session.access_token, client: c }
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
    people.superAdmin = await person('Super', mail('super'))
    people.projectAdmin = await person('Admin project', mail('pa'))
    people.member = await person('Anggota', mail('member'))
    people.guest = await person('Tamu', mail('tamu'))
    people.noMail = await person('Tanpa email', null)
    const sup = await login(mail('super'))
    const set = await admin.from('profiles').upsert({ user_id: sup.id, system_role: 'super_admin' })
    if (set.error) throw new Error(set.error.message)
    tokens.superAdmin = sup.token
    const pa = await login(mail('pa'))
    tokens.projectAdmin = pa.token
    paClient = pa.client
    tokens.member = (await login(mail('member'))).token
    const p = await admin.from('projects').insert({ name: `Undangan ${run}`, entity_code: 'SAMB' }).select('id').single()
    if (p.error) throw new Error(p.error.message)
    projectId = p.data.id
    const m = await admin.from('project_members').insert([
      { project_id: projectId, person_id: people.projectAdmin, role: 'project_admin' },
      { project_id: projectId, person_id: people.member, role: 'member' },
    ])
    if (m.error) throw new Error(m.error.message)
  })

  afterAll(async () => {
    if (!admin) return
    if (projectId) await admin.from('projects').delete().eq('id', projectId)
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data.users.filter((x) => x.email?.endsWith(`.${run}@undangan.test`)))
      // The test super admin stays when it is the only one (there is always one super admin).
      await admin.auth.admin.deleteUser(u.id).catch(() => undefined)
    await admin.from('invitations').delete().like('email', `%.${run}@undangan.test`)
    await admin.from('people').delete().in('id', Object.values(people))
  })

  it('the super admin gets a one-time invite link; the new login links to the person', async () => {
    const r = await invite(tokens.superAdmin, people.guest)
    expect(r.status, r.body.error).toBe(200)
    expect(r.body.type).toBe('invite')
    expect(r.body.link).toMatch(/\/auth\/v1\/verify\?token=/)
    const p = await admin.from('people').select('user_id').eq('id', people.guest).single()
    expect(p.data?.user_id).toBeTruthy()
  })

  it('a second link for someone who already has a login is a magic link', async () => {
    const r = await invite(tokens.superAdmin, people.guest)
    expect(r.status).toBe(200)
    expect(r.body.type).toBe('magiclink')
  })

  it('a person without an office e-mail cannot get a link', async () => {
    const r = await invite(tokens.superAdmin, people.noMail)
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('belum punya email kantor')
  })

  it('members and anonymous callers may not create login links', async () => {
    const r = await invite(tokens.member, people.guest)
    expect(r.status).toBe(403)
    const anon = await invite(anonKey, people.guest)
    expect([401, 403]).toContain(anon.status)
  })

  it('a project admin may create a link only for someone invited to their project, until it is revoked', async () => {
    // Not invited by anyone: refused.
    expect((await invite(tokens.projectAdmin, people.guest)).status).toBe(403)
    // Invited as Member of the project admin's project: allowed.
    const inv = await paClient.rpc('invite_member', {
      p: { email: mail('baru'), name: `Baru ${run}`, assignments: [{ project_id: projectId, role: 'member' }] },
    })
    expect(inv.error).toBeNull()
    const res = inv.data as unknown as { person_id: string; invitation_id: string; mode: string }
    expect(res.mode).toBe('invited')
    const r = await invite(tokens.projectAdmin, res.person_id)
    expect(r.status, r.body.error).toBe(200)
    expect(r.body.type).toBe('invite')
    // Revoked: the access and the unused login go; no new link, for anyone.
    const rev = await paClient.rpc('revoke_invitation', { p_invitation: res.invitation_id })
    expect(rev.error).toBeNull()
    expect((await invite(tokens.projectAdmin, res.person_id)).status).toBe(403)
    const again = await invite(tokens.superAdmin, res.person_id)
    expect(again.status).toBe(400)
    expect(again.body.error).toContain('dicabut')
    const member = await admin.from('project_members').select('person_id').eq('project_id', projectId).eq('person_id', res.person_id)
    expect(member.data).toEqual([])
    const pe = await admin.from('people').select('user_id').eq('id', res.person_id).single()
    expect(pe.data?.user_id).toBeNull()
    await admin.from('people').delete().eq('id', res.person_id)
  })
})
