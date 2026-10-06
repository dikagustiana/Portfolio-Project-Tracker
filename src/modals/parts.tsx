// Pieces shared by several dialogs: the warning list (prototype renderWarn), people options
// (pmOpts/memberOpts), calendar links (calLinksHtml), the calendar + reminder block under a task
// (taskActionsHtml), and the fallback when the record a dialog shows has disappeared.
import { useState } from 'react'
import { Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { messageOf } from '../data/actions.ts'
import { useBoard } from '../data/board-context.ts'
import { CAL_PROV } from '../domain/index.ts'
import type { CalProvider, Person, Task } from '../domain/index.ts'
import { CAL_ADDED, calStateText, firstName } from './logic.ts'

/** The record behind this dialog was deleted elsewhere, or access to it was removed. */
export function Gone() {
  const { close } = useOverlay()
  return (
    <>
      <h2>Tidak ditemukan</h2>
      <div className="sub">Data ini sudah dihapus, atau kamu tidak punya akses lagi.</div>
      <div className="mfoot">
        <span />
        <button className="btn primary" onClick={close}>
          Tutup
        </button>
      </div>
    </>
  )
}

/** First two warnings, the rest behind "Lihat n peringatan lain" (prototype renderWarn). */
export function WarnList({ list }: { list: readonly string[] }) {
  const [open, setOpen] = useState(false)
  const top = list.slice(0, 2)
  const rest = list.slice(2)
  return (
    <div className="warn">
      {top.map((x, i) => (
        <div key={i}>{x}</div>
      ))}
      {rest.length > 0 &&
        (open ? (
          <>
            {rest.map((x, i) => (
              <div key={i}>{x}</div>
            ))}
            <button type="button" className="linkbtn" onClick={() => setOpen(false)}>
              Sembunyikan
            </button>
          </>
        ) : (
          <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
            Lihat {rest.length} peringatan lain
          </button>
        ))}
    </div>
  )
}

/** Options of a people picker, starting with the empty choice. */
export function PersonOptions({ people, empty }: { people: readonly Person[]; empty: string }) {
  return (
    <>
      <option value="">{empty}</option>
      {people.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </>
  )
}

/** Google / Outlook links; a click records the event in the viewer's private calendar list. */
export function CalLinks({ t, onAdded }: { t: Task; onAdded?: () => void }) {
  const { d, actions, refresh } = useBoard()
  const { toast } = useOverlay()
  const record = (prov: CalProvider) => {
    onAdded?.()
    void actions
      .calRecord(t.id, t.end, t.title.slice(0, 200), prov)
      .then(refresh)
      .catch((e: unknown) => toast(messageOf(e)))
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="sub" style={{ marginRight: 2 }}>
        <Icon name="cal" /> Tambah deadline ke kalender:
      </span>
      {CAL_PROV.map(([k, l]) => (
        <a key={k} className="btn sm" href={d.calUrl(t, k)} target="_blank" rel="noopener noreferrer" onClick={() => record(k)}>
          {l}
        </a>
      ))}
    </div>
  )
}

/** Calendar status and the calendar's state line, as one block (calendar dialog). */
export function CalBlock({ t }: { t: Task }) {
  const { extras } = useBoard()
  const [added, setAdded] = useState(false)
  return (
    <>
      <CalLinks t={t} onAdded={() => setAdded(true)} />
      <div className="sub">{added ? CAL_ADDED : calStateText(extras.calendar.find((c) => c.taskId === t.id), t)}</div>
    </>
  )
}

/** Bottom of a task dialog: calendar links and reminder status (prototype taskActionsHtml). */
export function TaskActions({ t }: { t: Task }) {
  const { d, extras } = useBoard()
  const flows = useFlows()
  const p = d.project(t.projectId)
  if (d.isDone(t) || !d.pActive(p)) return null
  const last = d.remFor(t.id)[0]
  const pend = d.remPending(t.id)
  const m = d.person(t.assignee)
  const canRem = d.canPlan(p) && !d.locked(t)
  const mail = extras.emailLog.length > 0
  return (
    <div className="tact">
      <CalBlock t={t} />
      {canRem ? (
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="sub">{last ? d.remStatusText(last, mail) : 'Belum ada pengingat untuk task ini.'}</span>
          {pend ? null : m?.email ? (
            <button type="button" className="btn sm" onClick={() => flows.openRemind(t.id)}>
              Kirim pengingat ke {firstName(m.name)}
            </button>
          ) : (
            <span className="sub">{m ? `${m.name} belum punya email` : 'Belum ada PIC'}</span>
          )}
        </div>
      ) : last ? (
        <div className="sub">{d.remStatusText(last, mail)}</div>
      ) : null}
    </div>
  )
}
