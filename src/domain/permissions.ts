// Who decides and who may act (docs/ARCHITECTURE.md §D). Project roles say who administers a
// project (project_admin), who works in it (member) and who only reads (viewer); judgment
// (pemeriksa, pemutus, decider) is record-level and open to admins and members alike, never to
// the task's own PIC. These helpers mirror the database RPCs and are UI conveniences only: the
// database enforces the same rules.
//
// ctx.viewer === null is the prototype's local mode (no signed-in user): every viewer helper
// answers as if the viewer were a project admin on every project.
import type { BoardIndex } from './lookup.ts'
import type { Ask, Blocker, Id, Milestone, Project, ProjectRole, Task, Viewer } from './types.ts'

export interface Permissions {
  /** personId when that person may judge in the project (project_admin or member), else ''. */
  judgeOnly: (personId: Id | null | undefined, projectId: Id) => Id
  /** The project's PM (owner) when they are a project admin, else ''. */
  pmOf: (p: Project | null | undefined) => Id
  /** Pemutus of a milestone: its approver → the project PM → ''. */
  approverOf: (m: Milestone) => Id
  /** Pemeriksa of a task: its own → (sub-task) its package's own → gate pemutus → project PM → ''. */
  validatorOf: (t: Task) => Id
  /** True when the effective validator is the task's own PIC (nobody can accept it). */
  selfAccept: (t: Task) => boolean
  /** Pemutus of an ask: its decider → the project PM → ''. */
  deciderOf: (a: Ask) => Id

  /** The viewer's role on a project ('project_admin' for the super admin and in local mode). */
  roleIn: (projectId: Id) => ProjectRole | null
  /** The viewer administers this project (project admin or super admin). */
  isAdminIn: (projectId: Id) => boolean
  /** The viewer may comment and raise blockers or Keputusan here (admin or member). */
  canContribute: (projectId: Id) => boolean
  /** Viewer is the super admin, or local mode. */
  isSuperAdmin: () => boolean
  /** Viewer is this task's PIC. */
  viewerIsPIC: (t: Task) => boolean
  /** May the viewer act as personId: it is the viewer, or a project admin acting for someone without a login. */
  canAct: (personId: Id, projectId: Id) => boolean
  /** May the viewer commit the task's dates: the PIC, or a project admin for a PIC without a login. Not packages with sub-tasks. */
  canCommit: (t: Task) => boolean
  /** May the viewer accept or reject (or reopen) the task. */
  canValidate: (t: Task) => boolean
  /** May the viewer decide (or record the forum's decision on) a gate. */
  canDecide: (m: Milestone) => boolean
  canOwn: (p: Project) => boolean
  /** Project planning: gates, any task, project settings. */
  canPlan: (p: Project | null | undefined) => boolean
  /** May the viewer edit this task's planning fields: a project admin, or the package PIC for a sub-task. */
  canPlanTask: (t: Task) => boolean
  /** May the viewer add a sub-task under this task. */
  canAddChild: (t: Task) => boolean
  canDecideAsk: (a: Ask) => boolean
  /** Edit an open Keputusan: a project admin, or whoever raised it. */
  canEditAsk: (a: Ask) => boolean
  /** Mark a task Terhambat: its PIC (or a project admin). */
  canBlock: (t: Task) => boolean
  canResolveBlocker: (b: Blocker, t: Task) => boolean
}

export function makePermissions(ix: BoardIndex, viewer: Viewer | null): Permissions {
  const judgeOnly = (personId: Id | null | undefined, projectId: Id): Id => {
    const r = personId ? ix.roleOf(projectId, personId) : null
    return personId && (r === 'project_admin' || r === 'member') ? personId : ''
  }
  const pmOf = (p: Project | null | undefined): Id => (p && p.owner && ix.roleOf(p.id, p.owner) === 'project_admin' ? p.owner : '')
  const approverOf = (m: Milestone): Id => judgeOnly(m.approver, m.projectId) || pmOf(ix.project(m.projectId)) || ''
  const validatorOf = (t: Task): Id => {
    const parent = t.parentId ? ix.task(t.parentId) : undefined
    const m = ix.milestone(t.milestoneId)
    return (
      judgeOnly(t.validator, t.projectId) ||
      (parent ? judgeOnly(parent.validator, t.projectId) : '') ||
      (m ? approverOf(m) : pmOf(ix.project(t.projectId))) ||
      ''
    )
  }
  const selfAccept = (t: Task): boolean => {
    const a = validatorOf(t)
    return !!(a && t.assignee && a === t.assignee)
  }
  const deciderOf = (a: Ask): Id => judgeOnly(a.decider, a.projectId) || pmOf(ix.project(a.projectId)) || ''

  const roleIn = (projectId: Id): ProjectRole | null => {
    if (!viewer || viewer.isSuperAdmin) return 'project_admin'
    return viewer.personId ? ix.roleOf(projectId, viewer.personId) : null
  }
  const isAdminIn = (projectId: Id): boolean => roleIn(projectId) === 'project_admin'
  const canContribute = (projectId: Id): boolean => {
    const r = roleIn(projectId)
    return r === 'project_admin' || r === 'member'
  }
  const isMe = (personId: Id | null | undefined): boolean => !!viewer?.personId && personId === viewer.personId
  const canAct = (personId: Id, projectId: Id): boolean => {
    if (!viewer) return true
    if (personId && isMe(personId)) return true
    const m = personId ? ix.person(personId) : undefined
    return (!m || !m.userId) && isAdminIn(projectId)
  }
  const viewerIsPIC = (t: Task): boolean => !!t.assignee && isMe(t.assignee)
  const packagePIC = (parentId: Id): boolean => {
    const par = ix.task(parentId)
    return !!par && !par.parentId && viewerIsPIC(par)
  }
  const canBlock = (t: Task): boolean => canAct(t.assignee, t.projectId) || isAdminIn(t.projectId)

  return {
    judgeOnly,
    pmOf,
    approverOf,
    validatorOf,
    selfAccept,
    deciderOf,
    roleIn,
    isAdminIn,
    canContribute,
    isSuperAdmin: () => !viewer || viewer.isSuperAdmin,
    viewerIsPIC,
    canAct,
    canCommit(t) {
      if (ix.children(t.id).length) return false
      if (!viewer || viewerIsPIC(t)) return true
      const m = ix.person(t.assignee)
      return !!m && !m.userId && isAdminIn(t.projectId)
    },
    // Only the effective validator, or a project admin acting for a validator without a login.
    // Never the PIC, never a self-accepting task.
    canValidate: (t) => !viewerIsPIC(t) && !selfAccept(t) && canAct(validatorOf(t), t.projectId),
    canDecide: (m) => canAct(approverOf(m), m.projectId) || isAdminIn(m.projectId),
    canOwn: (p) => isAdminIn(p.id),
    canPlan: (p) => !!p && isAdminIn(p.id),
    canPlanTask: (t) => isAdminIn(t.projectId) || (!!t.parentId && canContribute(t.projectId) && packagePIC(t.parentId)),
    canAddChild: (t) => !t.parentId && (isAdminIn(t.projectId) || (canContribute(t.projectId) && viewerIsPIC(t))),
    canDecideAsk: (a) => canAct(deciderOf(a), a.projectId),
    canEditAsk: (a) => isAdminIn(a.projectId) || (!!a.createdBy && isMe(a.createdBy) && canContribute(a.projectId)),
    canBlock,
    canResolveBlocker: (b, t) => canBlock(t) || isMe(b.raisedBy) || isMe(b.neededFromPerson),
  }
}
