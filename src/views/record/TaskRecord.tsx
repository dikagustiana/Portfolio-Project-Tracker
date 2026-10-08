// The task record (docs/ARCHITECTURE.md §G "one record, one address"): detail, the PIC's actions
// (commit, start, submit, withdraw, Terhambat), the pemeriksa's actions (accept, reject, reopen),
// structure (package, sub-tasks, prerequisites, Keputusan) and history (review rounds,
// commitments, comments, events). The same component renders in the side peek and on the full
// page; role decides which actions show, the database decides what is allowed.
import { useState } from 'react'
import { Avatar, Icon, Linkified } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { openProject, peek } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import { dn, fmt, fmtTs, range, stageName } from '../../domain/index.ts'
import type { Project, Task } from '../../domain/index.ts'
import { reopenNote, withNote } from '../../modals/logic.ts'
import { WarnList } from '../../modals/parts.tsx'
import { useAct } from './act.ts'
import { Comments, CopyLink, Crumbs, RecordLine, RefTag, Section, Tag, TaskLine, Timeline } from './parts.tsx'
import { taskStatus } from './status.ts'

export function TaskRecord({ t, zoom }: { t: Task; zoom: 'peek' | 'full' }) {
  const { d } = useBoard()
  const p = d.project(t.projectId)
  if (!p) return null
  return <TaskBody t={t} p={p} zoom={zoom} />
}

function TaskBody({ t, p, zoom }: { t: Task; p: Project; zoom: 'peek' | 'full' }) {
  const { d, viewer, actions } = useBoard()
  const flows = useFlows()
  const { busy, err, setErr, run } = useAct()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [moved, setMoved] = useState<{ start?: string; end?: string }>({})

  const g = d.gated(p)
  const lk = d.locked(t)
  const done = d.isDone(t)
  const review = t.stage === 'review'
  const val = !lk && d.canValidate(t)
  const pic = !lk && d.canAct(t.assignee, t.projectId)
  const ms = d.mstone(t.milestoneId)
  const parent = t.parentId ? d.task(t.parentId) : undefined
  const kids = d.children(t.id)
  const openKids = kids.filter((k) => !d.isDone(k))
  const vid = d.validatorOf(t)
  const blocker = d.blocker(t)
  const st = taskStatus(d, t)
  const slip = d.slip(t)
  const waitStart = d.waitingToStart(t)
  const waitAccept = d.waitingToAccept(t)
  const dependents = d.board.tasks.filter((x) => x.deps.includes(t.id) || x.acceptDeps.includes(t.id))
  const asks = d.board.asks.filter((a) => a.taskIds.includes(t.id) || a.id === blocker?.askId)
  const rounds = d.reviewsOf(t.id)
  const commits = d.commitmentsOf(t.id)
  const flags = d.taskFlags(t, p)

  const start = moved.start ?? t.start
  const end = moved.end ?? t.end
  const datesMoved = start !== t.start || end !== t.end
  const mayCommit = g && !lk && !done && !review && !!t.assignee && d.canCommit(t)
  const showCommit = mayCommit && (!t.committed || datesMoved)
  const newWarnings = (() => {
    if (!datesMoved || !start || !end) return []
    const before = new Set(d.warnings(t, p))
    return d.warnings({ ...t, start, end }, p).filter((w) => !before.has(w))
  })()

  const commit = () => {
    if (!start || !end) return setErr('Isi tanggal mulai dan selesai.')
    if (end < start) return setErr('Tanggal selesai tidak boleh sebelum tanggal mulai.')
    void run(() => actions.commitTaskDates(t.id, start, end), `Tanggal dikomit: ${range(start, end)}`).then((ok) => ok && setMoved({}))
  }
  const reject = () => {
    if (!rejecting) return setRejecting(true)
    if (!reason.trim()) return setErr('Tulis alasan supaya PIC tahu apa yang harus diperbaiki.')
    void run(() => actions.reviewTask(t.id, 'reject', reason.trim()), 'Task dikembalikan ke PIC').then((ok) => {
      if (ok) {
        setRejecting(false)
        setReason('')
      }
    })
  }
  const go = (id: string) => peek(d, { kind: 'task', id })

  const crumbs = [
    { label: p.name, onClick: () => openProject(d, p.id) },
    ...(ms ? [{ label: `${d.msNo(ms)} · ${ms.title}`, onClick: () => peek(d, { kind: 'gate', id: ms.id }) }] : []),
    ...(parent ? [{ label: parent.ref, onClick: () => go(parent.id) }] : []),
    { label: t.ref },
  ]
  const H = zoom === 'full' ? 'h1' : 'h2'

  return (
    <article>
      <Crumbs items={crumbs} />
      <div className="rec-h">
        <H>{t.title}</H>
        <div className="row" style={{ gap: 4 }}>
          <CopyLink target={{ kind: 'task', id: t.id }} />
        </div>
      </div>
      <div className="rec-chips">
        <RefTag r={t.ref} />
        <Tag tone={st.tone} box>
          {st.text}
        </Tag>
        {g && stageName(t.stage) !== st.text && (
          <span className={`chip s-${t.stage}`} style={{ color: 'var(--sc)' }}>
            {stageName(t.stage)}
          </span>
        )}
        {kids.length > 0 && (
          <Tag tone="indigo" box>
            Paket · {d.taskProg(t).d}/{d.taskProg(t).n} sub-task diterima
          </Tag>
        )}
        {d.isDraft(t) && !done && (
          <Tag tone="amber" box>
            Draf: {!t.assignee ? 'belum ada PIC' : 'bukti yang diminta kosong'}
          </Tag>
        )}
      </div>

      {!lk && (
        <div className="rec-acts">
          {g && review && val && (
            <>
              <button className="btn ok" disabled={busy || waitAccept.length > 0} title={waitAccept.length ? `Menunggu ${waitAccept.map((x) => x.ref).join(', ')}` : ''} onClick={() => void run(() => actions.reviewTask(t.id, 'accept'), 'Task diterima ✓')}>
                Terima
              </button>
              <button className="btn danger" disabled={busy} onClick={reject}>
                {rejecting ? 'Kirim penolakan' : 'Tolak'}
              </button>
            </>
          )}
          {g && review && pic && !val && (
            <button className="btn" disabled={busy} onClick={() => void run(() => actions.withdrawSubmission(t.id), 'Pengajuan ditarik')}>
              Tarik pengajuan
            </button>
          )}
          {g && done && val && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void run(() => actions.reopenTask(t.id), withNote('Task dibuka lagi', reopenNote(d, t, { milestoneId: t.milestoneId, stage: 'progress' })))}
            >
              Buka lagi task
            </button>
          )}
          {g && !done && !review && pic && (
            <>
              {/* A package's work happens in its sub-tasks; it is only submitted once they are accepted. */}
              {kids.length > 0 ? null : t.stage === 'todo' ? (
                <button className="btn" disabled={busy || waitStart.length > 0} title={waitStart.length ? `Menunggu ${waitStart.map((x) => x.ref).join(', ')}` : ''} onClick={() => void run(() => actions.setTaskStage(t.id, 'progress'), 'Mulai dikerjakan')}>
                  Mulai kerjakan
                </button>
              ) : (
                <button className="btn ghost" disabled={busy} onClick={() => void run(() => actions.setTaskStage(t.id, 'todo'))}>
                  Kembalikan ke belum mulai
                </button>
              )}
              <button
                className={`btn${openKids.length ? '' : ' primary'}`}
                disabled={busy || openKids.length > 0}
                title={openKids.length ? `Menunggu sub-task diterima: ${openKids.map((x) => x.ref).join(', ')}` : ''}
                onClick={() => flows.submitFlow(t.id)}
              >
                {kids.length ? 'Ajukan paket' : 'Ajukan selesai'}
              </button>
            </>
          )}
          {!g && (pic || d.isAdminIn(t.projectId)) && !(openKids.length > 0 && !done) && (
            <button className="btn primary" disabled={busy} onClick={() => flows.onCheck(t.id)}>
              {done ? 'Buka lagi' : 'Tandai selesai'}
            </button>
          )}
          {showCommit && (
            <button className="btn primary" onClick={commit} disabled={busy}>
              {viewer.personId === t.assignee ? 'Komit tanggal' : 'Komit atas nama PIC'}
            </button>
          )}
          {!done && !blocker && d.canBlock(t) && (
            <button className="btn ghost" onClick={() => flows.raiseBlocker(t.id)}>
              Tandai terhambat
            </button>
          )}
          {d.canPlanTask(t) && (!g || !(review || done)) && (
            <button className="btn ghost" onClick={() => flows.editTask(t.id)}>
              Edit
            </button>
          )}
          {d.canAddChild(t) && !(g && (review || done)) && (
            <button className="btn ghost" onClick={() => flows.openTask(null, { projectId: p.id, milestoneId: t.milestoneId, parentId: t.id })}>
              <Icon name="plus" /> Sub-task
            </button>
          )}
          {!done && (
            <button className="btn ghost" onClick={() => flows.openCal(t.id)}>
              <Icon name="cal" /> Kalender
            </button>
          )}
          {!done && d.canPlan(p) && t.assignee && (
            <button className="btn ghost" onClick={() => flows.openRemind(t.id)}>
              <Icon name="bell" /> Pengingat
            </button>
          )}
        </div>
      )}
      {lk && <div className="sub" style={{ marginTop: 10 }}>Project ini sudah ditutup atau dihentikan. Data hanya bisa dibaca.</div>}

      {rejecting && (
        <label className="f" style={{ marginTop: 8 }}>
          Alasan penolakan
          <textarea
            className="inp"
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
      {mayCommit && (
        <div className="fgrid" style={{ marginTop: 8 }}>
          <label className="f">
            Mulai
            <input className="inp" type="date" value={start} onChange={(e) => setMoved((x) => ({ ...x, start: e.target.value }))} />
          </label>
          <label className="f">
            Selesai
            <input className="inp" type="date" value={end} onChange={(e) => setMoved((x) => ({ ...x, end: e.target.value }))} />
          </label>
        </div>
      )}
      {newWarnings.length > 0 && <WarnList list={newWarnings} />}
      <div className="err">{err}</div>

      <div className="rec-body">
        {blocker && (
          <div className="box badbox" style={{ whiteSpace: 'normal' }}>
            <b>Terhambat</b> sejak {fmtTs(blocker.raisedAt)} · dicatat {d.mname(blocker.raisedBy) || '—'}
            <div style={{ marginTop: 6 }}>{blocker.reason}</div>
            {blocker.need && <div className="sub" style={{ color: 'var(--ink)' }}>Dibutuhkan: {blocker.need}</div>}
            <div className="sub" style={{ color: 'var(--ink)' }}>
              {blocker.neededFromPerson ? `Dari ${d.mname(blocker.neededFromPerson)}` : blocker.neededFromFunction ? `Dari fungsi ${d.fn(blocker.neededFromFunction)?.name ?? ''}` : 'Dari Project Admin'}
              {blocker.target ? ` · target ${fmt(blocker.target)}` : ''}
              {blocker.askId && d.ask(blocker.askId) ? ` · diangkat menjadi ${d.ask(blocker.askId)?.ref}` : ''}
            </div>
            {!lk && d.canResolveBlocker(blocker, t) && (
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <button className="btn sm" onClick={() => flows.resolveBlocker(blocker.id)}>
                  Hambatan selesai
                </button>
                {!blocker.askId && d.canBlock(t) && (
                  <button className="btn sm ghost" onClick={() => flows.escalateBlocker(blocker.id)}>
                    Angkat menjadi Keputusan
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* The blocker box above already says what blocks the task. */}
        {flags.length > 0 && !done && <WarnList list={flags.filter(([l, x]) => l < 2 && !(blocker && x.startsWith('Terhambat'))).map(([, x]) => x)} />}

        <dl className="kv">
          <dt>PIC</dt>
          <dd className="row" style={{ gap: 8 }}>
            <Avatar id={t.assignee} size={22} />
            {d.mname(t.assignee) || 'Belum ditugaskan'}
          </dd>
          {g && (
            <>
              <dt>Pemeriksa</dt>
              <dd className="row" style={{ gap: 8 }}>
                <Avatar id={vid} size={22} />
                {d.mname(vid) || 'Project Admin'}
                {!t.validator && vid && <span className="sub">(otomatis{parent ? ' dari paket' : ''})</span>}
              </dd>
            </>
          )}
          {t.ownerFunctionId && (
            <>
              <dt>Fungsi pemilik</dt>
              <dd>{d.fn(t.ownerFunctionId)?.name ?? '—'}</dd>
            </>
          )}
          <dt>Jadwal</dt>
          <dd>
            {range(t.start, t.end)} · {d.workdays(t.start, t.end)} hari kerja
          </dd>
          {g && !done && kids.length === 0 && (
            <>
              <dt>Komitmen</dt>
              <dd>
                {t.committed ? `Dikomit ${d.mname(t.committedBy)}${t.committedAt ? ` · ${fmtTs(t.committedAt)}` : ''}` : 'Belum dikomit'}
                {slip && slip.days !== 0 && (
                  <div className="sub" style={{ color: slip.days > 0 ? 'var(--bad-ink)' : 'var(--muted)' }}>
                    Komitmen awal {fmt(slip.baseline.end)}, komitmen terakhir {fmt(slip.latest.end)} ({slip.days > 0 ? '+' : ''}
                    {slip.days} hari)
                  </div>
                )}
              </dd>
            </>
          )}
          {d.vcOf(t).length > 0 && (
            <>
              <dt>Value chain</dt>
              <dd>
                {d
                  .vcOf(t)
                  .map((c) => d.vcSteps(p)?.all.find((s) => s.code === c))
                  .filter((s) => !!s)
                  .map((s) => d.vcLabel(s))
                  .join(', ')}
                {!t.steps.length && parent ? ' (dari paket)' : ''}
              </dd>
            </>
          )}
        </dl>

        {g && (
          <div>
            <div className="h3">Bukti yang diminta</div>
            <div className="box">{t.proof ? <Linkified text={t.proof} /> : <span className="sub">Belum ditentukan</span>}</div>
          </div>
        )}

        {(kids.length > 0 || d.canAddChild(t)) && !t.parentId && (
          <Section title="Sub-task" n={kids.length} more={d.canAddChild(t) && !lk && !(g && (review || done)) ? '+ Tambah sub-task' : undefined} onMore={() => flows.openTask(null, { projectId: p.id, milestoneId: t.milestoneId, parentId: t.id })}>
            {kids.length ? (
              <div className="rows">
                {kids.map((c) => (
                  <TaskLine key={c.id} t={c} showProject={false} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Pecah paket ini menjadi inchstone yang bisa diterima satu per satu.</div>
            )}
          </Section>
        )}

        {(t.deps.length > 0 || t.acceptDeps.length > 0 || dependents.length > 0) && (
          <Section title="Ketergantungan">
            {t.deps.length > 0 && <div className="h3">Mulai setelah</div>}
            <div className="rows">
              {t.deps.map((id) => d.task(id)).filter((x) => !!x).map((x) => <TaskLine key={x.id} t={x} showProject={false} />)}
            </div>
            {t.acceptDeps.length > 0 && <div className="h3" style={{ marginTop: 10 }}>Diterima setelah</div>}
            <div className="rows">
              {t.acceptDeps.map((id) => d.task(id)).filter((x) => !!x).map((x) => <TaskLine key={x.id} t={x} showProject={false} />)}
            </div>
            {dependents.length > 0 && <div className="h3" style={{ marginTop: 10 }}>Ditunggu oleh</div>}
            <div className="rows">
              {dependents.map((x) => (
                <TaskLine key={x.id} t={x} showProject={false} />
              ))}
            </div>
          </Section>
        )}

        {asks.length > 0 && (
          <Section title="Keputusan terkait" n={asks.length}>
            <div className="rows">
              {asks.map((a) => (
                <RecordLine
                  key={a.id}
                  target={{ kind: 'ask', id: a.id }}
                  r={a.ref}
                  title={a.question}
                  sub={a.status === 'decided' ? `Diputuskan: ${a.answer ?? ''}` : `Pemutus ${d.mname(d.deciderOf(a)) || 'PM'}${a.due ? ` · batas ${fmt(a.due)}` : ''}`}
                  tone={a.status === 'decided' ? 'green' : a.due && a.due < d.today ? 'red' : 'amber'}
                  label={a.status === 'decided' ? 'Diputuskan' : 'Terbuka'}
                />
              ))}
            </div>
          </Section>
        )}

        {rounds.length > 0 && (
          <Section title="Riwayat pemeriksaan" n={rounds.length}>
            <div className="tl">
              {[...rounds].reverse().map((r) => (
                <div key={r.id} className={`ev tone-${r.verdict === 'accepted' ? 'green' : r.verdict === 'rejected' ? 'red' : r.verdict === 'withdrawn' ? 'grey' : 'violet'}`}>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <b>Putaran {r.round}</b> · diajukan {d.mname(r.submittedBy) || '—'} · {fmtTs(r.submittedAt)}
                    </div>
                    <div className="note">
                      Bukti: <Linkified text={r.evidence} />
                    </div>
                    <div className="when">
                      {r.verdict === 'accepted'
                        ? `Diterima ${d.mname(r.reviewer)}${r.reviewedAt ? ` · ${fmtTs(r.reviewedAt)}` : ''}`
                        : r.verdict === 'rejected'
                          ? `Ditolak ${d.mname(r.reviewer)}${r.reviewedAt ? ` · ${fmtTs(r.reviewedAt)}` : ''}: ${r.feedback ?? ''}`
                          : r.verdict === 'withdrawn'
                            ? 'Ditarik PIC'
                            : `Menunggu ${d.mname(vid) || 'pemeriksa'}`}
                      {r.reopenedAt ? ` · dibuka lagi ${d.mname(r.reopenedBy)} · ${fmtTs(r.reopenedAt)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {commits.length > 1 && (
          <Section title="Riwayat komitmen" n={commits.length}>
            <div className="tl">
              {[...commits].reverse().map((c, i) => (
                <div key={c.id} className={`ev tone-${i === commits.length - 1 ? 'indigo' : 'grey'}`}>
                  <div>
                    {range(c.start, c.end)} · {d.mname(c.by) || '—'}
                    {i === commits.length - 1 ? ' · komitmen awal' : ` · ${dn(c.end) - dn(commits[0]?.end ?? c.end) > 0 ? '+' : ''}${dn(c.end) - dn(commits[0]?.end ?? c.end)} hari dari awal`}
                    <div className="when">{fmtTs(c.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {t.desc && (
          <Section title="Catatan">
            <div className="box" style={{ maxHeight: zoom === 'peek' ? 260 : undefined, overflow: 'auto' }}>
              <Linkified text={t.desc} />
            </div>
          </Section>
        )}

        <Section title="Komentar" n={d.commentsOf(t.id).length}>
          <Comments kind="task" id={t.id} projectId={t.projectId} />
        </Section>

        <Section title="Riwayat">
          <Timeline events={d.recordEvents(t.id)} limit={8} withObject={false} />
        </Section>
      </div>
    </article>
  )
}
