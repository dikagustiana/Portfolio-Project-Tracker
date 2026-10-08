// Login links for an invited person, through the invite-person Edge Function (it checks the
// caller with login_link_target and only then uses the service role).
import type { Supa } from '../lib/supabase.ts'

export async function sendLoginLink(
  supa: Supa,
  personId: string,
  mode: 'email' | 'link',
): Promise<{ ok: true; link: string | null } | { ok: false; error: string }> {
  const res = await supa.functions.invoke<{ link?: string | null }>('invite-person', {
    body: { person_id: personId, mode, redirect_to: window.location.origin },
  })
  const error = res.error as (Error & { context?: Response }) | null
  if (error) {
    let msg = error.message
    try {
      const body = (await error.context?.json()) as { error?: string } | undefined
      if (body?.error) msg = body.error
    } catch {
      /* keep the generic message */
    }
    return { ok: false, error: msg }
  }
  return { ok: true, link: res.data?.link ?? null }
}
