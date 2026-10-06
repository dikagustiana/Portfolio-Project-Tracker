// "Keputusan dibutuhkan" and "Log keputusan" panels on the Milestone tab (prototype viewMilestones).
import { Avatar, Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmt, fmtTs, MS_LABEL, P_LABEL } from '../../domain/index.ts'
import type { Decision, Project } from '../../domain/index.ts'
import { decisionLog, openAsks } from './model.ts'

export function AsksPanel({ p }: { p: Project }) {
  const { d, today } = useBoard()
  const flows = useFlows()
  const open = openAsks(d, p)
  // Recording a new ask is a planning action; deciding one is handled by flows.openAsk.
  const canAsk = d.canPlan(p) && !d.locked(p)
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Keputusan dibutuhkan</h2>
        {canAsk && (
          <button className="btn sm w" onClick={() => flows.openAsk(p.id)}>
            <Icon name="plus" /> Catat keputusan
          </button>
        )}
      </div>
      {open.length ? (
        <div className="dl">
          {open.map((x) => {
            const late = !!x.due && x.due < today
            const m = d.mstone(x.milestoneId)
            const who = d.deciderOf(x)
            return (
              <button key={x.id} className="dl-item" onClick={() => flows.openAsk(p.id, x.id)}>
                <Avatar id={who} />
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{x.question}</div>
                  <div className="sub">
                    Pemutus: {d.mname(who) || 'Project Manager'}
                    {m ? ` · ${d.msNo(m)}` : ''}
                    {x.due ? ` · batas ${fmt(x.due)}` : ''}
                  </div>
                </div>
                <span className={`chip ${late ? 'late' : 'soon'}`}>{late ? 'Lewat batas' : 'Terbuka'}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="sub">
          Belum ada keputusan yang ditunggu. Catat di sini hal yang harus diputuskan seseorang sebelum task bisa lanjut: apa,
          siapa pemutusnya, dan kapan.
        </div>
      )}
    </section>
  )
}

const PROJECT_TITLE: Record<string, string> = {
  aktif: 'Project dibuka lagi',
  selesai: 'Project ditutup, hasil akhir tercapai',
}
const label = <K extends string>(map: Record<K, string>, k: string): string => (k in map ? map[k as K] : k)

export function DecisionLog({ p }: { p: Project }) {
  const { d } = useBoard()
  const flows = useFlows()
  const log = decisionLog(d, p)

  const projectRow = (x: Decision) => (
    <div key={x.id}>
      <span className="sub mono">{fmtTs(x.at)}</span>
      <span className={`chip ${x.status === 'selesai' ? 'lulus' : x.status === 'dihentikan' ? 'stop' : ''}`}>
        Project · {label(P_LABEL, x.status)}
      </span>
      <span>
        <b>{PROJECT_TITLE[x.status] ?? 'Project dihentikan'}</b>
        <br />
        <span className="sub">
          {d.decWho(x.src, x.by)} · {x.note || ''}
        </span>
      </span>
    </div>
  )
  const gateRow = (x: Decision) => {
    const m = d.mstone(x.milestoneId)
    return (
      <div key={x.id}>
        <span className="sub mono">{fmtTs(x.at)}</span>
        <span className={`chip ${x.status}`}>Milestone · {label(MS_LABEL, x.status)}</span>
        <span>
          <b>{m ? `${d.msNo(m)} · ${m.title}` : 'Milestone terhapus'}</b>
          <br />
          <span className="sub">
            {d.decWho(x.src, x.by)}
            {x.note ? ` · ${x.note}` : ''}
          </span>
        </span>
      </div>
    )
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Log keputusan</h2>
        <span className="sub">{log.length} keputusan</span>
      </div>
      {log.length ? (
        <div className="log">
          {log.map((e) =>
            e.kind === 'project' ? (
              projectRow(e.d)
            ) : e.kind === 'gate' ? (
              gateRow(e.d)
            ) : (
              <div key={e.a.id}>
                <span className="sub mono">{fmtTs(e.at)}</span>
                <span className="chip">Keputusan</span>
                <button className="dl-item" style={{ padding: 0, display: 'block' }} onClick={() => flows.openAsk(p.id, e.a.id)}>
                  <b>{e.a.question}</b>
                  <br />
                  <span className="sub">
                    {d.decWho(e.a.src, e.a.decidedBy)} · {e.a.answer ?? ''}
                  </span>
                </button>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="sub">Belum ada keputusan. Keputusan milestone dan keputusan yang dijawab akan tercatat di sini.</div>
      )}
    </section>
  )
}
