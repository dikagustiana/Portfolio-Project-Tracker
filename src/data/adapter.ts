// Database rows → domain Board (src/domain/types.ts). Pure; also used by tests.
import type {
  Ask,
  Blocker,
  Board,
  BusinessFunction,
  CalendarEntry,
  Comment,
  Commitment,
  Decision,
  EventVerb,
  Holiday,
  Invitation,
  Membership,
  MigrationFlag,
  Milestone,
  Person,
  Project,
  ProjectEvent,
  ProjectRole,
  Reminder,
  ReviewRound,
  Settings,
  StepTemplate,
  SystemRole,
  Task,
} from '../domain/index.ts'
import type { Database } from './database.types.ts'

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']

/** Tables every board needs (the daily digest loads only these). RLS decides which rows come back. */
export const CORE_TABLES = [
  'projects',
  'project_members',
  'people',
  'people_contact',
  'milestones',
  'tasks',
  'task_deps',
  'task_steps',
  'asks',
  'ask_tasks',
  'decisions',
  'reminders',
  'holidays',
  'step_templates',
  'template_steps',
  'org_settings',
  'entities',
  'functions',
  'task_blockers',
  'task_reviews',
  'task_commitments',
] as const satisfies readonly (keyof Tables)[]

/** Every table the client loads: the core plus history, access and per-user tables. */
export const BOARD_TABLES = [
  ...CORE_TABLES,
  'comments',
  'project_events',
  'invitations',
  'invitation_projects',
  'migration_flags',
  'profiles',
  'user_calendar',
  'email_log',
] as const satisfies readonly (keyof Tables)[]
export type BoardTable = (typeof BOARD_TABLES)[number]
export type CoreTable = (typeof CORE_TABLES)[number]

/** Rows per table; tables outside the core may be missing (the digest does not load them). */
export type BoardRows = { [T in CoreTable]: Row<T>[] } & { [T in Exclude<BoardTable, CoreTable>]?: Row<T>[] }

export interface Entity {
  code: string
  label: string
  legalName: string | null
  sort: number
}

export interface BoardExtras {
  entities: Entity[]
  calendar: CalendarEntry[]
  emailLog: Row<'email_log'>[]
  /** System role per login (own row, or every row for the super admin). */
  systemRoles: Map<string, SystemRole>
  appUrl: string
}

const ts = (s: string | null | undefined): number | null => (s ? Date.parse(s) : null)

/**
 * Prototype list order: its store listed records by id in byte order, so imported rows come in
 * workbook-id order (CAP-NOV, G0…, K01…, MB01…, TB-…) and rows created in the app follow in
 * creation order.
 */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const byCreated = <R extends { created_at: string; id: string; legacy_id?: string | null }>(a: R, b: R): number =>
  Number(!a.legacy_id) - Number(!b.legacy_id) ||
  cmp(a.legacy_id ?? '', b.legacy_id ?? '') ||
  Date.parse(a.created_at) - Date.parse(b.created_at) ||
  cmp(a.id, b.id)
const tsReq = (s: string): number => Date.parse(s)

export const DEFAULT_SETTINGS: Settings = {
  cutiIsWorkday: false,
  emailPaused: false,
  emailTime: '07:00',
  timezone: 'Asia/Jakarta',
  emailProvider: 'none',
}

export function toBoard(r: BoardRows): { board: Board; extras: BoardExtras } {
  const emails = new Map(r.people_contact.map((c) => [c.person_id, c.email]))
  const people: Person[] = [...r.people]
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'id'))
    .map((p) => ({
      id: p.id,
      legacyId: p.legacy_id,
      name: p.display_name,
      role: p.job_title,
      userId: p.user_id,
      email: emails.get(p.id) ?? null,
      emailDaily: p.email_daily,
      functionId: p.function_id ?? '',
      createdAt: tsReq(p.created_at),
    }))

  const memberships: Membership[] = r.project_members.map((m) => ({
    projectId: m.project_id,
    personId: m.person_id,
    role: m.role as ProjectRole,
  }))

  const projects: Project[] = [...r.projects].sort(byCreated).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      entity: p.entity_code,
      outcome: p.outcome,
      measure: p.measure,
      owner: p.pm_person_id ?? '',
      status: p.status as Project['status'],
      maturity: p.maturity as Project['maturity'],
      gateMode: p.gate_mode,
      parallelGates: p.parallel_gates,
      color: p.color,
      stepTemplateId: p.step_template_id,
      closedAt: ts(p.closed_at),
      closedBy: p.closed_by,
      closeNote: p.close_note,
      closeSrc:
        p.status === 'aktif'
          ? null
          : { deciderName: p.close_decider_name ?? '', forum: p.close_forum ?? '', decidedOn: p.close_decided_on ?? '' },
      createdAt: tsReq(p.created_at),
    }))

  const milestones: Milestone[] = [...r.milestones].sort(byCreated).map((m) => ({
    id: m.id,
    projectId: m.project_id,
    ref: m.ref,
    code: m.code,
    title: m.title,
    target: m.target ?? '',
    criteria: m.criteria,
    trigger: m.trigger,
    fallback: m.fallback,
    approver: m.approver_person_id ?? '',
    mode: m.mode as Milestone['mode'],
    order: m.sort_order,
    status: m.status as Milestone['status'],
    lastDecision: m.last_decision as Milestone['lastDecision'],
    createdAt: tsReq(m.created_at),
  }))

  const stepCode = new Map(r.template_steps.map((s) => [s.id, s.code]))
  const depsOf = new Map<string, string[]>()
  const acceptOf = new Map<string, string[]>()
  for (const d of r.task_deps) {
    const map = d.kind === 'accept' ? acceptOf : depsOf
    map.set(d.task_id, [...(map.get(d.task_id) ?? []), d.depends_on_task_id])
  }
  const stepsOf = new Map<string, string[]>()
  for (const s of r.task_steps) {
    const code = stepCode.get(s.template_step_id)
    if (code) stepsOf.set(s.task_id, [...(stepsOf.get(s.task_id) ?? []), code])
  }

  const tasks: Task[] = [...r.tasks].sort(byCreated).map((t) => ({
      id: t.id,
      projectId: t.project_id,
      ref: t.ref,
      parentId: t.parent_task_id ?? '',
      ownerFunctionId: t.owner_function_id ?? '',
      milestoneId: t.milestone_id ?? '',
      title: t.title,
      desc: t.description,
      start: t.start_date,
      end: t.end_date,
      assignee: t.assignee_person_id ?? '',
      validator: t.validator_person_id ?? '',
      proof: t.proof_requested,
      stage: t.stage as Task['stage'],
      committed: t.committed,
      committedAt: ts(t.committed_at),
      committedBy: t.committed_by,
      evidence: t.evidence,
      submittedAt: ts(t.submitted_at),
      submittedBy: t.submitted_by,
      acceptedAt: ts(t.accepted_at),
      acceptedBy: t.accepted_by,
      rejectReason: t.reject_reason,
      rejectedAt: ts(t.rejected_at),
      rejectedBy: t.rejected_by,
      doneAt: ts(t.done_at),
      deps: depsOf.get(t.id) ?? [],
      acceptDeps: acceptOf.get(t.id) ?? [],
      steps: stepsOf.get(t.id) ?? [],
      createdAt: tsReq(t.created_at),
    }))

  const askTasks = new Map<string, string[]>()
  for (const x of r.ask_tasks) askTasks.set(x.ask_id, [...(askTasks.get(x.ask_id) ?? []), x.task_id])
  const asks: Ask[] = [...r.asks].sort(byCreated).map((a) => ({
    id: a.id,
    projectId: a.project_id,
    ref: a.ref,
    milestoneId: a.milestone_id ?? '',
    question: a.question,
    context: a.context,
    options: a.options,
    recommendation: a.recommendation,
    rationale: a.rationale,
    taskIds: askTasks.get(a.id) ?? [],
    decider: a.decider_person_id ?? '',
    due: a.due ?? '',
    status: a.status as Ask['status'],
    answer: a.answer,
    decidedAt: ts(a.decided_at),
    decidedBy: a.decided_by,
    src: { deciderName: a.decider_name, forum: a.forum, decidedOn: a.decided_on ?? '' },
    createdAt: tsReq(a.created_at),
    createdBy: a.created_by,
  }))

  const decisions: Decision[] = r.decisions.map((d) => ({
    id: d.id,
    projectId: d.project_id,
    milestoneId: d.milestone_id,
    kind: d.kind as Decision['kind'],
    status: d.status,
    note: d.note,
    rationale: d.rationale,
    askId: d.ask_id,
    by: d.recorded_by,
    at: tsReq(d.recorded_at),
    src: { deciderName: d.decider_name, forum: d.forum, decidedOn: d.decided_on ?? '' },
  }))

  const reminders: Reminder[] = r.reminders.map((x) => ({
    id: x.id,
    projectId: x.project_id,
    taskId: x.task_id ?? '',
    toMember: x.to_person_id ?? '',
    message: x.message,
    note: x.note,
    status: x.status as Reminder['status'],
    by: x.created_by,
    at: tsReq(x.created_at),
    sentAt: ts(x.sent_at),
  }))

  const holidays: Holiday[] = [...r.holidays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => ({ date: h.date, type: h.type as Holiday['type'], name: h.name }))

  const templates: StepTemplate[] = r.step_templates.map((t) => ({
    id: t.id,
    name: t.name,
    steps: r.template_steps
      .filter((s) => s.template_id === t.id)
      .sort((a, b) => a.sort - b.sort)
      .map((s) => ({ id: s.id, code: s.code, no: s.label_no, name: s.name, need: s.need, kind: s.kind as 'chain', sort: s.sort })),
  }))

  const s = r.org_settings[0]
  const settings: Settings = s
    ? {
        cutiIsWorkday: s.cuti_bersama_is_workday,
        emailPaused: s.email_paused,
        emailTime: s.email_time.slice(0, 5),
        timezone: s.timezone,
        emailProvider: s.email_provider as Settings['emailProvider'],
      }
    : DEFAULT_SETTINGS

  const functions: BusinessFunction[] = [...r.functions]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'id'))
    .map((f) => ({ id: f.id, name: f.name, sort: f.sort }))

  const blockers: Blocker[] = r.task_blockers.map((b) => ({
    id: b.id,
    projectId: b.project_id,
    taskId: b.task_id,
    reason: b.reason,
    need: b.need,
    neededFromPerson: b.needed_from_person_id ?? '',
    neededFromFunction: b.needed_from_function_id ?? '',
    target: b.target_date ?? '',
    raisedBy: b.raised_by,
    raisedAt: tsReq(b.raised_at),
    resolvedBy: b.resolved_by,
    resolvedAt: ts(b.resolved_at),
    resolution: b.resolution,
    askId: b.ask_id ?? '',
  }))

  const reviews: ReviewRound[] = r.task_reviews.map((x) => ({
    id: x.id,
    projectId: x.project_id,
    taskId: x.task_id,
    round: x.round,
    submittedBy: x.submitted_by,
    submittedAt: tsReq(x.submitted_at),
    evidence: x.evidence,
    reviewer: x.reviewer_person_id,
    reviewedAt: ts(x.reviewed_at),
    verdict: x.verdict as ReviewRound['verdict'],
    feedback: x.feedback,
    reopenedAt: ts(x.reopened_at),
    reopenedBy: x.reopened_by,
  }))

  const commitments: Commitment[] = r.task_commitments.map((c) => ({
    id: c.id,
    seq: c.seq,
    projectId: c.project_id,
    taskId: c.task_id,
    start: c.start_date,
    end: c.end_date,
    by: c.committed_by,
    at: tsReq(c.committed_at),
  }))

  const comments: Comment[] = (r.comments ?? []).map((c) => ({
    id: c.id,
    projectId: c.project_id,
    taskId: c.task_id ?? '',
    askId: c.ask_id ?? '',
    author: c.author_person_id,
    body: c.body,
    at: tsReq(c.created_at),
  }))

  const events: ProjectEvent[] = (r.project_events ?? []).map((e) => ({
    id: e.id,
    projectId: e.project_id,
    objectType: e.object_type as ProjectEvent['objectType'],
    objectId: e.object_id ?? '',
    objectRef: e.object_ref ?? '',
    objectTitle: e.object_title,
    verb: e.verb as EventVerb,
    actor: e.actor_person_id,
    actorName: e.actor_name,
    at: tsReq(e.at),
    meta: (e.meta ?? {}) as Record<string, unknown>,
  }))

  const invProjects = new Map<string, Invitation['projects']>()
  for (const x of r.invitation_projects ?? [])
    invProjects.set(x.invitation_id, [
      ...(invProjects.get(x.invitation_id) ?? []),
      { projectId: x.project_id, role: x.project_role as ProjectRole, previousRole: (x.previous_role as ProjectRole | null) ?? null },
    ])
  const invitations: Invitation[] = (r.invitations ?? [])
    .map((i) => ({
      id: i.id,
      email: String(i.email),
      displayName: i.display_name,
      personId: i.person_id ?? '',
      invitedBy: i.invited_by,
      status: i.status as Invitation['status'],
      expiresAt: tsReq(i.expires_at),
      createdAt: tsReq(i.created_at),
      acceptedAt: ts(i.accepted_at),
      revokedAt: ts(i.revoked_at),
      projects: invProjects.get(i.id) ?? [],
    }))
    .sort((a, b) => b.createdAt - a.createdAt)

  const flags: MigrationFlag[] = (r.migration_flags ?? []).map((f) => ({
    id: f.id,
    projectId: f.project_id,
    objectType: f.object_type,
    objectId: f.object_id ?? '',
    ref: f.ref ?? '',
    code: f.code,
    detail: f.detail,
    createdAt: tsReq(f.created_at),
    resolvedAt: ts(f.resolved_at),
  }))

  return {
    board: {
      people,
      memberships,
      projects,
      milestones,
      tasks,
      asks,
      decisions,
      reminders,
      holidays,
      templates,
      settings,
      functions,
      blockers,
      reviews,
      commitments,
      comments,
      events,
      invitations,
      flags,
    },
    extras: {
      entities: [...r.entities]
        .sort((a, b) => a.sort - b.sort)
        .map((e) => ({ code: e.code, label: e.label, legalName: e.legal_name, sort: e.sort })),
      calendar: (r.user_calendar ?? []).map((c) => ({ taskId: c.task_id, end: c.end_date, title: c.title, at: tsReq(c.added_at) })),
      emailLog: [...(r.email_log ?? [])].sort((a, b) => b.run_date.localeCompare(a.run_date)),
      systemRoles: new Map((r.profiles ?? []).map((x) => [x.user_id, x.system_role as SystemRole])),
      appUrl: s?.app_url || '',
    },
  }
}
