// Pure helpers behind the dialogs: people pickers, the task draft and its save rules, the gate
// auto-reopen note, and the project wizard (prototype openTask/saveTask/put, startWizard,
// wzValidate, wzCreate). No React and no DOM, so tests can run them on the prototype board.
import { addDays, fmt } from '../domain/index.ts'
import type { Board, CalendarEntry, Domain, Id, Person, ProjectRole, Stage, Task } from '../domain/index.ts'

/** Milestone titles that read like an activity instead of a condition (prototype ACTIVITY). */
export const ACTIVITY =
  /^(urus|mengurus|buat|bikin|membuat|siapkan|menyiapkan|lakukan|melakukan|kerjakan|proses|memproses|susun|menyusun|cari|mencari|follow ?up|koordinasi|meeting|rapat)\b/i

export const LOCK_MSG = 'Project ini sudah ditutup atau dihentikan. Buka lagi project-nya untuk mengubah.'
export const PM_ONLY_MSG = 'Hanya Project Manager yang bisa melakukan ini.'

/** People with one of `roles` on the project, in the board's (name) order. */
export function projectPeople(board: Board, projectId: Id, roles: readonly ProjectRole[]): Person[] {
  const ids = new Set(board.memberships.filter((m) => m.projectId === projectId && roles.includes(m.role)).map((m) => m.personId))
  return board.people.filter((p) => ids.has(p.id))
}
/** Who can be PIC: PM or officer members of this project. */
export const picPeople = (board: Board, projectId: Id): Person[] => projectPeople(board, projectId, ['pm', 'officer'])
/** Who can be PM, pemeriksa, pemutus or ask decider: PM members of this project. */
export const pmPeople = (board: Board, projectId: Id): Person[] => projectPeople(board, projectId, ['pm'])
/** `id` when it is one of `people`, else '' (a select cannot show a value it has no option for). */
export const pick = (people: readonly Person[], id: Id | null | undefined): Id => (id && people.some((p) => p.id === id) ? id : '')

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** Status of the viewer's own calendar event for a task (prototype calStateText). */
export function calStateText(c: CalendarEntry | undefined, t: Task): string {
  if (!c) return 'Event dibuat sebagai acara seharian di tanggal deadline, lengkap dengan detail task.'
  if (c.end === t.end) return `Sudah kamu tambahkan ke kalender (deadline ${fmt(c.end)}).`
  return `Deadline berubah sejak kamu tambahkan (${fmt(c.end)} → ${fmt(t.end)}). Hapus event lama, lalu tambahkan lagi.`
}
export const CAL_ADDED = 'Sudah kamu tambahkan ke kalender. Simpan event-nya di tab yang baru terbuka.'

/**
 * Note appended to the toast when a write reopens a passed gate (prototype put('tasks') →
 * pendingNote). The database reopens the gate itself; this only words what happened.
 */
export function reopenNote(d: Domain, old: Task | null | undefined, next: { milestoneId: Id; stage: Stage }): string {
  const m = d.mstone(next.milestoneId)
  if (!m || m.status !== 'lulus' || next.stage === 'done') return ''
  const why = !old || old.milestoneId !== next.milestoneId ? 'ada task baru' : 'task dibuka lagi'
  return `Keputusan ${d.msNo(m)} dibuka lagi karena ${why}`
}
export const withNote = (msg: string, note: string): string => (note ? `${msg} · ${note}` : msg)

export interface TaskPreset {
  milestoneId?: Id
  title?: string
  desc?: string
}

/** A new task as the prototype's openTask pre-fills it. */
export function newTask(d: Domain, projectId: Id, today: string, preset: TaskPreset = {}): Task {
  const p = d.project(projectId)
  const msId = preset.milestoneId || (p ? d.currentMs(p)?.id : '') || d.pms(projectId)[0]?.id || ''
  return {
    id: '',
    projectId,
    milestoneId: msId,
    title: preset.title ?? '',
    desc: preset.desc ?? '',
    start: today,
    end: addDays(today, 3),
    assignee: '',
    validator: '',
    proof: '',
    stage: 'todo',
    committed: false,
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
    deps: [],
    steps: [],
    createdAt: 0,
  }
}

/** Semantic checks after the required fields are filled (prototype saveTask click handler). */
export function taskSaveError(d: Domain, t: Task, gated: boolean, hasMilestones: boolean): string {
  if (!t.title) return 'Isi judul task dulu.'
  if (!t.start || !t.end) return 'Isi tanggal mulai dan selesai.'
  if (t.end < t.start) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
  if (gated && t.assignee && t.assignee === t.validator) return 'Pemeriksa tidak boleh orang yang sama dengan PIC.'
  if (gated && d.selfAccept(t)) return 'Penerima task ini jatuh ke PIC-nya sendiri. Pilih pemeriksa lain.'
  if (gated && hasMilestones && !t.milestoneId)
    return 'Pilih milestone. Di project dengan alur pemeriksaan, setiap task harus masuk milestone.'
  return ''
}

/** save_task payload (structurally the data layer's TaskInput). */
export interface TaskPayload {
  id?: string
  project_id?: string
  milestone_id: string
  title: string
  description: string
  start_date: string
  end_date: string
  assignee_person_id: string
  validator_person_id?: string
  proof_requested?: string
  stage: string
  deps: string[]
  steps?: string[]
  commit?: 'on' | 'off'
}

/**
 * Light mode keeps pemeriksa and bukti as they are; steps are only sent when the project has a
 * value-chain template; commit is omitted when the toggle was hidden (the database then clears
 * the commitment if dates or PIC changed).
 */
export function taskPayload(t: Task, o: { isNew: boolean; gated: boolean; hasTemplate: boolean; commit?: 'on' | 'off' }): TaskPayload {
  return {
    ...(o.isNew ? { project_id: t.projectId } : { id: t.id }),
    milestone_id: t.milestoneId,
    title: t.title,
    description: t.desc,
    start_date: t.start,
    end_date: t.end,
    assignee_person_id: t.assignee,
    ...(o.gated ? { validator_person_id: t.validator, proof_requested: t.proof } : {}),
    stage: t.stage,
    deps: [...t.deps],
    ...(o.hasTemplate ? { steps: [...t.steps] } : {}),
    ...(o.gated && o.commit ? { commit: o.commit } : {}),
  }
}

/** Toast after saving a task (prototype: '· tanggal belum dikomit PIC', plus the reopen note). */
export function taskSavedToast(d: Domain, draft: Task, old: Task | null, gated: boolean, commit?: 'on' | 'off'): string {
  const committed = d.commitAfterEdit(draft, old, commit === 'on' ? true : commit === 'off' ? 'off' : false).committed
  const msg = (old ? 'Task disimpan' : 'Task ditambahkan') + (gated && !committed ? ' · tanggal belum dikomit PIC' : '')
  return withNote(msg, reopenNote(d, old, draft))
}

// ---------------------------------------------------------------------------------------------
// Project wizard (prototype startWizard … wzCreate). No "Tim" step: people are managed in Admin.
// ---------------------------------------------------------------------------------------------

export const WZ_STEPS = ['hasil', 'milestone', 'task', 'periksa', 'ringkasan'] as const
export type WzStep = (typeof WZ_STEPS)[number]
export const WZ_NAMES: Record<WzStep, string> = {
  hasil: 'Hasil akhir',
  milestone: 'Milestone',
  task: 'Task',
  periksa: 'Pemeriksaan',
  ringkasan: 'Ringkasan',
}

export interface WzMs {
  id: string
  title: string
  target: string
}
export interface WzTask {
  id: string
  title: string
  pic: Id
  start: string
  end: string
}
export interface WzState {
  name: string
  entity: string
  outcome: string
  measure: string
  /** PM (people id). */
  owner: Id
  gate: boolean
  validator: Id
  color: string
  /** In display order: earliest first. New milestones are added at the front (planned backward). */
  ms: WzMs[]
  tasks: Record<string, WzTask[]>
}
export interface WzError {
  msg: string
  /** Element ids to mark; the first one gets focus. */
  bad: string[]
}

/** Element ids of the wizard's repeated fields. */
export const wzId = {
  ms: (id: string, k: 'title' | 'target') => `wzms-${id}-${k}`,
  task: (id: string, k: keyof Omit<WzTask, 'id'>) => `wzt-${id}-${k}`,
  addTask: (msId: string) => `wztadd-${msId}`,
}

const wzTasksOf = (wz: WzState, msId: string): WzTask[] => wz.tasks[msId] ?? []
export const wzAllTasks = (wz: WzState): WzTask[] => wz.ms.flatMap((m) => wzTasksOf(wz, m.id))

/** Adding a milestone in front: it must not be after the current first one (prototype doAdd). */
export function wzAddMsError(wz: WzState, title: string, target: string): WzError | null {
  const miss: [string, string][] = []
  if (!title.trim()) miss.push(['wzMsNew', 'Tulis kondisi milestone.'])
  if (!target) miss.push(['wzMsDate', 'Isi target tanggal milestone.'])
  const first = miss[0]
  if (first) return { msg: first[1], bad: miss.map((x) => x[0]) }
  const m1 = wz.ms[0]
  if (m1?.target && target > m1.target)
    return { msg: `Target milestone ini harus sebelum target M1 (${fmt(m1.target)}), karena ia terjadi lebih dulu.`, bad: ['wzMsDate'] }
  return null
}

export function wzValidate(wz: WzState, step: WzStep): WzError | null {
  const E = (msg: string, bad: string[]): WzError => ({ msg, bad })
  if (step === 'hasil') {
    const miss = (
      [
        [wz.name.trim(), 'wzName', 'Isi nama project.'],
        [wz.entity, 'wzEnt', 'Pilih entitasnya.'],
        [wz.outcome.trim(), 'wzOutcome', 'Tulis hasil akhirnya.'],
        [wz.measure.trim(), 'wzMeasure', 'Tulis cara tahu hasil akhir sudah tercapai.'],
        [wz.owner, 'wzOwner', 'Pilih PM-nya.'],
      ] as const
    ).filter((x) => !x[0])
    const first = miss[0]
    if (first) return E(first[2], miss.map((x) => x[1]))
  }
  if (step === 'milestone') {
    if (!wz.ms.length) return E('Tambahkan minimal satu milestone.', ['wzMsNew', 'wzMsDate'])
    const bad: string[] = []
    for (const m of wz.ms) {
      if (!m.title.trim()) bad.push(wzId.ms(m.id, 'title'))
      if (!m.target) bad.push(wzId.ms(m.id, 'target'))
    }
    if (bad.length) return E('Lengkapi kondisi dan target tanggal setiap milestone.', bad)
    for (let i = 1; i < wz.ms.length; i++) {
      const a = wz.ms[i - 1]
      const b = wz.ms[i]
      if (a && b && b.target < a.target)
        return E(
          `Target M${i + 1} (${fmt(b.target)}) lebih awal dari M${i} (${fmt(a.target)}). Urutan target harus maju.`,
          [wzId.ms(b.id, 'target')],
        )
    }
  }
  if (step === 'task') {
    const empty = wz.ms.findIndex((m) => !wzTasksOf(wz, m.id).length)
    const em = wz.ms[empty]
    if (em) return E(`Tambahkan minimal satu task untuk M${empty + 1}.`, [wzId.addTask(em.id)])
    const bad: string[] = []
    let first = ''
    const labels = [
      ['title', 'judul'],
      ['pic', 'PIC'],
      ['start', 'tanggal mulai'],
      ['end', 'tanggal selesai'],
    ] as const
    wz.ms.forEach((m, i) => {
      for (const t of wzTasksOf(wz, m.id)) {
        for (const [k, l] of labels) {
          if (!t[k].trim()) {
            bad.push(wzId.task(t.id, k))
            first ||= `Isi ${l} task di M${i + 1}.`
          }
        }
        if (t.start && t.end && t.end < t.start) {
          bad.push(wzId.task(t.id, 'end'))
          first ||= `Tanggal selesai "${t.title.trim() || 'task'}" sebelum tanggal mulai.`
        }
      }
    })
    if (bad.length) return E(first, bad)
  }
  if (step === 'periksa' && wz.gate) {
    if (!wz.validator) return E('Pilih pemeriksa.', ['wzVal'])
    const self = wzAllTasks(wz).find((t) => t.pic === wz.validator && t.pic === wz.owner)
    if (self)
      return E(
        `Pemeriksa dan PM sama-sama PIC untuk "${self.title.trim()}", jadi tidak ada yang bisa memeriksanya. Pilih pemeriksa lain.`,
        ['wzVal'],
      )
  }
  return null
}

/** create_project payload (structurally the data layer's WizardInput). */
export interface WizardPayload {
  name: string
  entity_code: string
  outcome: string
  measure: string
  pm_person_id: string
  gate_mode: boolean
  maturity: string
  color: string
  validator_person_id?: string
  milestones: { title: string; target: string }[]
  tasks: { milestone_index: number; title: string; assignee_person_id: string; start_date: string; end_date: string }[]
}

export function wzPayload(wz: WzState): WizardPayload {
  return {
    name: wz.name.trim(),
    entity_code: wz.entity,
    outcome: wz.outcome.trim(),
    measure: wz.measure.trim(),
    pm_person_id: wz.owner,
    gate_mode: wz.gate,
    maturity: 'release',
    color: wz.color,
    ...(wz.gate && wz.validator ? { validator_person_id: wz.validator } : {}),
    milestones: wz.ms.map((m) => ({ title: m.title.trim(), target: m.target })),
    tasks: wz.ms.flatMap((m, i) =>
      wzTasksOf(wz, m.id)
        .filter((t) => t.title.trim())
        .map((t) => ({ milestone_index: i, title: t.title.trim(), assignee_person_id: t.pic, start_date: t.start, end_date: t.end })),
    ),
  }
}
