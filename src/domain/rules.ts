// Core derived state: task and milestone status, readiness, health, progress, status chips and
// the commitment rule of the prototype's saveTask. Names follow reference/prototype.html.
import { stageName } from './constants.ts'
import { dn, fmt } from './dates.ts'
import type { BoardIndex } from './lookup.ts'
import type { Permissions } from './permissions.ts'
import type { DateStr, DecisionSource, Id, Milestone, MsState, Project, Task } from './types.ts'

export interface SeqConflict {
  /** The previous milestone, which has not passed. */
  pv: Milestone
  /** Its end: target, or the latest end of its tasks. */
  pe: DateStr
}

export interface Readiness {
  /** The current milestone. */
  m: Milestone
  /** Tasks that are done, or committed with a PIC. */
  ok: number
  n: number
  ready: boolean
}

export type HealthLevel = 'bad' | 'warn' | 'ok'
export interface Health {
  level: HealthLevel
  label: string
  items: string[]
}

export interface Progress {
  /** Tasks done. */
  d: number
  n: number
  /** Percent done, rounded. */
  p: number
}

/** Chip classes used by the prototype (`chip ok`, `chip rv`, …); '' is the neutral stage chip. */
export type ChipKind = 'ok' | 'rv' | 'late' | 'soon' | ''
export interface Chip {
  kind: ChipKind
  text: string
}

/**
 * Commit intent when saving a task (prototype saveTask `commit` argument):
 * true = commit now, 'off' = un-commit, false = the commit box was hidden,
 * null/undefined = no explicit choice.
 */
export type CommitIntent = true | 'off' | false | null | undefined
export interface CommitResult {
  /** The task's new `committed` value. */
  committed: boolean
  /** Stamp committedAt/committedBy now (prototype quirk kept: can be true while committed is false for a task without PIC). */
  stamp: boolean
}

/**
 * How the database applies the same rule (M1 RPCs): any change of start, end or assignee clears
 * `committed` (and its stamps) unless the same call commits. commitAfterEdit is the client-side
 * preview of that rule.
 */
export const DB_COMMIT_RULE =
  'The database clears commitment whenever start, end or assignee change, unless the same call commits.'

const CLOSED_STATES: readonly MsState[] = ['lulus', 'stop']

export interface Rules {
  isDone: (t: Task) => boolean
  /** Gate mode (review flow) on; false for a missing project. */
  gated: (p: Project | null | undefined) => boolean
  pActive: (p: Project | null | undefined) => boolean
  /** Project of x is not active (closed or stopped): read-only until reopened. */
  locked: (x: { projectId: Id } | Project) => boolean
  isLate: (t: Task) => boolean
  needsCommit: (t: Task) => boolean
  durDays: (t: Task) => number
  /** Gate code, or M1…Mn by order. */
  msNo: (m: Milestone) => string
  msState: (m: Milestone) => MsState
  /** Latest end among the milestone's tasks, or null. */
  msDate: (m: Milestone) => DateStr | null
  msEnd: (m: Milestone) => DateStr | null
  msLate: (m: Milestone) => boolean
  prevMs: (m: Milestone) => Milestone | null
  currentMs: (p: Project) => Milestone | null
  readiness: (p: Project) => Readiness | null
  seqConflict: (t: Task) => SeqConflict | null
  readyToClose: (p: Project) => boolean
  health: (p: Project) => Health | null
  prog: (projectId: Id) => Progress
  /** Time chip (Telat / Deadline hari ini / n hari lagi / Diterima / Menunggu pemeriksa), or null. */
  due: (t: Task) => Chip | null
  /** due(t), or the stage name. */
  statusChip: (t: Task) => Chip
  /** Person name, '' when unknown. */
  mname: (id: Id | null | undefined) => string
  /** 'Pak X · Weekly review GM · 12 Okt · dicatat Dika', or the recorder when nobody else decided. */
  decWho: (src: DecisionSource | null | undefined, byId: Id | null | undefined) => string
  /** Commitment after saving task nt over old (null for a new task). */
  commitAfterEdit: (nt: Task, old: Task | null, commit: CommitIntent) => CommitResult
}

export function makeRules(ix: BoardIndex, today: DateStr, perms: Permissions): Rules {
  const isDone = (t: Task): boolean => t.stage === 'done'
  const gated = (p: Project | null | undefined): boolean => !!p && p.gateMode
  const pActive = (p: Project | null | undefined): boolean => !!p && (p.status || 'aktif') === 'aktif'
  const msNo = (m: Milestone): string => m.code || `M${ix.pms(m.projectId).findIndex((x) => x.id === m.id) + 1}`
  const msState = (m: Milestone): MsState => {
    if (m.status) return m.status
    const ts = ix.mtasks(m.id)
    if (!ts.length) return 'kosong'
    return ts.every(isDone) ? 'siap' : 'jalan'
  }
  const msDate = (m: Milestone): DateStr | null => {
    let last: DateStr | null = null
    for (const t of ix.mtasks(m.id)) if (last === null || t.end > last) last = t.end
    return last
  }
  const msEnd = (m: Milestone): DateStr | null => m.target || msDate(m)
  const isOpenMs = (m: Milestone): boolean => !CLOSED_STATES.includes(msState(m))
  const msLate = (m: Milestone): boolean =>
    !!(m.target && isOpenMs(m) && ((msDate(m) ?? '') > m.target || m.target < today))
  const prevMs = (m: Milestone): Milestone | null => {
    const ms = ix.pms(m.projectId)
    const i = ms.findIndex((x) => x.id === m.id)
    return i > 0 ? (ms[i - 1] ?? null) : null
  }
  const currentMs = (p: Project): Milestone | null => ix.pms(p.id).find(isOpenMs) ?? null
  const readiness = (p: Project): Readiness | null => {
    const m = currentMs(p)
    if (!m || !gated(p)) return null
    const ts = ix.mtasks(m.id)
    const ok = ts.filter((t) => isDone(t) || (t.committed && !!t.assignee)).length
    return { m, ok, n: ts.length, ready: ts.length > 0 && ok === ts.length }
  }
  const isLate = (t: Task): boolean => !isDone(t) && t.end < today
  const needsCommit = (t: Task): boolean => gated(ix.project(t.projectId)) && !isDone(t) && !t.committed
  const readyToClose = (p: Project): boolean => {
    const ms = ix.pms(p.id)
    return pActive(p) && ms.length > 0 && ms.every((m) => msState(m) === 'lulus')
  }
  const seqConflict = (t: Task): SeqConflict | null => {
    if (ix.project(t.projectId)?.parallelGates) return null
    const m = ix.milestone(t.milestoneId)
    if (!m || isDone(t)) return null
    const pv = prevMs(m)
    if (!pv || msState(pv) === 'lulus') return null
    const pe = msEnd(pv)
    return pe && t.start <= pe ? { pv, pe } : null
  }
  const mname = (id: Id | null | undefined): string => ix.person(id)?.name ?? ''
  const due = (t: Task): Chip | null => {
    if (isDone(t)) return { kind: 'ok', text: gated(ix.project(t.projectId)) ? 'Diterima' : 'Selesai' }
    if (t.stage === 'review') return { kind: 'rv', text: 'Menunggu pemeriksa' }
    const d = dn(t.end) - dn(today)
    if (d < 0) return { kind: 'late', text: `Telat ${-d} hari` }
    if (d === 0) return { kind: 'soon', text: 'Deadline hari ini' }
    if (d <= 3) return { kind: 'soon', text: `${d} hari lagi` }
    return null
  }

  return {
    isDone,
    gated,
    pActive,
    locked: (x) => !pActive(ix.project('projectId' in x ? x.projectId : x.id)),
    isLate,
    needsCommit,
    durDays: (t) => dn(t.end) - dn(t.start) + 1,
    msNo,
    msState,
    msDate,
    msEnd,
    msLate,
    prevMs,
    currentMs,
    readiness,
    seqConflict,
    readyToClose,
    health(p) {
      if (!pActive(p)) return null
      const bad: string[] = []
      const warn: string[] = []
      const late = ix.ptasks(p.id).filter((t) => !isDone(t) && isLate(t)).length
      if (late) bad.push(`${late} task telat`)
      for (const m of ix.pms(p.id)) {
        if (msState(m) === 'stop') bad.push(`${msNo(m)} dihentikan`)
        if (msLate(m)) bad.push(`${msNo(m)} lewat target`)
      }
      const r = readiness(p)
      if (r && !r.ready && r.n) warn.push(`${msNo(r.m)} belum siap jalan`)
      const od = ix.pasks(p.id).filter((a) => a.status !== 'decided' && a.due && a.due < today).length
      if (od) warn.push(`${od} keputusan lewat batas`)
      if (!ix.pms(p.id).length) warn.push('Belum ada milestone')
      if (readyToClose(p)) warn.push('Siap ditutup')
      const level: HealthLevel = bad.length ? 'bad' : warn.length ? 'warn' : 'ok'
      const label = { bad: 'Bermasalah', warn: 'Perlu perhatian', ok: 'Sehat' }[level]
      return { level, label, items: [...bad, ...warn] }
    },
    prog(projectId) {
      const ts = ix.ptasks(projectId)
      const d = ts.filter(isDone).length
      return { d, n: ts.length, p: ts.length ? Math.round((d / ts.length) * 100) : 0 }
    },
    due,
    statusChip: (t) => due(t) ?? { kind: '', text: stageName(t.stage) },
    mname,
    decWho(src, byId) {
      const rec = mname(byId) || 'Project Manager'
      if (!src?.deciderName) return rec + (src?.forum ? ` · ${src.forum}` : '')
      return (
        src.deciderName +
        (src.forum ? ` · ${src.forum}` : '') +
        (src.decidedOn ? ` · ${fmt(src.decidedOn)}` : '') +
        ` · dicatat ${rec}`
      )
    },
    commitAfterEdit(nt, old, commit) {
      // Light mode (gate_mode=false) has no commitment; saveTask leaves the field alone.
      if (!gated(ix.project(nt.projectId))) return { committed: nt.committed, stamp: false }
      const changed = !old || old.start !== nt.start || old.end !== nt.end || old.assignee !== nt.assignee
      let c = old ? old.committed : false
      if (commit === true) c = true
      else if (commit === 'off') c = false
      else if (commit === false && changed) c = false
      else if ((commit === null || commit === undefined) && changed)
        c = !!old && old.assignee === nt.assignee && perms.canCommit(nt)
      const stamp = c && !(old?.committed && !changed)
      return { committed: c && !!nt.assignee, stamp }
    },
  }
}
