// Gate decision (prototype openGate): lulus (only when every task is accepted), ubah rencana, or
// hentikan, with a mandatory note and who actually decided.
import { useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import type { GateDecision, Id, Milestone } from '../domain/index.ts'
import { DecisionSource } from './DecisionSource.tsx'
import { decSrcInput, newDecSrc, useBad, useSubmit } from './form.ts'
import { Gone } from './parts.tsx'

const OK: Record<GateDecision, string> = {
  lulus: 'Milestone lulus. Lanjut ke milestone berikutnya.',
  stop: 'Milestone dihentikan. Jalankan rencana cadangan.',
  rescope: 'Perubahan rencana dicatat. Sesuaikan task atau jadwalnya.',
}

export function GateDialog({ id }: { id: Id }) {
  const { d } = useBoard()
  const m = d.mstone(id)
  if (!m) return <Gone />
  return <GateBody m={m} />
}

function GateBody({ m }: { m: Milestone }) {
  const { d, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const ts = d.mtasks(m.id)
  const n = ts.filter((t) => d.isDone(t)).length
  const all = ts.length > 0 && n === ts.length
  const [dec, setDec] = useState<GateDecision | ''>(all ? 'lulus' : 'rescope')
  const [note, setNote] = useState('')
  const [src, setSrc] = useState(() => newDecSrc(today))

  const save = () => {
    if (!dec) return setErr('Pilih keputusan dulu.')
    if (!note.trim()) return setErr(bad.mark(['gNote'], 'Tulis catatan keputusannya.'))
    void run(() => actions.decideGate(m.id, dec, note.trim(), decSrcInput(src, today)), { ok: OK[dec] })
  }
  const radio = (v: GateDecision, label: string, disabled = false) => (
    <label>
      <input type="radio" name="gd" value={v} checked={dec === v} disabled={disabled} onChange={() => setDec(v)} /> {label}
    </label>
  )
  return (
    <>
      <h2>Putuskan milestone {d.msNo(m)}</h2>
      <div className="sub">{d.project(m.projectId)?.name ?? ''}</div>
      <div className="prompt">
        <b>{m.title}</b>
        <br />
        <span className="sub">
          {n}/{ts.length} task diterima
        </span>
      </div>
      <div className="gate" style={{ margin: 0 }}>
        <div>
          <small>Syarat tercapai</small>
          {m.criteria || '—'}
        </div>
        <div>
          <small>Tanda bahaya</small>
          {m.trigger || '—'}
        </div>
        <div>
          <small>Rencana cadangan</small>
          {m.fallback || '—'}
        </div>
      </div>
      <div className="f">
        Keputusan
        <div className="radios">
          {radio('lulus', 'Lulus', !all)}
          {radio('rescope', 'Ubah rencana')}
          {radio('stop', 'Hentikan')}
        </div>
        {!all && <span className="hint">Lulus baru bisa dipilih setelah semua task di milestone ini diterima.</span>}
      </div>
      <label className="f">
        Catatan
        <textarea
          className={bad.cls('gNote')}
          id="gNote"
          placeholder="Alasan keputusan, apa yang berubah, langkah berikutnya"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            bad.ok('gNote')
            setErr('')
          }}
        />
      </label>
      <DecisionSource px="g" value={src} onChange={setSrc} />
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            Simpan keputusan
          </button>
        </div>
      </div>
    </>
  )
}
