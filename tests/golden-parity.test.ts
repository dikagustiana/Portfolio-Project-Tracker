// Golden parity (BRIEF §9): the domain port must reproduce every value the prototype returned on the
// seed data with the clock fixed at 2026-10-07T08:00:00+07:00, prototype in local mode (no
// signed-in user, so viewer: null). parallelGates=false and cutiIsWorkday=false: 100% match.
import { describe, expect, it } from 'vitest'
import { createDomain } from '../src/domain/index.ts'
import type { Domain, Inbox, Milestone, Project, Task } from '../src/domain/index.ts'
import { PROJECT_ID, PROTOTYPE_URL, prototypeBoard, readJson } from './fixtures/prototype-board.ts'

type Flag = [number, string]
interface GoldenTask {
  id: string
  isLate: boolean
  needsCommit: boolean
  validatorOf: string
  selfAccept: boolean
  durDays: number
  workdays: number
  seqConflict: { prevMilestone: string; prevEnd: string } | null
  taskFlags: Flag[]
  warnings: string[]
}
interface GoldenMilestone {
  id: string
  msNo: string
  msState: string
  msDate: string | null
  msLate: boolean
  approverOf: string
}
interface GoldenProject {
  id: string
  prog: { d: number; n: number; p: number }
  health: { level: string; label: string; items: string[] } | null
  readiness: { milestone: string; ok: number; n: number; ready: boolean } | null
  currentMs: string | null
  readyToClose: boolean
}
type GoldenInbox = Record<Exclude<keyof Inbox, 'n'>, string[]> & { n: number }
interface Golden {
  meta: { fixed_now: string; timezone: string }
  today: string
  tasks: GoldenTask[]
  milestones: GoldenMilestone[]
  projects: GoldenProject[]
  inbox: Record<string, GoldenInbox>
  valueChain: Record<string, unknown>
  digest: Record<string, { count: number; subject: string; text: string }>
  digestAll: Record<string, unknown>
  calendar: { date: string; isWork: boolean; holiday: { type: string; name: string } | null }[]
  calendar_ranges: { from: string; to: string; workdays: number }[]
}

const golden = readJson<Golden>('reference/golden/prototype-golden.json')
const board = prototypeBoard()
const d: Domain = createDomain(board, { today: golden.today, appUrl: PROTOTYPE_URL, viewer: null })

const must = <T>(x: T | null | undefined, what: string): T => {
  if (x === null || x === undefined) throw new Error(`missing ${what}`)
  return x
}
const ids = (xs: readonly { id: string }[]): string[] => xs.map((x) => x.id)

// Serializers: the shape the golden file recorded for each prototype function.
const serTask = (t: Task): GoldenTask => {
  const p = d.project(t.projectId)
  const sc = d.seqConflict(t)
  return {
    id: t.id,
    isLate: d.isLate(t),
    needsCommit: d.needsCommit(t),
    validatorOf: d.validatorOf(t),
    selfAccept: d.selfAccept(t),
    durDays: d.durDays(t),
    workdays: d.workdays(t.start, t.end),
    seqConflict: sc ? { prevMilestone: sc.pv.id, prevEnd: sc.pe } : null,
    taskFlags: d.taskFlags(t, p),
    warnings: d.warnings(t, p),
  }
}
const serMilestone = (m: Milestone): GoldenMilestone => ({
  id: m.id,
  msNo: d.msNo(m),
  msState: d.msState(m),
  msDate: d.msDate(m),
  msLate: d.msLate(m),
  approverOf: d.approverOf(m),
})
const serProject = (p: Project): GoldenProject => {
  const r = d.readiness(p)
  return {
    id: p.id,
    prog: d.prog(p.id),
    health: d.health(p),
    readiness: r ? { milestone: r.m.id, ok: r.ok, n: r.n, ready: r.ready } : null,
    currentMs: d.currentMs(p)?.id ?? null,
    readyToClose: d.readyToClose(p),
  }
}
const serInbox = (ib: Inbox): GoldenInbox => ({
  toValidate: ids(ib.toValidate),
  gates: ids(ib.gates),
  stops: ids(ib.stops),
  closes: ids(ib.closes),
  asks: ids(ib.asks),
  commits: ids(ib.commits),
  rejected: ids(ib.rejected),
  n: ib.n,
})

describe('golden file', () => {
  it('was captured at the instant the domain is given', () => {
    expect(golden.meta.fixed_now).toBe('2026-10-07T08:00:00+07:00')
    expect(golden.meta.timezone).toBe('Asia/Jakarta')
    expect(golden.today).toBe('2026-10-07')
  })

  it('covers every task, milestone and project of the board', () => {
    expect(golden.tasks.map((t) => t.id).sort()).toEqual(ids(board.tasks).sort())
    expect(golden.milestones.map((m) => m.id).sort()).toEqual(ids(board.milestones).sort())
    expect(golden.projects.map((p) => p.id)).toEqual(ids(board.projects))
  })
})

describe('tasks: isLate, needsCommit, validatorOf, selfAccept, durDays, workdays, seqConflict, taskFlags, warnings', () => {
  it.each(golden.tasks.map((g) => [g.id, g] as const))('%s', (id, g) => {
    expect(serTask(must(d.task(id), `task ${id}`))).toEqual(g)
  })
})

describe('milestones: msNo, msState, msDate, msLate, approverOf', () => {
  it.each(golden.milestones.map((g) => [g.id, g] as const))('%s', (id, g) => {
    expect(serMilestone(must(d.mstone(id), `milestone ${id}`))).toEqual(g)
  })
})

describe('projects: prog, health, readiness, currentMs, readyToClose', () => {
  it.each(golden.projects.map((g) => [g.id, g] as const))('%s', (id, g) => {
    expect(serProject(must(d.project(id), `project ${id}`))).toEqual(g)
  })
})

describe('inbox', () => {
  it.each(Object.entries(golden.inbox))('%s', (who, g) => {
    expect(serInbox(d.inbox(who === 'all' ? '*' : who))).toEqual(g)
  })
})

describe('value chain', () => {
  it('vcStat for every template step', () => {
    const p = must(d.project(PROJECT_ID), 'project')
    const steps = must(d.vcSteps(p), 'template').all
    expect(Object.fromEntries(steps.map((s) => [s.code, d.vcStat(p.id, s.code)]))).toEqual(golden.valueChain)
  })
})

describe('digest per member (digestFor + emailFor)', () => {
  it.each(Object.entries(golden.digest))('%s', (memberId, g) => {
    const dg = must(d.digestFor(memberId, golden.today), `digest ${memberId}`)
    const mail = d.emailFor(dg)
    expect({ count: dg.count, subject: mail.subject, text: mail.text }).toEqual(g)
  })
})

describe('digestAll', () => {
  it(`on ${golden.today}`, () => {
    const run: Record<string, unknown> = { ...d.digestAll(golden.today) }
    expect(Object.fromEntries(Object.keys(golden.digestAll).map((k) => [k, run[k] ?? null]))).toEqual(golden.digestAll)
  })
})

describe('calendar', () => {
  it.each(golden.calendar.map((g) => [g.date, g] as const))('isWork and hol on %s', (date, g) => {
    const h = d.hol(date)
    expect({ date, isWork: d.isWork(date), holiday: h ? { type: h.type, name: h.name } : null }).toEqual(g)
  })

  it.each(golden.calendar_ranges.map((g) => [`${g.from}..${g.to}`, g] as const))('workdays %s', (_, g) => {
    expect({ from: g.from, to: g.to, workdays: d.workdays(g.from, g.to) }).toEqual(g)
  })
})
