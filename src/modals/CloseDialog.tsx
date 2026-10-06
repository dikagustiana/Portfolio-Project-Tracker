// Close, stop or reopen a project (prototype openClose), with evidence or a reason and who
// actually decided. A closed or stopped project is read-only until reopened.
import { useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { setUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import type { Id, Project } from '../domain/index.ts'
import { DecisionSource } from './DecisionSource.tsx'
import { decSrcInput, newDecSrc, useBad, useSubmit } from './form.ts'
import { Gone } from './parts.tsx'

export type CloseMode = 'close' | 'stop' | 'reopen'

const TITLE: Record<CloseMode, string> = { close: 'Tutup project', stop: 'Hentikan project', reopen: 'Buka lagi project' }
const OK: Record<CloseMode, string> = { close: 'Project ditutup. Selamat!', stop: 'Project dihentikan.', reopen: 'Project dibuka lagi.' }

export function CloseDialog({ projectId, mode }: { projectId: Id; mode: CloseMode }) {
  const { d } = useBoard()
  const p = d.project(projectId)
  if (!p) return <Gone />
  return <CloseBody p={p} mode={mode} />
}

function CloseBody({ p, mode }: { p: Project; mode: CloseMode }) {
  const { d, today, actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const [note, setNote] = useState('')
  const [src, setSrc] = useState(() => newDecSrc(today))
  const n = d.pms(p.id).length
  const T = TITLE[mode]

  const save = () => {
    if (!note.trim()) return setErr(bad.mark(['cNote'], mode === 'close' ? 'Isi bukti hasil akhir dulu.' : 'Tulis alasannya dulu.'))
    const s = decSrcInput(src, today)
    const work =
      mode === 'close'
        ? () => actions.closeProject(p.id, note.trim(), s)
        : mode === 'stop'
          ? () => actions.stopProject(p.id, note.trim(), s)
          : () => actions.reopenProject(p.id, note.trim(), s)
    void run(work, { ok: OK[mode], after: () => setUI({ view: 'project', pid: p.id, tab: 'milestone' }) })
  }
  const field = (label: string, placeholder: string) => (
    <label className="f">
      {label}
      <textarea
        className={bad.cls('cNote')}
        id="cNote"
        placeholder={placeholder}
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          bad.ok('cNote')
          setErr('')
        }}
      />
    </label>
  )

  return (
    <>
      <h2>{T}</h2>
      <div className="prompt">
        <b>{p.name}</b>
        <br />
        <span className="sub">Hasil akhir: {p.outcome || 'belum ditetapkan'}</span>
        {p.measure && (
          <>
            <br />
            <span className="sub">Cara tahu sudah tercapai: {p.measure}</span>
          </>
        )}
      </div>
      {mode === 'close' ? (
        <>
          <div className="sub">
            {n} dari {n} milestone lulus. Lulusnya semua milestone belum tentu berarti hasil akhir tercapai. Tunjukkan buktinya terhadap ukuran di atas.
          </div>
          {field('Bukti hasil akhir tercapai', 'Link laporan, file rekonsiliasi, atau notulen rapat yang membuktikan ukuran hasil akhir terpenuhi')}
        </>
      ) : mode === 'stop' ? (
        <>
          <div className="sub">
            Project berhenti dikerjakan dan keluar dari dashboard aktif. Task dan riwayatnya tetap tersimpan, dan project bisa dibuka lagi.
          </div>
          {field('Alasan menghentikan', 'mis. milestone M2 dihentikan karena data per principal tidak tersedia, rencana cadangan tidak layak')}
        </>
      ) : (
        field('Alasan membuka lagi', 'Apa yang berubah')
      )}
      <DecisionSource px="c" value={src} onChange={setSrc} />
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className={`btn ${mode === 'stop' ? 'danger' : 'primary'}`} onClick={save} disabled={busy}>
            {T}
          </button>
        </div>
      </div>
    </>
  )
}
