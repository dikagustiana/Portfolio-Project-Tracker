// The client's write path for project data: one typed wrapper per RPC (supabase/migrations/…_rpcs.sql).
// The database decides; these only shape arguments and surface its (Bahasa Indonesia) messages.
import type { Supa } from '../lib/supabase.ts'
import type { Database, Json } from './database.types.ts'

type Fns = Database['public']['Functions']

export class ActionError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Human message for a failed call: the database's own text when it raised one. */
export function messageOf(e: unknown): string {
  if (e instanceof ActionError) return e.message
  if (e instanceof Error) return e.message
  return 'Gagal menyimpan. Coba lagi sebentar.'
}

const FRIENDLY: Record<string, string> = {
  '23503': 'Data yang dirujuk tidak ada atau ada di project lain.',
  '23505': 'Data ini sudah ada.',
  '42501': 'Kamu tidak punya akses untuk melakukan ini.',
}

async function call<F extends keyof Fns>(supa: Supa, fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  // supabase-js overloads cannot infer a generic function name; the wrapper keeps callers typed.
  const rpc = supa.rpc.bind(supa) as unknown as (f: string, a: unknown) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
  const { data, error } = await rpc(fn, args)
  if (error) {
    const own = error.message && !/^(permission denied|new row violates|insert or update on table)/.test(error.message)
    throw new ActionError(own ? error.message : (FRIENDLY[error.code ?? ''] ?? error.message), error.code)
  }
  return data as Fns[F]['Returns']
}

export interface DecisionSourceInput {
  deciderName?: string
  forum?: string
  decidedOn?: string
}
const src = (s: DecisionSourceInput = {}) => ({
  p_decider_name: s.deciderName ?? '',
  p_forum: s.forum ?? '',
  ...(s.decidedOn ? { p_decided_on: s.decidedOn } : {}),
})

export interface TaskInput {
  id?: string
  project_id?: string
  parent_task_id?: string
  owner_function_id?: string
  milestone_id?: string
  title?: string
  description?: string
  start_date?: string
  end_date?: string
  assignee_person_id?: string
  validator_person_id?: string
  proof_requested?: string
  stage?: string
  /** Prerequisites: ids (start dependencies) or {task_id, kind}. */
  deps?: (string | { task_id: string; kind: 'start' | 'accept' })[]
  steps?: string[]
  commit?: 'on' | 'off'
}
export interface MilestoneInput {
  id?: string
  project_id?: string
  title?: string
  target?: string
  criteria?: string
  trigger?: string
  fallback?: string
  approver_person_id?: string
  mode?: 'slow' | 'fast'
  code?: string
  position?: 'before' | 'after'
}
export interface AskInput {
  id?: string
  project_id?: string
  question?: string
  context?: string
  options?: string[]
  recommendation?: string
  decider_person_id?: string
  due?: string
  milestone_id?: string
  task_ids?: string[]
}

export interface BlockerInput {
  reason: string
  need?: string
  fromPerson?: string
  fromFunction?: string
  target?: string
}

export interface InviteInput {
  email: string
  name?: string
  assignments: { project_id: string; role: 'project_admin' | 'member' | 'viewer' }[]
}
export interface InviteResult {
  mode: 'invited' | 'updated'
  person_id: string
  invitation_id: string | null
}
export interface ProjectInput {
  id?: string
  /** New projects only: the short code (else derived from the name). */
  code?: string
  name?: string
  entity_code?: string
  outcome?: string
  measure?: string
  pm_person_id?: string
  gate_mode?: boolean
  maturity?: string
  color?: string
  parallel_gates?: boolean
  step_template_id?: string
}
export interface WizardInput extends ProjectInput {
  validator_person_id?: string
  milestones: { title: string; target: string }[]
  tasks: { milestone_index: number; title: string; assignee_person_id: string; start_date: string; end_date: string }[]
}

export function makeActions(supa: Supa) {
  return {
    saveTask: (p: TaskInput) => call(supa, 'save_task', { p: p as unknown as Json }),
    deleteTask: (id: string) => call(supa, 'delete_task', { p_task: id }),
    commitTaskDates: (id: string, start?: string, end?: string) =>
      call(supa, 'commit_task_dates', { p_task: id, ...(start ? { p_start: start } : {}), ...(end ? { p_end: end } : {}) }),
    setTaskStage: (id: string, stage: string) => call(supa, 'set_task_stage', { p_task: id, p_stage: stage }),
    submitTask: (id: string, evidence: string) => call(supa, 'submit_task', { p_task: id, p_evidence: evidence }),
    withdrawSubmission: (id: string) => call(supa, 'withdraw_submission', { p_task: id }),
    reviewTask: (id: string, decision: 'accept' | 'reject', reason?: string) =>
      call(supa, 'review_task', { p_task: id, p_decision: decision, ...(reason ? { p_reason: reason } : {}) }),
    reopenTask: (id: string) => call(supa, 'reopen_task', { p_task: id }),

    saveMilestone: (p: MilestoneInput) => call(supa, 'save_milestone', { p: p as unknown as Json }),
    moveMilestone: (id: string, dir: -1 | 1) => call(supa, 'move_milestone', { p_milestone: id, p_dir: dir }),
    deleteMilestone: (id: string) => call(supa, 'delete_milestone', { p_milestone: id }),
    decideGate: (id: string, decision: 'lulus' | 'rescope' | 'stop', note: string, s?: DecisionSourceInput) =>
      call(supa, 'decide_gate', { p_milestone: id, p_decision: decision, p_note: note, ...src(s) }),

    saveAsk: (p: AskInput) => call(supa, 'save_ask', { p: p as unknown as Json }),
    decideAsk: (id: string, answer: string, s?: DecisionSourceInput, rationale?: string) =>
      call(supa, 'decide_ask', { p_ask: id, p_answer: answer, ...src(s), ...(rationale ? { p_rationale: rationale } : {}) }),
    reopenAsk: (id: string, reason?: string) => call(supa, 'reopen_ask', { p_ask: id, ...(reason ? { p_reason: reason } : {}) }),
    deleteAsk: (id: string) => call(supa, 'delete_ask', { p_ask: id }),

    createProject: (p: WizardInput) => call(supa, 'create_project', { p: p as unknown as Json }),
    updateProject: (p: ProjectInput & { id: string }) => call(supa, 'update_project', { p: p as unknown as Json }),
    closeProject: (id: string, note: string, s?: DecisionSourceInput) => call(supa, 'close_project', { p_project: id, p_note: note, ...src(s) }),
    stopProject: (id: string, note: string, s?: DecisionSourceInput) => call(supa, 'stop_project', { p_project: id, p_note: note, ...src(s) }),
    reopenProject: (id: string, note: string, s?: DecisionSourceInput) => call(supa, 'reopen_project', { p_project: id, p_note: note, ...src(s) }),
    deleteProject: (id: string) => call(supa, 'delete_project', { p_project: id }),

    createReminder: (taskId: string, message: string) => call(supa, 'create_reminder', { p_task: taskId, p_message: message }),

    raiseBlocker: (taskId: string, b: BlockerInput) =>
      call(supa, 'raise_blocker', {
        p_task: taskId,
        p_reason: b.reason,
        p_need: b.need ?? '',
        ...(b.fromPerson ? { p_from_person: b.fromPerson } : {}),
        ...(b.fromFunction ? { p_from_function: b.fromFunction } : {}),
        ...(b.target ? { p_target: b.target } : {}),
      }),
    resolveBlocker: (id: string, resolution?: string) => call(supa, 'resolve_blocker', { p_blocker: id, p_resolution: resolution ?? '' }),
    escalateBlocker: (id: string, p: { question?: string; context?: string; decider_person_id?: string; due?: string }) =>
      call(supa, 'escalate_blocker', { p_blocker: id, p: p as unknown as Json }),
    addComment: (target: 'task' | 'ask', id: string, body: string) => call(supa, 'add_comment', { p_target: target, p_id: id, p_body: body }),

    setMemberRole: (projectId: string, personId: string, role: 'project_admin' | 'member' | 'viewer' | null) =>
      call(supa, 'set_member_role', { p_project: projectId, p_person: personId, p_role: role as string }),
    setSystemRole: (personId: string, role: 'super_admin' | 'user') => call(supa, 'set_system_role', { p_person: personId, p_role: role }),
    inviteMember: async (p: InviteInput) => (await call(supa, 'invite_member', { p: p as unknown as Json })) as unknown as InviteResult,
    revokeInvitation: (id: string) => call(supa, 'revoke_invitation', { p_invitation: id }),
    resolveMigrationFlag: (id: number) => call(supa, 'resolve_migration_flag', { p_flag: id }),

    /** Private calendar record (prototype calRecord), own rows only (RLS). */
    calRecord: async (taskId: string, end: string, title: string, provider?: 'google' | 'outlook365') => {
      const { error } = await supa.from('user_calendar').upsert(
        { task_id: taskId, end_date: end, title, added_at: new Date().toISOString(), ...(provider ? { provider } : {}) },
        { onConflict: 'user_id,task_id' },
      )
      if (error) throw new ActionError(error.message, error.code)
    },
    calRemove: async (taskId: string) => {
      const { error } = await supa.from('user_calendar').delete().eq('task_id', taskId)
      if (error) throw new ActionError(error.message, error.code)
    },
  }
}

export type Actions = ReturnType<typeof makeActions>
