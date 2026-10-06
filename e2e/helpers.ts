// End-to-end helpers: a service-role client for setup (local stacks only) and sign-in through a
// one-time magic link, which is what an invitation produces.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Database } from '../src/data/database.types.ts'

export const run = Math.random().toString(36).slice(2, 8)

export function adminClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url) || !key) throw new Error('e2e runs only against a local Supabase stack.')
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}

/** A person with an office e-mail (the database only allows logins for known e-mails). */
export async function addPerson(admin: SupabaseClient<Database>, name: string, email: string): Promise<string> {
  const p = await admin.from('people').insert({ display_name: name, job_title: 'Uji e2e' }).select('id').single()
  if (p.error) throw new Error(p.error.message)
  const c = await admin.from('people_contact').insert({ person_id: p.data.id, email })
  if (c.error) throw new Error(c.error.message)
  return p.data.id
}

/** Sign in as `email` in `page`: creates the login if needed and opens its one-time link. */
export async function signIn(page: Page, admin: SupabaseClient<Database>, email: string, baseURL: string): Promise<void> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (created.error && !/already/i.test(created.error.message)) throw new Error(created.error.message)
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: baseURL } })
  if (error) throw new Error(error.message)
  await page.goto(data.properties.action_link)
  await expect(page.getByRole('navigation', { name: 'Menu utama' })).toBeVisible({ timeout: 20_000 })
}

export async function cleanup(admin: SupabaseClient<Database>, opts: { projects?: string[]; people?: string[]; emailSuffix: string }) {
  if (opts.projects?.length) await admin.from('projects').delete().in('id', opts.projects)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((x) => x.email?.endsWith(opts.emailSuffix))) {
    await admin.from('app_roles').delete().eq('user_id', u.id).eq('role', 'group_viewer')
    await admin.auth.admin.deleteUser(u.id).catch(() => undefined)
  }
  if (opts.people?.length) await admin.from('people').delete().in('id', opts.people)
}
