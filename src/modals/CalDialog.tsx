// "Tambah ke kalender" (prototype openCal): Google / Outlook links for the task's deadline.
// Clicking one records it in the viewer's private calendar list (user_calendar).
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import { fmtLong } from '../domain/index.ts'
import type { Id } from '../domain/index.ts'
import { CalBlock, Gone } from './parts.tsx'

export function CalDialog({ taskId }: { taskId: Id }) {
  const { d } = useBoard()
  const { close } = useOverlay()
  const t = d.task(taskId)
  if (!t) return <Gone />
  return (
    <>
      <h2>Tambah ke kalender</h2>
      <div className="prompt">
        <span className="sub">Task:</span> <b>{t.title}</b>
        <br />
        <span className="sub">Deadline:</span> {fmtLong(t.end)}
      </div>
      <div className="tact" style={{ border: 0, padding: 0 }}>
        <CalBlock t={t} />
      </div>
      <div className="mfoot">
        <span />
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Tutup
          </button>
        </div>
      </div>
    </>
  )
}
