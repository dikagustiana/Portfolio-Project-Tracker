// Task detail (prototype openReview): accept / reject with a reason, withdraw a submission, reopen
// an accepted task, commit dates, and the way in to the edit form for planners. The PIC (or a PM
// for a PIC without a login) may move the dates while committing (commit_task_dates).
import { useState } from 'react'
import { Avatar, Linkified } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import { fmtTs, range, stageName } from '../domain/index.ts'
import type { Id, Project, Task } from '../domain/index.ts'
import { useBad, useSubmit } from './form.ts'
import { reopenNote, withNote } from './logic.ts'
import { Gone, TaskActions, WarnList } from './parts.tsx'

export function ReviewDialog({ id }: { id: Id }) {
  const { d } = useBoard()
  const t = d.task(id)
  const p = d.project(t?.projectId)
  if (!t || !p) return <Gone />
  return <ReviewBody t={t} p={p} />
}

function ReviewBody({ t, p }: { t: Task; p: Project }) {
  const { d, viewer, actions } = useBoard()
  const flows = useFlows()
  const { close } = useOverlay()
  const { busy, err, setErr, run } = useSubmit()
  const bad = useBad()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  /** Dates the viewer typed; unset fields follow the live task. */
  const [moved, setMoved] = useState<{ start?: string; end?: string }>({})

  const g = d.gated(p)
  const lk = d.locked(t)
  const done = d.isDone(t)
  const review = t.stage === 'review'
  const val = !lk && d.canValidate(t)
  const pic = !lk && d.canAct(t.assignee, t.projectId)
  const ms = d.mstone(t.milestoneId)
  const vid = d.validatorOf(t)
  const vname = d.mname(vid) || 'Project Manager'

  const start = moved.start ?? t.start
  const end = moved.end ?? t.end
  const datesMoved = start !== t.start || end !== t.end
  const mayCommit = g && !lk && !done && !review && !!t.assignee && d.canCommit(t)
  const showCommit = mayCommit && (!t.committed || datesMoved)
  /** Warnings the moved dates would add (holiday, weekend, after the gate's target, …). */
  const newWarnings = (() => {
    if (!datesMoved || !start || !end) return []
    const before = new Set(d.warnings(t, p))
    return d.warnings({ ...t, start, end }, p).filter((w) => !before.has(w))
  })()

  const commit = () => {
    const e = bad.need([
      ['rStart', start, 'Isi tanggal mulai dan selesai.'],
      ['rEnd', end, 'Isi tanggal mulai dan selesai.'],
    ])
    if (e) return setErr(e)
    if (end < start) return setErr(bad.mark(['rEnd'], 'Tanggal selesai tidak boleh sebelum tanggal mulai.'))
    void run(() => actions.commitTaskDates(t.id, start, end), { ok: `Tanggal dikomit: ${range(start, end)}` })
  }
  const reject = () => {
    if (!rejecting) {
      setRejecting(true)
      return
    }
    if (!reason.trim()) return setErr('Tulis alasan supaya PIC tahu apa yang harus diperbaiki.')
    void run(() => actions.reviewTask(t.id, 'reject', reason.trim()), { ok: 'Task dikembalikan ke PIC' })
  }

  const acts = (
    <>
      {g && review && val ? (
        <>
          <button className="btn danger" onClick={reject} disabled={busy}>
            {rejecting ? 'Kirim penolakan' : 'Tolak'}
          </button>
          <button className="btn ok" disabled={busy} onClick={() => void run(() => actions.reviewTask(t.id, 'accept'), { ok: 'Task diterima ✓' })}>
            Terima
          </button>
        </>
      ) : g && review && pic ? (
        <button className="btn" disabled={busy} onClick={() => void run(() => actions.withdrawSubmission(t.id), { ok: 'Pengajuan ditarik' })}>
          Tarik pengajuan
        </button>
      ) : g && done && val ? (
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            void run(() => actions.reopenTask(t.id), {
              ok: withNote('Task dibuka lagi', reopenNote(d, t, { milestoneId: t.milestoneId, stage: 'progress' })),
            })
          }
        >
          Buka lagi task
        </button>
      ) : null}
      {showCommit && (
        <button className="btn primary" onClick={commit} disabled={busy}>
          {viewer.personId === t.assignee ? 'Komit tanggal' : 'Komit atas nama PIC'}
        </button>
      )}
    </>
  )

  return (
    <>
      <h2>{t.title}</h2>
      <div className="row" style={{ gap: 6 }}>
        <span className={`chip s-${t.stage}`} style={{ color: 'var(--sc)' }}>
          {stageName(t.stage)}
        </span>
        {ms && (
          <span className="chip">
            {d.msNo(ms)} · {ms.title}
          </span>
        )}
        <span className="chip">{range(t.start, t.end)}</span>
      </div>
      <div className="fgrid">
        <div className="f">
          PIC
          <div className="row" style={{ gap: 8, color: 'var(--ink)' }}>
            <Avatar id={t.assignee} />
            {d.mname(t.assignee) || 'Belum ditugaskan'}
          </div>
        </div>
        {g && (
          <div className="f">
            Pemeriksa
            <div className="row" style={{ gap: 8, color: 'var(--ink)' }}>
              <Avatar id={vid} />
              {vname}
            </div>
          </div>
        )}
      </div>
      {g && !done && (
        <div className="sub">
          {d.workdays(t.start, t.end)} hari kerja · Tanggal: <b style={{ color: 'var(--ink)' }}>{t.committed ? 'Dikomit' : 'Belum dikomit'}</b>
          {t.committed && t.committedAt ? ` oleh ${d.mname(t.committedBy)} · ${fmtTs(t.committedAt)}` : ''}
          {!t.committed && !mayCommit && t.assignee ? ` · menunggu dikomit ${d.mname(t.assignee)}` : ''}
        </div>
      )}
      {mayCommit && (
        <>
          <div className="fgrid">
            <label className="f">
              Mulai
              <input
                className={bad.cls('rStart')}
                type="date"
                id="rStart"
                value={start}
                onChange={(e) => {
                  setMoved((x) => ({ ...x, start: e.target.value }))
                  bad.ok('rStart')
                  setErr('')
                }}
              />
            </label>
            <label className="f">
              Selesai
              <input
                className={bad.cls('rEnd')}
                type="date"
                id="rEnd"
                value={end}
                onChange={(e) => {
                  setMoved((x) => ({ ...x, end: e.target.value }))
                  bad.ok('rEnd')
                  setErr('')
                }}
              />
            </label>
          </div>
          {datesMoved && start && end && end >= start && (
            <div className="sub" style={{ marginTop: -6 }}>
              {d.workdays(start, end)} hari kerja dari {d.durDays({ ...t, start, end })} hari kalender
            </div>
          )}
          {newWarnings.length > 0 && <WarnList list={newWarnings} />}
        </>
      )}
      {t.desc && (
        <div className="f">
          Catatan
          <div className="evidence">
            <Linkified text={t.desc} />
          </div>
        </div>
      )}
      {g && (
        <div className="f">
          Bukti yang diminta
          <div className="evidence">{t.proof ? t.proof : <span className="sub">Tidak ditentukan</span>}</div>
        </div>
      )}
      {t.evidence && (
        <div className="f">
          Bukti yang diajukan
          {t.submittedAt ? <span className="hint"> · {fmtTs(t.submittedAt)}</span> : null}
          <div className="evidence">
            <Linkified text={t.evidence} />
          </div>
        </div>
      )}
      {done && t.acceptedAt && (
        <div className="sub">
          Diterima {d.mname(t.acceptedBy)} · {fmtTs(t.acceptedAt)}
        </div>
      )}
      {g && d.selfAccept(t) && !done && (
        <div className="warn">
          <div>
            Penerima task ini jatuh ke {d.mname(t.assignee)}, yang juga PIC-nya, jadi tidak ada yang bisa menerimanya.{' '}
            {review ? 'Tarik pengajuan, lalu e' : 'E'}dit task dan pilih pemeriksa lain.
          </div>
        </div>
      )}
      {g && review && !val && !pic && <div className="sub">Menunggu keputusan {vname}.</div>}
      <TaskActions t={t} />
      {rejecting && (
        <label className="f">
          Alasan penolakan
          <textarea
            className="inp"
            id="rReason"
            autoFocus
            placeholder="Apa yang kurang dan apa yang harus diperbaiki"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setErr('')
            }}
          />
        </label>
      )}
      <div className="err">{err}</div>
      <div className="mfoot">
        <div>
          {d.canPlan(p) && !lk && (!g || !(review || done)) && (
            <button className="btn ghost" onClick={() => flows.openTask(t.id)}>
              Edit task
            </button>
          )}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={close}>
            Tutup
          </button>
          {acts}
        </div>
      </div>
    </>
  )
}
