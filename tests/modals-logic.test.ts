// Pure rules behind the dialogs (src/modals/logic.ts) on the prototype's seed board: people
// pickers per project role, the task form's save rules and payload, the gate auto-reopen note,
// and the project wizard's validation and payload.
import { describe, expect, it } from 'vitest'
import { createDomain } from '../src/domain/index.ts'
import type { Board, Domain, Task, Viewer } from '../src/domain/index.ts'
import {
  ACTIVITY,
  newTask,
  picPeople,
  pick,
  adminPeople,
  judgePeople,
  reopenNote,
  taskPayload,
  taskSaveError,
  taskSavedToast,
  wzAddMsError,
  wzPayload,
  wzValidate,
} from '../src/modals/logic.ts'
import type { WzState } from '../src/modals/logic.ts'
import { PROJECT_ID, PROTOTYPE_URL, prototypeBoard } from './fixtures/prototype-board.ts'

const TODAY = '2026-10-07'
const dika: Viewer = { userId: 'u-dika', personId: 'm-dika', isSuperAdmin: true }
const withLogins = (b: Board): Board => ({ ...b, people: b.people.map((p) => ({ ...p, userId: `u-${p.id.slice(2)}` })) })
const domain = (board: Board, viewer: Viewer | null = dika): Domain => createDomain(board, { today: TODAY, appUrl: PROTOTYPE_URL, viewer })
const must = <T>(x: T | null | undefined): T => {
  if (x === null || x === undefined) throw new Error('missing')
  return x
}
const base = prototypeBoard()
const d = domain(withLogins(base))
const task = (id: string): Task => must(d.task(id))

describe('people pickers follow per-project roles', () => {
  it('PIC, pemeriksa, pemutus: admins and members; the project PM: project admins only', () => {
    expect(picPeople(base, PROJECT_ID).map((p) => p.id)).toEqual(['m-david', 'm-dika', 'm-muti', 'm-yani'])
    expect(judgePeople(base, PROJECT_ID).map((p) => p.id)).toEqual(['m-david', 'm-dika', 'm-muti', 'm-yani'])
    expect(adminPeople(base, PROJECT_ID).map((p) => p.id)).toEqual(['m-david', 'm-dika'])
    expect(picPeople(base, 'other-project')).toEqual([])
    const viewer = { ...base, memberships: base.memberships.map((m) => (m.personId === 'm-yani' ? { ...m, role: 'viewer' as const } : m)) }
    expect(judgePeople(viewer, PROJECT_ID).map((p) => p.id)).toEqual(['m-david', 'm-dika', 'm-muti'])
  })
  it('a value outside the options becomes empty (prototype pmOpts(pmOnly(x)))', () => {
    const pms = adminPeople(base, PROJECT_ID)
    expect(pick(pms, 'm-david')).toBe('m-david')
    expect(pick(pms, 'm-yani')).toBe('')
    expect(pick(pms, '')).toBe('')
  })
})

describe('task form', () => {
  it('a new task starts in the current milestone, today + 3 days', () => {
    const t = newTask(d, PROJECT_ID, TODAY, { title: 'Rencana cadangan: ' })
    expect(t).toMatchObject({ id: '', milestoneId: must(d.currentMs(must(d.project(PROJECT_ID)))).id, start: TODAY, end: '2026-10-10' })
    expect(t.title).toBe('Rencana cadangan: ')
    expect(newTask(d, PROJECT_ID, TODAY, { milestoneId: 'G5' }).milestoneId).toBe('G5')
  })

  it('save rules, in the prototype order', () => {
    const t = task('MB02')
    expect(taskSaveError(d, t, true, true)).toBe('')
    expect(taskSaveError(d, { ...t, end: '2026-10-01' }, true, true)).toBe('Tanggal selesai tidak boleh sebelum tanggal mulai.')
    expect(taskSaveError(d, { ...t, validator: t.assignee }, true, true)).toBe('Pemeriksa tidak boleh orang yang sama dengan PIC.')
    // No validator: falls back to the PM (Dika), who is also the PIC.
    expect(taskSaveError(d, { ...t, validator: '' }, true, true)).toBe('Penerima task ini jatuh ke PIC-nya sendiri. Pilih pemeriksa lain.')
    expect(taskSaveError(d, { ...t, milestoneId: '' }, true, true)).toBe(
      'Pilih milestone. Di project dengan alur pemeriksaan, setiap task harus masuk milestone.',
    )
    expect(taskSaveError(d, { ...t, milestoneId: '', validator: t.assignee }, false, true)).toBe('')
  })

  it('regression (BRIEF §6.7): a changed pemeriksa is sent as validator_person_id', () => {
    const t = task('MB03')
    expect(t.validator).toBe('m-dika')
    const p = taskPayload({ ...t, validator: 'm-david', assignee: 'm-muti' }, { isNew: false, gated: true, hasTemplate: true })
    expect(p.validator_person_id).toBe('m-david')
    expect(p).toMatchObject({ id: 'MB03', assignee_person_id: 'm-muti' })
    expect(p).not.toHaveProperty('project_id')
  })

  it('payload: light mode keeps pemeriksa and bukti, steps only with a template, commit only when the toggle showed', () => {
    const t = task('MB21')
    const light = taskPayload(t, { isNew: false, gated: false, hasTemplate: false, commit: 'on' })
    expect(light).not.toHaveProperty('validator_person_id')
    expect(light).not.toHaveProperty('proof_requested')
    expect(light).not.toHaveProperty('steps')
    expect(light).not.toHaveProperty('commit')
    const gated = taskPayload(t, { isNew: true, gated: true, hasTemplate: true, commit: 'off' })
    expect(gated).toMatchObject({ project_id: PROJECT_ID, steps: ['report'], deps: ['TB-OKT'], commit: 'off' })
    expect(gated).not.toHaveProperty('id')
    expect(taskPayload(t, { isNew: false, gated: true, hasTemplate: true })).not.toHaveProperty('commit')
  })

  it('toast says when dates end up uncommitted', () => {
    const t = task('MB03')
    const fresh = { ...newTask(d, PROJECT_ID, TODAY), title: 'x', assignee: 'm-muti', validator: 'm-dika' }
    expect(taskSavedToast(d, fresh, null, true)).toBe('Task ditambahkan · tanggal belum dikomit PIC')
    expect(taskSavedToast(d, fresh, null, true, 'on')).toBe('Task ditambahkan')
    expect(taskSavedToast(d, fresh, null, false)).toBe('Task ditambahkan')
    const committed = { ...t, committed: true }
    expect(taskSavedToast(d, committed, committed, true)).toBe('Task disimpan')
    expect(taskSavedToast(d, { ...committed, end: '2026-10-20' }, committed, true)).toBe('Task disimpan · tanggal belum dikomit PIC')
    expect(taskSavedToast(d, { ...committed, end: '2026-10-20' }, committed, true, 'on')).toBe('Task disimpan')
  })
})

describe('gate auto-reopen note (prototype pendingNote)', () => {
  const lulus = domain(withLogins({ ...base, milestones: base.milestones.map((m) => (m.id === 'G0' ? { ...m, status: 'lulus' as const } : m)) }))
  it('names why the passed gate reopens', () => {
    const t = must(lulus.task('MB03'))
    expect(reopenNote(lulus, null, { milestoneId: 'G0', stage: 'todo' })).toBe('Keputusan G0 dibuka lagi karena ada task baru')
    expect(reopenNote(lulus, { ...t, milestoneId: 'G1' }, { milestoneId: 'G0', stage: 'todo' })).toBe(
      'Keputusan G0 dibuka lagi karena ada task baru',
    )
    expect(reopenNote(lulus, t, { milestoneId: 'G0', stage: 'progress' })).toBe('Keputusan G0 dibuka lagi karena task dibuka lagi')
    expect(reopenNote(lulus, t, { milestoneId: 'G0', stage: 'done' })).toBe('')
    expect(reopenNote(lulus, t, { milestoneId: 'G1', stage: 'progress' })).toBe('')
    expect(taskSavedToast(lulus, { ...t, committed: true }, { ...t, committed: true }, true)).toBe(
      'Task disimpan · Keputusan G0 dibuka lagi karena task dibuka lagi',
    )
  })
})

describe('project wizard', () => {
  const wz = (patch: Partial<WzState> = {}): WzState => ({
    name: 'BMG Costing',
    entity: 'BMG',
    outcome: 'Standard cost per SKU disetujui',
    measure: 'Selisih ke aktual < 2%',
    owner: 'm-dika',
    gate: true,
    validator: 'm-david',
    color: 'samb1',
    ms: [
      { id: 'a', title: 'BOM lengkap', target: '2026-10-20' },
      { id: 'b', title: 'Tarif overhead disetujui', target: '2026-11-10' },
    ],
    tasks: {
      a: [{ id: 't1', title: 'Kumpulkan BOM', pic: 'm-muti', start: '2026-10-08', end: '2026-10-14' }],
      b: [{ id: 't2', title: 'Hitung tarif', pic: 'm-david', start: '2026-10-21', end: '2026-10-27' }],
    },
    ...patch,
  })

  it('hasil: first missing field, all marked', () => {
    expect(wzValidate(wz({ name: ' ', owner: '' }), 'hasil')).toEqual({ msg: 'Isi nama project.', bad: ['wzName', 'wzOwner'] })
    expect(wzValidate(wz(), 'hasil')).toBeNull()
  })

  it('milestones are planned backward: targets must move forward, a new one goes before M1', () => {
    expect(wzValidate(wz({ ms: [] }), 'milestone')?.msg).toBe('Tambahkan minimal satu milestone.')
    const back = wz({
      ms: [
        { id: 'a', title: 'A', target: '2026-11-20' },
        { id: 'b', title: 'B', target: '2026-11-10' },
      ],
    })
    expect(wzValidate(back, 'milestone')).toEqual({
      msg: 'Target M2 (10 Nov) lebih awal dari M1 (20 Nov). Urutan target harus maju.',
      bad: ['wzms-b-target'],
    })
    expect(wzAddMsError(wz(), 'Data siap', '2026-10-25')?.msg).toBe(
      'Target milestone ini harus sebelum target M1 (20 Okt), karena ia terjadi lebih dulu.',
    )
    expect(wzAddMsError(wz(), '', '')).toEqual({ msg: 'Tulis kondisi milestone.', bad: ['wzMsNew', 'wzMsDate'] })
    expect(wzAddMsError(wz(), 'Data siap', '2026-10-15')).toBeNull()
  })

  it('tasks: every milestone needs one, every field filled, end not before start', () => {
    expect(wzValidate(wz({ tasks: { a: [] } }), 'task')).toEqual({ msg: 'Tambahkan minimal satu task untuk M1.', bad: ['wztadd-a'] })
    const t = wz()
    const bad = { ...t, tasks: { ...t.tasks, b: [{ id: 't2', title: 'Hitung', pic: '', start: '2026-10-21', end: '2026-10-20' }] } }
    expect(wzValidate(bad, 'task')).toEqual({ msg: 'Isi PIC task di M2.', bad: ['wzt-t2-pic', 'wzt-t2-end'] })
    expect(wzValidate(t, 'task')).toBeNull()
  })

  it('periksa: a pemeriksa is required, and must not leave a task with nobody to accept it', () => {
    expect(wzValidate(wz({ validator: '' }), 'periksa')?.msg).toBe('Pilih pemeriksa.')
    expect(wzValidate(wz({ validator: '', gate: false }), 'periksa')).toBeNull()
    const self = wz({ validator: 'm-dika', tasks: { a: [{ id: 't1', title: 'Kumpulkan BOM', pic: 'm-dika', start: '2026-10-08', end: '2026-10-14' }] } })
    expect(wzValidate(self, 'periksa')?.msg).toBe(
      'Pemeriksa dan PM sama-sama PIC untuk "Kumpulkan BOM", jadi tidak ada yang bisa memeriksanya. Pilih pemeriksa lain.',
    )
  })

  it('payload: milestones in order, tasks pointing at their milestone index', () => {
    expect(wzPayload(wz())).toEqual({
      name: 'BMG Costing',
      entity_code: 'BMG',
      outcome: 'Standard cost per SKU disetujui',
      measure: 'Selisih ke aktual < 2%',
      pm_person_id: 'm-dika',
      gate_mode: true,
      maturity: 'release',
      color: 'samb1',
      validator_person_id: 'm-david',
      milestones: [
        { title: 'BOM lengkap', target: '2026-10-20' },
        { title: 'Tarif overhead disetujui', target: '2026-11-10' },
      ],
      tasks: [
        { milestone_index: 0, title: 'Kumpulkan BOM', assignee_person_id: 'm-muti', start_date: '2026-10-08', end_date: '2026-10-14' },
        { milestone_index: 1, title: 'Hitung tarif', assignee_person_id: 'm-david', start_date: '2026-10-21', end_date: '2026-10-27' },
      ],
    })
    expect(wzPayload(wz({ gate: false }))).not.toHaveProperty('validator_person_id')
  })

  it('default task dates continue after the last task of this or an earlier milestone', () => {
    const t = wz()
    const byMs = { a: t.tasks.a?.map((x) => ({ end: x.end })), b: [] }
    // After 14 Okt (Rabu) → Kamis 15 Okt; five days long.
    expect(d.wzTaskDefaults(['a', 'b'], byMs, 'b')).toEqual({ start: '2026-10-15', end: '2026-10-19' })
  })
})

describe('milestone wording check', () => {
  it('flags activities, not conditions', () => {
    expect(ACTIVITY.test('Susun mapping TB')).toBe(true)
    expect(ACTIVITY.test('Follow up vendor')).toBe(true)
    expect(ACTIVITY.test('Mapping TB disetujui')).toBe(false)
  })
})
