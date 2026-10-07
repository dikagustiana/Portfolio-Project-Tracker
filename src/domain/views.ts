// Product-defined views (docs/ARCHITECTURE.md §H): each business question is answered once, here,
// over the RLS-filtered board, and every surface (Beranda, sidebar badge, Minggu ini, Portofolio,
// project pages, the digest) renders the same rows. A view is a query, not a copy of data: a count
// shown anywhere is the length of the view it opens.
//
//   who = ''        → the viewer        who = '*' → everyone        who = person id → that person
import { addDays, dn, tsToDate } from './dates.ts'
import type { Inbox } from './inbox.ts'
import type { BoardIndex } from './lookup.ts'
import type { Permissions } from './permissions.ts'
import type { Health, Progress, Rules } from './rules.ts'
import type { Ask, Blocker, DateStr, Id, Milestone, Project, ProjectEvent, Task, Ts, Viewer } from './types.ts'

/** The record a row opens. */
export type RecordKind = 'task' | 'gate' | 'ask' | 'project'
export interface RecordTarget {
  kind: RecordKind
  id: Id
}

export type ActionKind =
  | 'validate'
  | 'decide-gate'
  | 'gate-stop'
  | 'close'
  | 'decide-ask'
  | 'commit'
  | 'rework'
  | 'submit-package'
  | 'blocker'

export type Tone = 'red' | 'amber' | 'indigo' | 'green' | 'grey' | 'violet'

/** One thing someone has to do (Perlu tindakan). */
export interface ActionItem {
  key: string
  kind: ActionKind
  projectId: Id
  target: RecordTarget
  title: string
  /** Short id shown before the title (MB12, G3, K01). */
  ref: string
  /** Who holds it (for "everyone" lists). */
  who: Id
  /** The date that makes it urgent: due, start, submitted… Sorting key. */
  when: DateStr
  label: string
  tone: Tone
  detail: string
}

/** Something the person is waiting on someone else for (Menunggu orang lain). */
export interface WaitItem {
  key: string
  kind: 'review' | 'decision' | 'blocker' | 'dependency'
  projectId: Id
  target: RecordTarget
  ref: string
  title: string
  /** Who it waits on ('' = a role, e.g. the project PM). */
  on: Id
  onLabel: string
  /** Waiting since (date). Oldest first. */
  since: DateStr
}

/** A dated item of a week (Minggu ini). */
export interface ScheduleItem {
  key: string
  date: DateStr
  kind: 'due' | 'start' | 'accepted' | 'decision' | 'gate' | 'commitment'
  projectId: Id
  target: RecordTarget
  ref: string
  title: string
  who: Id
  label: string
  tone: Tone
}

export interface PortfolioRow {
  p: Project
  prog: Progress
  msPassed: number
  msTotal: number
  health: Health | null
  /** The current gate (first not passed or stopped). */
  next: Milestone | null
  pm: Id
  /** Latest human-readable event, or null. */
  lastMovement: ProjectEvent | null
  late: number
  blocked: number
  openAsks: number
  waitingReview: number
  /** The viewer is operationally involved (not merely able to read). */
  mine: boolean
}

export interface FunctionLoad {
  functionId: Id
  name: string
  open: number
  /** Open leaves owned by the function without a PIC. */
  unstaffed: number
  late: number
  blocked: number
  people: number
}

export interface ReviewSections {
  since: DateStr
  until: DateStr
  moved: ProjectEvent[]
  slipped: { t: Task; from: DateStr; to: DateStr; days: number }[]
  late: Task[]
  blocked: { t: Task; b: Blocker }[]
  decisions: Ask[]
  dueNext: Task[]
  gatesReady: Milestone[]
}

export type PortfolioFilter = 'all' | 'mine' | 'attention' | 'blocked' | 'done'

export interface ViewSpec {
  id: ViewId
  title: string
  /** What the rows are. */
  source: 'actions' | 'tasks' | 'waits' | 'asks' | 'projects' | 'schedule' | 'blockers'
  /** Properties shown per row, in order. */
  columns: readonly string[]
  layout: 'list' | 'table'
  /** Sentence shown when the view is empty. */
  empty: string
}

export type ViewId =
  | 'perlu-tindakan'
  | 'kerja-saya'
  | 'milik-fungsi'
  | 'menunggu'
  | 'minggu-ini'
  | 'blocked'
  | 'waiting-review'
  | 'keputusan-menunggu'
  | 'keputusan-terbuka'
  | 'portfolio'
  | 'unstaffed'

/** The product's views. Rows come from the matching function of Views. */
export const VIEWS: Record<ViewId, ViewSpec> = {
  'perlu-tindakan': {
    id: 'perlu-tindakan',
    title: 'Perlu tindakan',
    source: 'actions',
    columns: ['ref', 'title', 'project', 'label'],
    layout: 'list',
    empty: 'Tidak ada yang menunggu tindakanmu.',
  },
  'kerja-saya': {
    id: 'kerja-saya',
    title: 'Kerja saya',
    source: 'tasks',
    columns: ['ref', 'title', 'project', 'dates', 'status'],
    layout: 'list',
    empty: 'Tidak ada task aktif atas namamu.',
  },
  'milik-fungsi': {
    id: 'milik-fungsi',
    title: 'Milik fungsi saya',
    source: 'tasks',
    columns: ['ref', 'title', 'project', 'dates'],
    layout: 'list',
    empty: 'Tidak ada task fungsimu yang belum punya PIC.',
  },
  menunggu: {
    id: 'menunggu',
    title: 'Menunggu orang lain',
    source: 'waits',
    columns: ['ref', 'title', 'on', 'since'],
    layout: 'list',
    empty: 'Tidak ada yang sedang kamu tunggu dari orang lain.',
  },
  'minggu-ini': {
    id: 'minggu-ini',
    title: 'Jadwal minggu ini',
    source: 'schedule',
    columns: ['date', 'ref', 'title', 'label'],
    layout: 'list',
    empty: 'Tidak ada jadwal di minggu ini.',
  },
  blocked: {
    id: 'blocked',
    title: 'Terhambat',
    source: 'blockers',
    columns: ['ref', 'title', 'reason', 'from', 'since'],
    layout: 'list',
    empty: 'Tidak ada task yang terhambat.',
  },
  'waiting-review': {
    id: 'waiting-review',
    title: 'Menunggu pemeriksaan',
    source: 'tasks',
    columns: ['ref', 'title', 'validator', 'since'],
    layout: 'list',
    empty: 'Tidak ada task yang menunggu pemeriksaan.',
  },
  'keputusan-menunggu': {
    id: 'keputusan-menunggu',
    title: 'Keputusan menunggu kamu',
    source: 'asks',
    columns: ['ref', 'question', 'project', 'due'],
    layout: 'list',
    empty: 'Tidak ada keputusan yang menunggu kamu.',
  },
  'keputusan-terbuka': {
    id: 'keputusan-terbuka',
    title: 'Keputusan terbuka',
    source: 'asks',
    columns: ['ref', 'question', 'project', 'decider', 'due'],
    layout: 'table',
    empty: 'Tidak ada keputusan yang terbuka.',
  },
  portfolio: {
    id: 'portfolio',
    title: 'Portofolio',
    source: 'projects',
    columns: ['project', 'progress', 'gates', 'status', 'next', 'pm', 'movement'],
    layout: 'table',
    empty: 'Tidak ada project yang cocok.',
  },
  unstaffed: {
    id: 'unstaffed',
    title: 'Tanggung jawab tanpa PIC',
    source: 'tasks',
    columns: ['ref', 'title', 'function', 'dates'],
    layout: 'list',
    empty: 'Setiap task punya PIC.',
  },
}

export interface Views {
  /** Perlu tindakan: everything the person must do now, by urgency then age. */
  actions: (who?: Id) => ActionItem[]
  /** Kerja saya: open leaf tasks the person is PIC of (not waiting for review), by deadline then project. */
  myWork: (who?: Id) => Task[]
  /** Milik fungsi saya: open leaf tasks of the person's function that have no PIC yet. */
  functionWork: (who?: Id) => Task[]
  /** Menunggu orang lain: what the person waits on, oldest first. */
  waiting: (who?: Id) => WaitItem[]
  /** The dated items of the week starting weekStart (Monday). */
  week: (weekStart: DateStr, who?: Id) => ScheduleItem[]
  /** Open blockers, oldest first (optionally of one project). */
  blockedList: (projectId?: Id) => { t: Task; b: Blocker }[]
  /** Tasks in review, oldest submission first. */
  waitingReview: (projectId?: Id) => Task[]
  /** Open Keputusan the person decides (cross-project), by due date. */
  asksFor: (who?: Id) => Ask[]
  /** Every open Keputusan the viewer can read, by due date. */
  openAsks: (projectId?: Id) => Ask[]
  /** One row per readable project. */
  portfolio: () => PortfolioRow[]
  portfolioFilter: (rows: readonly PortfolioRow[], f: PortfolioFilter, q?: string) => PortfolioRow[]
  /** Is the person operationally involved in the project ("Project saya")? */
  involved: (projectId: Id, who?: Id) => boolean
  /** Latest event of a project. */
  lastMovement: (projectId: Id) => ProjectEvent | null
  /** Open leaf tasks owned by a function without a PIC. */
  unstaffed: (projectId?: Id) => Task[]
  functionLoad: () => FunctionLoad[]
  /** Weekly management review over [since, until]. */
  review: (since: DateStr, until: DateStr, projectIds?: readonly Id[]) => ReviewSections
}

export function makeViews(deps: {
  ix: BoardIndex
  perms: Permissions
  rules: Rules
  inbox: (who?: Id) => Inbox
  today: DateStr
  viewer: Viewer | null
}): Views {
  const { ix, perms, rules, inbox, today, viewer } = deps
  const { board } = ix
  const me = viewer?.personId ?? ''
  /** Resolve `who` to a person id ('' when the viewer has none), or '*' for everyone. */
  const person = (who: Id = ''): Id => (who === '' ? me : who)
  const isP = (who: Id, id: Id | null | undefined): boolean => {
    const w = person(who)
    return w === '*' ? !!id : !!w && id === w
  }
  const live = (projectId: Id): boolean => rules.pActive(ix.project(projectId))
  const ref = (x: { ref: string; title?: string }): string => x.ref
  const pname = (projectId: Id): string => ix.project(projectId)?.name ?? ''
  const day = (ts: Ts | null | undefined): DateStr => (ts ? tsToDate(ts) : today)
  const openLeaves = (projectId?: Id): Task[] =>
    (projectId ? ix.ptasks(projectId) : board.tasks).filter((t) => live(t.projectId) && rules.isLeaf(t) && !rules.isDone(t))

  const actions = (who: Id = ''): ActionItem[] => {
    const ib = inbox(who)
    const w = person(who)
    const out: ActionItem[] = []
    for (const t of ib.toValidate)
      out.push({
        key: `v${t.id}`,
        kind: 'validate',
        projectId: t.projectId,
        target: { kind: 'task', id: t.id },
        ref: ref(t),
        title: t.title,
        who: perms.validatorOf(t),
        when: day(t.submittedAt),
        label: 'Periksa',
        tone: 'violet',
        detail: `Diajukan ${rules.mname(t.assignee) || 'PIC'}`,
      })
    for (const m of ib.gates)
      out.push({
        key: `g${m.id}`,
        kind: 'decide-gate',
        projectId: m.projectId,
        target: { kind: 'gate', id: m.id },
        ref: rules.msNo(m),
        title: m.title,
        who: perms.approverOf(m),
        when: m.target || today,
        label: 'Putuskan milestone',
        tone: 'indigo',
        detail: 'Semua task diterima',
      })
    for (const m of ib.stops)
      out.push({
        key: `s${m.id}`,
        kind: 'gate-stop',
        projectId: m.projectId,
        target: { kind: 'gate', id: m.id },
        ref: rules.msNo(m),
        title: m.title,
        who: perms.approverOf(m),
        when: today,
        label: 'Tindak lanjut',
        tone: 'red',
        detail: 'Milestone dihentikan',
      })
    for (const p of ib.closes)
      out.push({
        key: `c${p.id}`,
        kind: 'close',
        projectId: p.id,
        target: { kind: 'project', id: p.id },
        ref: p.code,
        title: p.name,
        who: perms.pmOf(p),
        when: today,
        label: 'Tutup project',
        tone: 'green',
        detail: 'Semua milestone lulus',
      })
    for (const a of ib.asks)
      out.push({
        key: `a${a.id}`,
        kind: 'decide-ask',
        projectId: a.projectId,
        target: { kind: 'ask', id: a.id },
        ref: ref(a),
        title: a.question,
        who: perms.deciderOf(a),
        when: a.due || day(a.createdAt),
        label: a.due && a.due < today ? 'Lewat batas' : 'Putuskan',
        tone: a.due && a.due < today ? 'red' : 'amber',
        detail: 'Keputusan',
      })
    for (const t of ib.commits)
      out.push({
        key: `k${t.id}`,
        kind: 'commit',
        projectId: t.projectId,
        target: { kind: 'task', id: t.id },
        ref: ref(t),
        title: t.title,
        who: t.assignee,
        when: t.start,
        label: 'Komit tanggal',
        tone: 'grey',
        detail: 'Tanggal belum dikomit',
      })
    for (const t of ib.rejected)
      out.push({
        key: `r${t.id}`,
        kind: 'rework',
        projectId: t.projectId,
        target: { kind: 'task', id: t.id },
        ref: ref(t),
        title: t.title,
        who: t.assignee,
        when: day(t.rejectedAt),
        label: 'Perbaiki',
        tone: 'red',
        detail: `Ditolak: ${t.rejectReason ?? ''}`,
      })
    // Packages whose sub-tasks are all accepted: the PIC submits the package.
    for (const t of board.tasks)
      if (live(t.projectId) && rules.gated(ix.project(t.projectId)) && rules.packageReady(t) && !t.rejectReason && isP(who, t.assignee))
        out.push({
          key: `p${t.id}`,
          kind: 'submit-package',
          projectId: t.projectId,
          target: { kind: 'task', id: t.id },
          ref: ref(t),
          title: t.title,
          who: t.assignee,
          when: t.end,
          label: 'Ajukan paket',
          tone: 'indigo',
          detail: 'Semua sub-task diterima',
        })
    // Blockers that need this person: named, or (nobody named) the project's admins.
    for (const b of board.blockers) {
      if (b.resolvedAt !== null || !live(b.projectId)) continue
      const t = ix.task(b.taskId)
      if (!t || rules.isDone(t)) continue
      // Named → that person; unnamed → the project's own admins (members, not the super admin's
      // implicit reach), except the PIC who raised it.
      const mine =
        w === '*' ||
        (b.neededFromPerson ? isP(who, b.neededFromPerson) : !!w && ix.roleOf(b.projectId, w) === 'project_admin' && t.assignee !== w)
      if (!mine) continue
      out.push({
        key: `b${b.id}`,
        kind: 'blocker',
        projectId: b.projectId,
        target: { kind: 'task', id: t.id },
        ref: ref(t),
        title: t.title,
        who: b.neededFromPerson,
        when: b.target || day(b.raisedAt),
        label: 'Bantu buka hambatan',
        tone: 'red',
        detail: `Terhambat: ${b.reason}${b.need ? ` · butuh ${b.need}` : ''}`,
      })
    }
    const prio: Record<ActionKind, number> = {
      blocker: 0,
      rework: 1,
      validate: 2,
      'decide-ask': 3,
      'decide-gate': 4,
      'gate-stop': 5,
      'submit-package': 6,
      close: 7,
      commit: 8,
    }
    return out.sort((a, b) => a.when.localeCompare(b.when) || prio[a.kind] - prio[b.kind] || a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  }

  const myWork = (who: Id = ''): Task[] =>
    openLeaves()
      .filter((t) => t.stage !== 'review' && isP(who, t.assignee))
      .sort((a, b) => a.end.localeCompare(b.end) || pname(a.projectId).localeCompare(pname(b.projectId)) || a.ref.localeCompare(b.ref, 'en', { numeric: true }))

  const functionWork = (who: Id = ''): Task[] => {
    const w = person(who)
    const fn = w && w !== '*' ? ix.person(w)?.functionId : ''
    if (!fn) return []
    return openLeaves()
      .filter((t) => !t.assignee && t.ownerFunctionId === fn)
      .sort((a, b) => a.start.localeCompare(b.start) || a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  }

  const waiting = (who: Id = ''): WaitItem[] => {
    const out: WaitItem[] = []
    for (const t of board.tasks) {
      if (!live(t.projectId) || rules.isDone(t) || !isP(who, t.assignee)) continue
      if (t.stage === 'review') {
        const v = perms.validatorOf(t)
        out.push({
          key: `r${t.id}`,
          kind: 'review',
          projectId: t.projectId,
          target: { kind: 'task', id: t.id },
          ref: ref(t),
          title: t.title,
          on: v,
          onLabel: `Diperiksa ${rules.mname(v) || 'Project Admin'}`,
          since: day(t.submittedAt),
        })
        continue
      }
      const b = ix.openBlocker(t.id)
      if (b) {
        out.push({
          key: `b${b.id}`,
          kind: 'blocker',
          projectId: t.projectId,
          target: { kind: 'task', id: t.id },
          ref: ref(t),
          title: t.title,
          on: b.neededFromPerson,
          onLabel: b.neededFromPerson
            ? `Butuh ${rules.mname(b.neededFromPerson)}`
            : b.neededFromFunction
              ? `Butuh fungsi ${ix.fn(b.neededFromFunction)?.name ?? ''}`
              : 'Butuh Project Admin',
          since: day(b.raisedAt),
        })
      }
      // Prerequisites the person owns themselves are their own work, not a wait on others.
      const wait = rules.waitingToStart(t).filter((d) => person(who) === '*' || !isP(who, d.assignee))
      if (t.stage === 'todo' && wait.length)
        out.push({
          key: `d${t.id}`,
          kind: 'dependency',
          projectId: t.projectId,
          target: { kind: 'task', id: t.id },
          ref: ref(t),
          title: t.title,
          on: wait[0]?.assignee ?? '',
          onLabel: `Menunggu ${wait.map((d) => d.ref || d.title).join(', ')}`,
          since: t.start,
        })
    }
    for (const a of board.asks) {
      if (!live(a.projectId) || a.status === 'decided' || !isP(who, a.createdBy)) continue
      const d = perms.deciderOf(a)
      if (isP(who, d) && person(who) !== '*') continue
      out.push({
        key: `a${a.id}`,
        kind: 'decision',
        projectId: a.projectId,
        target: { kind: 'ask', id: a.id },
        ref: ref(a),
        title: a.question,
        on: d,
        onLabel: `Diputuskan ${rules.mname(d) || 'PM project'}`,
        since: day(a.createdAt),
      })
    }
    return out.sort((a, b) => a.since.localeCompare(b.since) || a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  }

  const week = (ws: DateStr, who: Id = ''): ScheduleItem[] => {
    const we = addDays(ws, 6)
    const inWeek = (d: DateStr | null | undefined): d is DateStr => !!d && d >= ws && d <= we
    const out: ScheduleItem[] = []
    for (const t of board.tasks) {
      if (!live(t.projectId) || !rules.isLeaf(t) || !isP(who, t.assignee)) continue
      const done = rules.isDone(t)
      const acc = t.acceptedAt ?? t.doneAt
      if (done && acc && inWeek(tsToDate(acc)))
        out.push({ key: `x${t.id}`, date: tsToDate(acc), kind: 'accepted', projectId: t.projectId, target: { kind: 'task', id: t.id }, ref: ref(t), title: t.title, who: t.assignee, label: 'Diterima', tone: 'green' })
      if (done) continue
      if (inWeek(t.end))
        out.push({ key: `e${t.id}`, date: t.end, kind: 'due', projectId: t.projectId, target: { kind: 'task', id: t.id }, ref: ref(t), title: t.title, who: t.assignee, label: t.end < today ? 'Telat' : 'Deadline', tone: t.end < today ? 'red' : 'amber' })
      if (inWeek(t.start) && t.start !== t.end)
        out.push({ key: `s${t.id}`, date: t.start, kind: 'start', projectId: t.projectId, target: { kind: 'task', id: t.id }, ref: ref(t), title: t.title, who: t.assignee, label: 'Mulai', tone: 'indigo' })
    }
    for (const c of board.commitments) {
      const t = ix.task(c.taskId)
      if (!t || !live(t.projectId) || !isP(who, t.assignee) || !inWeek(tsToDate(c.at))) continue
      out.push({ key: `c${c.id}`, date: tsToDate(c.at), kind: 'commitment', projectId: t.projectId, target: { kind: 'task', id: t.id }, ref: ref(t), title: t.title, who: t.assignee, label: 'Dikomit', tone: 'grey' })
    }
    for (const a of board.asks) {
      if (!live(a.projectId) || a.status === 'decided' || !inWeek(a.due)) continue
      if (!isP(who, perms.deciderOf(a)) && !isP(who, a.createdBy)) continue
      out.push({ key: `a${a.id}`, date: a.due, kind: 'decision', projectId: a.projectId, target: { kind: 'ask', id: a.id }, ref: ref(a), title: a.question, who: perms.deciderOf(a), label: 'Batas keputusan', tone: 'amber' })
    }
    for (const m of board.milestones) {
      if (!live(m.projectId) || !inWeek(m.target) || ['lulus', 'stop'].includes(rules.msState(m))) continue
      const w = person(who)
      const concerned =
        w === '*' || isP(who, perms.approverOf(m)) || ix.mtasks(m.id).some((t) => isP(who, t.assignee) || isP(who, perms.validatorOf(t)))
      if (!concerned) continue
      out.push({ key: `g${m.id}`, date: m.target, kind: 'gate', projectId: m.projectId, target: { kind: 'gate', id: m.id }, ref: rules.msNo(m), title: m.title, who: perms.approverOf(m), label: 'Target milestone', tone: 'indigo' })
    }
    const order: Record<ScheduleItem['kind'], number> = { due: 0, gate: 1, decision: 2, start: 3, commitment: 4, accepted: 5 }
    return out.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  }

  const blockedList = (projectId?: Id) =>
    board.blockers
      .filter((b) => b.resolvedAt === null && live(b.projectId) && (!projectId || b.projectId === projectId))
      .map((b) => ({ b, t: ix.task(b.taskId) }))
      .filter((x): x is { b: Blocker; t: Task } => !!x.t && !rules.isDone(x.t))
      .sort((a, b) => a.b.raisedAt - b.b.raisedAt)

  const waitingReview = (projectId?: Id): Task[] =>
    board.tasks
      .filter((t) => t.stage === 'review' && live(t.projectId) && (!projectId || t.projectId === projectId))
      .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0))

  const byDue = (a: Ask, b: Ask) => (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt
  const openAsks = (projectId?: Id): Ask[] =>
    board.asks.filter((a) => a.status !== 'decided' && live(a.projectId) && (!projectId || a.projectId === projectId)).sort(byDue)
  const asksFor = (who: Id = ''): Ask[] => openAsks().filter((a) => isP(who, perms.deciderOf(a)))

  const lastMovement = (projectId: Id): ProjectEvent | null => ix.projectEvents(projectId)[0] ?? null

  const involved = (projectId: Id, who: Id = ''): boolean => {
    const w = person(who)
    if (!w || w === '*') return false
    const role = ix.roleOf(projectId, w)
    if (!role || role === 'viewer') return false
    const p = ix.project(projectId)
    if (role === 'project_admin' || (p && p.owner === w)) return true
    const open = (t: Task) => !rules.isDone(t)
    return (
      ix.ptasks(projectId).some((t) => open(t) && (t.assignee === w || perms.validatorOf(t) === w)) ||
      ix.pms(projectId).some((m) => !['lulus', 'stop'].includes(rules.msState(m)) && perms.approverOf(m) === w) ||
      ix.pasks(projectId).some((a) => a.status !== 'decided' && (perms.deciderOf(a) === w || a.createdBy === w)) ||
      board.blockers.some((b) => b.projectId === projectId && b.resolvedAt === null && b.neededFromPerson === w)
    )
  }

  const portfolio = (): PortfolioRow[] =>
    [...board.projects]
      .sort((a, b) => Number(rules.pActive(b)) - Number(rules.pActive(a)) || a.name.localeCompare(b.name, 'id'))
      .map((p) => {
        const ms = ix.pms(p.id)
        const leaves = rules.leaves(p.id)
        return {
          p,
          prog: rules.prog(p.id),
          msPassed: ms.filter((m) => rules.msState(m) === 'lulus').length,
          msTotal: ms.length,
          health: rules.health(p),
          next: rules.currentMs(p),
          pm: perms.pmOf(p),
          lastMovement: lastMovement(p.id),
          late: leaves.filter(rules.isLate).length,
          blocked: ix.ptasks(p.id).filter((t) => !rules.isDone(t) && rules.isBlocked(t)).length,
          openAsks: ix.pasks(p.id).filter((a) => a.status !== 'decided').length,
          waitingReview: ix.ptasks(p.id).filter((t) => t.stage === 'review').length,
          mine: involved(p.id),
        }
      })

  const portfolioFilter = (rows: readonly PortfolioRow[], f: PortfolioFilter, q = ''): PortfolioRow[] => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      const active = rules.pActive(r.p)
      const ok =
        f === 'all'
          ? true
          : f === 'mine'
            ? r.mine
            : f === 'attention'
              ? active && !!r.health && r.health.level !== 'ok'
              : f === 'blocked'
                ? active && (r.blocked > 0 || r.late > 0)
                : !active
      return ok && (!s || `${r.p.name} ${r.p.code} ${r.p.entity}`.toLowerCase().includes(s))
    })
  }

  const unstaffed = (projectId?: Id): Task[] =>
    openLeaves(projectId)
      .filter((t) => !t.assignee && !!t.ownerFunctionId)
      .sort((a, b) => a.start.localeCompare(b.start) || a.ref.localeCompare(b.ref, 'en', { numeric: true }))

  const functionLoad = (): FunctionLoad[] => {
    const leaves = openLeaves()
    return board.functions
      .map((f) => {
        const ts = leaves.filter((t) => t.ownerFunctionId === f.id)
        return {
          functionId: f.id,
          name: f.name,
          open: ts.length,
          unstaffed: ts.filter((t) => !t.assignee).length,
          late: ts.filter(rules.isLate).length,
          blocked: ts.filter(rules.isBlocked).length,
          people: board.people.filter((p) => p.functionId === f.id).length,
        }
      })
      .filter((x) => x.open > 0)
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
  }

  const review = (since: DateStr, until: DateStr, projectIds?: readonly Id[]): ReviewSections => {
    const inScope = (pid: Id) => live(pid) && (!projectIds || projectIds.includes(pid))
    const inWindow = (ts: Ts) => {
      const d = tsToDate(ts)
      return d >= since && d <= until
    }
    const MOVED = new Set(['task_accepted', 'task_completed', 'task_submitted', 'task_rejected', 'task_reopened', 'gate_passed', 'gate_stopped', 'gate_rescoped', 'decision_made', 'blocker_raised', 'blocker_resolved', 'project_closed', 'project_stopped', 'project_reopened', 'task_created', 'task_deleted'])
    const moved = board.events.filter((e) => inScope(e.projectId) && MOVED.has(e.verb) && inWindow(e.at)).sort((a, b) => b.at - a.at)
    // Commitments that moved later during the window: open leaf work, recommitted in the window.
    const slipped = board.tasks
      .filter((t) => inScope(t.projectId) && rules.isLeaf(t) && !rules.isDone(t))
      .map((t) => ({ t, s: rules.slip(t) }))
      .filter((x) => !!x.s && x.s.days > 0 && inWindow(x.s.latest.at))
      .map(({ t, s }) => ({ t, from: s?.baseline.end ?? t.end, to: s?.latest.end ?? t.end, days: s?.days ?? 0 }))
      .sort((a, b) => b.days - a.days)
    const nextStart = addDays(until, 1)
    const nextEnd = addDays(until, 7)
    return {
      since,
      until,
      moved,
      slipped,
      late: board.tasks.filter((t) => inScope(t.projectId) && rules.isLeaf(t) && rules.isLate(t)).sort((a, b) => a.end.localeCompare(b.end)),
      blocked: blockedList().filter((x) => inScope(x.t.projectId)),
      decisions: openAsks().filter((a) => inScope(a.projectId)),
      dueNext: board.tasks
        .filter((t) => inScope(t.projectId) && rules.isLeaf(t) && !rules.isDone(t) && t.end >= nextStart && t.end <= nextEnd)
        .sort((a, b) => a.end.localeCompare(b.end)),
      gatesReady: board.milestones.filter((m) => inScope(m.projectId) && rules.msState(m) === 'siap'),
    }
  }

  return {
    actions,
    myWork,
    functionWork,
    waiting,
    week,
    blockedList,
    waitingReview,
    asksFor,
    openAsks,
    portfolio,
    portfolioFilter,
    involved,
    lastMovement,
    unstaffed,
    functionLoad,
    review,
  }
}

/** Days between a date and today (positive = in the past). */
export const daysSince = (date: DateStr, today: DateStr): number => dn(today) - dn(date)
