// Integrity of the reference package (BRIEF §0). These files are the spec for the domain
// port (M2) and the seed import (M5); this suite pins the facts both milestones rely on.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) as T

interface SeedTask {
  id: string
  milestoneId: string
  assignee: string
  validator: string
  committed: boolean
  steps?: string[]
  deps: string[]
}
interface SeedExport {
  projects: { id: string; name: string; entity: string; color: string }[]
  milestones: { id: string; code: string }[]
  tasks: SeedTask[]
  asks: { id: string; status: string; due: string }[]
  members: { id: string }[]
  decisions: unknown[]
  reminders: unknown[]
  settings: unknown[]
  emaillog: unknown[]
}
interface Golden {
  meta: { fixed_now: string; timezone: string }
  today: string
  tasks: { id: string }[]
  milestones: { id: string }[]
}

const seed = readJson<SeedExport>('seed/board-export.json')
const golden = readJson<Golden>('reference/golden/prototype-golden.json')
const holidays = readJson<{ holidays: { date: string; type: string }[] }>('seed/holidays.json').holidays
const entities = readJson<{ entities: { code: string }[] }>('seed/entities.json').entities
const template = readJson<{ steps: { code: string; kind: string }[] }>('seed/step-template-trading-samb.json').steps

describe('seed export matches the verification report in BRIEF §7', () => {
  const tasks = seed.tasks

  it('has the expected collection sizes', () => {
    expect(seed.projects).toHaveLength(1)
    expect(seed.milestones).toHaveLength(13)
    expect(tasks).toHaveLength(59)
    expect(seed.asks).toHaveLength(8)
    expect(seed.members).toHaveLength(4)
    expect([seed.decisions, seed.reminders, seed.settings, seed.emaillog].map((c) => c.length)).toEqual([0, 0, 0, 0])
  })

  it('has the expected task facts', () => {
    expect(tasks.filter((t) => !t.milestoneId).map((t) => t.id).sort()).toEqual(['TB-DES', 'TB-JAN', 'TB-NOV', 'TB-OKT'])
    expect(tasks.filter((t) => t.assignee)).toHaveLength(39)
    expect(tasks.filter((t) => t.validator)).toHaveLength(59)
    expect(tasks.filter((t) => t.committed)).toHaveLength(0)
    expect(tasks.filter((t) => t.steps?.length)).toHaveLength(28)
    expect(tasks.reduce((n, t) => n + (t.steps?.length ?? 0), 0)).toBe(38)
  })

  it('has exactly the three finish-to-start dependencies', () => {
    const deps = tasks.flatMap((t) => t.deps.map((d) => `${d}→${t.id}`)).sort()
    expect(deps).toEqual(['CAP-NOV→MB27', 'TB-NOV→MB27', 'TB-OKT→MB21'])
  })

  it('has eight open asks, seven due 9 Okt 2026', () => {
    expect(seed.asks.every((a) => a.status === 'open')).toBe(true)
    expect(seed.asks.filter((a) => a.due === '2026-10-09')).toHaveLength(7)
  })

  it('maps every task step onto the Trading SAMB template', () => {
    const codes = new Set(template.map((s) => s.code))
    expect(tasks.flatMap((t) => t.steps ?? []).filter((s) => !codes.has(s))).toEqual([])
  })
})

describe('supporting seed files', () => {
  it('lists 13 entities including MAM and Group', () => {
    const codes = entities.map((e) => e.code)
    expect(codes).toHaveLength(13)
    expect(codes).toEqual(expect.arrayContaining(['SAMB', 'MAM', 'Group']))
  })

  it('has the SKB holiday counts per year and type', () => {
    const count = (year: string, type: string) => holidays.filter((h) => h.date.startsWith(year) && h.type === type).length
    expect([count('2026', 'libur'), count('2026', 'cuti'), count('2027', 'libur'), count('2027', 'cuti')]).toEqual([17, 8, 18, 8])
    expect(new Set(holidays.map((h) => h.date)).size).toBe(holidays.length)
  })

  it('has the Trading SAMB template: 9 chain steps, one output, one side block', () => {
    const kinds = template.map((s) => s.kind)
    expect(kinds.filter((k) => k === 'chain')).toHaveLength(9)
    expect(template.filter((s) => s.kind !== 'chain').map((s) => `${s.code}:${s.kind}`)).toEqual(['report:output', 'lp:side'])
  })
})

describe('golden file', () => {
  it('was captured at the fixed instant, in Jakarta time', () => {
    expect(golden.meta.fixed_now).toBe('2026-10-07T08:00:00+07:00')
    expect(golden.meta.timezone).toBe('Asia/Jakarta')
    expect(golden.today).toBe('2026-10-07')
  })

  it('covers exactly the seeded tasks and milestones', () => {
    expect(golden.tasks.map((t) => t.id).sort()).toEqual(seed.tasks.map((t) => t.id).sort())
    expect(golden.milestones.map((m) => m.id).sort()).toEqual(seed.milestones.map((m) => m.id).sort())
  })
})

describe('test runtime', () => {
  it('runs on Asia/Jakarta (UTC+7, no DST)', () => {
    expect(new Date('2026-10-07T00:00:00Z').getTimezoneOffset()).toBe(-420)
    expect(new Date('2026-01-15T00:00:00Z').getTimezoneOffset()).toBe(-420)
  })
})
