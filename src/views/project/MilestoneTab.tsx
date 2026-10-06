// Milestone tab (prototype viewMilestones): outcome, next steps, milestone cards, loose tasks,
// then "Keputusan dibutuhkan" and "Log keputusan".
import { Fragment } from 'react'
import { Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { setUI } from '../../app/ui.ts'
import { useBoard } from '../../data/board-context.ts'
import { MATURITY } from '../../domain/index.ts'
import type { Project } from '../../domain/index.ts'
import { AsksPanel, DecisionLog } from './Decisions.tsx'
import { MilestoneCard } from './MilestoneCard.tsx'
import { NextSteps } from './NextSteps.tsx'

export function MilestoneTab({ p }: { p: Project }) {
  const { d } = useBoard()
  const flows = useFlows()
  const ms = d.pms(p.id)
  const rd = d.readiness(p)
  const lk = d.locked(p)
  const plan = d.canPlan(p) && !lk
  const loose = d.ptasks(p.id).filter((t) => !t.milestoneId || !d.mstone(t.milestoneId))

  return (
    <div className="stack">
      <div className="outcome">
        <div style={{ minWidth: 0 }}>
          <div className="lbl">Hasil akhir{p.maturity ? ` · ${MATURITY[p.maturity]}` : ''}</div>
          <b>{p.outcome || 'Belum ditetapkan'}</b>
          <div className="sub">
            {p.measure
              ? `Cara tahu sudah tercapai: ${p.measure}`
              : 'Cara tahu sudah tercapai belum diisi. Tanpa ini, tim tidak bisa tahu kapan project benar-benar selesai.'}
          </div>
          {ms.length > 0 && (
            <div className="chain" style={{ marginTop: 10 }}>
              {ms.map((m, i) => (
                <Fragment key={m.id}>
                  {i > 0 && <b>→</b>}
                  <span className={d.msState(m) === 'lulus' ? 'done' : ''}>{d.msNo(m)}</span>
                </Fragment>
              ))}
              <b>→</b>
              <span className="goal">Hasil akhir</span>
            </div>
          )}
        </div>
        {plan && (
          <button className="btn sm w wp" onClick={() => flows.openProject(p.id)}>
            Edit project
          </button>
        )}
      </div>
      {d.pActive(p) && <NextSteps p={p} />}
      {ms.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <h3>Susun milestone mundur dari hasil akhir</h3>
            <p style={{ maxWidth: '52ch', margin: '0 auto' }}>
              Mulai dari pertanyaan: apa yang harus sudah benar tepat sebelum hasil akhir tercapai? Jawabannya jadi
              milestone terakhir. Ulangi sampai kembali ke kondisi sekarang.
            </p>
            {plan && (
              <button className="btn primary w wp" onClick={() => flows.openMs(p.id)}>
                <Icon name="plus" /> Tambah milestone
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="sub">{ms.length} milestone · disusun mundur, ditampilkan maju</span>
            {plan && (
              <button className="btn primary sm w wp" onClick={() => flows.openMs(p.id)}>
                <Icon name="plus" /> Tambah milestone
              </button>
            )}
          </div>
          {ms.map((m, i) => (
            <MilestoneCard key={m.id} p={p} m={m} first={i === 0} last={i === ms.length - 1} rd={rd} />
          ))}
          {loose.length > 0 && (
            <div className="banner">
              <span>{loose.length} task belum masuk milestone mana pun. Task tanpa milestone tidak ikut milestone.</span>
              <button className="btn sm" onClick={() => setUI({ tab: 'list' })}>
                Lihat di Checklist
              </button>
            </div>
          )}
          <AsksPanel p={p} />
          <DecisionLog p={p} />
        </>
      )}
    </div>
  )
}
