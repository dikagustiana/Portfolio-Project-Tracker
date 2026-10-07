// Value chain per project (prototype VC, VC_LP, vcOf, hasVC, vcStat). Steps come from the project's
// step template (board.templates) instead of the prototype's hard-coded trading chain. Step
// progress counts leaf tasks (ARCHITECTURE §E); a sub-task without steps of its own sits in its
// package's steps.
import type { BoardIndex } from './lookup.ts'
import type { Progress, Rules } from './rules.ts'
import type { Id, Project, Task, TemplateStep } from './types.ts'

export interface VcStat {
  /** Leaf tasks in the step. */
  n: number
  done: number
  /** Waiting for the validator. */
  rev: number
  /** With a PIC. */
  pic: number
  /** Committed or done. */
  com: number
  late: number
}

/** State of a value-chain module: green complete, indigo active, amber attention, red blocked/late, grey idle. */
export type VcState = 'done' | 'active' | 'attention' | 'blocked' | 'idle'

/** One compact progress module (vcStat plus progress, blocked count and a state). */
export interface VcModule {
  stat: VcStat
  prog: Progress
  blocked: number
  state: VcState
  /** Short status line, e.g. '1 menunggu pemeriksaan'. */
  note: string
}

export interface VcSteps {
  /** chain and output steps in sort order: the chevron strip ending in the Report box. */
  strip: TemplateStep[]
  /** side steps in sort order, shown as a separate block (Logistics services). */
  side: TemplateStep[]
  /** Every step in sort order. */
  all: TemplateStep[]
}

export interface ValueChain {
  /** Step codes a task fills (its own, else its package's). */
  vcOf: (t: Task) => readonly string[]
  /** '⓪ Appraise', or the name alone when the step has no number. */
  vcLabel: (s: TemplateStep) => string
  /** The project's template steps, or null when the project has no template. */
  vcSteps: (p: Project | null | undefined) => VcSteps | null
  /** The project has a template and at least one of its tasks sits in a step. */
  hasVC: (p: Project | null | undefined) => boolean
  vcStat: (projectId: Id, stepCode: string) => VcStat
  vcModule: (projectId: Id, stepCode: string) => VcModule
}

export function makeValueChain(ix: BoardIndex, rules: Rules): ValueChain {
  const vcOf = (t: Task): readonly string[] => (t.steps.length || !t.parentId ? t.steps : (ix.task(t.parentId)?.steps ?? t.steps))
  const vcSteps = (p: Project | null | undefined): VcSteps | null => {
    const tpl = ix.template(p?.stepTemplateId)
    if (!tpl) return null
    const all = [...tpl.steps].sort((a, b) => a.sort - b.sort)
    return { strip: all.filter((s) => s.kind !== 'side'), side: all.filter((s) => s.kind === 'side'), all }
  }
  const vcStat = (projectId: Id, stepCode: string): VcStat => {
    const ts = ix.ptasks(projectId).filter((t) => rules.isLeaf(t) && vcOf(t).includes(stepCode))
    return {
      n: ts.length,
      done: ts.filter(rules.isDone).length,
      rev: ts.filter((t) => t.stage === 'review').length,
      pic: ts.filter((t) => t.assignee).length,
      com: ts.filter((t) => t.committed || rules.isDone(t)).length,
      late: ts.filter(rules.isLate).length,
    }
  }
  return {
    vcStat,
    vcModule(projectId, stepCode) {
      const stat = vcStat(projectId, stepCode)
      const ts = ix.ptasks(projectId).filter((t) => rules.isLeaf(t) && vcOf(t).includes(stepCode))
      const blocked = ts.filter((t) => !rules.isDone(t) && rules.isBlocked(t)).length
      const prog: Progress = { d: stat.done, n: stat.n, p: stat.n ? Math.round((stat.done / stat.n) * 100) : 0 }
      const started = ts.some((t) => t.stage !== 'todo')
      const state: VcState = !stat.n
        ? 'idle'
        : stat.done === stat.n
          ? 'done'
          : blocked || stat.late
            ? 'blocked'
            : stat.pic < stat.n || stat.com < stat.n
              ? 'attention'
              : started
                ? 'active'
                : 'idle'
      const note = !stat.n
        ? 'Belum ada task'
        : stat.done === stat.n
          ? 'Selesai'
          : blocked
            ? `${blocked} terhambat`
            : stat.late
              ? `${stat.late} telat`
              : stat.rev
                ? `${stat.rev} menunggu pemeriksaan`
                : stat.pic < stat.n
                  ? `${stat.n - stat.pic} belum ada PIC`
                  : stat.com < stat.n
                    ? `${stat.n - stat.com} belum dikomit`
                    : started
                      ? 'Berjalan'
                      : 'Belum mulai'
      return { stat, prog, blocked, state, note }
    },
    vcOf,
    vcLabel: (s) => (s.no ? `${s.no} ` : '') + s.name,
    vcSteps,
    hasVC: (p) => !!p && !!vcSteps(p) && ix.ptasks(p.id).some((t) => vcOf(t).length > 0),
  }
}
