// "Ajukan selesai" (prototype submitFlow): the PIC submits a task with evidence for review.
import { useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import type { Id, Task } from '../domain/index.ts'
import { useSubmit } from './form.ts'
import { Gone } from './parts.tsx'

export function SubmitDialog({ id }: { id: Id }) {
  const { d } = useBoard()
  const t = d.task(id)
  if (!t) return <Gone />
  return <SubmitBody t={t} />
}

function SubmitBody({ t }: { t: Task }) {
  const { d, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const [ev, setEv] = useState(t.evidence ?? '')
  const blocked = t.deps.map((x) => d.task(x)).filter((x): x is Task => !!x && !d.isDone(x))
  const who = d.mname(d.validatorOf(t)) || 'Project Manager'
  const save = () => {
    if (!ev.trim()) return setErr('Isi bukti dulu. Pemeriksa butuh sesuatu untuk dicek.')
    void run(() => actions.submitTask(t.id, ev.trim()), { ok: `Diajukan. Menunggu diperiksa ${who}.` })
  }
  return (
    <>
      <h2>Ajukan selesai</h2>
      <div className="prompt">
        <b>{t.title}</b>
        <br />
        <span className="sub">Pemeriksa: {who}</span>
      </div>
      {blocked.length > 0 && (
        <div className="warn">
          <div>Task ini masih menunggu: {blocked.map((x) => x.title).join(', ')}. Pastikan memang sudah bisa diajukan.</div>
        </div>
      )}
      <div className="f">
        Bukti yang diminta
        <div className="evidence">{t.proof ? t.proof : <span className="sub">Tidak ditentukan. Jelaskan hasil kerjamu sejelas mungkin.</span>}</div>
      </div>
      <label className="f">
        Bukti yang diajukan
        <span className="hint">Tempel link dokumen, foto, atau tulis ringkasan hasil yang bisa dicek.</span>
        <textarea
          className="inp"
          id="sEv"
          placeholder="https://drive.google.com/... atau catatan hasil"
          value={ev}
          onChange={(e) => {
            setEv(e.target.value)
            setErr('')
          }}
        />
      </label>
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            Ajukan ke pemeriksa
          </button>
        </div>
      </div>
    </>
  )
}
