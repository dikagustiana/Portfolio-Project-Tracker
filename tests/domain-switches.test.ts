// New behaviour that the golden file cannot cover (BRIEF §6.4, §6.6, §6.7) and the per-project
// permission helpers that replace the prototype's global PM role (BRIEF §3).
import { describe, expect, it } from 'vitest'
import { createDomain, isWeekend } from '../src/domain/index.ts'
import type { Board, Domain, Flag, Task, Viewer } from '../src/domain/index.ts'
import { PROJECT_ID, PROTOTYPE_URL, prototypeBoard, readJson } from './fixtures/prototype-board.ts'

const TODAY = '2026-10-07'
const golden = readJson<{ calendar_ranges: { from: string; to: string; workdays: number }[] }>(
  'reference/golden/prototype-golden.json',
)
const domain = (board: Board, viewer: Viewer | null = null): Domain =>
  createDomain(board, { today: TODAY, appUrl: PROTOTYPE_URL, viewer })
const must = <T>(x: T | null | undefined, what: string): T => {
  if (x === null || x === undefined) throw new Error(`missing ${what}`)
  return x
}
const flagsOf = (d: Domain, t: Task): Flag[] => d.taskFlags(t, d.project(t.projectId))
const warningsOf = (d: Domain, t: Task): string[] => d.warnings(t, d.project(t.projectId))
/** Replace one task in a board. */
const withTask = (board: Board, id: string, patch: Partial<Task>): Board => ({
  ...board,
  tasks: board.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
})

const base = domain(prototypeBoard())

describe('parallelGates (BRIEF §6.4)', () => {
  const GATE_FLAG = /^Mulai sebelum \S+ selesai$/
  const GATE_WARN = /^Mulai sebelum \S+ selesai \(.*\), padahal \S+ belum lulus\.$/
  const parBoard = prototypeBoard()
  for (const p of parBoard.projects) p.parallelGates = true
  const par = domain(parBoard)

  it('off (default): exactly 35 of 59 tasks start before the previous gate closes', () => {
    const conflicted = base.board.tasks.filter((t) => base.seqConflict(t)).map((t) => t.id)
    expect(base.board.tasks).toHaveLength(59)
    expect(conflicted).toHaveLength(35)
    expect(base.board.tasks.filter((t) => flagsOf(base, t).some((f) => GATE_FLAG.test(f[1]))).map((t) => t.id)).toEqual(
      conflicted,
    )
    expect(base.board.tasks.filter((t) => warningsOf(base, t).some((w) => GATE_WARN.test(w))).map((t) => t.id)).toEqual(
      conflicted,
    )
  })

  it('on: no task has seqConflict, the "Mulai sebelum …" flag or warning', () => {
    for (const t of par.board.tasks) {
      expect(par.seqConflict(t)).toBeNull()
      expect(flagsOf(par, t).filter((f) => GATE_FLAG.test(f[1]))).toEqual([])
      expect(warningsOf(par, t).filter((w) => GATE_WARN.test(w))).toEqual([])
    }
  })

  it('on: every other flag and warning is unchanged', () => {
    for (const t of par.board.tasks) {
      const b = must(base.task(t.id), t.id)
      expect(flagsOf(par, t)).toEqual(flagsOf(base, b).filter((f) => !GATE_FLAG.test(f[1])))
      expect(warningsOf(par, t)).toEqual(warningsOf(base, b).filter((w) => !GATE_WARN.test(w)))
    }
  })

  it('applies per project: a project with the switch off keeps the check', () => {
    const b = prototypeBoard()
    const other = { ...must(b.projects[0], 'project'), id: 'other', parallelGates: true }
    const d = domain({ ...b, projects: [...b.projects, other] })
    expect(d.board.tasks.filter((t) => d.seqConflict(t))).toHaveLength(35)
  })
})

describe('cutiIsWorkday (BRIEF §6.6)', () => {
  const cuti = domain(prototypeBoard({ cutiIsWorkday: true }))
  const HOL_FLAG = 'Jatuh di hari libur: '
  const holFlag = (d: Domain, t: Task): string | undefined => flagsOf(d, t).find((f) => f[1].startsWith(HOL_FLAG))?.[1]

  it('makes a cuti bersama weekday a working day', () => {
    expect(base.isWork('2026-12-24')).toBe(false)
    expect(cuti.isWork('2026-12-24')).toBe(true)
    expect(cuti.hol('2026-12-24')).toMatchObject({ type: 'cuti', name: 'Cuti bersama Natal' })
  })

  it('leaves libur nasional and weekends non-working', () => {
    for (const s of ['2026-12-25', '2027-01-01', '2027-03-26', '2027-05-17']) expect(cuti.isWork(s)).toBe(false)
    expect(cuti.isWork('2026-10-10')).toBe(false)
    expect(cuti.isWork('2027-02-06')).toBe(false)
  })

  it('adds the cuti weekdays to workdays()', () => {
    const dec = must(golden.calendar_ranges.find((r) => r.from === '2026-12-01'), 'Dec range')
    expect(cuti.workdays(dec.from, dec.to)).toBe(dec.workdays + 1)
    for (const r of golden.calendar_ranges) {
      const cutiWeekdays = cuti.holsIn(r.from, r.to).filter((h) => h.type === 'cuti' && !isWeekend(h.date))
      expect(cuti.workdays(r.from, r.to)).toBe(r.workdays + cutiWeekdays.length)
    }
  })

  it('moves nextWorkday and the digest workday check', () => {
    expect(base.nextWorkday('2026-12-24')).toBe('2026-12-28')
    expect(cuti.nextWorkday('2026-12-24')).toBe('2026-12-24')
    expect(base.digestAll('2026-12-24')).toMatchObject({ workday: false, reason: 'Hari libur: Cuti bersama Natal' })
    expect(cuti.digestAll('2026-12-24')).toMatchObject({ workday: true, reason: null })
    expect(cuti.digestAll('2026-12-25')).toMatchObject({ workday: false, reason: 'Hari libur: Natal' })
  })

  it('stops flagging tasks that start or end on cuti bersama', () => {
    for (const id of ['MB31', 'MB35', 'MB46']) {
      const t = must(cuti.task(id), id)
      expect(holFlag(base, t)).toBe('Jatuh di hari libur: Cuti bersama Imlek')
      expect(holFlag(cuti, t)).toBeUndefined()
      expect(flagsOf(cuti, t)).toEqual(flagsOf(base, t).filter((f) => !f[1].startsWith(HOL_FLAG)))
      expect(warningsOf(cuti, t).filter((w) => w.includes('cuti bersama:'))).toEqual([])
    }
  })

  it('keeps flagging tasks on libur nasional', () => {
    const expected: Record<string, string> = {
      MB29: 'Jatuh di hari libur: Wafat Yesus Kristus',
      MB43: 'Jatuh di hari libur: Wafat Yesus Kristus',
      MB39: 'Jatuh di hari libur: Hari Suci Nyepi',
      MB54: 'Jatuh di hari libur: Idul Adha',
    }
    for (const [id, flag] of Object.entries(expected)) {
      const t = must(cuti.task(id), id)
      expect(holFlag(cuti, t)).toBe(flag)
      expect(flagsOf(cuti, t)).toEqual(flagsOf(base, t))
    }
  })

  it('counts only days off in the "Rentang ini melewati" warning', () => {
    const mb29 = must(cuti.task('MB29'), 'MB29')
    expect(warningsOf(cuti, mb29)).toContain(
      'Rentang ini melewati 3 hari libur/cuti bersama (8 Mar Hari Suci Nyepi, 10 Mar Idul Fitri, 11 Mar Idul Fitri).',
    )
    const mb43 = must(cuti.task('MB43'), 'MB43')
    expect(warningsOf(cuti, mb43).some((w) => w.startsWith('Rentang ini melewati'))).toBe(false)
  })

  it('flags only the libur name when a task spans a cuti start and a libur end', () => {
    const b = withTask(prototypeBoard(), 'MB01', { start: '2026-12-24', end: '2026-12-25' })
    const t = must(b.tasks.find((x) => x.id === 'MB01'), 'MB01')
    expect(holFlag(domain(b), t)).toBe('Jatuh di hari libur: Cuti bersama Natal, Natal')
    const c = domain({ ...b, settings: { ...b.settings, cutiIsWorkday: true } })
    expect(holFlag(c, t)).toBe('Jatuh di hari libur: Natal')
    expect(warningsOf(c, t).filter((w) => w.startsWith('Tanggal'))).toEqual([
      'Tanggal selesai jatuh di libur nasional: Natal.',
    ])
  })
})

describe('validator regression (BRIEF §6.7)', () => {
  const board = prototypeBoard()
  const t = must(
    board.tasks.find((x) => x.validator === 'm-dika' && x.assignee && x.assignee !== 'm-david'),
    'task validated by Dika',
  )

  it('a validator changed to another PM is the effective validator', () => {
    expect(base.validatorOf(t)).toBe('m-dika')
    const d = domain(withTask(board, t.id, { validator: 'm-david' }))
    const saved = must(d.task(t.id), t.id)
    expect(saved.validator).toBe('m-david')
    expect(d.validatorOf(saved)).toBe('m-david')
  })

  it('a member can be pemeriksa: judgment is record-level, not tied to project admin (ARCHITECTURE §D)', () => {
    const d = domain(withTask(board, t.id, { validator: 'm-muti' }))
    expect(d.validatorOf(must(d.task(t.id), t.id))).toBe('m-muti')
  })

  it('a pemeriksa who is a viewer or not on the project falls back to the gate approver', () => {
    const viewer = { ...board, memberships: board.memberships.map((m) => (m.personId === 'm-muti' ? { ...m, role: 'viewer' as const } : m)) }
    const d = domain(withTask(viewer, t.id, { validator: 'm-muti' }))
    expect(d.validatorOf(must(d.task(t.id), t.id))).toBe('m-dika')
    const out = domain(withTask(board, t.id, { validator: 'm-stranger' }))
    expect(out.validatorOf(must(out.task(t.id), t.id))).toBe('m-dika')
  })

  it('changing only the validator keeps the date commitment', () => {
    const old = { ...t, committed: true }
    expect(base.commitAfterEdit({ ...old, validator: 'm-david' }, old, null)).toEqual({ committed: true, stamp: false })
  })
})

describe('permission helpers', () => {
  const linked = (b: Board, unlinked: string[] = []): Board => ({
    ...b,
    people: b.people.map((p) => ({ ...p, userId: unlinked.includes(p.id) ? null : `u-${p.id}` })),
  })
  const as = (personId: string | null, extra: Partial<Viewer> = {}): Viewer => ({
    userId: `u-${personId ?? 'x'}`,
    personId,
    isSuperAdmin: false,
    ...extra,
  })
  const b = linked(prototypeBoard())
  // In the seed Dika checks Yani's and Muti's tasks, and David checks Dika's.
  const yaniTask = must(
    b.tasks.find((t) => t.assignee === 'm-yani' && base.validatorOf(t) === 'm-dika'),
    'Yani task validated by Dika',
  )
  const dikaTask = must(
    b.tasks.find((t) => t.assignee === 'm-dika' && base.validatorOf(t) === 'm-david'),
    'Dika task validated by David',
  )

  it('roleIn follows memberships and the super admin; no membership means no role', () => {
    expect(domain(b, as('m-dika')).roleIn(PROJECT_ID)).toBe('project_admin')
    expect(domain(b, as('m-muti')).roleIn(PROJECT_ID)).toBe('member')
    expect(domain(b, as(null, { isSuperAdmin: true })).roleIn(PROJECT_ID)).toBe('project_admin')
    expect(domain(b, as('stranger')).roleIn(PROJECT_ID)).toBeNull()
    expect(domain(b, null).roleIn(PROJECT_ID)).toBe('project_admin')
  })

  it('a project admin who is not the validator cannot validate a linked validator’s task', () => {
    expect(domain(b, as('m-david')).canValidate(yaniTask)).toBe(false)
    expect(domain(b, as(null, { isSuperAdmin: true })).canValidate(yaniTask)).toBe(false)
    expect(domain(b, as('m-dika')).canValidate(yaniTask)).toBe(true)
  })

  it('a project admin can act for a validator without a login', () => {
    const d = domain(linked(prototypeBoard(), ['m-dika']), as('m-david'))
    expect(d.canAct('m-dika', PROJECT_ID)).toBe(true)
    expect(d.canValidate(yaniTask)).toBe(true)
  })

  it('the PIC can never validate their own task', () => {
    for (const board of [b, linked(prototypeBoard(), ['m-david'])]) {
      expect(domain(board, as('m-dika')).canValidate(dikaTask)).toBe(false)
      expect(domain(board, as('m-dika', { isSuperAdmin: true })).canValidate(dikaTask)).toBe(false)
    }
    expect(domain(b, as('m-david')).canValidate(dikaTask)).toBe(true)
    const self = { ...dikaTask, validator: 'm-dika' }
    expect(base.selfAccept(self)).toBe(true)
    expect(domain(b, null).canValidate(self)).toBe(false)
  })

  it('a member who is not the pemeriksa cannot validate, even for a pemeriksa without a login', () => {
    expect(domain(b, as('m-muti')).canValidate(yaniTask)).toBe(false)
    expect(domain(linked(prototypeBoard(), ['m-dika']), as('m-muti')).canValidate(yaniTask)).toBe(false)
  })

  it('local mode (viewer null) can validate', () => {
    expect(domain(b, null).canValidate(yaniTask)).toBe(true)
    expect(domain(b, null).canValidate(dikaTask)).toBe(true)
  })

  it('canCommit: own task, or a project admin for a PIC without a login', () => {
    const muti = must(b.tasks.find((t) => t.assignee === 'm-muti'), 'Muti task')
    expect(domain(b, as('m-muti')).canCommit(muti)).toBe(true)
    expect(domain(b, as('m-muti')).canCommit(yaniTask)).toBe(false)
    expect(domain(b, as('m-david')).canCommit(yaniTask)).toBe(false)
    expect(domain(linked(prototypeBoard(), ['m-yani']), as('m-david')).canCommit(yaniTask)).toBe(true)
    expect(domain(linked(prototypeBoard(), ['m-yani']), as('m-muti')).canCommit(yaniTask)).toBe(false)
    expect(domain(b, as('m-david')).canCommit({ ...yaniTask, assignee: '' })).toBe(false)
  })

  it('canAct: self, or a project admin for an empty or unlinked person', () => {
    const dika = domain(b, as('m-dika'))
    expect(dika.canAct('m-dika', PROJECT_ID)).toBe(true)
    expect(dika.canAct('', PROJECT_ID)).toBe(true)
    expect(dika.canAct('m-yani', PROJECT_ID)).toBe(false)
    expect(domain(b, as('m-muti')).canAct('', PROJECT_ID)).toBe(false)
    expect(domain(b, as('m-muti')).canAct('m-muti', PROJECT_ID)).toBe(true)
    expect(dika.canAct('', 'another-project')).toBe(false)
  })

  it('canDecide: the pemutus, or a project admin recording for the forum (A5); others do not', () => {
    const g0 = must(b.milestones.find((m) => m.id === 'G0'), 'G0')
    expect(domain(b, as('m-david')).canDecide(g0)).toBe(true)
    expect(domain(b, as('m-muti')).canDecide(g0)).toBe(false)
    expect(domain(b, as('stranger')).canDecide(g0)).toBe(false)
    const muti = { ...g0, approver: 'm-muti' }
    expect(domain(b, as('m-muti')).canDecide(muti)).toBe(true)
    expect(domain(b, as('m-yani')).canDecide(muti)).toBe(false)
  })

  it('locked: a closed or stopped project is read-only', () => {
    const closed = prototypeBoard()
    for (const p of closed.projects) p.status = 'selesai'
    const d = domain(closed)
    expect(base.locked(yaniTask)).toBe(false)
    expect(d.locked(yaniTask)).toBe(true)
    expect(d.locked(must(d.project(PROJECT_ID), 'project'))).toBe(true)
  })

  it("inbox(''): the viewer's own commitments; '*' and a person id ignore the viewer", () => {
    const muti = domain(b, as('m-muti'))
    expect(muti.inbox('').commits.every((t) => t.assignee === 'm-muti')).toBe(true)
    expect(muti.inbox('').commits.map((t) => t.id)).toEqual(base.inbox('m-muti').commits.map((t) => t.id))
    expect(muti.inbox('').asks).toEqual([])
    expect(muti.inbox('*')).toEqual(base.inbox('*'))
    expect(muti.inbox('m-dika')).toEqual(base.inbox('m-dika'))
    expect(domain(b, as('m-dika')).inbox('').asks).toHaveLength(8)
    expect(base.inbox('').n).toBe(base.inbox('*').n)
  })

  it("inbox(''): review items follow canValidate", () => {
    const review = withTask(b, yaniTask.id, { stage: 'review', evidence: 'https://example.com/x' })
    expect(domain(review, as('m-dika')).inbox('').toValidate.map((t) => t.id)).toEqual([yaniTask.id])
    expect(domain(review, as('m-david')).inbox('').toValidate).toEqual([])
    expect(domain(review, as('m-yani')).inbox('').toValidate).toEqual([])
    expect(domain(review, null).inbox('m-dika').toValidate.map((t) => t.id)).toEqual([yaniTask.id])
  })
})
