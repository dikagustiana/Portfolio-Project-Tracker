// "Kirim pengingat" (prototype openRemind): queue a reminder e-mail to the task's PIC. Sending is
// phase 2; until an e-mail run has happened the reminder waits in the queue.
import { useMailActive } from '../app/hooks.ts'
import { useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import { fmtLong, range } from '../domain/index.ts'
import type { Id, Person, Task } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { firstName } from './logic.ts'
import { Gone } from './parts.tsx'

export function RemindDialog({ taskId }: { taskId: Id }) {
  const { d } = useBoard()
  const t = d.task(taskId)
  const m = d.person(t?.assignee)
  if (!t || !m) return <Gone />
  return <RemindBody t={t} m={m} />
}

function RemindBody({ t, m }: { t: Task; m: Person }) {
  const { actions } = useBoard()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const [msg, setMsg] = useState(
    () => `Halo ${firstName(m.name)}, mohon task "${t.title}" diselesaikan sebelum ${fmtLong(t.end)}. Kalau ada kendala, kabari saya.`,
  )
  const mail = useMailActive()
  const save = () => {
    const e = bad.need([['rmMsg', msg, 'Tulis pesannya.']])
    if (e) return setErr(e)
    void run(() => actions.createReminder(t.id, msg.trim()), {
      ok: mail ? 'Pengingat masuk antrean pengiriman' : 'Pengingat disimpan, terkirim begitu email aktif',
    })
  }
  return (
    <>
      <h2>Kirim pengingat</h2>
      <div className="req-note">Semua isian wajib diisi.</div>
      <div className="prompt">
        <span className="sub">Kepada:</span> <b>{m.name}</b>
        {m.email ? ` <${m.email}>` : ''}
        <br />
        <span className="sub">Task:</span> {t.title} · {range(t.start, t.end)}
      </div>
      <label className="f">
        Pesan
        <textarea
          className={bad.cls('rmMsg')}
          id="rmMsg"
          rows={4}
          value={msg}
          onChange={(e) => {
            setMsg(e.target.value)
            bad.ok('rmMsg')
          }}
        />
        <span className="hint">Detail task dan tombol ke SAMB Project Board otomatis ikut di email.</span>
      </label>
      {!mail && (
        <div className="warn">
          <div>Pengiriman email belum disambungkan. Pengingat disimpan di antrean dan otomatis terkirim begitu email aktif.</div>
        </div>
      )}
      <div className="err">{err}</div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            Kirim pengingat
          </button>
        </div>
      </div>
    </>
  )
}
