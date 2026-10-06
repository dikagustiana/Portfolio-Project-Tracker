// Lookup maps built once per Board (prototype: member/project/task/mstone/ptasks/pms/mtasks).
// Lists keep the Board's array order, which is what the prototype's filters return.
import type {
  Ask,
  Board,
  Id,
  Milestone,
  Person,
  Project,
  ProjectRole,
  Reminder,
  StepTemplate,
  Task,
} from './types.ts'

export interface BoardIndex {
  readonly board: Board
  person: (id: Id | null | undefined) => Person | undefined
  project: (id: Id | null | undefined) => Project | undefined
  task: (id: Id | null | undefined) => Task | undefined
  milestone: (id: Id | null | undefined) => Milestone | undefined
  template: (id: Id | null | undefined) => StepTemplate | undefined
  /** Tasks of a project. */
  ptasks: (projectId: Id) => readonly Task[]
  /** Milestones of a project sorted by `order` (stable). */
  pms: (projectId: Id) => readonly Milestone[]
  /** Tasks of a milestone. */
  mtasks: (milestoneId: Id) => readonly Task[]
  /** Asks of a project. */
  pasks: (projectId: Id) => readonly Ask[]
  /** Reminders of a task, newest first. */
  remFor: (taskId: Id) => readonly Reminder[]
  /** The person's role on the project, null when not a member. */
  roleOf: (projectId: Id, personId: Id) => ProjectRole | null
  /** Number of memberships on a project. */
  memberCount: (projectId: Id) => number
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

export function makeIndex(board: Board): BoardIndex {
  const people = byId(board.people)
  const projects = byId(board.projects)
  const tasks = byId(board.tasks)
  const milestones = byId(board.milestones)
  const templates = byId(board.templates)
  const tasksByProject = groupBy(board.tasks, (t) => t.projectId)
  const tasksByMs = groupBy(board.tasks, (t) => t.milestoneId)
  const asksByProject = groupBy(board.asks, (a) => a.projectId)
  const msByProject = groupBy(board.milestones, (m) => m.projectId)
  for (const list of msByProject.values()) list.sort((a, b) => a.order - b.order)
  const remByTask = groupBy(board.reminders, (r) => r.taskId)
  for (const list of remByTask.values()) list.sort((a, b) => b.at - a.at)
  const roles = new Map(board.memberships.map((m) => [`${m.projectId}\u0000${m.personId}`, m.role]))
  const memberCounts = new Map<Id, number>()
  for (const m of board.memberships) memberCounts.set(m.projectId, (memberCounts.get(m.projectId) ?? 0) + 1)

  const get = <T>(map: Map<Id, T>, id: Id | null | undefined): T | undefined => (id ? map.get(id) : undefined)

  return {
    board,
    person: (id) => get(people, id),
    project: (id) => get(projects, id),
    task: (id) => get(tasks, id),
    milestone: (id) => get(milestones, id),
    template: (id) => get(templates, id),
    ptasks: (pid) => tasksByProject.get(pid) ?? EMPTY,
    pms: (pid) => msByProject.get(pid) ?? EMPTY,
    mtasks: (mid) => tasksByMs.get(mid) ?? EMPTY,
    pasks: (pid) => asksByProject.get(pid) ?? EMPTY,
    remFor: (tid) => remByTask.get(tid) ?? EMPTY,
    roleOf: (pid, personId) => roles.get(`${pid}\u0000${personId}`) ?? null,
    memberCount: (pid) => memberCounts.get(pid) ?? 0,
  }
}
