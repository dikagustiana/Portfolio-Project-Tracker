// View-model of the Project page: filters, grouping and Gantt geometry (prototype viewProject,
// viewList, viewVC, viewMilestones, viewGantt).
import { describe, expect, it } from 'vitest'
import { createDomain, dn } from '../../domain/index.ts'
import type { Ask, Board, Decision, Domain, Milestone, Project, Task } from '../../domain/index.ts'
import {
  decisionLog,
  draggedDates,
  effectiveWho,
  filterTasks,
  ganttLayout,
  listGroups,
  memberOptions,
  openAsks,
  projectTabs,
  vcGroups,
  vcSelected,
} from './model.ts'

const TODAY = '2026-10-07' // Wednesday

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Margin Bridge',
  entity: 'SAMB',
  outcome: '',
  measure: '',
  owner: 'dika',
  status: 'aktif',
  maturity: 'release',
  gateMode: true,
  parallelGates: false,
  color: 'samb3',
  stepTemplateId: 'tpl',
  closedAt: null,
  closedBy: null,
  closeNote: null,
  closeSrc: null,
  createdAt: 1,
  ...over,
})
const ms = (id: string, order: number, over: Partial<Milestone> = {}): Milestone => ({
  id,
  projectId: 'p1',
  code: null,
  title: `Gate ${id}`,
  target: '',
  criteria: '',
  trigger: '',
  fallback: '',
  approver: '',
  mode: 'slow',
  order,
  status: null,
  lastDecision: null,
  createdAt: order,
  ...over,
})
const task = (id: string, start: string, end: string, over: Partial<Task> = {}): Task => ({
  id,
  projectId: 'p1',
  milestoneId: '',
  title: `Task ${id}`,
  desc: '',
  start,
  end,
  assignee: '',
  validator: '',
  proof: '',
  stage: 'todo',
  committed: false,
  committedAt: null,
  committedBy: null,
  evidence: null,
  submittedAt: null,
  submittedBy: null,
  acceptedAt: null,
  acceptedBy: null,
  rejectReason: null,
  rejectedAt: null,
  rejectedBy: null,
  doneAt: null,
  deps: [],
  steps: [],
  createdAt: 1,
  ...over,
})
const ask = (id: string, over: Partial<Ask> = {}): Ask => ({
  id,
  projectId: 'p1',
  milestoneId: '',
  question: `Q ${id}`,
  decider: '',
  due: '',
  status: 'open',
  answer: null,
  decidedAt: null,
  decidedBy: null,
  src: { deciderName: '', forum: '', decidedOn: '' },
  createdAt: 1,
  createdBy: null,
  ...over,
})
const decision = (id: string, at: number, over: Partial<Decision> = {}): Decision => ({
  id,
  projectId: 'p1',
  milestoneId: null,
  kind: 'gate',
  status: 'lulus',
  note: '',
  by: null,
  at,
  src: { deciderName: '', forum: '', decidedOn: '' },
  ...over,
})

function board(over: Partial<Board> = {}): Board {
  return {
    people: [
      { id: 'david', name: 'David', role: '', userId: null, email: null, emailDaily: true, createdAt: 1 },
      { id: 'dika', name: 'Dika', role: '', userId: null, email: null, emailDaily: true, createdAt: 1 },
      { id: 'outsider', name: 'Outsider', role: '', userId: null, email: null, emailDaily: true, createdAt: 1 },
      { id: 'yani', name: 'Yani', role: '', userId: null, email: null, emailDaily: true, createdAt: 1 },
    ],
    memberships: [
      { projectId: 'p1', personId: 'dika', role: 'pm' },
      { projectId: 'p1', personId: 'yani', role: 'officer' },
      { projectId: 'p1', personId: 'david', role: 'pm' },
      { projectId: 'p2', personId: 'outsider', role: 'pm' },
    ],
    projects: [project()],
    milestones: [ms('g2', 2, { target: '2026-10-30' }), ms('g1', 1, { target: '2026-10-16' })],
    tasks: [
      task('b', '2026-10-12', '2026-10-14', { milestoneId: 'g1', assignee: 'yani', steps: ['store'] }),
      task('a', '2026-10-05', '2026-10-09', { milestoneId: 'g1', title: 'Hitung pallet', desc: 'gudang Cikarang', steps: ['store', 'lp'] }),
      task('c', '2026-10-08', '2026-10-20', { milestoneId: 'g2', assignee: 'dika', deps: ['a'] }),
      task('d', '2026-10-01', '2026-10-02', { assignee: 'yani', stage: 'done' }),
    ],
    asks: [],
    decisions: [],
    reminders: [],
    holidays: [
      { date: '2026-10-09', type: 'cuti', name: 'Cuti bersama' },
      { date: '2026-10-12', type: 'libur', name: 'Libur' },
    ],
    templates: [
      {
        id: 'tpl',
        name: 'Trading SAMB',
        steps: [
          { id: 's-lp', code: 'lp', no: '', name: 'Logistics services', need: 'Side', kind: 'side', sort: 11 },
          { id: 's-store', code: 'store', no: '③', name: 'Store', need: 'Pallet-days', kind: 'chain', sort: 4 },
          { id: 's-report', code: 'report', no: '', name: 'Report', need: 'Report', kind: 'output', sort: 10 },
        ],
      },
    ],
    settings: { cutiIsWorkday: false, emailPaused: false, emailTime: '07:00', timezone: 'Asia/Jakarta', emailProvider: 'none' },
    ...over,
  }
}

const dom = (b: Board = board()): Domain => createDomain(b, { today: TODAY, appUrl: '', viewer: null })
const ids = (ts: readonly { id: string }[]) => ts.map((t) => t.id)

describe('tabs and filters', () => {
  it('shows Value chain only for a project with a template in use', () => {
    const d = dom()
    const p = d.project('p1')!
    expect(projectTabs(d, p).map((x) => x[0])).toEqual(['milestone', 'vc', 'list', 'pipeline', 'gantt'])
    const noTpl = dom(board({ projects: [project({ stepTemplateId: null })] }))
    expect(projectTabs(noTpl, noTpl.project('p1')!).map((x) => x[1])).toEqual(['Milestone', 'Checklist', 'Pipeline', 'Gantt chart'])
  })

  it('lists only this project’s members as PIC options, in board order', () => {
    const d = dom()
    expect(ids(memberOptions(d, 'p1'))).toEqual(['david', 'dika', 'yani'])
    expect(effectiveWho('yani', memberOptions(d, 'p1'))).toBe('yani')
    expect(effectiveWho('none', memberOptions(d, 'p1'))).toBe('none')
    expect(effectiveWho('outsider', memberOptions(d, 'p1'))).toBe('all')
  })

  it('filters by PIC and search text (title and description) and sorts by start, then end', () => {
    const d = dom()
    expect(ids(filterTasks(d, 'p1', 'all', ''))).toEqual(['d', 'a', 'c', 'b'])
    expect(ids(filterTasks(d, 'p1', 'none', ''))).toEqual(['a'])
    expect(ids(filterTasks(d, 'p1', 'yani', ''))).toEqual(['d', 'b'])
    expect(ids(filterTasks(d, 'p1', 'all', '  CIKARANG '))).toEqual(['a'])
    expect(ids(filterTasks(d, 'p1', 'all', 'pallet'))).toEqual(['a'])
  })
})

describe('groups', () => {
  it('groups the checklist per milestone in gate order, then Tanpa milestone', () => {
    const d = dom()
    const p = d.project('p1')!
    const gs = listGroups(d, p, filterTasks(d, 'p1', 'all', ''))
    expect(gs.map((g) => [g.label, g.state, ids(g.rows)])).toEqual([
      ['M1 · Gate g1', 'jalan', ['a', 'b']],
      ['M2 · Gate g2', 'jalan', ['c']],
      ['Tanpa milestone', undefined, ['d']],
    ])
  })

  it('groups the value chain tab per step (strip first, then side), then tasks outside the chain', () => {
    const d = dom()
    const p = d.project('p1')!
    const ts = filterTasks(d, 'p1', 'all', '')
    expect(vcGroups(d, p, ts, '').map((g) => [g.title, ids(g.rows)])).toEqual([
      ['③ Store', ['a', 'b']],
      ['Logistics services', ['a']],
      ['Tidak masuk value chain', ['d', 'c']],
    ])
    expect(vcSelected(d, p, 'lp')).toBe('lp')
    expect(vcSelected(d, p, 'nope')).toBe('')
    expect(vcGroups(d, p, ts, 'lp').map((g) => g.title)).toEqual(['Logistics services'])
    expect(vcGroups(d, p, ts, 'report')).toEqual([])
  })

  it('orders open asks by due date (none last, ties by creation) and the log newest first', () => {
    const b = board({
      asks: [
        ask('k1'),
        ask('k2', { due: '2026-10-09', createdAt: 5 }),
        ask('k6', { due: '2026-10-09', createdAt: 2 }),
        ask('k3', { due: '2026-10-08' }),
        ask('k4', { status: 'decided', decidedAt: 300, answer: 'Ya' }),
        ask('k5', { projectId: 'p2' }),
      ],
      decisions: [decision('d1', 100), decision('d2', 500, { kind: 'project', status: 'aktif' }), decision('d3', 50, { projectId: 'p2' })],
    })
    const d = dom(b)
    const p = d.project('p1')!
    expect(ids(openAsks(d, p))).toEqual(['k3', 'k6', 'k2', 'k1'])
    expect(decisionLog(d, p).map((e) => [e.kind, e.kind === 'ask' ? e.a.id : e.d.id])).toEqual([
      ['project', 'd2'],
      ['ask', 'k4'],
      ['gate', 'd1'],
    ])
  })
})

describe('gantt layout', () => {
  const d = dom()
  const p = d.project('p1')!
  const all = filterTasks(d, 'p1', 'all', '')

  it('spans from 3 days before the earliest start to 7 days after the last end or target', () => {
    const L = ganttLayout(d, p, all, 'day', false)
    expect(L.a).toBe(dn('2026-10-01') - 3)
    expect(L.b).toBe(dn('2026-10-30') + 7)
    expect(L.DW).toBe(36)
    expect(L.W).toBe((L.b - L.a + 1) * 36)
    // Today minus four days at the left edge on first render.
    expect(L.initialScroll).toBe((dn(TODAY) - L.a - 4) * 36)
    expect(L.todayLeft).toBe((dn(TODAY) - L.a) * 36 + 18 - 1)
  })

  it('stretches short ranges to four weeks (day) or twelve weeks (week)', () => {
    const one = [task('x', TODAY, TODAY)]
    const bare = dom(board({ milestones: [], tasks: one }))
    const pb = bare.project('p1')!
    const day = ganttLayout(bare, pb, one, 'day', false)
    expect(day.b - day.a).toBe(27)
    const week = ganttLayout(bare, pb, one, 'week', false)
    expect(week.b - week.a).toBe(83)
    expect(week.DW).toBe(15)
    // Week zoom labels Mondays only.
    expect(week.days.filter((x) => x.label).every((x) => new Date(`${x.key}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
  })

  it('shades holidays (cuti apart) and weekends, and labels months wider than 60px', () => {
    const L = ganttLayout(d, p, all, 'day', false)
    const at = (s: string) => (dn(s) - L.a) * 36
    expect(L.shades.find((x) => x.left === at('2026-10-09'))?.cls).toBe('ghol cuti')
    expect(L.shades.find((x) => x.left === at('2026-10-12'))?.cls).toBe('ghol')
    expect(L.shades.find((x) => x.left === at('2026-10-10'))?.cls).toBe('gwk')
    expect(L.shades.some((x) => x.left === at('2026-10-07'))).toBe(false)
    expect(L.days.find((x) => x.key === '2026-10-09')?.hol?.name).toBe('Cuti bersama')
    expect(L.days.find((x) => x.today)?.key).toBe(TODAY)
    expect(L.months.map((m) => m.label)).toEqual(['September 2026', 'Oktober 2026', 'November 2026'])
    expect(L.months.reduce((s, m) => s + m.width, 0)).toBe(L.W)
  })

  it('lists rows per milestone, then loose tasks after a label row', () => {
    const L = ganttLayout(d, p, all, 'day', false)
    expect(L.rows.map((r) => (r.kind === 'task' ? r.t.id : r.kind === 'ms' ? `ms:${r.m.id}` : r.kind))).toEqual([
      'ms:g1',
      'a',
      'b',
      'ms:g2',
      'c',
      'loose',
      'd',
    ])
    expect(L.height).toBe(3 * 38 + 4 * 46)
    const g1 = L.rows[0]
    expect(g1?.kind === 'ms' && g1.target).toEqual({ left: (dn('2026-10-16') - L.a) * 36 + 36 - 8, labelLeft: (dn('2026-10-16') - L.a) * 36 + 36 + 14 })
    const a = L.rows[1]
    expect(a?.kind === 'task' && [a.left, a.width]).toEqual([(dn('2026-10-05') - L.a) * 36, 5 * 36])
  })

  it('hides empty milestone headers only while a filter is active', () => {
    const only = filterTasks(d, 'p1', 'dika', '')
    expect(ganttLayout(d, p, only, 'day', true).rows.map((r) => r.key)).toEqual(['ms:g2', 'c'])
    expect(ganttLayout(d, p, only, 'day', false).rows.map((r) => r.key)).toEqual(['ms:g1', 'ms:g2', 'c'])
  })

  it('draws dependency arrows, red when the task starts before its dependency ends', () => {
    const L = ganttLayout(d, p, all, 'day', false)
    expect(L.arrows).toHaveLength(1)
    const arrow = L.arrows[0]!
    expect(arrow.bad).toBe(true) // c starts 8 Okt, a ends 9 Okt
    const x1 = (dn('2026-10-05') - L.a) * 36 + 5 * 36
    const x2 = (dn('2026-10-08') - L.a) * 36
    expect(arrow.path).toBe(`M${x1} ${38 + 23} h8 V${38 + 46 * 2 + 38 + 23} H${x2 - 3}`)
    // A dependency that is filtered out draws nothing.
    expect(ganttLayout(d, p, filterTasks(d, 'p1', 'dika', ''), 'day', true).arrows).toEqual([])
  })
})

describe('draggedDates', () => {
  const t = { start: '2026-10-05', end: '2026-10-09' }
  it('moves both ends', () => {
    expect(draggedDates(t, 3, false)).toEqual({ start: '2026-10-08', end: '2026-10-12' })
    expect(draggedDates(t, -5, false)).toEqual({ start: '2026-09-30', end: '2026-10-04' })
  })
  it('resizes the end, never before the start', () => {
    expect(draggedDates(t, 2, true)).toEqual({ start: '2026-10-05', end: '2026-10-11' })
    expect(draggedDates(t, -9, true)).toEqual({ start: '2026-10-05', end: '2026-10-05' })
  })
})
