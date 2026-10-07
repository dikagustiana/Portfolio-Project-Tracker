// One milestone (gate) card on the Milestone tab (prototype viewMilestones, article.ms).
import { Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { peek } from '../../app/nav.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmt, MS_LABEL } from '../../domain/index.ts'
import type { Milestone, Project, Readiness } from '../../domain/index.ts'
import { useReadOnly } from './hooks.ts'

interface Props {
  p: Project
  m: Milestone
  first: boolean
  last: boolean
  /** readiness(p), computed once for all cards. */
  rd: Readiness | null
}

export function MilestoneCard({ p, m, first, last, rd }: Props) {
  const { d } = useBoard()
  const flows = useFlows()
  const ro = useReadOnly(p)
  const lk = d.locked(p)
  const plan = d.canPlan(p) && !lk
  const s = d.msState(m)
  const prog = d.msProg(m)
  const date = d.msDate(m)
  const cur = !!rd && rd.m.id === m.id
  const gate = (
    [
      ['Syarat tercapai', m.criteria],
      ['Tanda bahaya', m.trigger],
      ['Rencana cadangan', m.fallback],
    ] as const
  ).filter((x) => x[1])

  return (
    <article className={`ms ${s}`}>
      <div className="ms-no">{d.msNo(m)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6, marginBottom: 4 }}>
              {d.msLate(m) ? (
                <span className="chip late">Lewat target</span>
              ) : cur && !rd.ready && rd.n ? (
                <span className="chip notready" title="Siap jalan = semua task punya PIC dan tanggalnya sudah dikomit">
                  Belum siap · {rd.ok}/{rd.n} tanggal dikomit
                </span>
              ) : (
                <span className={`chip ${s}`}>{cur && rd.ready && s === 'jalan' ? 'Siap jalan' : MS_LABEL[s]}</span>
              )}
            </div>
            <h3>
              <button className="linkbtn" style={{ font: 'inherit', color: 'inherit', textAlign: 'left' }} onClick={() => peek(d, { kind: 'gate', id: m.id })}>
                {m.title}
              </button>
            </h3>
            <div className="line2">
              {m.target ? (
                <>
                  Target <b>{fmt(m.target)}</b>
                </>
              ) : (
                'Belum ada target'
              )}
              {date && date !== m.target ? ` · task sampai ${fmt(date)}` : ''} · {m.mode === 'fast' ? 'Siap eksekusi' : 'Perlu dikaji'}
            </div>
          </div>
          {plan && (
            <div className="row w wp" style={{ gap: 2, flexWrap: 'nowrap' }}>
              <button className="icon-btn" disabled={first} aria-label="Naikkan" onClick={() => flows.moveMs(m.id, -1)}>
                <Icon name="up" />
              </button>
              <button className="icon-btn" disabled={last} aria-label="Turunkan" onClick={() => flows.moveMs(m.id, 1)}>
                <Icon name="down" />
              </button>
            </div>
          )}
        </div>
        {gate.length ? (
          <div className="gate">
            {gate.map(([label, text]) => (
              <div key={label}>
                <small>{label}</small>
                {text}
              </div>
            ))}
          </div>
        ) : (
          <div className="line2" style={{ marginTop: 10 }}>
            Syarat, tanda bahaya, dan rencana cadangan belum diisi.
            {plan && (
              <>
                {' '}
                <button className="linkbtn wp" onClick={() => flows.openMs(p.id, m.id)}>
                  Edit milestone
                </button>
              </>
            )}
          </div>
        )}
        <div className="ms-foot">
          <div className="ms-prog">
            <span className="sub">
              {prog.d} dari {prog.n} task diterima
            </span>
            <div className="bar">
              <i style={{ width: `${prog.p}%` }} />
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="sub">
              Pemutus: <b style={{ color: 'var(--ink)' }}>{d.mname(d.approverOf(m)) || 'Project Admin'}</b>
            </span>
            {plan && (
              <>
                <button className="btn sm w wp" onClick={() => flows.openTask(null, { projectId: p.id, milestoneId: m.id })}>
                  <Icon name="plus" /> Tambah task
                </button>
                <button className="btn sm w wp" onClick={() => flows.openMs(p.id, m.id)}>
                  Edit milestone
                </button>
              </>
            )}
            {!lk && d.canDecide(m) && s !== 'lulus' && s !== 'stop' && (
              <button className={`btn sm w${s === 'siap' ? ' primary' : ''}`} onClick={() => flows.openGate(m.id)}>
                Putuskan milestone
              </button>
            )}
          </div>
        </div>
        {s === 'stop' && !lk && (
          <div className="banner" style={{ margin: '12px 0 0', background: 'var(--danger-soft)' }}>
            <span>
              <b>Milestone dihentikan.</b> Rencana cadangan yang disepakati: {m.fallback || 'belum diisi'}
            </span>
            {!ro && (
              <span className="row" style={{ gap: 6 }}>
                {d.canPlan(p) && (
                  <button
                    className="btn sm w wp"
                    onClick={() =>
                      flows.openTask(null, { projectId: p.id, milestoneId: m.id, title: 'Rencana cadangan: ', desc: m.fallback || '' })
                    }
                  >
                    <Icon name="plus" /> Task cadangan
                  </button>
                )}
                {d.canDecide(m) && (
                  <button className="btn sm" onClick={() => flows.openGate(m.id)}>
                    Putuskan ulang
                  </button>
                )}
                {d.canOwn(p) && d.pActive(p) && (
                  <button className="btn sm danger" onClick={() => flows.openClose(p.id, 'stop')}>
                    Hentikan project
                  </button>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
