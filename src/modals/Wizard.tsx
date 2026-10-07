// Project wizard (prototype startWizard/renderWizard): outcome → milestones planned backward →
// tasks per milestone → pemeriksa → summary. Super admin only; there is no "Tim" step because
// people are managed in Admin, so PM, PIC and pemeriksa pick from everyone. create_project adds
// the memberships (PM as Project Admin, pemeriksa and PICs as Member).
import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, Tip } from '../app/bits.tsx'
import { useOverlay } from '../app/overlay-context.ts'
import { getUI, setUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { fmt, GRADS, range } from '../domain/index.ts'
import type { Id } from '../domain/index.ts'
import { focusId, useBad, useSubmit } from './form.ts'
import { ACTIVITY, WZ_NAMES, WZ_STEPS, wzAddMsError, wzAllTasks, wzId, wzPayload, wzValidate } from './logic.ts'
import type { WzMs, WzState, WzTask } from './logic.ts'
import { PersonOptions } from './parts.tsx'

/** Local ids for rows that exist only inside the wizard (the database mints the real ones). */
const uid = (): string => Math.random().toString(36).slice(2, 12)

export function Wizard() {
  const { d, board, extras, viewer, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const [step, setStep] = useState(0)
  const [wz, setWz] = useState<WzState>(() => ({
    name: '',
    entity: getUI().ent,
    outcome: '',
    measure: '',
    owner: viewer.personId ?? '',
    gate: true,
    validator: '',
    color: GRADS[board.projects.length % GRADS.length] ?? 'samb3',
    ms: [],
    tasks: {},
  }))
  const [msNew, setMsNew] = useState({ title: '', target: '' })
  /** Element to focus after the next render (a newly added task row). */
  const [focusNext, setFocusNext] = useState('')
  const top = useRef<HTMLDivElement>(null)
  const st = WZ_STEPS[step] ?? 'hasil'
  const last = step === WZ_STEPS.length - 1
  const people = board.people

  // Each step opens like a fresh dialog in the prototype: focus its first field.
  useEffect(() => {
    const f = top.current
      ?.closest('.modal')
      ?.querySelector<HTMLElement>('input:not([type=radio]):not([type=checkbox]),textarea,select')
    f?.focus()
  }, [step])
  useEffect(() => {
    if (focusNext) focusId(focusNext)
  }, [focusNext])

  const patch = (p: Partial<WzState>, fieldId?: string) => {
    setWz((x) => ({ ...x, ...p }))
    if (fieldId) bad.ok(fieldId)
  }
  const setMs = (id: string, k: 'title' | 'target', v: string) => {
    setWz((x) => ({ ...x, ms: x.ms.map((m) => (m.id === id ? { ...m, [k]: v } : m)) }))
    bad.ok(wzId.ms(id, k))
  }
  const setTask = (msId: string, id: string, k: keyof Omit<WzTask, 'id'>, v: string) => {
    setWz((x) => ({ ...x, tasks: { ...x.tasks, [msId]: (x.tasks[msId] ?? []).map((t) => (t.id === id ? { ...t, [k]: v } : t)) } }))
    bad.ok(wzId.task(id, k))
  }
  const addMs = () => {
    const e = wzAddMsError(wz, msNew.title, msNew.target)
    if (e) {
      setErr(bad.only(e.bad, e.msg))
      return
    }
    const m: WzMs = { id: uid(), title: msNew.title.trim(), target: msNew.target }
    setWz((x) => ({ ...x, ms: [m, ...x.ms] }))
    setMsNew({ title: '', target: '' })
    setErr('')
    focusId('wzMsNew')
  }
  const delMs = (id: string) => {
    setWz((x) => {
      const tasks = { ...x.tasks }
      delete tasks[id]
      return { ...x, ms: x.ms.filter((m) => m.id !== id), tasks }
    })
  }
  const addTask = (msId: string) => {
    const tasksByMs = Object.fromEntries(Object.entries(wz.tasks).map(([k, v]) => [k, v.map((t) => ({ end: t.end }))]))
    const dt = d.wzTaskDefaults(
      wz.ms.map((m) => m.id),
      tasksByMs,
      msId,
    )
    const t: WzTask = { id: uid(), title: '', pic: '', start: dt.start, end: dt.end }
    setWz((x) => ({ ...x, tasks: { ...x.tasks, [msId]: [...(x.tasks[msId] ?? []), t] } }))
    bad.ok(wzId.addTask(msId))
    setFocusNext(wzId.task(t.id, 'title'))
  }
  const delTask = (id: string) => {
    setWz((x) => ({ ...x, tasks: Object.fromEntries(Object.entries(x.tasks).map(([k, v]) => [k, v.filter((t) => t.id !== id)])) }))
  }
  const go = (to: number) => {
    setErr('')
    bad.only([], '')
    setStep(to)
  }
  const next = () => {
    const e = wzValidate(wz, st)
    if (e) {
      setErr(bad.only(e.bad, e.msg))
      return
    }
    if (!last) return go(step + 1)
    let pid = ''
    void run(
      async () => {
        pid = await actions.createProject(wzPayload(wz))
      },
      {
        ok: `Project dibuat dengan ${wz.ms.length} milestone. Lanjutkan lewat Langkah berikutnya.`,
        after: () => {
          if (pid) setUI({ view: 'project', pid, tab: 'milestone' })
          window.scrollTo(0, 0)
        },
      },
    )
  }

  const mname = (id: Id) => people.find((p) => p.id === id)?.name ?? ''
  const entLabel = (code: string) => extras.entities.find((x) => x.code === code)?.label ?? code

  let body: ReactNode = null
  if (st === 'hasil')
    body = (
      <>
        <div className="wz-q">
          Apa yang ingin dicapai project ini?
          <Tip k="hasil" />
        </div>
        <div className="fgrid">
          <label className="f">
            Nama project
            <input
              className={bad.cls('wzName')}
              id="wzName"
              value={wz.name}
              placeholder="mis. Margin Bridge SAMB"
              maxLength={80}
              onChange={(e) => patch({ name: e.target.value }, 'wzName')}
            />
          </label>
          <label className="f">
            Entitas
            <select className={bad.cls('wzEnt')} id="wzEnt" value={wz.entity} onChange={(e) => patch({ entity: e.target.value }, 'wzEnt')}>
              <option value="">Pilih entitas…</option>
              {extras.entities.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="f">
          Hasil akhir
          <span className="hint">Tulis kondisi akhirnya, bukan aktivitasnya.</span>
          <textarea
            className={bad.cls('wzOutcome')}
            id="wzOutcome"
            placeholder="mis. Laporan kontribusi per principal untuk data November terkirim ke manajemen dan terekonsiliasi ke P&L SAMB"
            value={wz.outcome}
            onChange={(e) => patch({ outcome: e.target.value }, 'wzOutcome')}
          />
        </label>
        <label className="f">
          <span>
            Cara tahu sudah tercapai
            <Tip k="ukur" />
          </span>
          <input
            className={bad.cls('wzMeasure')}
            id="wzMeasure"
            value={wz.measure}
            placeholder="mis. Total kontribusi semua principal sama dengan P&L SAMB, selisih nol"
            onChange={(e) => patch({ measure: e.target.value }, 'wzMeasure')}
          />
        </label>
        <label className="f">
          <span>
            Siapa PM-nya?
            <Tip k="pm" />
          </span>
          <select className={bad.cls('wzOwner')} id="wzOwner" value={wz.owner} onChange={(e) => patch({ owner: e.target.value }, 'wzOwner')}>
            <PersonOptions people={people} empty="Pilih PM…" />
          </select>
        </label>
      </>
    )

  if (st === 'milestone')
    body = (
      <>
        <div className="wz-q">
          Apa yang harus sudah benar tepat sebelum <span style={{ color: 'var(--accent)' }}>{wz.ms[0]?.title || wz.outcome.trim()}</span> tercapai?
          <Tip k="mundur" />
        </div>
        <div className="sub">
          Tulis jawabannya sebagai kondisi beserta target tanggalnya, lalu Tambah. Ulangi pertanyaannya sampai kembali ke kondisi sekarang. Biasanya
          3–6 milestone cukup.
        </div>
        <div className="wz-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 150px auto' }}>
          <input
            className={bad.cls('wzMsNew')}
            id="wzMsNew"
            placeholder="mis. Account mapping TB disetujui Accounting"
            maxLength={140}
            value={msNew.title}
            onChange={(e) => {
              setMsNew((x) => ({ ...x, title: e.target.value }))
              bad.ok('wzMsNew')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addMs()
              }
            }}
          />
          <input
            className={bad.cls('wzMsDate')}
            type="date"
            id="wzMsDate"
            aria-label="Target tanggal"
            title="Target tanggal"
            value={msNew.target}
            onChange={(e) => {
              setMsNew((x) => ({ ...x, target: e.target.value }))
              bad.ok('wzMsDate')
            }}
          />
          <button type="button" className="btn primary" onClick={addMs}>
            <Icon name="plus" /> Tambah
          </button>
        </div>
        <div className="warn">
          {ACTIVITY.test(msNew.title.trim()) && (
            <div>Ini terdengar seperti aktivitas. Tulis kondisi akhirnya, mis. &quot;Mapping disetujui&quot;, bukan &quot;Susun mapping&quot;.</div>
          )}
        </div>
        <div className="wz-list">
          {wz.ms.map((m, i) => (
            <div className="wz-row" key={m.id}>
              <span className="wz-no">M{i + 1}</span>
              <input
                className={bad.cls(wzId.ms(m.id, 'title'))}
                id={wzId.ms(m.id, 'title')}
                value={m.title}
                aria-label={`Kondisi M${i + 1}`}
                onChange={(e) => setMs(m.id, 'title', e.target.value)}
              />
              <input
                className={bad.cls(wzId.ms(m.id, 'target'))}
                type="date"
                id={wzId.ms(m.id, 'target')}
                value={m.target}
                aria-label={`Target M${i + 1}`}
                onChange={(e) => setMs(m.id, 'target', e.target.value)}
              />
              <button type="button" className="icon-btn" aria-label="Hapus" onClick={() => delMs(m.id)}>
                ✕
              </button>
            </div>
          ))}
          <div className="wz-goal">
            <span className="chip" style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
              Hasil akhir
            </span>
            <span>{wz.outcome.trim()}</span>
          </div>
        </div>
      </>
    )

  if (st === 'task')
    body = (
      <>
        <div className="wz-q">Task apa saja yang membuat tiap milestone tercapai, dan siapa PIC-nya?</div>
        <div className="sub">Tanggal yang diisi di sini masih usulan. Masing-masing PIC nanti mengomitnya sendiri.</div>
        {wz.ms.length ? (
          wz.ms.map((m, i) => {
            const arr = wz.tasks[m.id] ?? []
            return (
              <div className="wz-block" key={m.id}>
                <h3>
                  M{i + 1} · {m.title}
                  {m.target && <span className="sub"> · target {fmt(m.target)}</span>}
                </h3>
                {arr.length > 0 && (
                  <div className="wz-row t sub" style={{ fontWeight: 700 }}>
                    <span>Task</span>
                    <span>PIC</span>
                    <span>Mulai</span>
                    <span>Selesai</span>
                    <span />
                  </div>
                )}
                {arr.map((t) => (
                  <div className="wz-row t" key={t.id}>
                    <input
                      className={bad.cls(wzId.task(t.id, 'title'))}
                      id={wzId.task(t.id, 'title')}
                      value={t.title}
                      placeholder="mis. Kirim data pallet-days per principal"
                      aria-label="Judul task"
                      onChange={(e) => setTask(m.id, t.id, 'title', e.target.value)}
                    />
                    <select
                      className={bad.cls(wzId.task(t.id, 'pic'))}
                      id={wzId.task(t.id, 'pic')}
                      value={t.pic}
                      aria-label="PIC"
                      onChange={(e) => setTask(m.id, t.id, 'pic', e.target.value)}
                    >
                      <PersonOptions people={people} empty="PIC…" />
                    </select>
                    <input
                      className={bad.cls(wzId.task(t.id, 'start'))}
                      type="date"
                      id={wzId.task(t.id, 'start')}
                      value={t.start}
                      aria-label="Mulai"
                      onChange={(e) => setTask(m.id, t.id, 'start', e.target.value)}
                    />
                    <input
                      className={bad.cls(wzId.task(t.id, 'end'))}
                      type="date"
                      id={wzId.task(t.id, 'end')}
                      value={t.end}
                      aria-label="Selesai"
                      onChange={(e) => setTask(m.id, t.id, 'end', e.target.value)}
                    />
                    <button type="button" className="icon-btn" aria-label="Hapus" onClick={() => delTask(t.id)}>
                      ✕
                    </button>
                  </div>
                ))}
                <div>
                  <button type="button" className="btn sm" id={wzId.addTask(m.id)} onClick={() => addTask(m.id)}>
                    <Icon name="plus" /> Tambah task
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="empty">Belum ada milestone. Kembali ke langkah sebelumnya untuk menambahkannya.</div>
        )}
      </>
    )

  if (st === 'periksa') {
    const clash = wz.validator ? wzAllTasks(wz).filter((t) => t.title.trim() && t.pic === wz.validator).length : 0
    body = (
      <>
        <div className="wz-q">
          Siapa yang memeriksa hasil kerja?
          <Tip k="pemeriksa" />
        </div>
        <label className="toggle">
          <input type="checkbox" id="wzGate" checked={wz.gate} onChange={(e) => patch({ gate: e.target.checked })} />
          <span>
            <b>Pakai alur pemeriksaan</b>
            <br />
            <span className="sub">Task yang selesai diajukan dengan bukti, lalu diterima atau ditolak pemeriksa. Matikan untuk project kecil.</span>
          </span>
        </label>
        <label className="f">
          Pemeriksa untuk semua task
          <select className={bad.cls('wzVal')} id="wzVal" value={wz.validator} onChange={(e) => patch({ validator: e.target.value }, 'wzVal')}>
            <PersonOptions people={people} empty="Pilih pemeriksa…" />
          </select>
          <span className="hint">Bisa diganti per task nanti. Pemeriksa tidak boleh PIC dari task yang sama.</span>
        </label>
        {clash > 0 && (
          <div className="warn">
            <div>
              {clash} task PIC-nya sama dengan pemeriksa ini. Untuk task tersebut, pemeriksanya otomatis PM ({mname(wz.owner) || '-'}).
            </div>
          </div>
        )}
        <div className="sub">Pemutus setiap milestone: {mname(wz.owner) || 'Project Manager'} (PM). Bisa diganti per milestone nanti.</div>
      </>
    )
  }

  if (st === 'ringkasan') {
    const nT = wzAllTasks(wz).filter((t) => t.title.trim()).length
    body = (
      <>
        <div className="wz-q">Cek dulu sebelum dibuat</div>
        <div className="prompt">
          <b>{wz.name.trim()}</b>
          {wz.entity && <span className="sub"> · {entLabel(wz.entity)}</span>}
          <br />
          <span className="sub">Hasil akhir: {wz.outcome.trim()}</span>
          {wz.measure.trim() && (
            <>
              <br />
              <span className="sub">Cara tahu sudah tercapai: {wz.measure.trim()}</span>
            </>
          )}
          <br />
          <span className="sub">
            PM: {mname(wz.owner) || 'Project Manager'} · {wz.gate ? 'Pakai alur pemeriksaan' : 'Tanpa pemeriksaan'}
          </span>
        </div>
        <div className="wz-tree">
          {wz.ms.map((m, i) => {
            const arr = (wz.tasks[m.id] ?? []).filter((t) => t.title.trim())
            return (
              <Fragment key={m.id}>
                <div className="lv1">
                  M{i + 1} · {m.title}
                  {m.target && <span className="sub"> · target {fmt(m.target)}</span>}
                </div>
                {arr.length ? (
                  arr.map((t) => (
                    <div className="lv2" key={t.id}>
                      {t.title.trim()} · {mname(t.pic) || 'PIC belum ditentukan'} · {range(t.start, t.end)}
                    </div>
                  ))
                ) : (
                  <div className="lv2">Belum ada task</div>
                )}
              </Fragment>
            )
          })}
        </div>
        <div className="sub">
          {wz.ms.length} milestone · {nT} task. Detail seperti syarat tercapai, rencana cadangan, dan bukti yang diminta bisa dilengkapi setelah
          project dibuat, dipandu checklist Langkah berikutnya.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Rancang project</h2>
      </div>
      <div className="wz-steps" ref={top}>
        {WZ_STEPS.map((x, i) => (
          <span key={x} className={i === step ? 'on' : i < step ? 'done' : ''}>
            {i + 1}. {WZ_NAMES[x]}
          </span>
        ))}
      </div>
      <div className="req-note">Semua isian wajib diisi.</div>
      {body}
      <div className="err">{err}</div>
      <div className="mfoot">
        <button className="btn ghost" onClick={close}>
          Batal
        </button>
        <div className="row">
          {step > 0 && (
            <button className="btn" onClick={() => go(step - 1)} disabled={busy}>
              Kembali
            </button>
          )}
          <button className="btn primary" onClick={next} disabled={busy}>
            {last ? 'Buat project' : 'Lanjut'}
          </button>
        </div>
      </div>
    </>
  )
}
