// The Keputusan record: the open decision object (question, context, options, recommendation,
// decider, due, related tasks) and, separately, its immutable decision log. Anyone working on the
// project may raise one; only its decider (or a project admin for a decider without a login)
// decides it.
import { useState } from 'react'
import { Linkified } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { openProject, peek } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import { bareTitle, fmt, fmtTs } from '../../domain/index.ts'
import type { Ask } from '../../domain/index.ts'
import { DecisionSource } from '../../modals/DecisionSource.tsx'
import { decSrcInput, newDecSrc } from '../../modals/form.ts'
import { useAct } from './act.ts'
import { Comments, CopyLink, Crumbs, RefTag, Section, Tag, TaskLine, Timeline } from './parts.tsx'

export function AskRecord({ a, zoom }: { a: Ask; zoom: 'peek' | 'full' }) {
  const { d, today, actions } = useBoard()
  const flows = useFlows()
  const { busy, err, setErr, run } = useAct()
  const [ans, setAns] = useState('')
  const [why, setWhy] = useState('')
  const [src, setSrc] = useState(() => newDecSrc(today))
  const [reopening, setReopening] = useState(false)
  const [reopenWhy, setReopenWhy] = useState('')
  const p = d.project(a.projectId)
  if (!p) return null
  const ms = d.mstone(a.milestoneId)
  const lk = d.locked(p)
  const open = a.status !== 'decided'
  const late = open && !!a.due && a.due < today
  const decider = d.deciderOf(a)
  const may = !lk && d.canDecideAsk(a)
  const tasks = [
    ...a.taskIds.map((id) => d.task(id)).filter((t) => !!t),
    ...d.board.blockers.filter((b) => b.askId === a.id && !a.taskIds.includes(b.taskId)).map((b) => d.task(b.taskId)).filter((t) => !!t),
  ]
  const log = d.board.decisions.filter((x) => x.askId === a.id).sort((x, y) => y.at - x.at)
  const H = zoom === 'full' ? 'h1' : 'h2'

  const decide = () => {
    if (!ans.trim()) return setErr('Tulis keputusannya dulu.')
    void run(() => actions.decideAsk(a.id, ans.trim(), decSrcInput(src, today), why.trim()), 'Keputusan tercatat di log').then((ok) => {
      if (ok) {
        setAns('')
        setWhy('')
      }
    })
  }

  return (
    <article>
      <Crumbs
        items={[
          { label: p.name, onClick: () => openProject(d, p.id, 'keputusan') },
          ...(ms ? [{ label: `${d.msNo(ms)} · ${ms.title}`, onClick: () => peek(d, { kind: 'gate', id: ms.id }) }] : []),
          { label: a.ref },
        ]}
      />
      <div className="rec-h">
        <H>{bareTitle(a.ref, a.question)}</H>
        <CopyLink target={{ kind: 'ask', id: a.id }} />
      </div>
      <div className="rec-chips">
        <RefTag r={a.ref} />
        <Tag tone={!open ? 'green' : late ? 'red' : 'amber'} box>
          {!open ? 'Diputuskan' : late ? 'Lewat batas' : 'Menunggu keputusan'}
        </Tag>
        {a.due && open && (
          <Tag tone="grey" box>
            Batas {fmt(a.due)}
          </Tag>
        )}
      </div>
      {!lk && (
        <div className="rec-acts">
          {open && d.canEditAsk(a) && (
            <button className="btn ghost" onClick={() => flows.editAsk(a.id)}>
              Edit
            </button>
          )}
          {!open && may && !reopening && (
            <button className="btn ghost" onClick={() => setReopening(true)}>
              Buka lagi keputusan
            </button>
          )}
        </div>
      )}
      <div className="rec-body">
        <dl className="kv">
          <dt>Pemutus</dt>
          <dd>{d.mname(decider) || 'PM project'}{!a.decider && decider ? ' (PM project)' : ''}</dd>
          <dt>Diminta oleh</dt>
          <dd>
            {d.mname(a.createdBy) || '—'} · {fmtTs(a.createdAt)}
          </dd>
          {ms && (
            <>
              <dt>Milestone</dt>
              <dd>
                <button className="linkbtn" onClick={() => peek(d, { kind: 'gate', id: ms.id })}>
                  {d.msNo(ms)} · {ms.title}
                </button>
              </dd>
            </>
          )}
        </dl>
        {a.context && (
          <div>
            <div className="h3">Konteks</div>
            <div className="box">
              <Linkified text={a.context} />
            </div>
          </div>
        )}
        {a.options.length > 0 && (
          <div>
            <div className="h3">Pilihan</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5 }}>
              {a.options.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ol>
          </div>
        )}
        {a.recommendation && (
          <div>
            <div className="h3">Rekomendasi</div>
            <div className="box">
              <Linkified text={a.recommendation} />
            </div>
          </div>
        )}

        {!open && (
          <div>
            <div className="h3">Keputusan</div>
            <div className="box" style={{ background: 'var(--done-soft)', borderColor: 'transparent' }}>
              <b>
                <Linkified text={a.answer} />
              </b>
              {a.rationale && (
                <div style={{ marginTop: 6 }}>
                  Alasan: <Linkified text={a.rationale} />
                </div>
              )}
              <div className="sub" style={{ marginTop: 6 }}>
                {d.decWho(a.src, a.decidedBy)}
              </div>
            </div>
          </div>
        )}
        {reopening && (
          <div>
            <label className="f">
              Kenapa dibuka lagi
              <input className="inp" value={reopenWhy} onChange={(e) => setReopenWhy(e.target.value)} placeholder="mis. data baru tersedia" />
            </label>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" disabled={busy} onClick={() => void run(() => actions.reopenAsk(a.id, reopenWhy.trim()), 'Keputusan dibuka lagi').then((ok) => ok && setReopening(false))}>
                Buka lagi
              </button>
              <button className="btn ghost" onClick={() => setReopening(false)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {open && may && (
          <Section title="Catat keputusan">
            <label className="f">
              Keputusan
              <textarea className="inp" value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Apa yang diputuskan" />
            </label>
            <label className="f">
              Alasan
              <textarea className="inp" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Kenapa pilihan ini (opsional)" />
            </label>
            <DecisionSource px="k" value={src} onChange={setSrc} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" disabled={busy} onClick={decide}>
                Simpan keputusan
              </button>
            </div>
          </Section>
        )}
        {open && !may && <div className="sub">Menunggu keputusan {d.mname(decider) || 'PM project'}.</div>}
        <div className="err">{err}</div>

        {tasks.length > 0 && (
          <Section title="Task terkait" n={tasks.length}>
            <div className="rows">
              {tasks.map((t) => (
                <TaskLine key={t.id} t={t} showProject={false} />
              ))}
            </div>
          </Section>
        )}
        {log.length > 0 && (
          <Section title="Log keputusan" n={log.length}>
            <div className="tl">
              {log.map((x) => (
                <div key={x.id} className={`ev tone-${x.status === 'decided' ? 'green' : 'amber'}`}>
                  <div>
                    <b>{x.status === 'decided' ? 'Diputuskan' : 'Dibuka lagi'}</b> · {x.note}
                    {x.rationale && <div className="note">Alasan: {x.rationale}</div>}
                    <div className="when">
                      {d.decWho(x.src, x.by)} · {fmtTs(x.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section title="Komentar" n={d.commentsOf(a.id).length}>
          <Comments kind="ask" id={a.id} projectId={a.projectId} />
        </Section>
        <Section title="Riwayat">
          <Timeline events={d.recordEvents(a.id)} limit={8} withObject={false} />
        </Section>
      </div>
    </article>
  )
}
