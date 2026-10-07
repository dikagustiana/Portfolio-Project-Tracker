// The architecture pass in the domain (docs/ARCHITECTURE.md §E, §G, §H): leaf progress, packages,
// typed dependencies, views, Quick Find and record addresses, on the prototype board extended with
// sub-tasks. The golden parity suite proves nothing changed for projects without sub-tasks.
import { describe, expect, it } from 'vitest'
import { createDomain } from '../src/domain/index.ts'
import type { Board, Blocker, Commitment, Domain, Stage, Task, Viewer } from '../src/domain/index.ts'
import { PROJECT_ID, PROTOTYPE_URL, prototypeBoard } from './fixtures/prototype-board.ts'

const TODAY = '2026-10-07'
const must = <T>(x: T | undefined | null, what = 'value'): T => {
  if (x === undefined || x === null) throw new Error(`missing ${what}`)
  return x
}
const viewer = (personId: string | null, isSuperAdmin = false): Viewer => ({ userId: `u-${personId ?? 'x'}`, personId, isSuperAdmin })
const domain = (b: Board, v: Viewer | null = null): Domain => createDomain(b, { today: TODAY, appUrl: PROTOTYPE_URL, viewer: v })

/** A sub-task of `parent`, as the extraction or the task form creates it. */
function child(parent: Task, n: number, stage: Stage, extra: Partial<Task> = {}): Task {
  return {
    ...parent,
    id: `${parent.id}.${n}`,
    ref: `${parent.ref}.${n}`,
    parentId: parent.id,
    title: `${parent.title} · bagian ${n}`,
    stage,
    committed: false,
    deps: [],
    acceptDeps: [],
    steps: [],
    acceptedAt: stage === 'done' ? Date.parse('2026-10-06T10:00:00+07:00') : null,
    doneAt: stage === 'done' ? Date.parse('2026-10-06T10:00:00+07:00') : null,
    ...extra,
  }
}

/** Prototype board where MB05 (Yani, G0) gets three sub-tasks, two accepted. */
function withPackage(): Board {
  const b = prototypeBoard()
  const mb05 = must(b.tasks.find((t) => t.id === 'MB05'))
  b.tasks.push(child(mb05, 1, 'done'), child(mb05, 2, 'done'), child(mb05, 3, 'todo'))
  return b
}

describe('progress over leaf tasks (ARCHITECTURE §E)', () => {
  it('case 1: a task without sub-tasks is its own unit', () => {
    const d = domain(prototypeBoard())
    const t = must(d.task('MB01'))
    expect(d.isLeaf(t)).toBe(true)
    expect(d.taskProg(t)).toEqual({ d: 0, n: 1, p: 0 })
    expect(d.prog(PROJECT_ID)).toEqual({ d: 0, n: 59, p: 0 })
  })

  it('case 2: a package with 3 sub-tasks, 2 accepted, is 67% and not counted itself', () => {
    const d = domain(withPackage())
    const mb05 = must(d.task('MB05'))
    expect(d.hasChildren(mb05)).toBe(true)
    expect(d.isLeaf(mb05)).toBe(false)
    expect(d.taskProg(mb05)).toEqual({ d: 2, n: 3, p: 67 })
  })

  it('case 3: mixed packages and standalone tasks count leaves only (58 standalone + 3 sub-tasks)', () => {
    const d = domain(withPackage())
    expect(d.leaves(PROJECT_ID)).toHaveLength(61)
    expect(d.prog(PROJECT_ID)).toEqual({ d: 2, n: 61, p: 3 })
    const g0 = must(d.mstone('G0'))
    expect(d.msProg(g0).n).toBe(d.mtasks(g0.id).filter(d.isLeaf).length)
  })

  it('case 4: a value-chain step spanning several tasks counts its leaves; sub-tasks inherit their package steps', () => {
    const b = prototypeBoard()
    const store = b.tasks.filter((t) => t.steps.includes('store'))
    expect(store.map((t) => t.id)).toEqual(['CAP-NOV', 'MB11', 'MB12', 'MB16'])
    const mb12 = must(b.tasks.find((t) => t.id === 'MB12'))
    mb12.stage = 'done'
    b.tasks.push(child(must(b.tasks.find((t) => t.id === 'MB11')), 1, 'done'), child(must(b.tasks.find((t) => t.id === 'MB11')), 2, 'review'))
    const d = domain(b)
    const m = d.vcModule(PROJECT_ID, 'store')
    expect(m.stat.n).toBe(5) // CAP-NOV, MB12, MB16 and MB11's two sub-tasks (MB11 itself is a package now)
    expect(m.prog).toEqual({ d: 2, n: 5, p: 40 })
    expect(m.stat.rev).toBe(1)
    expect(d.vcStat(PROJECT_ID, 'store')).toEqual(m.stat)
  })

  it('case 5: the same number everywhere — prog, portfolio row and the sum of milestone progress', () => {
    const d = domain(withPackage())
    const row = must(d.portfolio().find((r) => r.p.id === PROJECT_ID))
    expect(row.prog).toEqual(d.prog(PROJECT_ID))
    const ms = d.pms(PROJECT_ID)
    const loose = d.leaves(PROJECT_ID).filter((t) => !t.milestoneId)
    const sum = ms.reduce((n, m) => n + d.msProg(m).n, 0) + loose.length
    expect(sum).toBe(d.prog(PROJECT_ID).n)
  })

  it('case 5: a project not on the board (no membership) appears nowhere', () => {
    const b = withPackage()
    const visible = { ...b, projects: [], tasks: [], milestones: [], asks: [] }
    const d = domain(visible, viewer('m-yani'))
    expect(d.portfolio()).toEqual([])
    expect(d.search('MB05')).toEqual([])
    expect(d.search('Margin')).toEqual([])
    expect(d.actions()).toEqual([])
    expect(d.resolveProject('MB')).toBe('')
  })

  it('a package needs no commitment of its own; its sub-tasks do', () => {
    const d = domain(withPackage())
    expect(d.needsCommit(must(d.task('MB05')))).toBe(false)
    expect(d.needsCommit(must(d.task('MB05.3')))).toBe(true)
    expect(d.inbox('m-yani').commits.map((t) => t.id)).not.toContain('MB05')
  })
})

describe('packages and dependencies', () => {
  it('a package is ready to submit once every sub-task is accepted, and waits for them before acceptance', () => {
    const b = withPackage()
    const d1 = domain(b)
    expect(d1.packageReady(must(d1.task('MB05')))).toBe(false)
    expect(d1.waitingToAccept(must(d1.task('MB05'))).map((t) => t.id)).toEqual(['MB05.3'])
    must(b.tasks.find((t) => t.id === 'MB05.3')).stage = 'done'
    const d2 = domain(b)
    expect(d2.packageReady(must(d2.task('MB05')))).toBe(true)
    expect(d2.actions('m-yani').filter((a) => a.kind === 'submit-package').map((a) => a.ref)).toEqual(['MB05'])
  })

  it('start dependencies hold the start; acceptance dependencies only the acceptance', () => {
    const b = prototypeBoard()
    const t = must(b.tasks.find((x) => x.id === 'MB05'))
    t.deps = ['MB01']
    t.acceptDeps = ['MB02']
    const d = domain(b)
    expect(d.waitingToStart(t).map((x) => x.id)).toEqual(['MB01'])
    expect(d.waitingToAccept(t).map((x) => x.id)).toEqual(['MB01', 'MB02'])
    expect(d.taskFlags(t, d.project(t.projectId)).map((f) => f[1])).toContain('Diterima setelah: MB02')
  })

  it('a sub-task outside its package dates is flagged', () => {
    const b = withPackage()
    const c = must(b.tasks.find((t) => t.id === 'MB05.3'))
    c.end = '2026-12-01'
    const d = domain(b)
    expect(d.taskFlags(c, d.project(c.projectId)).map((f) => f[1])).toContain('Di luar jadwal paket MB05')
  })

  it('a sub-task without its own pemeriksa is checked by its package\'s pemeriksa', () => {
    const b = withPackage()
    must(b.tasks.find((t) => t.id === 'MB05')).validator = 'm-david'
    const c = must(b.tasks.find((t) => t.id === 'MB05.3'))
    c.validator = ''
    expect(domain(b).validatorOf(c)).toBe('m-david')
  })
})

describe('history: commitment slip', () => {
  const at = (day: string) => Date.parse(`${day}T10:00:00+07:00`)
  const c = (seq: number, end: string, when: string, start = '2026-10-05'): Commitment => ({
    id: `c${seq}`,
    seq,
    projectId: PROJECT_ID,
    taskId: 'MB05',
    start,
    end,
    by: 'm-yani',
    at: at(when),
  })

  it('original 10 Okt, current 17 Okt: slip 7 days, listed in the review of the week it moved', () => {
    const b = prototypeBoard()
    const t = must(b.tasks.find((x) => x.id === 'MB05'))
    t.end = '2026-10-17'
    b.commitments = [c(1, '2026-10-10', '2026-09-20'), c(2, '2026-10-17', '2026-10-05')]
    const s = must(domain(b).slip(t))
    expect([s.baseline.end, s.latest.end, s.days, s.count]).toEqual(['2026-10-10', '2026-10-17', 7, 2])
    expect(domain(b).review('2026-10-01', '2026-10-07').slipped.map((x) => [x.t.id, x.from, x.to, x.days])).toEqual([['MB05', '2026-10-10', '2026-10-17', 7]])
    // A review of an earlier window does not list a move made later.
    expect(domain(b).review('2026-09-14', '2026-09-30').slipped).toEqual([])
  })

  it('a plan date moved without a new commitment is not a slip', () => {
    const b = prototypeBoard()
    const t = must(b.tasks.find((x) => x.id === 'MB05'))
    t.end = '2026-12-31'
    b.commitments = [c(1, '2026-10-10', '2026-10-02')]
    expect(must(domain(b).slip(t)).days).toBe(0)
    expect(domain(b).review('2026-10-01', '2026-10-07').slipped).toEqual([])
  })
})

describe('views (ARCHITECTURE §H)', () => {
  const blocker = (taskId: string, extra: Partial<Blocker> = {}): Blocker => ({
    id: `b-${taskId}`,
    projectId: PROJECT_ID,
    taskId,
    reason: 'Data belum ada',
    need: 'Ekstrak SAP',
    neededFromPerson: '',
    neededFromFunction: '',
    target: '2026-10-09',
    raisedBy: 'm-yani',
    raisedAt: Date.parse('2026-10-05T09:00:00+07:00'),
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
    askId: '',
    ...extra,
  })

  it('Perlu tindakan extends the inbox (same items) and adds blockers that need the person', () => {
    const b = prototypeBoard()
    b.blockers = [blocker('MB05', { neededFromPerson: 'm-muti' })]
    const d = domain(b)
    const ib = d.inbox('m-muti')
    const acts = d.actions('m-muti')
    expect(acts.filter((a) => a.kind !== 'blocker')).toHaveLength(ib.n)
    expect(acts.filter((a) => a.kind === 'blocker').map((a) => a.ref)).toEqual(['MB05'])
    const whens = acts.map((a) => a.when)
    expect([...whens].sort()).toEqual(whens) // by the date that makes each urgent: due, start, submitted, target
  })

  it('an unnamed blocker goes to the project admins, not to the PIC who raised it', () => {
    const b = prototypeBoard()
    b.blockers = [blocker('MB05')]
    const d = domain(b)
    expect(d.actions('m-dika').some((a) => a.kind === 'blocker')).toBe(true)
    expect(d.actions('m-yani').some((a) => a.kind === 'blocker')).toBe(false)
    expect(d.waiting('m-yani').map((w) => [w.kind, w.ref, w.onLabel])).toContainEqual(['blocker', 'MB05', 'Butuh Project Admin'])
  })

  it('a blocker left open on an accepted task no longer counts anywhere', () => {
    const b = prototypeBoard()
    b.blockers = [blocker('MB05')]
    const mb05 = must(b.tasks.find((t) => t.id === 'MB05'))
    mb05.stage = 'done'
    mb05.acceptedAt = Date.parse('2026-10-06T10:00:00+07:00')
    const d = domain(b)
    expect(d.isBlocked(mb05)).toBe(false)
    expect(d.actions('m-dika').some((a) => a.kind === 'blocker')).toBe(false)
    expect(d.blockedList()).toEqual([])
    expect(d.portfolio()[0]?.blocked).toBe(0)
  })

  it('a rejected package whose sub-tasks are accepted is one action (rework), not two', () => {
    const b = withPackage()
    const mb05 = must(b.tasks.find((t) => t.id === 'MB05'))
    must(b.tasks.find((t) => t.id === 'MB05.3')).stage = 'done'
    mb05.rejectReason = 'Bukti kurang'
    mb05.rejectedAt = Date.parse('2026-10-06T10:00:00+07:00')
    const acts = domain(b).actions('m-yani').filter((a) => a.ref === 'MB05')
    expect(acts.map((a) => a.kind)).toEqual(['rework'])
  })

  it('the viewer\'s badge view equals the list it opens', () => {
    const d = domain(prototypeBoard(), viewer('m-yani'))
    expect(d.actions('')).toEqual(d.actions('m-yani'))
  })

  it('Kerja saya: open leaf work of the PIC, by deadline; not tasks waiting for review', () => {
    const b = withPackage()
    const mb04 = must(b.tasks.find((t) => t.id === 'MB04'))
    mb04.stage = 'review'
    mb04.submittedAt = Date.parse('2026-10-06T08:00:00+07:00')
    const d = domain(b)
    const mine = d.myWork('m-yani').map((t) => t.id)
    expect(mine).toContain('MB05.3')
    expect(mine).not.toContain('MB05')
    expect(mine).not.toContain('MB04')
    const ends = d.myWork('m-yani').map((t) => t.end)
    expect([...ends].sort()).toEqual(ends)
    expect(d.waiting('m-yani').map((w) => [w.kind, w.ref])).toContainEqual(['review', 'MB04'])
  })

  it('Menunggu orang lain: a prerequisite the person owns is their own work, not a wait', () => {
    const b = withPackage()
    const one = must(b.tasks.find((t) => t.id === 'MB05.1'))
    const two = must(b.tasks.find((t) => t.id === 'MB05.3'))
    one.stage = 'todo'
    one.acceptedAt = null
    one.doneAt = null
    two.deps = ['MB05.1']
    const d = domain(b)
    // Both belong to Yani: waiting on herself is not "waiting on others".
    expect(d.waiting('m-yani').some((w) => w.kind === 'dependency' && w.ref === 'MB05.3')).toBe(false)
    one.assignee = 'm-muti'
    const d2 = domain(b)
    expect(d2.waiting('m-yani').find((w) => w.kind === 'dependency' && w.ref === 'MB05.3')?.on).toBe('m-muti')
    // Everyone's view keeps it.
    expect(d.waiting('*').some((w) => w.kind === 'dependency' && w.ref === 'MB05.3')).toBe(true)
  })

  it('Milik fungsi saya: unassigned work of the person\'s function', () => {
    const b = prototypeBoard()
    b.functions = [{ id: 'f-com', name: 'Commercial', sort: 1 }]
    must(b.people.find((p) => p.id === 'm-yani')).functionId = 'f-com'
    const t = must(b.tasks.find((x) => x.id === 'MB01'))
    t.ownerFunctionId = 'f-com'
    const d = domain(b)
    expect(d.functionWork('m-yani').map((x) => x.id)).toEqual(['MB01'])
    expect(d.unstaffed().map((x) => x.id)).toEqual(['MB01'])
    expect(d.functionLoad()).toEqual([{ functionId: 'f-com', name: 'Commercial', open: 1, unstaffed: 1, late: 0, blocked: 0, people: 1 }])
  })

  it('Minggu ini follows the selected week, apart from Perlu tindakan', () => {
    const d = domain(prototypeBoard())
    const thisWeek = d.week('2026-10-05', 'm-yani')
    const nextWeek = d.week('2026-10-12', 'm-yani')
    expect(thisWeek.every((x) => x.date >= '2026-10-05' && x.date <= '2026-10-11')).toBe(true)
    expect(nextWeek.every((x) => x.date >= '2026-10-12' && x.date <= '2026-10-18')).toBe(true)
    expect(nextWeek.map((x) => x.key)).not.toEqual(thisWeek.map((x) => x.key))
  })

  it('Project saya: involvement, not visibility — the super admin without a role is not involved', () => {
    const b = prototypeBoard()
    expect(domain(b, viewer('m-yani')).involved(PROJECT_ID)).toBe(true)
    expect(domain(b, viewer(null, true)).involved(PROJECT_ID)).toBe(false)
    const asViewer = { ...b, memberships: b.memberships.map((m) => (m.personId === 'm-muti' ? { ...m, role: 'viewer' as const } : m)) }
    expect(domain(asViewer, viewer('m-muti')).involved(PROJECT_ID)).toBe(false)
  })

  it('portfolio filters', () => {
    const d = domain(prototypeBoard(), viewer('m-yani'))
    const rows = d.portfolio()
    expect(d.portfolioFilter(rows, 'all')).toHaveLength(1)
    expect(d.portfolioFilter(rows, 'mine')).toHaveLength(1)
    expect(d.portfolioFilter(rows, 'done')).toHaveLength(0)
    expect(d.portfolioFilter(rows, 'all', 'tidak ada')).toHaveLength(0)
    expect(d.portfolioFilter(rows, 'all', 'margin')).toHaveLength(1)
  })
})

describe('Quick Find and addresses (ARCHITECTURE §G)', () => {
  const d = domain(withPackage(), viewer('m-yani'))

  it('an exact short id ranks first, case-insensitive', () => {
    expect(d.search('mb12')[0]).toMatchObject({ kind: 'task', id: 'MB12', ref: 'MB12' })
    expect(d.search('G3')[0]).toMatchObject({ kind: 'gate', id: 'G3' })
    expect(d.search('K01')[0]).toMatchObject({ kind: 'ask', id: 'K01' })
    expect(d.search('MB05.2')[0]).toMatchObject({ kind: 'task', id: 'MB05.2' })
  })

  it('a ref prefix beats a title match; a title prefix beats a word inside', () => {
    const hits = d.search('MB1').map((h) => h.ref)
    expect(hits.slice(0, 3).every((r) => r.startsWith('MB1'))).toBe(true)
    expect(d.search('Reconcile')[0]?.title.startsWith('Reconcile')).toBe(true)
  })

  it('a project-scoped query and people', () => {
    expect(d.search('MB MB12')[0]?.id).toBe('MB12')
    expect(d.search('yan').some((h) => h.kind === 'person' && h.id === 'm-yani')).toBe(true)
  })

  it('addresses: path, absolute link and resolution by ref', () => {
    expect(d.pathOf({ kind: 'task', id: 'MB05.1' })).toBe('#/p/MB/t/MB05.1')
    expect(d.pathOf({ kind: 'gate', id: 'G3' })).toBe('#/p/MB/g/G3')
    expect(d.pathOf({ kind: 'ask', id: 'K01' })).toBe('#/p/MB/k/K01')
    expect(d.pathOf({ kind: 'project', id: PROJECT_ID })).toBe('#/p/MB')
    expect(d.urlOf({ kind: 'task', id: 'MB12' })).toBe(`${PROTOTYPE_URL}/#/p/MB/t/MB12`)
    expect(d.resolveProject('mb')).toBe(PROJECT_ID)
    expect(d.resolveRecord(PROJECT_ID, 'task', 'mb05.1')).toBe('MB05.1')
    expect(d.resolveRecord(PROJECT_ID, 'gate', 'g3')).toBe('G3')
    expect(d.resolveRecord(PROJECT_ID, 'task', 'nope')).toBe('')
    expect(d.pathOf({ kind: 'task', id: 'missing' })).toBe('')
  })
})

describe('record-level rights (ARCHITECTURE §D)', () => {
  const b = withPackage()
  for (const p of b.people) p.userId = `u-${p.id}`

  it('the package PIC plans its sub-tasks; another member does not', () => {
    const yani = domain(b, viewer('m-yani'))
    const muti = domain(b, viewer('m-muti'))
    const mb05 = must(yani.task('MB05'))
    const sub = must(yani.task('MB05.3'))
    expect(yani.canAddChild(mb05)).toBe(true)
    expect(yani.canPlanTask(sub)).toBe(true)
    expect(yani.canPlanTask(mb05)).toBe(false)
    expect(muti.canAddChild(mb05)).toBe(false)
    expect(muti.canPlanTask(sub)).toBe(false)
    expect(yani.canAddChild(sub)).toBe(false)
  })

  it('blockers: the PIC raises; the person needed, the raiser or an admin resolves', () => {
    const t = must(b.tasks.find((x) => x.id === 'MB05.3'))
    const bl: Blocker = { ...{ id: 'x', projectId: PROJECT_ID, taskId: t.id, reason: 'r', need: '', neededFromPerson: 'm-muti', neededFromFunction: '', target: '', raisedBy: 'm-yani', raisedAt: 0, resolvedBy: null, resolvedAt: null, resolution: null, askId: '' } }
    expect(domain(b, viewer('m-yani')).canBlock(t)).toBe(true)
    expect(domain(b, viewer('m-muti')).canBlock(t)).toBe(false)
    expect(domain(b, viewer('m-muti')).canResolveBlocker(bl, t)).toBe(true)
    expect(domain(b, viewer('m-david')).canResolveBlocker(bl, t)).toBe(true)
  })

  it('a Keputusan is edited by its creator or an admin; decided by its decider', () => {
    const a = { ...must(b.asks[0]), createdBy: 'm-muti', decider: 'm-yani' }
    expect(domain(b, viewer('m-muti')).canEditAsk(a)).toBe(true)
    expect(domain(b, viewer('m-yani')).canEditAsk(a)).toBe(false)
    expect(domain(b, viewer('m-yani')).canDecideAsk(a)).toBe(true)
    expect(domain(b, viewer('m-david')).canDecideAsk(a)).toBe(false)
  })
})
