// The action inbox (prototype `inbox(who)`), shared by "Minggu ini", the sidebar badge and the
// daily digest so all three apply the same rules.
//   who = ''        → the viewer, judged by the viewer permission helpers
//   who = '*'       → everyone (ignores the viewer)
//   who = person id → as that person (ignores the viewer)
import type { BoardIndex } from './lookup.ts'
import type { Permissions } from './permissions.ts'
import type { Rules } from './rules.ts'
import type { Ask, Id, Milestone, Project, Task, Viewer } from './types.ts'

export interface Inbox {
  /** Tasks submitted for review that this person checks. */
  toValidate: Task[]
  /** Gates with every task accepted, waiting for a decision. */
  gates: Milestone[]
  /** Stopped gates needing follow-up. */
  stops: Milestone[]
  /** Projects with every gate passed, ready to close. */
  closes: Project[]
  /** Open asks this person decides. */
  asks: Ask[]
  /** Tasks whose dates this person (as PIC) must commit. */
  commits: Task[]
  /** Rejected tasks back with this person (as PIC). */
  rejected: Task[]
  n: number
}

export function makeInbox(
  ix: BoardIndex,
  perms: Permissions,
  rules: Rules,
  viewer: Viewer | null,
): (who?: Id) => Inbox {
  const { board } = ix
  return (who = '') => {
    const isP = (id: Id): boolean =>
      who === '*' ? true : who ? id === who : !viewer || (!!viewer.personId && id === viewer.personId)
    const valOK = (t: Task): boolean => (who ? isP(perms.validatorOf(t)) || who === '*' : perms.canValidate(t))
    const decOK = (id: Id, projectId: Id): boolean => (who ? isP(id) || who === '*' : perms.canAct(id || '', projectId))
    const live = (x: { projectId: Id }): boolean => rules.pActive(ix.project(x.projectId))

    const toValidate = board.tasks.filter(
      (t) => live(t) && t.stage === 'review' && rules.gated(ix.project(t.projectId)) && valOK(t),
    )
    const gates = board.milestones.filter(
      (m) => live(m) && rules.msState(m) === 'siap' && decOK(perms.approverOf(m), m.projectId),
    )
    const stops = board.milestones.filter(
      (m) => live(m) && rules.msState(m) === 'stop' && decOK(perms.approverOf(m), m.projectId),
    )
    const closes = board.projects.filter((p) => rules.readyToClose(p) && decOK(perms.pmOf(p) || '', p.id))
    const asks = board.asks.filter(
      (a) => live(a) && a.status !== 'decided' && decOK(perms.deciderOf(a), a.projectId),
    )
    const commits = board.tasks.filter(
      (t) => live(t) && rules.needsCommit(t) && !!t.assignee && t.stage !== 'review' && isP(t.assignee),
    )
    const rejected = board.tasks.filter(
      (t) => live(t) && !!t.rejectReason && !rules.isDone(t) && t.stage !== 'review' && isP(t.assignee),
    )
    return {
      toValidate,
      gates,
      stops,
      closes,
      asks,
      commits,
      rejected,
      n: toValidate.length + gates.length + stops.length + closes.length + asks.length + commits.length + rejected.length,
    }
  }
}
