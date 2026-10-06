// Who decides and who may act. The prototype had one global PM role (`access==='pm'`); here the
// PM check is per project through memberships, and the rules mirror the database RPCs (BRIEF §3).
// These helpers are UI conveniences only: the database enforces the same rules.
//
// ctx.viewer === null is the prototype's local mode (no signed-in user): every viewer helper
// answers as if the viewer were a PM on every project.
import type { BoardIndex } from './lookup.ts'
import type { Ask, Id, Milestone, Project, ProjectRole, Task, Viewer } from './types.ts'

export interface Permissions {
  /** personId when that person is a `pm` member of the project, else ''. */
  pmOnly: (personId: Id | null | undefined, projectId: Id) => Id
  /** The project's PM (owner) when they are a pm member, else ''. */
  pmOf: (p: Project | null | undefined) => Id
  /** Pemutus of a milestone: its approver → the project PM → ''. */
  approverOf: (m: Milestone) => Id
  /** Pemeriksa of a task: its validator → its milestone's approver (or the project PM) → ''. */
  validatorOf: (t: Task) => Id
  /** True when the effective validator is the task's own PIC (nobody can accept it). */
  selfAccept: (t: Task) => boolean
  /** Pemutus of an ask: its decider → the project PM → ''. */
  deciderOf: (a: Ask) => Id

  /** The viewer's role on a project ('pm' for the app owner and in local mode). */
  roleIn: (projectId: Id) => ProjectRole | null
  isPMin: (projectId: Id) => boolean
  /** Viewer is the app owner, or local mode (prototype `isAdmin`). */
  isAdmin: () => boolean
  /** Viewer is this task's PIC. */
  viewerIsPIC: (t: Task) => boolean
  /** May the viewer act as personId: it is the viewer, or a PM acting for someone without a login. */
  canAct: (personId: Id, projectId: Id) => boolean
  /** May the viewer commit the task's dates: the PIC, or a PM for a PIC without a login. */
  canCommit: (t: Task) => boolean
  /** May the viewer accept or reject (or reopen) the task. */
  canValidate: (t: Task) => boolean
  canDecide: (m: Milestone) => boolean
  canOwn: (p: Project) => boolean
  canPlan: (p: Project | null | undefined) => boolean
  canDecideAsk: (a: Ask) => boolean
}

export function makePermissions(ix: BoardIndex, viewer: Viewer | null): Permissions {
  const pmOnly = (personId: Id | null | undefined, projectId: Id): Id =>
    personId && ix.roleOf(projectId, personId) === 'pm' ? personId : ''
  const pmOf = (p: Project | null | undefined): Id => (p ? pmOnly(p.owner, p.id) : '')
  const approverOf = (m: Milestone): Id => pmOnly(m.approver, m.projectId) || pmOf(ix.project(m.projectId)) || ''
  const validatorOf = (t: Task): Id => {
    const m = ix.milestone(t.milestoneId)
    return pmOnly(t.validator, t.projectId) || (m ? approverOf(m) : pmOf(ix.project(t.projectId))) || ''
  }
  const selfAccept = (t: Task): boolean => {
    const a = validatorOf(t)
    return !!(a && t.assignee && a === t.assignee)
  }
  const deciderOf = (a: Ask): Id => pmOnly(a.decider, a.projectId) || pmOf(ix.project(a.projectId)) || ''

  const roleIn = (projectId: Id): ProjectRole | null => {
    if (!viewer || viewer.isOwner) return 'pm'
    const r = viewer.personId ? ix.roleOf(projectId, viewer.personId) : null
    return r ?? (viewer.isGroupViewer ? 'viewer' : null)
  }
  const isPMin = (projectId: Id): boolean => roleIn(projectId) === 'pm'
  const isViewer = (personId: Id): boolean => !!viewer?.personId && personId === viewer.personId
  const canAct = (personId: Id, projectId: Id): boolean => {
    if (!viewer) return true
    if (personId && isViewer(personId)) return true
    const m = personId ? ix.person(personId) : undefined
    return (!m || !m.userId) && isPMin(projectId)
  }
  const viewerIsPIC = (t: Task): boolean => !!t.assignee && isViewer(t.assignee)

  return {
    pmOnly,
    pmOf,
    approverOf,
    validatorOf,
    selfAccept,
    deciderOf,
    roleIn,
    isPMin,
    isAdmin: () => !viewer || viewer.isOwner,
    viewerIsPIC,
    canAct,
    canCommit(t) {
      if (!viewer || viewerIsPIC(t)) return true
      const m = ix.person(t.assignee)
      return !!m && !m.userId && isPMin(t.projectId)
    },
    // Tightened vs the prototype (which let any PM validate): only the effective validator, or a
    // PM acting for a validator who has no login. Never the PIC, never a self-accepting task.
    canValidate: (t) => !viewerIsPIC(t) && !selfAccept(t) && canAct(validatorOf(t), t.projectId),
    canDecide: (m) => isPMin(m.projectId),
    canOwn: (p) => isPMin(p.id),
    canPlan: (p) => !!p && isPMin(p.id),
    canDecideAsk: (a) => canAct(deciderOf(a), a.projectId),
  }
}
