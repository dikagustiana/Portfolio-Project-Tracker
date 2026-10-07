// Project header (prototype viewProject: menu row, .phead and the closed / ready-to-close banner).
import { Icon } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useShell } from '../../app/shell-context.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmtTs, MATURITY, P_LABEL } from '../../domain/index.ts'
import type { Project } from '../../domain/index.ts'
import { useGo, useReadOnly } from './hooks.ts'

export function ProjectHeader({ p }: { p: Project }) {
  const { d, extras } = useBoard()
  const flows = useFlows()
  const go = useGo()
  const { toggleDrawer } = useShell()
  const g = d.prog(p.id)
  const pm = d.pmOf(p)
  const r = d.pActive(p) ? d.readiness(p) : null
  const entLabel = extras.entities.find((e) => e.code === p.entity)?.label ?? p.entity
  // .w buttons also hide on a closed project (.plock); render them only where they apply.
  const plan = d.canPlan(p) && d.pActive(p)
  const closable = d.readyToClose(p) && d.canOwn(p)

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="icon-btn menu-btn" aria-label="Buka menu" onClick={toggleDrawer}>
          <Icon name="menu" />
        </button>
      </div>
      <header className={`phead g-${p.color || 'samb3'}`}>
        <div style={{ minWidth: 0 }}>
          <button className="crumb" onClick={() => go({ view: 'portfolio', peek: null })}>
            ← Portofolio
          </button>
          <h1>{p.name}</h1>
          <div className="row" style={{ gap: 6, margin: '6px 0 2px' }}>
            <span className="chip on-dark mono" title="Kode project, dipakai di semua ID record">
              {p.code}
            </span>
            {p.entity && <span className="chip on-dark">{entLabel}</span>}
            {!d.pActive(p) && (
              <span className="chip on-dark" style={{ background: '#fff', color: '#14212c' }}>
                {P_LABEL[p.status]}
              </span>
            )}
            {pm && <span className="chip on-dark">Project Admin: {d.mname(pm)}</span>}
            {p.maturity && <span className="chip on-dark">{MATURITY[p.maturity]}</span>}
            <span className="chip on-dark">{d.gated(p) ? 'Alur pemeriksaan aktif' : 'Mode ringan'}</span>
            {r && (
              <span className="chip on-dark" title={`${d.msNo(r.m)}: ${r.m.title}`}>
                {r.ready ? `✓ ${d.msNo(r.m)} siap jalan` : `${d.msNo(r.m)} belum siap · ${r.ok}/${r.n} dikomit`}
              </span>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>
            {g.n ? `${g.d} dari ${g.n} task diterima · ${g.p}%` : 'Belum ada task'}
          </div>
          <div className="pbar">
            <i style={{ width: `${g.p}%` }} />
          </div>
        </div>
        <div className="row">
          {plan && (
            <button className="btn w wp" onClick={() => flows.openProject(p.id)}>
              Edit project
            </button>
          )}
          {closable ? (
            <button className="btn white w" onClick={() => flows.openClose(p.id, 'close')}>
              Tutup project
            </button>
          ) : (
            plan && (
              <button className="btn white w wp" onClick={() => flows.openTask(null, { projectId: p.id })}>
                <Icon name="plus" /> Tambah task
              </button>
            )
          )}
        </div>
      </header>
      <StatusBanner p={p} />
    </>
  )
}

function StatusBanner({ p }: { p: Project }) {
  const { d } = useBoard()
  const flows = useFlows()
  const ro = useReadOnly(p)
  const own = d.canOwn(p) && !ro
  if (!d.pActive(p))
    return (
      <div className="banner" style={{ background: p.status === 'selesai' ? 'var(--done-soft)' : 'var(--danger-soft)' }}>
        <span>
          <b>Project {P_LABEL[p.status].toLowerCase()}</b>
          {p.closedAt ? ` · ${fmtTs(p.closedAt)}` : ''}
          {p.closedBy ? ` · ${d.decWho(p.closeSrc, p.closedBy)}` : ''}
          <br />
          {p.closeNote ?? ''}
        </span>
        {own && (
          <button className="btn sm" onClick={() => flows.openClose(p.id, 'reopen')}>
            Buka lagi project
          </button>
        )}
      </div>
    )
  if (!d.readyToClose(p)) return null
  return (
    <div className="banner" style={{ background: 'var(--done-soft)' }}>
      <span>
        <b>Semua milestone lulus.</b> Tunjukkan bukti hasil akhir tercapai (sesuai cara tahu sudah tercapai), lalu tutup
        project.
      </span>
      {own ? (
        <button className="btn sm primary" onClick={() => flows.openClose(p.id, 'close')}>
          Tutup project
        </button>
      ) : (
        <span className="sub">Menunggu {d.mname(d.pmOf(p)) || 'Project Admin'}</span>
      )}
    </div>
  )
}
