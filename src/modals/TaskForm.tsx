// Task form (prototype openTask + saveTask): new or edit, for project admins, and for the PIC of a
// package planning its sub-tasks. A new task inherits its context (project, gate, package). A draft
// may leave PIC, pemeriksa and requested proof empty; commitment and submission need them. The
// database clears the commitment whenever dates or PIC change; the commit toggle only says what
// this save should do about it.
import { useState } from 'react'
import { Tip } from '../app/bits.tsx'
import { useOverlay } from '../app/overlay-context.ts'
import { TwoStep } from '../app/overlay.tsx'
import { useBoard } from '../data/board-context.ts'
import { fmt, STAGES } from '../domain/index.ts'
import type { Id, Project, Stage, Task } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { judgePeople, newTask, picPeople, pick, taskPayload, taskSaveError, taskSavedToast } from './logic.ts'
import type { TaskPreset } from './logic.ts'
import { Gone, PersonOptions, TaskActions, WarnList } from './parts.tsx'

export function TaskForm({ id, projectId, preset }: { id: Id | null; projectId: Id; preset?: TaskPreset }) {
  const { d, today } = useBoard()
  const live = id ? d.task(id) : undefined
  const p = d.project(live ? live.projectId : projectId)
  if (!p || (id && !live)) return <Gone />
  return <TaskFormBody p={p} live={live ?? null} seed={live ?? newTask(d, p.id, today, preset)} />
}

interface Fields {
  title: string
  milestoneId: Id
  start: string
  end: string
  assignee: Id
  validator: Id
  proof: string
  stage: Stage
  desc: string
  /** Prerequisite id → kind. */
  deps: Record<Id, 'start' | 'accept'>
  steps: string[]
  fn: Id
}

const toggle = (list: readonly string[], v: string, on: boolean): string[] => (on ? [...list.filter((x) => x !== v), v] : list.filter((x) => x !== v))

function TaskFormBody({ p, live, seed }: { p: Project; live: Task | null; seed: Task }) {
  const { d, board, viewer, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  // The task as it was when the form opened (prototype captured `t`): change detection and the toast compare against it.
  const [t0] = useState(seed)
  const isNew = !t0.id
  const g = d.gated(p)
  const ms = d.pms(p.id)
  const pics = picPeople(board, p.id)
  const pms = judgePeople(board, p.id)
  const steps = d.vcSteps(p)?.all ?? null
  const admin = d.canPlan(p)
  const parent = t0.parentId ? d.task(t0.parentId) : undefined
  const parentMs = parent ? d.mstone(parent.milestoneId) : undefined
  const [f, setF] = useState<Fields>(() => ({
    title: t0.title,
    milestoneId: ms.some((m) => m.id === t0.milestoneId) ? t0.milestoneId : '',
    start: t0.start,
    end: t0.end,
    assignee: pick(pics, t0.assignee),
    validator: pick(pms, t0.validator),
    proof: t0.proof,
    stage: t0.stage,
    desc: t0.desc,
    deps: Object.fromEntries([...t0.deps.map((x) => [x, 'start'] as const), ...t0.acceptDeps.map((x) => [x, 'accept'] as const)]),
    steps: [...t0.steps],
    fn: t0.ownerFunctionId,
  }))
  /** null until the viewer touches the commit box. */
  const [commitPick, setCommitPick] = useState<boolean | null>(null)
  const [adv, setAdv] = useState(() => t0.deps.length + t0.acceptDeps.length > 0 || !!t0.desc || t0.steps.length > 0)

  const set = <K extends keyof Fields>(k: K, v: Fields[K], fieldId?: string) => {
    setF((x) => ({ ...x, [k]: v }))
    setErr('')
    if (fieldId) bad.ok(fieldId)
  }

  const draft: Task = {
    ...t0,
    title: f.title.trim(),
    milestoneId: f.milestoneId,
    start: f.start,
    end: f.end,
    assignee: f.assignee,
    validator: g ? f.validator : t0.validator,
    proof: g ? f.proof.trim() : t0.proof,
    stage: f.stage,
    desc: f.desc.trim(),
    deps: Object.keys(f.deps).filter((x) => f.deps[x] === 'start'),
    acceptDeps: Object.keys(f.deps).filter((x) => f.deps[x] === 'accept'),
    steps: f.steps,
    ownerFunctionId: f.fn,
  }
  const changed = !isNew && (t0.start !== f.start || t0.end !== f.end || t0.assignee !== f.assignee)
  const canCommit = g && !!f.assignee && d.canCommit(draft)
  const committed = commitPick ?? (t0.committed && !changed)
  const liveErr = g && f.assignee && f.validator && f.assignee === f.validator ? 'Pemeriksa tidak boleh orang yang sama dengan PIC.' : ''
  const wd =
    f.start && f.end && f.end >= f.start
      ? `${d.workdays(f.start, f.end)} hari kerja dari ${d.durDays(draft)} hari kalender ${
          board.settings.cutiIsWorkday ? '(tanpa weekend dan libur nasional)' : '(tanpa weekend, libur nasional, dan cuti bersama)'
        }`
      : ''
  const others = d
    .ptasks(p.id)
    .filter((x) => x.id !== t0.id && x.id !== t0.parentId && x.parentId !== t0.id)
    .sort((a, b) => a.start.localeCompare(b.start) || a.ref.localeCompare(b.ref, 'en', { numeric: true }))
  const [depQ, setDepQ] = useState('')
  const depList = others.filter((o) => !!f.deps[o.id] || !depQ.trim() || `${o.ref} ${o.title}`.toLowerCase().includes(depQ.trim().toLowerCase()))
  const draftNote = g && (!f.assignee || !f.proof.trim()) ? `Disimpan sebagai draf: ${[!f.assignee && 'PIC', !f.proof.trim() && 'bukti yang diminta'].filter(Boolean).join(' dan ')} belum diisi. Task baru bisa dikomit dan diajukan setelah lengkap.` : ''

  const save = () => {
    const e = bad.need([
      ['tTitle', f.title, 'Isi judul task.'],
      g && ms.length > 0 && !parent && ['tMs', f.milestoneId, 'Pilih milestone.'],
      ['tStart', f.start, 'Isi tanggal mulai.'],
      ['tEnd', f.end, 'Isi tanggal selesai.'],
    ])
    if (e) return setErr(e)
    const e2 = taskSaveError(d, draft, g, ms.length > 0)
    if (e2) return setErr(e2)
    const commit = canCommit ? (committed ? 'on' : 'off') : undefined
    const payload = taskPayload(draft, { isNew, gated: g, hasTemplate: !!steps, commit, admin })
    const ok = taskSavedToast(d, draft, isNew ? null : t0, g, commit)
    void run(() => actions.saveTask(payload), { ok })
  }

  const meIsPic = !!viewer.personId && viewer.personId === f.assignee
  return (
    <>
      <h2>{isNew ? (parent ? 'Sub-task baru' : 'Task baru') : `Edit ${t0.ref || 'task'}`}</h2>
      <div className="req-note">Judul dan tanggal wajib. PIC, pemeriksa, dan bukti boleh menyusul (draf); dibutuhkan sebelum komit dan pengajuan.</div>
      {parent && (
        <div className="prompt" style={{ margin: 0 }}>
          Sub-task dari <b>{parent.ref}</b> · {parent.title}
          <br />
          <span className="sub">
            Ikut milestone paketnya{parentMs ? ` (${d.msNo(parentMs)})` : ''}. Jadwal paket {fmt(parent.start)} – {fmt(parent.end)}. Tanpa pemeriksa sendiri, sub-task diperiksa pemeriksa paketnya.
          </span>
        </div>
      )}
      {live?.rejectReason && (
        <div className="banner" style={{ margin: 0, background: 'var(--danger-soft)' }}>
          <span>
            <b>Ditolak pemeriksa:</b> {live.rejectReason}
          </span>
        </div>
      )}
      <label className="f">
        Judul task
        <input
          className={bad.cls('tTitle')}
          id="tTitle"
          value={f.title}
          placeholder="mis. Kirim data pallet-days per principal"
          maxLength={200}
          onChange={(e) => set('title', e.target.value, 'tTitle')}
        />
      </label>
      <label className="f" hidden={!!parent}>
        <span>
          Milestone
          <Tip k="milestone" />
        </span>
        <select className={bad.cls('tMs')} id="tMs" value={f.milestoneId} onChange={(e) => set('milestoneId', e.target.value, 'tMs')}>
          <option value="">{g && ms.length ? 'Pilih milestone…' : 'Tanpa milestone'}</option>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>
              {d.msNo(m)} · {m.title}
            </option>
          ))}
        </select>
      </label>
      <div className="fgrid">
        <label className="f">
          Mulai
          <input className={bad.cls('tStart')} type="date" id="tStart" value={f.start} onChange={(e) => set('start', e.target.value, 'tStart')} />
        </label>
        <label className="f">
          Selesai
          <input className={bad.cls('tEnd')} type="date" id="tEnd" value={f.end} onChange={(e) => set('end', e.target.value, 'tEnd')} />
        </label>
      </div>
      <div className="sub" style={{ marginTop: -6 }}>
        {wd}
      </div>
      <div className="fgrid">
        <label className="f">
          <span>
            PIC
            <Tip k="pic" />
          </span>
          <select className={bad.cls('tWho')} id="tWho" value={f.assignee} onChange={(e) => set('assignee', e.target.value, 'tWho')}>
            <PersonOptions people={pics} empty="Belum ditugaskan" />
          </select>
        </label>
        {g ? (
          <label className="f">
            <span>
              Pemeriksa
              <Tip k="pemeriksa" />
            </span>
            <select className={bad.cls('tVal')} id="tVal" value={f.validator} onChange={(e) => set('validator', e.target.value, 'tVal')}>
              <PersonOptions people={pms} empty="Belum ditentukan" />
            </select>
          </label>
        ) : (
          <label className="f">
            Tahap
            <select className="inp" id="tStage" value={f.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {board.functions.length > 0 && (
        <label className="f">
          <span>
            Fungsi pemilik
            <Tip k="fungsi" />
          </span>
          <select className="inp" id="tFn" value={f.fn} onChange={(e) => set('fn', e.target.value)}>
            <option value="">Tidak ditentukan</option>
            {board.functions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {g && (
        <>
          <label className="f">
            <span>
              Bukti yang diminta
              <Tip k="bukti" />
            </span>
            <input
              className={bad.cls('tProof')}
              id="tProof"
              value={f.proof}
              placeholder="mis. File data WMS per principal, total sudah dicocokkan ke closing stock"
              onChange={(e) => set('proof', e.target.value, 'tProof')}
            />
          </label>
          {canCommit && (
            <label className="toggle">
              <input type="checkbox" id="tCommit" checked={committed} onChange={(e) => setCommitPick(e.target.checked)} />
              <span>
                <b>{meIsPic ? 'Saya komit tanggal ini' : `Tandai komit atas nama ${d.mname(f.assignee) || 'PIC'}`}</b>
                <Tip k="komit" />
                <br />
                <span className="sub">Kalau tanggal atau PIC diubah, PIC perlu mengomit ulang.</span>
              </span>
            </label>
          )}
          <div className="sub">
            {canCommit ? null : f.assignee ? (
              <>
                Status tanggal: <b>{t0.committed && !changed ? 'Dikomit' : 'Belum dikomit'}</b>. Hanya {d.mname(f.assignee)} yang bisa mengomit.
              </>
            ) : (
              'Pilih PIC dulu. Tanggal baru bisa dikomit oleh PIC-nya.'
            )}
          </div>
        </>
      )}
      {!pics.length && (
        <div className="sub">Belum ada anggota di project ini. Project Admin menambahkannya di tab Anggota agar bisa dipilih sebagai PIC dan pemeriksa.</div>
      )}
      {draftNote && <div className="sub" style={{ color: 'var(--warn-ink)' }}>{draftNote}</div>}
      <WarnList list={d.warnings(draft, p)} />
      <details className="adv" open={adv} onToggle={(e) => setAdv(e.currentTarget.open)}>
        <summary>Detail lanjutan</summary>
        <div className="in">
          {steps && (
            <div className="f">
              <span>
                Step value chain
                <Tip k="vc" />
              </span>
              <div className="vcpick">
                {steps.map((s) => (
                  <label key={s.code}>
                    <input type="checkbox" value={s.code} checked={f.steps.includes(s.code)} onChange={(e) => set('steps', toggle(f.steps, s.code, e.target.checked))} />{' '}
                    {d.vcLabel(s)}
                  </label>
                ))}
              </div>
            </div>
          )}
          {g && admin && (
            <label className="f">
              Tahap
              <select className="inp" id="tStage" value={f.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
                <option value="todo">Belum mulai</option>
                <option value="progress">Dikerjakan</option>
              </select>
              <span className="hint">Tahap Diperiksa dan Selesai terisi lewat pengajuan dan pemeriksaan.</span>
            </label>
          )}
          <div className="f">
            <span>
              Prasyarat
              <Tip k="tunggu" />
            </span>
            {others.length ? (
              <>
                <input className="inp" placeholder="Cari ID atau judul task" value={depQ} onChange={(e) => setDepQ(e.target.value)} aria-label="Cari prasyarat" />
                <div className="deps">
                  {depList.map((o) => {
                    const cyc = !isNew && d.reaches(o.id, t0.id)
                    const kind = f.deps[o.id]
                    return (
                      <label key={o.id} className={cyc ? 'dis' : ''}>
                        <input
                          type="checkbox"
                          value={o.id}
                          checked={!!kind}
                          disabled={cyc}
                          onChange={(e) => {
                            const next = { ...f.deps }
                            if (e.target.checked) next[o.id] = 'start'
                            else delete next[o.id]
                            set('deps', next)
                          }}
                        />{' '}
                        <span className="ref" style={{ minWidth: 0 }}>{o.ref}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
                        {kind ? (
                          <select
                            className="inp"
                            style={{ width: 'auto', padding: '2px 6px', fontSize: 12 }}
                            aria-label={`Jenis prasyarat ${o.ref}`}
                            value={kind}
                            onClick={(e) => e.preventDefault()}
                            onChange={(e) => set('deps', { ...f.deps, [o.id]: e.target.value as 'start' | 'accept' })}
                          >
                            <option value="start">Mulai setelah</option>
                            <option value="accept">Diterima setelah</option>
                          </select>
                        ) : (
                          <span className="sub mono">{fmt(o.end)}</span>
                        )}
                        {cyc && <span className="sub">(melingkar)</span>}
                      </label>
                    )
                  })}
                </div>
                <span className="hint">Mulai setelah: task ini baru boleh mulai setelah prasyaratnya diterima. Diterima setelah: boleh jalan paralel, tapi baru bisa diterima setelah prasyaratnya diterima.</span>
              </>
            ) : (
              <span className="hint">Belum ada task lain di project ini.</span>
            )}
          </div>
          <label className="f">
            Catatan
            <textarea className="inp" id="tDesc" placeholder="Detail, konteks, atau link dokumen" value={f.desc} onChange={(e) => set('desc', e.target.value)} />
          </label>
        </div>
      </details>
      <div className="err">{err || liveErr}</div>
      {live && <TaskActions t={live} />}
      <div className="mfoot">
        <div>
          {!isNew && admin && (
            <TwoStep
              className="btn danger"
              label="Hapus task"
              armed="Klik lagi untuk hapus"
              disabled={busy}
              onConfirm={() => void run(() => actions.deleteTask(t0.id), { ok: 'Task dihapus' })}
            />
          )}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {isNew ? (parent ? 'Tambah sub-task' : 'Tambah task') : 'Simpan'}
          </button>
        </div>
      </div>
    </>
  )
}
