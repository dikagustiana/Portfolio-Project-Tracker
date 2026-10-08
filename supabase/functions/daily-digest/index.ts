// Daily digest (BRIEF §10 M6). Runs the app's own domain code — the same digestFor/digestAll as the
// "Minggu ini" page and the in-app preview — over all data, then logs the run in email_log. With
// email_provider = 'none' nothing is sent (dry run). pg_cron calls it every morning at the configured
// time (07.00 WIB by default); on weekends and holidays the run is logged with its reason and skipped.
//
// POST { date?: 'YYYY-MM-DD' }  — date defaults to today in Asia/Jakarta.
// Auth: the service-role key (pg_cron via Vault), or a signed-in super admin (manual run from the app).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { BOARD_TABLES, toBoard } from '../../../src/data/adapter.ts'
import type { BoardRows } from '../../../src/data/adapter.ts'
import { fetchAll } from '../../../src/data/fetch.ts'
import type { TableSource } from '../../../src/data/fetch.ts'
import { createDomain } from '../../../src/domain/index.ts'
import { providerFor } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const jakartaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Metode tidak didukung.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Konfigurasi fungsi belum lengkap.' })

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
  let trigger: 'cron' | 'super_admin'
  if (sameSecret(bearer, serviceKey) || sameSecret(bearer, secretKey)) trigger = 'cron'
  else {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } })
    const { data: who } = await caller.rpc('whoami')
    if (!who?.is_super_admin) return reply(403, { error: 'Hanya super admin atau jadwal otomatis yang bisa menjalankan email harian.' })
    trigger = 'super_admin'
  }

  let body: { date?: string } = {}
  try {
    body = (await req.json()) as { date?: string }
  } catch {
    /* empty body: today */
  }
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : jakartaToday()

  // Everything, as the service role: the digest needs every person's tasks and e-mail address.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const source = admin as unknown as TableSource
  const rows = Object.fromEntries(await Promise.all(BOARD_TABLES.map(async (t) => [t, await fetchAll(source, t)] as const))) as unknown as BoardRows
  const { board, extras } = toBoard(rows)
  const settings = rows.org_settings[0]
  const appUrl = extras.appUrl || Deno.env.get('APP_URL') || ''
  const d = createDomain(board, { today: date, appUrl, viewer: null })
  const run = d.digestAll(date)

  const providerName = settings?.email_provider ?? 'none'
  const provider = providerFor(providerName)
  const sent: { memberId: string; status: string; error?: string }[] = []
  if (provider && run.workday && !run.paused) {
    for (const e of run.emails) {
      const r = await provider.send(e.to, e.subject, e.text, e.html)
      sent.push({ memberId: e.memberId, status: r.ok ? 'terkirim' : 'gagal', ...(r.error ? { error: r.error } : {}) })
    }
  }

  // Logged without the HTML bodies (the text carries the same content).
  const results = {
    trigger,
    workday: run.workday,
    paused: run.paused,
    reason: run.reason,
    emails: run.emails.map(({ html: _html, ...e }) => ({ ...e, status: provider ? (sent.find((s) => s.memberId === e.memberId)?.status ?? 'tidak dikirim') : 'disusun' })),
    skipped: run.skipped,
    reminders: run.reminders.map(({ html: _html, ...r }) => r),
    reminderSkips: run.reminderSkips,
  }
  const log = await admin.from('email_log').insert({ run_date: date, provider: providerName, results }).select('id').single()
  if (log.error) return reply(500, { error: log.error.message })

  return reply(200, {
    id: log.data.id,
    date,
    provider: providerName,
    workday: run.workday,
    paused: run.paused,
    reason: run.reason,
    emails: run.emails.length,
    skipped: run.skipped.length,
  })
})
