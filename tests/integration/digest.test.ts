// M6 gate (BRIEF §10): the daily-digest Edge Function, run in dry-run mode for a workday and for a
// holiday, writes an email_log that matches the golden digest. Needs a local stack with the seed
// imported and the function reachable at DIGEST_URL (default: SUPABASE_URL/functions/v1/daily-digest).
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/data/database.types.ts'
import { createDomain } from '../../src/domain/index.ts'
import { PROTOTYPE_URL, prototypeBoard, readJson } from '../fixtures/prototype-board.ts'

const url = process.env.SUPABASE_URL ?? ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const fnUrl = process.env.DIGEST_URL ?? `${url}/functions/v1/daily-digest`
const local = /^http:\/\/(127\.0\.0\.1|localhost):/.test(url) && !!service

interface Golden {
  today: string
  digest: Record<string, { count: number; subject: string; text: string }>
  digestAll: { date: string; workday: boolean; paused: boolean; reason: string | null; emails: unknown[]; skipped: { memberId: string; name: string; reason: string }[] }
}
interface LoggedEmail {
  memberId: string
  name: string
  to: string
  count: number
  subject: string
  text: string
  status: string
}
interface Logged {
  workday: boolean
  paused: boolean
  reason: string | null
  emails: LoggedEmail[]
  skipped: { memberId: string; name: string; reason: string }[]
}

describe.skipIf(!local)('daily digest dry run (email_provider = none)', () => {
  const admin = createClient<Database>(url, service, { auth: { persistSession: false } })
  const golden = readJson<Golden>('reference/golden/prototype-golden.json')
  const legacyOf = new Map<string, string>()
  let savedContacts: { person_id: string; email: string }[] = []
  let savedAppUrl = ''

  const run = async (date: string): Promise<Logged> => {
    const res = await fetch(fnUrl, { method: 'POST', headers: { Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) })
    const body = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !body.id) throw new Error(body.error ?? `HTTP ${res.status}`)
    const log = await admin.from('email_log').select('run_date, provider, results').eq('id', body.id).single()
    if (log.error) throw new Error(log.error.message)
    expect(log.data.run_date).toBe(date)
    expect(log.data.provider).toBe('none')
    // Only the imported Margin Bridge people: other suites may add their own while this runs.
    const r = log.data.results as unknown as Logged
    const seed = <T extends { memberId: string }>(xs: T[]) =>
      xs.filter((x) => legacyOf.has(x.memberId)).map((x) => ({ ...x, memberId: legacyOf.get(x.memberId) ?? x.memberId }))
    return { ...r, emails: seed(r.emails), skipped: seed(r.skipped) }
  }

  beforeAll(async () => {
    const people = await admin.from('people').select('id, legacy_id').not('legacy_id', 'is', null)
    for (const p of people.data ?? []) if (p.legacy_id) legacyOf.set(p.id, p.legacy_id)
    const ids = [...legacyOf.keys()]
    savedContacts = ((await admin.from('people_contact').select('person_id, email').in('person_id', ids)).data ?? []).map((c) => ({ person_id: c.person_id, email: String(c.email) }))
    savedAppUrl = (await admin.from('org_settings').select('app_url').single()).data?.app_url ?? ''
    await admin.from('org_settings').update({ app_url: PROTOTYPE_URL, email_paused: false }).eq('id', true)
  })

  afterAll(async () => {
    const ids = [...legacyOf.keys()]
    await admin.from('people_contact').delete().in('person_id', ids)
    if (savedContacts.length) await admin.from('people_contact').insert(savedContacts)
    await admin.from('org_settings').update({ app_url: savedAppUrl }).eq('id', true)
  })

  it('workday without addresses: same run summary as the golden digestAll', async () => {
    await admin.from('people_contact').delete().in('person_id', [...legacyOf.keys()])
    const r = await run(golden.today)
    expect({ workday: r.workday, paused: r.paused, reason: r.reason, emails: r.emails, skipped: r.skipped }).toEqual({
      workday: golden.digestAll.workday,
      paused: golden.digestAll.paused,
      reason: golden.digestAll.reason,
      emails: golden.digestAll.emails,
      skipped: golden.digestAll.skipped,
    })
  })

  it('workday with addresses: each composed e-mail equals the golden digest for that person', async () => {
    await admin.from('people_contact').upsert([...legacyOf].map(([id, lid]) => ({ person_id: id, email: `${lid.replace('m-', '')}@digest.test` })))
    const r = await run(golden.today)
    const byMember = Object.fromEntries(r.emails.map((e) => [e.memberId, { count: e.count, subject: e.subject, text: e.text }]))
    expect(byMember).toEqual(golden.digest)
    expect(r.emails.every((e) => e.status === 'disusun')).toBe(true)
  })

  it('holiday: logged with its reason and nothing composed, as the domain says', async () => {
    const date = '2026-12-25'
    const expected = createDomain(prototypeBoard(), { today: golden.today, appUrl: PROTOTYPE_URL, viewer: null }).digestAll(date)
    const r = await run(date)
    expect({ workday: r.workday, reason: r.reason, emails: r.emails }).toEqual({ workday: expected.workday, reason: expected.reason, emails: [] })
    expect(r.reason).toBe('Hari libur: Natal')
  })
})
