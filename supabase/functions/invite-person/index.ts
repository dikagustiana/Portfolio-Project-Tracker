// Owner-only invitation (BRIEF §10 M3). Public sign-up is closed, so logins are created here.
//
// POST { person_id, mode: 'email' | 'link', redirect_to? }
//   email → Supabase sends the invite (new login) or a magic link (existing login). Needs SMTP
//           for addresses outside the Supabase team until custom SMTP is configured.
//   link  → returns a one-time link the owner can pass on (WhatsApp, Outlook) without SMTP.
//
// The caller is checked with their own JWT (whoami); only then is the service role used.
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

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: who, error: whoErr } = await caller.rpc('whoami')
  if (whoErr || !who?.is_owner) return reply(403, { error: 'Hanya owner yang bisa mengundang.' })

  let body: { person_id?: string; mode?: string; redirect_to?: string }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Permintaan tidak valid.' })
  }
  const mode = body.mode === 'link' ? 'link' : 'email'
  if (!body.person_id) return reply(400, { error: 'Pilih orangnya.' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('people').select('id, user_id, display_name').eq('id', body.person_id).maybeSingle()
  if (!person) return reply(404, { error: 'Orang ini tidak ditemukan.' })
  const { data: contact } = await admin.from('people_contact').select('email').eq('person_id', person.id).maybeSingle()
  if (!contact?.email) return reply(400, { error: `${person.display_name} belum punya email kantor. Isi dulu emailnya.` })

  const email = String(contact.email)
  const redirectTo = body.redirect_to || undefined

  if (mode === 'link') {
    const type = person.user_id ? 'magiclink' : 'invite'
    const { data, error } = await admin.auth.admin.generateLink({ type, email, options: { redirectTo } })
    if (error) return reply(400, { error: error.message })
    return reply(200, { mode, type, email, link: data.properties?.action_link ?? null })
  }

  if (person.user_id) {
    const { error } = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    if (error) return reply(400, { error: error.message })
    return reply(200, { mode, type: 'magiclink', email })
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) return reply(400, { error: error.message })
  return reply(200, { mode, type: 'invite', email })
})
