// Login links for invited people (docs/ARCHITECTURE.md §K). Public sign-up is closed, so logins
// are created here.
//
// POST { person_id, mode: 'email' | 'link', redirect_to? }
//   email → Supabase sends the invite (new login) or a magic link (existing login). Needs SMTP
//           for addresses outside the Supabase team until custom SMTP is configured.
//   link  → returns a one-time link the caller can pass on (WhatsApp, Outlook) without SMTP.
//
// Who may do this is decided by the database, with the caller's own JWT: login_link_target lets
// the super admin through, and a Project Admin only for someone with a pending invitation to one of
// their projects; it also refuses revoked or expired invitations. Only then is the service role
// used, and only for the auth call.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Metode tidak didukung.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Konfigurasi fungsi belum lengkap.' })
  if (!authHeader) return reply(401, { error: 'Kamu perlu masuk dulu.' })

  let body: { person_id?: string; mode?: string; redirect_to?: string }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Permintaan tidak valid.' })
  }
  const mode = body.mode === 'link' ? 'link' : 'email'
  if (!body.person_id) return reply(400, { error: 'Pilih orangnya.' })

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: target, error: denied } = await caller.rpc('login_link_target', { p_person: body.person_id })
  if (denied) {
    const status = denied.code === '42501' ? 403 : denied.code === 'P0002' ? 404 : 400
    return reply(status, { error: denied.message })
  }
  const { email, has_login: hasLogin } = target as { email: string; has_login: boolean }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const redirectTo = body.redirect_to || undefined

  if (mode === 'link') {
    const type = hasLogin ? 'magiclink' : 'invite'
    const { data, error } = await admin.auth.admin.generateLink({ type, email, options: { redirectTo } })
    if (error) return reply(400, { error: error.message })
    return reply(200, { mode, type, email, link: data.properties?.action_link ?? null })
  }

  if (hasLogin) {
    const { error } = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    if (error) return reply(400, { error: error.message })
    return reply(200, { mode, type: 'magiclink', email })
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) return reply(400, { error: error.message })
  return reply(200, { mode, type: 'invite', email })
})
