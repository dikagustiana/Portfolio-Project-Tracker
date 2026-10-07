// Terhambat (docs/ARCHITECTURE.md §K "blocker semantics"): the PIC says what blocks the work and
// what is needed from whom; whoever can unblock it resolves it; when it needs management judgment
// it is raised as a Keputusan that inherits the project, gate and task.
import { useState } from 'react'
import { Tip } from '../app/bits.tsx'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays } from '../domain/index.ts'
import type { Id } from '../domain/index.ts'
import { judgePeople, pick, projectPeople } from './logic.ts'
import { useBad, useSubmit } from './form.ts'
import { Gone, PersonOptions } from './parts.tsx'

export function BlockerDialog({ taskId }: { taskId: Id }) {
  const { d, board, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const [reason, setReason] = useState('')
  const [need, setNeed] = useState('')
  const [from, setFrom] = useState('')
  const [fn, setFn] = useState('')
  const [target, setTarget] = useState(() => addDays(today, 2))
  const t = d.task(taskId)
  if (!t) return <Gone />
  const people = projectPeople(board, t.projectId, ['project_admin', 'member', 'viewer']).filter((x) => x.id !== t.assignee)
  const save = () => {
    const e = bad.need([['bReason', reason, 'Tulis apa yang menghambat.']])
    if (e) return setErr(e)
    void run(() => actions.raiseBlocker(t.id, { reason: reason.trim(), need: need.trim(), fromPerson: from, fromFunction: fn, target }), {
      ok: from ? `Ditandai terhambat. ${d.mname(from)} akan melihatnya di Perlu tindakan.` : 'Ditandai terhambat. Project Admin akan melihatnya di Perlu tindakan.',
    })
  }
  return (
    <>
      <h2>
        Tandai terhambat
        <Tip k="terhambat" />
      </h2>
      <div className="prompt" style={{ margin: 0 }}>
        <b>{t.ref}</b> · {t.title}
      </div>
      <label className="f">
        Apa yang menghambat
        <textarea className={bad.cls('bReason')} id="bReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Ekstrak SAP Oktober belum tersedia" />
      </label>
      <label className="f">
        Apa yang dibutuhkan
        <input className="inp" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="mis. File ekstrak per principal sampai 13 Okt" />
      </label>
      <div className="fgrid">
        <label className="f">
          Dibutuhkan dari (orang)
          <select className="inp" value={from} onChange={(e) => setFrom(e.target.value)}>
            <PersonOptions people={people} empty="Project Admin" />
          </select>
        </label>
        <label className="f">
          Fungsi
          <select className="inp" value={fn} onChange={(e) => setFn(e.target.value)}>
            <option value="">Tidak spesifik</option>
            {board.functions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="f">
        Target terbuka
        <input className="inp" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn danger" disabled={busy} onClick={save}>
            Tandai terhambat
          </button>
        </div>
      </div>
    </>
  )
}

export function ResolveBlockerDialog({ blockerId }: { blockerId: Id }) {
  const { d, board, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, run } = useSubmit()
  const [note, setNote] = useState('')
  const b = board.blockers.find((x) => x.id === blockerId)
  const t = b ? d.task(b.taskId) : undefined
  if (!b || !t) return <Gone />
  return (
    <>
      <h2>Hambatan selesai</h2>
      <div className="prompt" style={{ margin: 0 }}>
        <b>{t.ref}</b> · {t.title}
        <br />
        <span className="sub">{b.reason}</span>
      </div>
      <label className="f">
        Bagaimana terbuka
        <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Ekstrak dikirim Accounting 12 Okt" />
      </label>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" disabled={busy} onClick={() => void run(() => actions.resolveBlocker(b.id, note.trim()), { ok: 'Hambatan ditandai selesai' })}>
            Tandai selesai
          </button>
        </div>
      </div>
    </>
  )
}

export function EscalateDialog({ blockerId }: { blockerId: Id }) {
  const { d, board, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const b = board.blockers.find((x) => x.id === blockerId)
  const t = b ? d.task(b.taskId) : undefined
  const pms = t ? judgePeople(board, t.projectId) : []
  const [q, setQ] = useState(() => (b ? b.reason : ''))
  const [decider, setDecider] = useState(() => pick(pms, t ? d.pmOf(d.project(t.projectId)) : ''))
  const [due, setDue] = useState(() => b?.target || addDays(today, 3))
  if (!b || !t) return <Gone />
  const p = d.project(t.projectId)
  const save = () => {
    if (!q.trim()) return setErr('Tulis apa yang harus diputuskan.')
    void run(() => actions.escalateBlocker(b.id, { question: q.trim(), decider_person_id: decider, due }), {
      ok: `Keputusan dicatat. ${d.mname(decider || d.pmOf(p)) || 'PM project'} akan melihatnya di Perlu tindakan.`,
    })
  }
  return (
    <>
      <h2>Angkat menjadi Keputusan</h2>
      <div className="prompt" style={{ margin: 0 }}>
        Hambatan pada <b>{t.ref}</b> · {t.title}
        <br />
        <span className="sub">Project, milestone, dan task ikut tercatat di Keputusan ini. Hambatannya tetap terbuka sampai ditandai selesai.</span>
      </div>
      <label className="f">
        Apa yang harus diputuskan
        <textarea className="inp" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="fgrid">
        <label className="f">
          Pemutus
          <select className="inp" value={decider} onChange={(e) => setDecider(e.target.value)}>
            <PersonOptions people={pms} empty={`PM (${d.mname(d.pmOf(p)) || 'project'})`} />
          </select>
        </label>
        <label className="f">
          Batas waktu
          <input className="inp" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" disabled={busy} onClick={save}>
            Catat Keputusan
          </button>
        </div>
      </div>
    </>
  )
}
