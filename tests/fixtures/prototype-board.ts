// The prototype's seed export as a domain Board, keeping prototype ids (MB01, G3, m-dika) as ids so
// results compare directly with reference/golden/prototype-golden.json (BRIEF §9).
import { readFileSync } from 'node:fs'
import type {
  Ask,
  Board,
  Holiday,
  Maturity,
  Membership,
  Milestone,
  MsStatus,
  Person,
  Project,
  ProjectStatus,
  Settings,
  Stage,
  StepKind,
  StepTemplate,
  Task,
} from '../../src/domain/types.ts'

/** The prototype's hard-coded APP_URL. */
export const PROTOTYPE_URL = 'https://claude.ai/artifact/BP9FN3MwNzf2uNdSeZG6fP'
export const PROJECT_ID = 'samb-timeline'
export const TEMPLATE_ID = 'trading-samb'

export const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')) as T

interface SeedMember {
  id: string
  name: string
  role: string
  email: string
  emailDaily?: boolean
  access: 'pm' | 'officer'
  createdAt: number
}
interface SeedProject {
  id: string
  name: string
  entity: string
  outcome: string
  measure: string
  owner: string
  status?: ProjectStatus
  maturity: Maturity
  gateMode?: boolean
  color: string
  createdAt: number
}
interface SeedMilestone {
  id: string
  projectId: string
  code?: string
  title: string
  target?: string
  criteria?: string
  trigger?: string
  fallback?: string
  approver?: string
  mode?: 'slow' | 'fast'
  order: number
  status?: MsStatus | null
  createdAt: number
}
interface SeedTask {
  id: string
  projectId: string
  milestoneId?: string
  title: string
  desc?: string
  start: string
  end: string
  assignee?: string
  validator?: string
  proof?: string
  stage: Stage
  committed?: boolean
  deps?: string[]
  steps?: string[]
  createdAt: number
}
interface SeedAsk {
  id: string
  projectId: string
  milestoneId?: string
  question: string
  decider?: string
  due?: string
  status: 'open' | 'decided'
  createdAt: number
  createdBy?: string
}
interface SeedExport {
  projects: SeedProject[]
  milestones: SeedMilestone[]
  tasks: SeedTask[]
  asks: SeedAsk[]
  members: SeedMember[]
}
interface SeedTemplate {
  meta: { name: string }
  steps: { code: string; label_no: string; name: string; need: string; sort: number; kind: StepKind }[]
}

/** Per-project roles for Margin Bridge (BRIEF §7). */
const MEMBERSHIPS: Membership[] = [
  { projectId: PROJECT_ID, personId: 'm-dika', role: 'pm' },
  { projectId: PROJECT_ID, personId: 'm-david', role: 'pm' },
  { projectId: PROJECT_ID, personId: 'm-yani', role: 'officer' },
  { projectId: PROJECT_ID, personId: 'm-muti', role: 'officer' },
]

export const DEFAULT_SETTINGS: Settings = {
  cutiIsWorkday: false,
  emailPaused: false,
  emailTime: '07:00',
  timezone: 'Asia/Jakarta',
  emailProvider: 'none',
}

const toPerson = (m: SeedMember): Person => ({
  id: m.id,
  name: m.name,
  role: m.role,
  userId: null,
  email: m.email || null,
  emailDaily: m.emailDaily ?? true,
  createdAt: m.createdAt,
})

const toProject = (p: SeedProject): Project => ({
  id: p.id,
  name: p.name,
  entity: p.entity,
  outcome: p.outcome,
  measure: p.measure,
  owner: p.owner,
  status: p.status ?? 'aktif',
  maturity: p.maturity,
  gateMode: p.gateMode !== false,
  parallelGates: false,
  color: p.color,
  stepTemplateId: TEMPLATE_ID,
  closedAt: null,
  closedBy: null,
  closeNote: null,
  closeSrc: null,
  createdAt: p.createdAt,
})

const toMilestone = (m: SeedMilestone): Milestone => ({
  id: m.id,
  projectId: m.projectId,
  code: m.code || null,
  title: m.title,
  target: m.target ?? '',
  criteria: m.criteria ?? '',
  trigger: m.trigger ?? '',
  fallback: m.fallback ?? '',
  approver: m.approver ?? '',
  mode: m.mode ?? 'slow',
  order: m.order,
  status: m.status ?? null,
  lastDecision: null,
  createdAt: m.createdAt,
})

const toTask = (t: SeedTask): Task => ({
  id: t.id,
  projectId: t.projectId,
  milestoneId: t.milestoneId ?? '',
  title: t.title,
  desc: t.desc ?? '',
  start: t.start,
  end: t.end,
  assignee: t.assignee ?? '',
  validator: t.validator ?? '',
  proof: t.proof ?? '',
  stage: t.stage,
  committed: t.committed ?? false,
  committedAt: null,
  committedBy: null,
  evidence: null,
  submittedAt: null,
  submittedBy: null,
  acceptedAt: null,
  acceptedBy: null,
  rejectReason: null,
  rejectedAt: null,
  rejectedBy: null,
  doneAt: null,
  deps: [...(t.deps ?? [])],
  steps: [...(t.steps ?? [])],
  createdAt: t.createdAt,
})

const toAsk = (a: SeedAsk): Ask => ({
  id: a.id,
  projectId: a.projectId,
  milestoneId: a.milestoneId ?? '',
  question: a.question,
  decider: a.decider ?? '',
  due: a.due ?? '',
  status: a.status,
  answer: null,
  decidedAt: null,
  decidedBy: null,
  src: { deciderName: '', forum: '', decidedOn: '' },
  createdAt: a.createdAt,
  createdBy: a.createdBy ?? null,
})

/** A fresh Board (safe to mutate) in the seed's array order, which the prototype's filters keep. */
export function prototypeBoard(settings: Partial<Settings> = {}): Board {
  const seed = readJson<SeedExport>('seed/board-export.json')
  const holidays = readJson<{ holidays: Holiday[] }>('seed/holidays.json').holidays.map(
    ({ date, type, name }): Holiday => ({ date, type, name }),
  )
  const tpl = readJson<SeedTemplate>('seed/step-template-trading-samb.json')
  const template: StepTemplate = {
    id: TEMPLATE_ID,
    name: tpl.meta.name,
    steps: tpl.steps.map((s) => ({ id: s.code, code: s.code, no: s.label_no, name: s.name, need: s.need, kind: s.kind, sort: s.sort })),
  }
  return {
    people: seed.members.map(toPerson),
    memberships: MEMBERSHIPS.map((m) => ({ ...m })),
    projects: seed.projects.map(toProject),
    milestones: seed.milestones.map(toMilestone),
    tasks: seed.tasks.map(toTask),
    asks: seed.asks.map(toAsk),
    decisions: [],
    reminders: [],
    holidays,
    templates: [template],
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
}
