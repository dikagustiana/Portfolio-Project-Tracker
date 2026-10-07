// Pure view-model helpers for the Project page: the data side of the prototype's filtered,
// viewProject tabs, viewList, viewVC, viewMilestones (asks and log) and viewGantt geometry.
// No React and no DOM, so they are unit-tested directly (model.test.ts).
import { addDays, dn, dow, ds, fmt } from '../../domain/index.ts'
import type {
  Ask,
  Decision,
  Domain,
  Holiday,
  Id,
  Milestone,
  MsState,
  Person,
  Project,
  Task,
  TemplateStep,
} from '../../domain/index.ts'
import type { Tab } from '../../app/ui.ts'

/** Top-level project tabs (spec §52). "Task" holds the four task views. */
export type TopTab = 'milestone' | 'task' | 'keputusan' | 'aktivitas' | 'anggota'
export const TOP_TABS: [TopTab, string][] = [
  ['milestone', 'Milestone'],
  ['task', 'Task'],
  ['keputusan', 'Keputusan'],
  ['aktivitas', 'Aktivitas'],
  ['anggota', 'Anggota'],
]
const TASK_VIEWS: readonly Tab[] = ['list', 'pipeline', 'gantt', 'vc']
export const isTaskView = (t: Tab): boolean => TASK_VIEWS.includes(t)
export const topOf = (t: Tab): TopTab => (isTaskView(t) ? 'task' : (t as TopTab))

/** The task views of a project. Value chain only when the project has a template in use. */
export function taskViews(d: Domain, p: Project): [Tab, string][] {
  return [
    ['list', 'Checklist'],
    ['pipeline', 'Pipeline'],
    ['gantt', 'Gantt'],
    ...(d.hasVC(p) ? ([['vc', 'Value chain']] as [Tab, string][]) : []),
  ]
}

/** The tab in effect: one the project has, else Milestone (e.g. Value chain without a template). */
export function projectTab(d: Domain, p: Project, tab: Tab): Tab {
  return tab === 'vc' && !d.hasVC(p) ? 'list' : tab
}

/** People who are members of the project, in board order (the PIC filter's options). */
export function memberOptions(d: Domain, projectId: Id): Person[] {
  const ids = new Set(d.board.memberships.filter((m) => m.projectId === projectId).map((m) => m.personId))
  return d.board.people.filter((m) => ids.has(m.id))
}

/** The PIC filter value in effect: 'all', 'none' or one of the options; anything else reads as 'all'. */
export function effectiveWho(who: string, options: readonly Person[]): string {
  return who === 'all' || who === 'none' || options.some((m) => m.id === who) ? who : 'all'
}

/** Tasks of a project after the PIC filter and the search box, by start then end (prototype filtered). */
export function filterTasks(d: Domain, projectId: Id, who: string, q: string): Task[] {
  const s = q.trim().toLowerCase()
  return d
    .ptasks(projectId)
    .filter(
      (t) =>
        (who === 'all' || (who === 'none' ? !t.assignee : t.assignee === who)) &&
        (!s || `${t.ref} ${t.title} ${t.desc || ''}`.toLowerCase().includes(s)),
    )
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

/** A row with the sub-tasks that are in the same (filtered) list. */
export interface Nested {
  t: Task
  kids: Task[]
}

/**
 * Packages with their sub-tasks under them, in the order of rows. A sub-task whose package is
 * filtered out stays in the list on its own, so a filter never hides a match.
 */
export function nestRows(rows: readonly Task[]): Nested[] {
  const inList = new Set(rows.map((t) => t.id))
  return rows
    .filter((t) => !t.parentId || !inList.has(t.parentId))
    .map((t) => ({ t, kids: rows.filter((c) => c.parentId === t.id) }))
}

export interface ListGroup {
  key: string
  label: string
  /** Milestone state; absent for "Tanpa milestone". */
  state?: MsState
  rows: Task[]
}

/** Checklist groups: one per milestone in order, then "Tanpa milestone" (prototype viewList). */
export function listGroups(d: Domain, p: Project, ts: readonly Task[]): ListGroup[] {
  const groups: ListGroup[] = d.pms(p.id).map((m) => ({
    key: m.id,
    label: `${d.msNo(m)} · ${m.title}`,
    state: d.msState(m),
    rows: ts.filter((t) => t.milestoneId === m.id),
  }))
  groups.push({ key: '', label: 'Tanpa milestone', rows: ts.filter((t) => !t.milestoneId || !d.mstone(t.milestoneId)) })
  return groups
}

export interface VcGroup {
  /** The step, or null for the "Tidak masuk value chain" group. */
  step: TemplateStep | null
  title: string
  need: string
  rows: Task[]
}

/** Steps in the prototype's VC_ALL order: the strip (chain + output), then the side steps. */
export function vcAll(d: Domain, p: Project): TemplateStep[] {
  const vs = d.vcSteps(p)
  return vs ? [...vs.strip, ...vs.side] : []
}

/** The selected step code when it belongs to the project's template, else ''. */
export function vcSelected(d: Domain, p: Project, vcStep: string): string {
  return vcAll(d, p).some((s) => s.code === vcStep) ? vcStep : ''
}

/** Value chain tab groups (prototype viewVC), only those with rows. Leaf tasks, like the step progress. */
export function vcGroups(d: Domain, p: Project, ts: readonly Task[], sel: string): VcGroup[] {
  const groups: VcGroup[] = vcAll(d, p)
    .filter((s) => !sel || s.code === sel)
    .map((s) => ({ step: s, title: d.vcLabel(s), need: s.need, rows: ts.filter((t) => d.isLeaf(t) && d.vcOf(t).includes(s.code)) }))
  if (!sel)
    groups.push({
      step: null,
      title: 'Tidak masuk value chain',
      need: 'Paket fondasi, BAU dan planning',
      rows: ts.filter((t) => d.isLeaf(t) && !d.vcOf(t).length),
    })
  return groups.filter((g) => g.rows.length > 0)
}

/**
 * Open asks of a project, earliest due first (no due date last). Ties keep creation order, which
 * is what the prototype's array order was; rows from the database arrive in id order.
 */
export function openAsks(d: Domain, p: Project): Ask[] {
  return d.board.asks
    .filter((x) => x.projectId === p.id && x.status !== 'decided')
    .sort((x, y) => (x.due || '9').localeCompare(y.due || '9') || x.createdAt - y.createdAt)
}

/**
 * "Log keputusan": every recorded decision of the project (gates, project close/reopen and
 * Keputusan answers or reopenings), newest first. The log is append-only, so a reopened
 * Keputusan keeps its earlier answer here.
 */
export function decisionLog(d: Domain, p: Project): Decision[] {
  return d.board.decisions.filter((x) => x.projectId === p.id).sort((a, b) => b.at - a.at)
}

// ---------- Gantt ----------

export type Zoom = 'day' | 'week'

export interface GanttMonth {
  key: string
  width: number
  label: string
}
export interface GanttDay {
  key: string
  label: string
  today: boolean
  hol: Holiday | null
}
export interface GanttShade {
  key: string
  left: number
  /** 'ghol', 'ghol cuti' or 'gwk'. */
  cls: string
}
export type GanttRow =
  | {
      kind: 'ms'
      key: string
      m: Milestone
      state: MsState
      late: boolean
      /** Target diamond position, when the target is inside the range. */
      target: { left: number; labelLeft: number } | null
    }
  | { kind: 'loose'; key: string }
  | { kind: 'task'; key: string; t: Task; left: number; width: number; child: boolean }

export interface GanttArrow {
  key: string
  path: string
  bad: boolean
}

export interface GanttLayout {
  /** Pixels per day. */
  DW: number
  /** First and last day number shown. */
  a: number
  b: number
  /** Track width in pixels. */
  W: number
  months: GanttMonth[]
  days: GanttDay[]
  shades: GanttShade[]
  rows: GanttRow[]
  /** Total height of the rows below the header (the arrow layer's height). */
  height: number
  arrows: GanttArrow[]
  todayLeft: number
  /** scrollLeft that puts today − 4 days at the left edge (prototype bindGantt on first render). */
  initialScroll: number
}

const MS_ROW = 38
const TASK_ROW = 46

/**
 * Geometry of the Gantt chart for the filtered tasks ts (prototype viewGantt). Milestone header
 * rows show even when empty only while no filter is active, like the prototype.
 */
export function ganttLayout(
  d: Domain,
  p: Project,
  ts: readonly Task[],
  zoom: Zoom,
  filtering: boolean,
): GanttLayout {
  const DW = zoom === 'day' ? 36 : 15
  const t0 = dn(d.today)
  const ms = d.pms(p.id)
  const tg = ms.filter((m) => m.target).map((m) => dn(m.target))
  const a = Math.min(t0, ...ts.map((t) => dn(t.start))) - 3
  let b = Math.max(t0, ...ts.map((t) => dn(t.end)), ...tg) + 7
  const minSpan = zoom === 'day' ? 27 : 83
  if (b - a < minSpan) b = a + minSpan
  const N = b - a + 1
  const W = N * DW

  const months: GanttMonth[] = []
  const days: GanttDay[] = []
  const shades: GanttShade[] = []
  let cur: string | null = null
  let cnt = 0
  const flush = () => {
    if (cur) months.push({ key: cur, width: cnt * DW, label: cnt * DW > 60 ? fmt(cur, { month: 'long', year: 'numeric' }) : '' })
  }
  for (let i = 0; i < N; i++) {
    const s = ds(a + i)
    const wd = dow(s)
    if (s.slice(0, 7) !== cur?.slice(0, 7)) {
      flush()
      cur = s
      cnt = 0
    }
    cnt++
    const h = d.hol(s)
    days.push({ key: s, label: zoom === 'day' || wd === 1 ? String(Number(s.slice(8))) : '', today: a + i === t0, hol: h })
    if (h) shades.push({ key: s, left: i * DW, cls: h.type === 'cuti' ? 'ghol cuti' : 'ghol' })
    else if (wd === 0 || wd === 6) shades.push({ key: s, left: i * DW, cls: 'gwk' })
  }
  flush()

  const rows: GanttRow[] = []
  const msRow = (m: Milestone): GanttRow => {
    const td = m.target ? dn(m.target) : NaN
    return {
      kind: 'ms',
      key: `ms:${m.id}`,
      m,
      state: d.msState(m),
      late: d.msLate(m),
      target: m.target && td >= a && td <= b ? { left: (td - a) * DW + DW - 8, labelLeft: (td - a) * DW + DW + 14 } : null,
    }
  }
  const taskRow = (t: Task, child = false): GanttRow => ({
    kind: 'task',
    key: t.id,
    t,
    left: (dn(t.start) - a) * DW,
    width: d.durDays(t) * DW,
    child,
  })
  // Sub-tasks right under their package.
  const tree = (list: readonly Task[]): GanttRow[] => nestRows(list).flatMap((n) => [taskRow(n.t, !!n.t.parentId), ...n.kids.map((k) => taskRow(k, true))])
  for (const m of ms) {
    const mine = ts.filter((t) => t.milestoneId === m.id)
    if (mine.length || !filtering) rows.push(msRow(m))
    rows.push(...tree(mine))
  }
  const loose = ts.filter((t) => !t.milestoneId || !d.mstone(t.milestoneId))
  if (loose.length) {
    if (rows.length) rows.push({ kind: 'loose', key: 'loose' })
    rows.push(...tree(loose))
  }

  let y = 0
  const pos = new Map<Id, { l: number; w: number; y: number }>()
  for (const r of rows) {
    if (r.kind === 'task') {
      pos.set(r.t.id, { l: r.left, w: r.width, y: y + 23 })
      y += TASK_ROW
    } else y += MS_ROW
  }

  const byId = new Map(ts.map((t) => [t.id, t]))
  const arrows: GanttArrow[] = []
  for (const t of ts)
    for (const did of t.deps) {
      const A = pos.get(did)
      const B = pos.get(t.id)
      const dep = byId.get(did)
      if (!A || !B || !dep) continue
      const bad = dep.end >= t.start
      arrows.push({ key: `${did}>${t.id}`, path: `M${A.l + A.w} ${A.y} h8 V${B.y} H${B.l - 3}`, bad })
    }

  return {
    DW,
    a,
    b,
    W,
    months,
    days,
    shades,
    rows,
    height: y,
    arrows,
    todayLeft: (t0 - a) * DW + DW / 2 - 1,
    initialScroll: Math.max(0, (t0 - a - 4) * DW),
  }
}

/** New dates after dragging a bar by k days; resizing never ends before the start (prototype bindGantt). */
export function draggedDates(t: Pick<Task, 'start' | 'end'>, k: number, resize: boolean): { start: string; end: string } {
  if (resize) {
    const end = addDays(t.end, k)
    return { start: t.start, end: end < t.start ? t.start : end }
  }
  return { start: addDays(t.start, k), end: addDays(t.end, k) }
}
