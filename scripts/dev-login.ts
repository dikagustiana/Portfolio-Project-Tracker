// Local development only: create logins for people with an e-mail on file and print a one-time
// sign-in link for each, so the board can be tried as super admin, Project Admin or Member without a mailbox.
//   node --env-file=.env.local scripts/dev-login.ts [email …]
// Refuses to run against anything but a local Supabase stack.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const redirectTo = process.env.APP_URL ?? 'http://localhost:5173'
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url) || !key) {
  console.error('dev-login runs only against a local Supabase stack (SUPABASE_URL=http://127.0.0.1:54321).')
  process.exit(2)
}

const admin = createClient(url, key, { auth: { persistSession: false } })
const wanted = process.argv.slice(2)
const { data: contacts, error } = await admin.from('people_contact').select('email, people(display_name)')
if (error) throw new Error(error.message)

for (const c of contacts) {
  const email = String(c.email)
  if (wanted.length && !wanted.includes(email)) continue
  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (created.error && !/already/i.test(created.error.message)) throw new Error(created.error.message)
  const { data, error: e } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
  if (e) throw new Error(e.message)
  console.log(`${email}\t${data.properties.action_link}`)
}
