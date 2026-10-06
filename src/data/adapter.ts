// Database rows → domain Board (src/domain/types.ts). Pure; also used by tests.
import type {
  Ask,
  Board,
  CalendarEntry,
  Decision,
  Holiday,
  Membership,
  Milestone,
  Person,
  Project,
  Reminder,
  Settings,
  StepTemplate,
  Task,
} from '../domain/index.ts'
import type { Database } from './database.types.ts'

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']

/** Every table the client loads. RLS decides which rows come back. */
export const BOARD_TABLES = [
  'projects',
  'project_members',
  'people',
  'people_contact',
  'milestones',
  'tasks',
  'task_deps',
  'task_steps',
  'asks',
  'decisions',
  'reminders',
  'holidays',
  'step_templates',
  'template_steps',
  'org_settings',
  'entities',
  'user_calendar',
  'app_roles',
  'email_log',
] as const satisfies readonly (keyof Tables)[]
export type BoardTable = (typeof BOARD_TABLES)[number]

export type BoardRows = { [T in BoardTable]: Row<T>[] }

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
  appUrl: string
}

const ts = (s: string | null | undefined): number | null => (s ? Date.parse(s) : null)
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
      name: p.display_name,
      role: p.job_title,
      userId: p.user_id,
      email: emails.get(p.id) ?? null,
      emailDaily: p.email_daily,
      createdAt: tsReq(p.created_at),
    }))

  const memberships: Membership[] = r.project_members.map((m) => ({
    projectId: m.project_id,
    personId: m.person_id,
    role: m.role as Membership['role'],
  }))

  const projects: Project[] = [...r.projects]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((p) => ({
      id: p.id,
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

  const milestones: Milestone[] = r.milestones.map((m) => ({
    id: m.id,
    projectId: m.project_id,
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
  for (const d of r.task_deps) depsOf.set(d.task_id, [...(depsOf.get(d.task_id) ?? []), d.depends_on_task_id])
  const stepsOf = new Map<string, string[]>()
  for (const s of r.task_steps) {
    const code = stepCode.get(s.template_step_id)
    if (code) stepsOf.set(s.task_id, [...(stepsOf.get(s.task_id) ?? []), code])
  }

  const tasks: Task[] = [...r.tasks]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      projectId: t.project_id,
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
      steps: stepsOf.get(t.id) ?? [],
      createdAt: tsReq(t.created_at),
    }))

  const asks: Ask[] = r.asks.map((a) => ({
    id: a.id,
    projectId: a.project_id,
    milestoneId: a.milestone_id ?? '',
    question: a.question,
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

  return {
    board: { people, memberships, projects, milestones, tasks, asks, decisions, reminders, holidays, templates, settings },
    extras: {
      entities: [...r.entities]
        .sort((a, b) => a.sort - b.sort)
        .map((e) => ({ code: e.code, label: e.label, legalName: e.legal_name, sort: e.sort })),
      calendar: r.user_calendar.map((c) => ({ taskId: c.task_id, end: c.end_date, title: c.title, at: tsReq(c.added_at) })),
      emailLog: [...r.email_log].sort((a, b) => b.run_date.localeCompare(a.run_date)),
      appUrl: s?.app_url || '',
    },
  }
}
