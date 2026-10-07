// User flows that open records or dialogs (prototype openTask, onCheck, moveTo, openGate, …).
// Views call these; src/flows implements them. Records open in the side peek (one record, one
// address); dialogs are for creating, editing and deciding. Every write goes through an RPC, so
// these only decide what to show; the database still decides what is allowed.
import { createContext, use } from 'react'
import type { Id, RecordTarget, Stage } from '../domain/index.ts'

/** Context a new task inherits (docs/ARCHITECTURE.md §I "contextual creation"). */
export interface TaskPreset {
  projectId?: Id
  milestoneId?: Id
  /** Package the new task belongs to (a sub-task). */
  parentId?: Id
  title?: string
  desc?: string
}

/** Context a new Keputusan inherits. */
export interface AskPreset {
  milestoneId?: Id
  taskIds?: Id[]
  question?: string
  context?: string
}

export interface Flows {
  /** id: the task record in the peek. null: a new task with the inherited context. */
  openTask: (id: Id | null, preset?: TaskPreset) => void
  /** The planning form of an existing task (project admins; package PIC for sub-tasks). */
  editTask: (id: Id) => void
  /** Kept for callers of the old review dialog: opens the task record. */
  openReview: (id: Id) => void
  /** Any record in the side peek. */
  openRecord: (target: RecordTarget) => void
  /** Checkbox click (prototype onCheck): light-mode toggle, submit flow, or the record. */
  onCheck: (id: Id) => void
  /** Pipeline drop (prototype moveTo). */
  moveTo: (id: Id, stage: Stage) => void
  /** Submit with evidence (prototype submitFlow). */
  submitFlow: (id: Id) => void
  /** Gate decision dialog (prototype openGate). */
  openGate: (milestoneId: Id) => void
  /** Milestone form; id omitted = new milestone in projectId. */
  openMs: (projectId: Id, id?: Id) => void
  moveMs: (id: Id, dir: -1 | 1) => void
  /** id: the Keputusan record in the peek; omitted: a new Keputusan in projectId. */
  openAsk: (projectId: Id, id?: Id) => void
  newAsk: (projectId: Id, preset?: AskPreset) => void
  editAsk: (id: Id) => void
  openClose: (projectId: Id, mode: 'close' | 'stop' | 'reopen') => void
  /** Edit project form (prototype openProject with an id). */
  openProject: (id: Id) => void
  /** Project wizard (prototype startWizard). */
  startWizard: () => void
  openRemind: (taskId: Id) => void
  openCal: (taskId: Id) => void
  /** Digest e-mail preview for a person (prototype openPreview). */
  openPreview: (personId: Id) => void
  /** Mark the viewer's calendar entry as current / removed (prototype calRecord / data-calrm). */
  calRecord: (taskId: Id) => void
  calRemove: (taskId: Id) => void
  /** Terhambat: raise, resolve, escalate to a Keputusan. */
  raiseBlocker: (taskId: Id) => void
  resolveBlocker: (blockerId: Id) => void
  escalateBlocker: (blockerId: Id) => void
  /** Invite someone by e-mail, with a role per project (projectId preselects one). */
  invite: (projectId?: Id) => void
  /** Quick Find. */
  openFind: () => void
}

export const FlowsCtx = createContext<Flows | null>(null)

export function useFlows(): Flows {
  const f = use(FlowsCtx)
  if (!f) throw new Error('useFlows dipakai di luar FlowsProvider.')
  return f
}
