// Renders a Domain into the shape of reference/golden/prototype-golden.json, so any board
// (the seed fixture, or rows read back from the database) can be compared with it in one assertion.
import type { Domain, Inbox, Milestone, Project, Task } from '../../src/domain/index.ts'

interface GoldenShape {
  today: string
  tasks: { id: string }[]
  milestones: { id: string }[]
  projects: { id: string }[]
  inbox: Record<string, unknown>
  valueChain: Record<string, unknown>
  digest: Record<string, unknown>
  digestAll: Record<string, unknown>
  calendar: { date: string }[]
  calendar_ranges: { from: string; to: string }[]
}

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id)
const inbox = (ib: Inbox) => ({
  toValidate: ids(ib.toValidate),
  gates: ids(ib.gates),
  stops: ids(ib.stops),
  closes: ids(ib.closes),
  asks: ids(ib.asks),
  commits: ids(ib.commits),
  rejected: ids(ib.rejected),
  n: ib.n,
})

/** The domain's values for exactly the entries and keys the golden file holds. */
export function goldenSnapshot(d: Domain, golden: GoldenShape) {
  const task = (t: Task) => {
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
  const milestone = (m: Milestone) => ({
    id: m.id,
    msNo: d.msNo(m),
    msState: d.msState(m),
    msDate: d.msDate(m),
    msLate: d.msLate(m),
    approverOf: d.approverOf(m),
  })
  const project = (p: Project) => {
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
  const must = <T>(x: T | undefined, what: string): T => {
    if (x === undefined) throw new Error(`missing ${what}`)
    return x
  }
  const p0 = must(d.project(must(golden.projects[0], 'project').id), 'project')
  const run: Record<string, unknown> = { ...d.digestAll(golden.today) }
  return {
    tasks: golden.tasks.map((g) => task(must(d.task(g.id), `task ${g.id}`))),
    milestones: golden.milestones.map((g) => milestone(must(d.mstone(g.id), `milestone ${g.id}`))),
    projects: golden.projects.map((g) => project(must(d.project(g.id), `project ${g.id}`))),
    inbox: Object.fromEntries(Object.keys(golden.inbox).map((who) => [who, inbox(d.inbox(who === 'all' ? '*' : who))])),
    valueChain: Object.fromEntries(Object.keys(golden.valueChain).map((code) => [code, d.vcStat(p0.id, code)])),
    digest: Object.fromEntries(
      Object.keys(golden.digest).map((who) => {
        const dg = must(d.digestFor(who, golden.today) ?? undefined, `digest ${who}`)
        const mail = d.emailFor(dg)
        return [who, { count: dg.count, subject: mail.subject, text: mail.text }]
      }),
    ),
    digestAll: Object.fromEntries(Object.keys(golden.digestAll).map((k) => [k, run[k] ?? null])),
    calendar: golden.calendar.map(({ date }) => {
      const h = d.hol(date)
      return { date, isWork: d.isWork(date), holiday: h ? { type: h.type, name: h.name } : null }
    }),
    calendar_ranges: golden.calendar_ranges.map((g) => ({ from: g.from, to: g.to, workdays: d.workdays(g.from, g.to) })),
  }
}
