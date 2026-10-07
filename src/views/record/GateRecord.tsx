// The gate (milestone) record: the condition that must become true, its leaf progress, the tasks
// that prove it, the Keputusan around it, and its decision history.
import { Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { openProject } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmt, fmtTs, MS_LABEL } from '../../domain/index.ts'
import type { Milestone } from '../../domain/index.ts'
import { CopyLink, Crumbs, ProgBar, RecordLine, RefTag, Section, Tag, TaskLine, Timeline } from './parts.tsx'

const STATE_TONE = { kosong: 'grey', jalan: 'indigo', siap: 'violet', lulus: 'green', stop: 'red' } as const

export function GateRecord({ m, zoom }: { m: Milestone; zoom: 'peek' | 'full' }) {
  const { d } = useBoard()
  const flows = useFlows()
  const p = d.project(m.projectId)
  if (!p) return null
  const s = d.msState(m)
  const prog = d.msProg(m)
  const ts = d.mtasks(m.id)
  const top = ts.filter((t) => !t.parentId)
  const lk = d.locked(m)
  const late = d.msLate(m)
  const asks = d.pasks(p.id).filter((a) => a.milestoneId === m.id)
  const log = d.board.decisions.filter((x) => x.milestoneId === m.id && x.kind === 'gate').sort((a, b) => b.at - a.at)
  const approver = d.approverOf(m)
  const H = zoom === 'full' ? 'h1' : 'h2'
  const e = d.msEnd(m)

  return (
    <article>
      <Crumbs items={[{ label: p.name, onClick: () => openProject(d, p.id) }, { label: d.msNo(m) }]} />
      <div className="rec-h">
        <H>{m.title}</H>
        <CopyLink target={{ kind: 'gate', id: m.id }} />
      </div>
      <div className="rec-chips">
        <RefTag r={d.msNo(m)} />
        <Tag tone={late ? 'red' : STATE_TONE[s]} box>
          {late ? 'Lewat target' : MS_LABEL[s]}
        </Tag>
        {e && (
          <Tag tone="grey" box>
            {m.target ? 'Target' : 's/d'} {fmt(e)}
          </Tag>
        )}
      </div>
      {!lk && (
        <div className="rec-acts">
          {d.canDecide(m) && (
            <button className={`btn ${s === 'siap' ? 'primary' : ''}`} onClick={() => flows.openGate(m.id)}>
              Putuskan milestone
            </button>
          )}
          {d.canPlan(p) && (
            <>
              <button className="btn ghost" onClick={() => flows.openMs(p.id, m.id)}>
                Edit
              </button>
              <button className="btn ghost" onClick={() => flows.openTask(null, { projectId: p.id, milestoneId: m.id })}>
                <Icon name="plus" /> Task
              </button>
            </>
          )}
          {d.canContribute(p.id) && (
            <button className="btn ghost" onClick={() => flows.newAsk(p.id, { milestoneId: m.id })}>
              <Icon name="plus" /> Keputusan
            </button>
          )}
        </div>
      )}
      <div className="rec-body">
        <div>
          <div className="h3">Progress</div>
          <ProgBar p={prog.p} tone={s === 'lulus' ? 'green' : late ? 'red' : 'indigo'} label={`${prog.d} dari ${prog.n} task diterima`} />
          <div className="sub" style={{ marginTop: 4 }}>
            {prog.d}/{prog.n} task diterima
            {top.length !== ts.length ? ` · ${top.filter((t) => d.hasChildren(t)).length} paket dengan sub-task` : ''}
          </div>
        </div>
        <dl className="kv">
          <dt>Pemutus</dt>
          <dd>{d.mname(approver) || 'Project Admin'}{!m.approver && approver ? ' (PM project)' : ''}</dd>
          <dt>Syarat tercapai</dt>
          <dd>{m.criteria || '—'}</dd>
          <dt>Tanda bahaya</dt>
          <dd>{m.trigger || '—'}</dd>
          <dt>Rencana cadangan</dt>
          <dd>{m.fallback || '—'}</dd>
        </dl>
        <Section title="Task" n={top.length}>
          {top.length ? (
            <div className="rows">
              {top.map((t) => (
                <TaskLine key={t.id} t={t} showProject={false} />
              ))}
            </div>
          ) : (
            <div className="empty-line">Belum ada task untuk milestone ini.</div>
          )}
        </Section>
        {asks.length > 0 && (
          <Section title="Keputusan" n={asks.length}>
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
        <Section title="Log keputusan" n={log.length}>
          {log.length ? (
            <div className="tl">
              {log.map((x) => (
                <div key={x.id} className={`ev tone-${x.status === 'lulus' ? 'green' : x.status === 'stop' ? 'red' : 'amber'}`}>
                  <div>
                    <b>{MS_LABEL[x.status as 'lulus' | 'stop' | 'rescope']}</b> · {x.note}
                    <div className="when">
                      {d.decWho(x.src, x.by)} · {fmtTs(x.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-line">Belum ada keputusan untuk milestone ini.</div>
          )}
        </Section>
        <Section title="Riwayat">
          <Timeline events={d.recordEvents(m.id)} limit={8} withObject={false} />
        </Section>
      </div>
    </article>
  )
}
