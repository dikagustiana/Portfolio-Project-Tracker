// Domain model: plain data, no I/O. Field names follow the prototype (reference/prototype.html)
// so the ported functions read side by side with it; the DB adapter maps snake_case columns
// onto these shapes. Ids are opaque strings (UUIDs in the app, prototype ids in parity tests).

export type Id = string
/** Calendar date 'YYYY-MM-DD' (Asia/Jakarta). Empty string means "not set". */
export type DateStr = string
/** Epoch milliseconds. */
export type Ts = number

/** project_admin plans and administers; member works on items they hold; viewer reads. */
export type ProjectRole = 'project_admin' | 'member' | 'viewer'
export type SystemRole = 'super_admin' | 'user'
export type DepKind = 'start' | 'accept'
export type Stage = 'todo' | 'progress' | 'review' | 'done'
export type ProjectStatus = 'aktif' | 'selesai' | 'dihentikan'
export type Maturity = 'prototype' | 'release' | 'decision' | 'bau'
export type MsStatus = 'lulus' | 'stop'
export type MsState = 'kosong' | 'jalan' | 'siap' | MsStatus
export type GateDecision = 'lulus' | 'rescope' | 'stop'
export type StepKind = 'chain' | 'output' | 'side'
export type ReminderStatus = 'menunggu' | 'terkirim' | 'gagal' | 'dibatalkan'

/** Who actually decided, where and when (BRIEF §4). All empty means the recorder decided. */
export interface DecisionSource {
  deciderName: string
  forum: string
  decidedOn: DateStr
}

export interface Person {
  id: Id
  /** Workbook id from the prototype (e.g. 'm-dika'), when imported. Keeps avatar colours stable. */
  legacyId?: string | null
  name: string
  /** Job title / division (prototype `role`). */
  role: string
  userId: string | null
  /** Only present where the viewer may read it (owner, PMs of a shared project, server jobs). */
  email: string | null
  emailDaily: boolean
  /** Primary business function, '' when unset. */
  functionId: Id
  createdAt: Ts
}

/** A business function (Accounting, Commercial, …): responsibility before a named PIC exists. */
export interface BusinessFunction {
  id: Id
  name: string
  sort: number
}

export interface Membership {
  projectId: Id
  personId: Id
  role: ProjectRole
}

export interface Project {
  id: Id
  /** Immutable short code used in addresses (MB). '' only in prototype fixtures. */
  code: string
  name: string
  entity: string
  outcome: string
  measure: string
  /** The project's PM (people id), '' when unset. Prototype `owner`. */
  owner: Id
  status: ProjectStatus
  maturity: Maturity
  gateMode: boolean
  parallelGates: boolean
  color: string
  stepTemplateId: Id | null
  closedAt: Ts | null
  closedBy: Id | null
  closeNote: string | null
  closeSrc: DecisionSource | null
  createdAt: Ts
}

export interface Milestone {
  id: Id
  projectId: Id
  /** Immutable short id (G3); '' only in prototype fixtures. */
  ref: string
  /** Gate code such as 'G3'; null falls back to the ref, then M1…Mn. */
  code: string | null
  title: string
  target: DateStr
  criteria: string
  trigger: string
  fallback: string
  /** Pemutus (people id), '' means the project PM. */
  approver: Id
  mode: 'slow' | 'fast'
  order: number
  status: MsStatus | null
  lastDecision: GateDecision | null
  createdAt: Ts
}

export interface Task {
  id: Id
  projectId: Id
  /** Immutable short id (MB12, MB05.1); '' only in prototype fixtures. */
  ref: string
  /** Package this sub-task belongs to, '' for a top-level task. */
  parentId: Id
  /** Business function that owns the task, '' when unset. */
  ownerFunctionId: Id
  /** '' when the task sits outside any milestone. */
  milestoneId: Id
  title: string
  desc: string
  start: DateStr
  end: DateStr
  /** PIC (people id), '' when unassigned. */
  assignee: Id
  /** Pemeriksa (people id), '' falls back to validatorOf(). */
  validator: Id
  /** Bukti yang diminta. */
  proof: string
  stage: Stage
  committed: boolean
  committedAt: Ts | null
  committedBy: Id | null
  evidence: string | null
  submittedAt: Ts | null
  submittedBy: Id | null
  acceptedAt: Ts | null
  acceptedBy: Id | null
  rejectReason: string | null
  rejectedAt: Ts | null
  rejectedBy: Id | null
  doneAt: Ts | null
  /** Finish-to-start ('start'): ids of tasks this one waits for before it can start. */
  deps: Id[]
  /** Acceptance-only ('accept'): may run in parallel, cannot be accepted before these. */
  acceptDeps: Id[]
  /** Template step codes this task fills (e.g. 'store', 'lp'). */
  steps: string[]
  createdAt: Ts
}

export interface Ask {
  id: Id
  projectId: Id
  /** Immutable short id (K01); '' only in prototype fixtures. */
  ref: string
  milestoneId: Id
  question: string
  context: string
  options: string[]
  recommendation: string
  /** Why the decision was taken (with the answer). */
  rationale: string
  /** Tasks this Keputusan blocks or concerns. */
  taskIds: Id[]
  /** Assigned pemutus (people id), '' means the project PM. */
  decider: Id
  due: DateStr
  status: 'open' | 'decided'
  answer: string | null
  decidedAt: Ts | null
  /** Who recorded the decision (people id). */
  decidedBy: Id | null
  /** Who actually decided, where, when. */
  src: DecisionSource
  createdAt: Ts
  createdBy: Id | null
}

export interface Decision {
  id: Id
  projectId: Id
  milestoneId: Id | null
  kind: 'gate' | 'project' | 'ask'
  /** Gate: lulus | rescope | stop. Project: selesai | dihentikan | aktif. Ask: decided | reopened. */
  status: string
  /** Gate/project note, or the Keputusan's answer. */
  note: string
  rationale: string
  askId: Id | null
  /** Recorder (people id). */
  by: Id | null
  at: Ts
  src: DecisionSource
}

export interface Reminder {
  id: Id
  projectId: Id
  taskId: Id
  toMember: Id
  message: string
  note: string | null
  status: ReminderStatus
  by: Id | null
  at: Ts
  sentAt: Ts | null
}

export interface Holiday {
  date: DateStr
  type: 'libur' | 'cuti'
  name: string
}

export interface TemplateStep {
  id: Id
  code: string
  /** Circled number shown before the name ('⓪', '①', …), '' for none. */
  no: string
  name: string
  need: string
  kind: StepKind
  sort: number
}

export interface StepTemplate {
  id: Id
  name: string
  steps: TemplateStep[]
}

export interface Settings {
  cutiIsWorkday: boolean
  emailPaused: boolean
  emailTime: string
  timezone: string
  emailProvider: 'none' | 'graph'
}

/** Private per-user calendar record (prototype CAL): deadline and title as added. */
export interface CalendarEntry {
  taskId: Id
  end: DateStr
  title: string
  at: Ts
}

/** A task flagged Terhambat: an overlay, not a stage. At most one open per task. */
export interface Blocker {
  id: Id
  projectId: Id
  taskId: Id
  reason: string
  need: string
  neededFromPerson: Id
  neededFromFunction: Id
  target: DateStr
  raisedBy: Id | null
  raisedAt: Ts
  resolvedBy: Id | null
  resolvedAt: Ts | null
  resolution: string | null
  /** Keputusan this blocker was escalated to. */
  askId: Id
}

/** One submission round of a task: never overwritten. */
export interface ReviewRound {
  id: Id
  projectId: Id
  taskId: Id
  round: number
  submittedBy: Id | null
  submittedAt: Ts
  evidence: string
  reviewer: Id | null
  reviewedAt: Ts | null
  verdict: 'accepted' | 'rejected' | 'withdrawn' | null
  feedback: string | null
  reopenedAt: Ts | null
  reopenedBy: Id | null
}

/** One commitment of a task's dates; the first is the baseline. */
export interface Commitment {
  id: Id
  seq: number
  projectId: Id
  taskId: Id
  start: DateStr
  end: DateStr
  by: Id | null
  at: Ts
}

export interface Comment {
  id: Id
  projectId: Id
  taskId: Id
  askId: Id
  author: Id | null
  body: string
  at: Ts
}

export type EventVerb =
  | 'task_created' | 'task_started' | 'task_submitted' | 'task_withdrawn' | 'task_accepted' | 'task_completed'
  | 'task_rejected' | 'task_reopened' | 'task_deleted' | 'pic_changed'
  | 'commitment_made' | 'commitment_changed' | 'commitment_cleared'
  | 'blocker_raised' | 'blocker_resolved' | 'blocker_escalated'
  | 'gate_passed' | 'gate_stopped' | 'gate_rescoped'
  | 'decision_requested' | 'decision_made' | 'decision_reopened'
  | 'project_created' | 'project_closed' | 'project_stopped' | 'project_reopened'
  | 'member_added' | 'member_role_changed' | 'member_removed' | 'comment_added'

/** Human-readable, append-only project history (separate from the forensic activity log). */
export interface ProjectEvent {
  id: number
  projectId: Id
  objectType: 'project' | 'task' | 'milestone' | 'ask' | 'member'
  objectId: Id
  objectRef: string
  objectTitle: string
  verb: EventVerb
  actor: Id | null
  actorName: string
  at: Ts
  meta: Record<string, unknown>
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export interface Invitation {
  id: Id
  email: string
  displayName: string
  personId: Id
  invitedBy: Id | null
  status: InvitationStatus
  expiresAt: Ts
  createdAt: Ts
  acceptedAt: Ts | null
  revokedAt: Ts | null
  /** Only the rows the viewer may read (their projects, or all for the super admin). */
  projects: { projectId: Id; role: ProjectRole; previousRole: ProjectRole | null }[]
}

/** Something the structure extraction could not map reliably. */
export interface MigrationFlag {
  id: number
  projectId: Id
  objectType: string
  objectId: Id
  ref: string
  code: string
  detail: string
  createdAt: Ts
  resolvedAt: Ts | null
}

export interface Board {
  people: Person[]
  memberships: Membership[]
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  asks: Ask[]
  decisions: Decision[]
  reminders: Reminder[]
  holidays: Holiday[]
  templates: StepTemplate[]
  settings: Settings
  functions: BusinessFunction[]
  blockers: Blocker[]
  reviews: ReviewRound[]
  commitments: Commitment[]
  comments: Comment[]
  events: ProjectEvent[]
  invitations: Invitation[]
  flags: MigrationFlag[]
}

/**
 * Who is looking. null = no signed-in viewer (server jobs, parity tests), which behaves like
 * the prototype's local mode for permission helpers.
 */
export interface Viewer {
  userId: string
  /** The people row linked to this login, if any. */
  personId: Id | null
  /** profiles.system_role = 'super_admin': every project, administration. */
  isSuperAdmin: boolean
}

export interface DomainContext {
  /** Today in Asia/Jakarta, 'YYYY-MM-DD'. Never read from the clock inside the domain. */
  today: DateStr
  /** Link used in e-mails and calendar entries. */
  appUrl: string
  viewer: Viewer | null
}
