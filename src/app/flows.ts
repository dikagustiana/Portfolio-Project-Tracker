// User flows that open dialogs (prototype openTask, onCheck, moveTo, openGate, …). Views call
// these; src/flows implements them. Every write they trigger goes through an RPC, so these only
// decide which dialog to show; the database still decides what is allowed.
import { createContext, use } from 'react'
import type { Id, Stage } from '../domain/index.ts'

export interface TaskPreset {
  projectId?: Id
  milestoneId?: Id
  title?: string
  desc?: string
}

export interface Flows {
  /** Edit form for planners/PIC, or the detail+review dialog (prototype openTask routing). id null = new task in preset.projectId. */
  openTask: (id: Id | null, preset?: TaskPreset) => void
  /** Task detail with accept/reject/withdraw/reopen/commit actions (prototype openReview). */
  openReview: (id: Id) => void
  /** Checkbox click (prototype onCheck): light-mode toggle, submit flow, or review. */
  onCheck: (id: Id) => void
  /** Pipeline drop (prototype moveTo). */
  moveTo: (id: Id, stage: Stage) => void
  /** Submit with evidence (prototype submitFlow). */
  submitFlow: (id: Id) => void
  /** Gate decision (prototype openGate). */
  openGate: (milestoneId: Id) => void
  /** Milestone form; id omitted = new milestone in projectId. */
  openMs: (projectId: Id, id?: Id) => void
  moveMs: (id: Id, dir: -1 | 1) => void
  /** Ask form / decided ask; id omitted = new ask in projectId. */
  openAsk: (projectId: Id, id?: Id) => void
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
}

export const FlowsCtx = createContext<Flows | null>(null)

export function useFlows(): Flows {
  const f = use(FlowsCtx)
  if (!f) throw new Error('useFlows dipakai di luar FlowsProvider.')
  return f
}
