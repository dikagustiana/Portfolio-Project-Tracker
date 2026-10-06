// Domain model: plain data, no I/O. Field names follow the prototype (reference/prototype.html)
// so the ported functions read side by side with it; the DB adapter maps snake_case columns
// onto these shapes. Ids are opaque strings (UUIDs in the app, prototype ids in parity tests).

export type Id = string
/** Calendar date 'YYYY-MM-DD' (Asia/Jakarta). Empty string means "not set". */
export type DateStr = string
/** Epoch milliseconds. */
export type Ts = number

export type ProjectRole = 'pm' | 'officer' | 'viewer'
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
  name: string
  /** Job title / division (prototype `role`). */
  role: string
  userId: string | null
  /** Only present where the viewer may read it (owner, PMs of a shared project, server jobs). */
  email: string | null
  emailDaily: boolean
  createdAt: Ts
}

export interface Membership {
  projectId: Id
  personId: Id
  role: ProjectRole
}

export interface Project {
  id: Id
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
  /** Gate code such as 'G3'; null falls back to M1…Mn. */
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
  /** Finish-to-start: ids of tasks this one waits for. */
  deps: Id[]
  /** Template step codes this task fills (e.g. 'store', 'lp'). */
  steps: string[]
  createdAt: Ts
}

export interface Ask {
  id: Id
  projectId: Id
  milestoneId: Id
  question: string
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
  kind: 'gate' | 'project'
  /** Gate: lulus | rescope | stop. Project: selesai | dihentikan | aktif. */
  status: string
  note: string
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
}

/**
 * Who is looking. null = no signed-in viewer (server jobs, parity tests), which behaves like
 * the prototype's local mode for permission helpers.
 */
export interface Viewer {
  userId: string
  /** The people row linked to this login, if any. */
  personId: Id | null
  isOwner: boolean
  isGroupViewer: boolean
}

export interface DomainContext {
  /** Today in Asia/Jakarta, 'YYYY-MM-DD'. Never read from the clock inside the domain. */
  today: DateStr
  /** Link used in e-mails and calendar entries. */
  appUrl: string
  viewer: Viewer | null
}
