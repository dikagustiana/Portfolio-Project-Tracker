// Lookup maps built once per Board (prototype: member/project/task/mstone/ptasks/pms/mtasks), plus
// the structure and history added in the architecture pass: sub-tasks, short ids, blockers,
// review rounds, commitments, comments and events by record.
// Lists keep the Board's array order, which is what the prototype's filters return.
import type {
  Ask,
  Blocker,
  Board,
  BusinessFunction,
  Comment,
  Commitment,
  Id,
  Milestone,
  Person,
  Project,
  ProjectEvent,
  ProjectRole,
  Reminder,
  ReviewRound,
  StepTemplate,
  Task,
} from './types.ts'

export interface BoardIndex {
  readonly board: Board
  person: (id: Id | null | undefined) => Person | undefined
  project: (id: Id | null | undefined) => Project | undefined
  task: (id: Id | null | undefined) => Task | undefined
  milestone: (id: Id | null | undefined) => Milestone | undefined
  ask: (id: Id | null | undefined) => Ask | undefined
  template: (id: Id | null | undefined) => StepTemplate | undefined
  fn: (id: Id | null | undefined) => BusinessFunction | undefined
  /** Project by its short code (MB), case-insensitive. */
  projectByCode: (code: string) => Project | undefined
  /** Records by short id within a project, case-insensitive. */
  taskByRef: (projectId: Id, ref: string) => Task | undefined
  milestoneByRef: (projectId: Id, ref: string) => Milestone | undefined
  askByRef: (projectId: Id, ref: string) => Ask | undefined
  /** Tasks of a project. */
  ptasks: (projectId: Id) => readonly Task[]
  /** Milestones of a project sorted by `order` (stable). */
  pms: (projectId: Id) => readonly Milestone[]
  /** Tasks of a milestone (packages and sub-tasks). */
  mtasks: (milestoneId: Id) => readonly Task[]
  /** Sub-tasks of a package, by ref. */
  children: (taskId: Id) => readonly Task[]
  /** Asks of a project. */
  pasks: (projectId: Id) => readonly Ask[]
  /** Reminders of a task, newest first. */
  remFor: (taskId: Id) => readonly Reminder[]
  /** The person's role on the project, null when not a member. */
  roleOf: (projectId: Id, personId: Id) => ProjectRole | null
  /** Number of memberships on a project. */
  memberCount: (projectId: Id) => number
  /** The task's open blocker, if any. */
  openBlocker: (taskId: Id) => Blocker | undefined
  /** Every blocker of a task, newest first. */
  blockersOf: (taskId: Id) => readonly Blocker[]
  /** Review rounds of a task, oldest first. */
  reviewsOf: (taskId: Id) => readonly ReviewRound[]
  /** Commitments of a task in the order they were made (the first is the baseline). */
  commitmentsOf: (taskId: Id) => readonly Commitment[]
  /** Comments on a task or Keputusan, oldest first. */
  commentsOf: (recordId: Id) => readonly Comment[]
  /** Events of a project, newest first. */
  projectEvents: (projectId: Id) => readonly ProjectEvent[]
  /** Events about one record, newest first. */
  recordEvents: (recordId: Id) => readonly ProjectEvent[]
}

const EMPTY: readonly never[] = []

function groupBy<T>(items: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of items) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}

const byId = <T extends { id: Id }>(items: readonly T[]): Map<Id, T> => new Map(items.map((x) => [x.id, x]))
const refKey = (projectId: Id, ref: string): string => `${projectId}\u0000${ref.toUpperCase()}`

export function makeIndex(board: Board): BoardIndex {
  const people = byId(board.people)
  const projects = byId(board.projects)
  const tasks = byId(board.tasks)
  const milestones = byId(board.milestones)
  const asks = byId(board.asks)
  const templates = byId(board.templates)
  const fns = byId(board.functions)
  const codes = new Map(board.projects.filter((p) => p.code).map((p) => [p.code.toUpperCase(), p]))
  const taskRefs = new Map(board.tasks.filter((t) => t.ref).map((t) => [refKey(t.projectId, t.ref), t]))
  const msRefs = new Map(board.milestones.filter((m) => m.ref).map((m) => [refKey(m.projectId, m.ref), m]))
  const askRefs = new Map(board.asks.filter((a) => a.ref).map((a) => [refKey(a.projectId, a.ref), a]))
  const tasksByProject = groupBy(board.tasks, (t) => t.projectId)
  const tasksByMs = groupBy(board.tasks, (t) => t.milestoneId)
  const childrenOf = groupBy(
    board.tasks.filter((t) => t.parentId),
    (t) => t.parentId,
  )
  for (const list of childrenOf.values()) list.sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  const asksByProject = groupBy(board.asks, (a) => a.projectId)
  const msByProject = groupBy(board.milestones, (m) => m.projectId)
  for (const list of msByProject.values()) list.sort((a, b) => a.order - b.order)
  const remByTask = groupBy(board.reminders, (r) => r.taskId)
  for (const list of remByTask.values()) list.sort((a, b) => b.at - a.at)
  const roles = new Map(board.memberships.map((m) => [`${m.projectId}\u0000${m.personId}`, m.role]))
  const memberCounts = new Map<Id, number>()
  for (const m of board.memberships) memberCounts.set(m.projectId, (memberCounts.get(m.projectId) ?? 0) + 1)
  const blockersByTask = groupBy(board.blockers, (b) => b.taskId)
  for (const list of blockersByTask.values()) list.sort((a, b) => b.raisedAt - a.raisedAt)
  const open = new Map(board.blockers.filter((b) => b.resolvedAt === null).map((b) => [b.taskId, b]))
  const reviewsByTask = groupBy(board.reviews, (r) => r.taskId)
  for (const list of reviewsByTask.values()) list.sort((a, b) => a.round - b.round)
  const commitsByTask = groupBy(board.commitments, (c) => c.taskId)
  for (const list of commitsByTask.values()) list.sort((a, b) => a.seq - b.seq)
  const commentsBy = groupBy(board.comments, (c) => c.taskId || c.askId)
  for (const list of commentsBy.values()) list.sort((a, b) => a.at - b.at)
  const newest = (a: ProjectEvent, b: ProjectEvent) => b.at - a.at || b.id - a.id
  const eventsByProject = groupBy(board.events, (e) => e.projectId)
  for (const list of eventsByProject.values()) list.sort(newest)
  const eventsByObject = groupBy(
    board.events.filter((e) => e.objectId),
    (e) => e.objectId,
  )
  for (const list of eventsByObject.values()) list.sort(newest)

  const get = <T>(map: Map<Id, T>, id: Id | null | undefined): T | undefined => (id ? map.get(id) : undefined)

  return {
    board,
    person: (id) => get(people, id),
    project: (id) => get(projects, id),
    task: (id) => get(tasks, id),
    milestone: (id) => get(milestones, id),
    ask: (id) => get(asks, id),
    template: (id) => get(templates, id),
    fn: (id) => get(fns, id),
    projectByCode: (code) => codes.get(code.toUpperCase()),
    taskByRef: (pid, ref) => taskRefs.get(refKey(pid, ref)),
    milestoneByRef: (pid, ref) => msRefs.get(refKey(pid, ref)),
    askByRef: (pid, ref) => askRefs.get(refKey(pid, ref)),
    ptasks: (pid) => tasksByProject.get(pid) ?? EMPTY,
    pms: (pid) => msByProject.get(pid) ?? EMPTY,
    mtasks: (mid) => tasksByMs.get(mid) ?? EMPTY,
    children: (tid) => childrenOf.get(tid) ?? EMPTY,
    pasks: (pid) => asksByProject.get(pid) ?? EMPTY,
    remFor: (tid) => remByTask.get(tid) ?? EMPTY,
    roleOf: (pid, personId) => roles.get(`${pid}\u0000${personId}`) ?? null,
    memberCount: (pid) => memberCounts.get(pid) ?? 0,
    openBlocker: (tid) => open.get(tid),
    blockersOf: (tid) => blockersByTask.get(tid) ?? EMPTY,
    reviewsOf: (tid) => reviewsByTask.get(tid) ?? EMPTY,
    commitmentsOf: (tid) => commitsByTask.get(tid) ?? EMPTY,
    commentsOf: (rid) => commentsBy.get(rid) ?? EMPTY,
    projectEvents: (pid) => eventsByProject.get(pid) ?? EMPTY,
    recordEvents: (rid) => eventsByObject.get(rid) ?? EMPTY,
  }
}
