// Value chain per project (prototype VC, VC_LP, vcOf, hasVC, vcStat). Steps come from the project's
// step template (board.templates) instead of the prototype's hard-coded trading chain.
import type { BoardIndex } from './lookup.ts'
import type { Rules } from './rules.ts'
import type { Id, Project, Task, TemplateStep } from './types.ts'

export interface VcStat {
  /** Tasks in the step. */
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

export interface VcSteps {
  /** chain and output steps in sort order: the chevron strip ending in the Report box. */
  strip: TemplateStep[]
  /** side steps in sort order, shown as a separate block (Logistics services). */
  side: TemplateStep[]
  /** Every step in sort order. */
  all: TemplateStep[]
}

export interface ValueChain {
  /** Step codes a task fills. */
  vcOf: (t: Task) => readonly string[]
  /** '⓪ Appraise', or the name alone when the step has no number. */
  vcLabel: (s: TemplateStep) => string
  /** The project's template steps, or null when the project has no template. */
  vcSteps: (p: Project | null | undefined) => VcSteps | null
  /** The project has a template and at least one of its tasks sits in a step. */
  hasVC: (p: Project | null | undefined) => boolean
  vcStat: (projectId: Id, stepCode: string) => VcStat
}

export function makeValueChain(ix: BoardIndex, rules: Rules): ValueChain {
  const vcOf = (t: Task): readonly string[] => t.steps
  const vcSteps = (p: Project | null | undefined): VcSteps | null => {
    const tpl = ix.template(p?.stepTemplateId)
    if (!tpl) return null
    const all = [...tpl.steps].sort((a, b) => a.sort - b.sort)
    return { strip: all.filter((s) => s.kind !== 'side'), side: all.filter((s) => s.kind === 'side'), all }
  }
  return {
    vcOf,
    vcLabel: (s) => (s.no ? `${s.no} ` : '') + s.name,
    vcSteps,
    hasVC: (p) => !!p && !!vcSteps(p) && ix.ptasks(p.id).some((t) => vcOf(t).length > 0),
    vcStat(projectId, stepCode) {
      const ts = ix.ptasks(projectId).filter((t) => vcOf(t).includes(stepCode))
      return {
        n: ts.length,
        done: ts.filter(rules.isDone).length,
        rev: ts.filter((t) => t.stage === 'review').length,
        pic: ts.filter((t) => t.assignee).length,
        com: ts.filter((t) => t.committed || rules.isDone(t)).length,
        late: ts.filter(rules.isLate).length,
      }
    },
  }
}
