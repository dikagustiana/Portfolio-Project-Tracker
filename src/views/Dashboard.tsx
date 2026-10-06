// Dashboard (prototype viewDash): stat cards, entity filter, value-chain strips, project cards
// with health ring, "Milestone mendatang", "Beban kerja tim", closed projects.
import { Avatar, Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useActionCount } from '../app/hooks.ts'
import { setUI, useUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { fmt, fmtLong, fmtTs, initials, MS_LABEL, P_LABEL } from '../domain/index.ts'
import type { Project, Task } from '../domain/index.ts'
import { useEntityLabel } from './entity.ts'
import { VcStrip } from './project/ValueChain.tsx'

export function Dashboard() {
  const ui = useUI()
  const { d, board, extras, viewer, today } = useBoard()
  const flows = useFlows()
  const entLabel = useEntityLabel()
  const actionCount = useActionCount()

  const all = [...board.projects].sort((a, b) => a.createdAt - b.createdAt)
  const ents = extras.entities.map((e) => e.code).filter((e) => all.some((p) => p.entity === e))
  const ent = ui.ent && ents.includes(ui.ent) ? ui.ent : ''
  const inEnt = (p: Project | undefined) => !ent || p?.entity === ent
  const act = all.filter((p) => d.pActive(p) && inEnt(p))
  const closed = all.filter((p) => !d.pActive(p) && inEnt(p)).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
  const go = (pid: string, tab: 'milestone' | 'list' = 'milestone') => {
    setUI({ view: 'project', pid, tab, who: 'all', q: '' })
    window.scrollTo(0, 0)
  }

  const head = (
    <Head
      eyebrow={fmtLong(today)}
      title={ent ? `Portofolio project ${entLabel(ent)}` : 'Portofolio project SAMB Group'}
      actions={
        <button className="btn primary w wc" onClick={flows.startWizard}>
          <Icon name="plus" /> Project baru
        </button>
      }
    />
  )

  if (!all.length) {
    return (
      <>
        {head}
        <div className="panel">
          <div className="empty">
            <h3>Belum ada project</h3>
            {viewer.isOwner ? (
              <>
                <p style={{ maxWidth: '50ch', margin: '0 auto' }}>
                  Mulai dengan menambahkan orang dan email kantornya di Admin, lalu buat project pertama: tetapkan hasil akhirnya, susun milestone mundur,
                  lalu pecah jadi task.
                </p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn w wa" onClick={() => setUI({ view: 'admin', adminTab: 'orang' })}>
                    <Icon name="team" /> Buka Admin
                  </button>
                  <button className="btn primary w wc" onClick={flows.startWizard}>
                    <Icon name="plus" /> Buat project
                  </button>
                </div>
              </>
            ) : (
              <p style={{ maxWidth: '50ch', margin: '0 auto' }}>Kamu belum menjadi anggota project mana pun. Owner akan menambahkanmu ke project yang relevan.</p>
            )}
          </div>
        </div>
      </>
    )
  }

  const live = (t: Task) => d.pActive(d.project(t.projectId)) && inEnt(d.project(t.projectId))
  const lateT = board.tasks.filter((t) => live(t) && d.isLate(t)).length
  const msA = board.milestones.filter((m) => d.pActive(d.project(m.projectId)) && inEnt(d.project(m.projectId)))
  const gatesReady = msA.filter((m) => d.msState(m) === 'siap').length
  const msLateN = msA.filter(d.msLate).length
  const hs = act.map(d.health)
  const badN = hs.filter((h) => h?.level === 'bad').length

  const upcoming = msA
    .filter((m) => !['lulus', 'stop'].includes(d.msState(m)))
    .sort((a, b) => (d.msEnd(a) ?? '9').localeCompare(d.msEnd(b) ?? '9'))
    .slice(0, 8)
  const load = board.people
    .filter((m) => !ent || board.tasks.some((t) => live(t) && (t.assignee === m.id || d.validatorOf(t) === m.id)))
    .map((m) => ({
      m,
      n: board.tasks.filter((t) => live(t) && !d.isDone(t) && t.assignee === m.id).length,
      v: board.tasks.filter((t) => live(t) && t.stage === 'review' && d.validatorOf(t) === m.id).length,
    }))
    .sort((a, b) => b.n - a.n)
  const mx = Math.max(1, ...load.map((x) => x.n))

  return (
    <>
      {head}
      {ents.length > 1 && (
        <div className="entbar pills" role="group" aria-label="Filter entitas">
          <button className={ent ? '' : 'on'} onClick={() => setUI({ ent: '' })}>
            Semua entitas
          </button>
          {ents.map((e) => (
            <button key={e} className={ent === e ? 'on' : ''} onClick={() => setUI({ ent: e })}>
              {e}
            </button>
          ))}
        </div>
      )}
      {actionCount > 0 && (
        <div className="banner" style={{ background: 'var(--review-soft)' }}>
          <span>
            Kamu punya <b>{actionCount} hal</b> yang menunggu tindakan.
          </span>
          <button className="btn sm primary" onClick={() => setUI({ view: 'week' })}>
            Buka Minggu ini
          </button>
        </div>
      )}
      <div className="stats">
        <div className={`stat c1${act.length ? '' : ' zero'}`}>
          <b>{act.length}</b>
          <span>
            Project aktif{badN ? ` · ${badN} bermasalah` : ''}
          </span>
        </div>
        <div className={`stat c2${gatesReady ? '' : ' zero'}`}>
          <b>{gatesReady}</b>
          <span>Milestone siap diputuskan</span>
        </div>
        <div className={`stat c3${msLateN ? '' : ' zero'}`}>
          <b>{msLateN}</b>
          <span>Milestone lewat target</span>
        </div>
        <div className={`stat c4${lateT ? '' : ' zero'}`}>
          <b>{lateT}</b>
          <span>Task telat</span>
        </div>
      </div>
      {act.filter(d.hasVC).map((p) => (
        <section key={p.id} className="panel" style={{ marginBottom: 22 }}>
          <div className="panel-h">
            <h2>Value chain · {p.name}</h2>
            <button className="linkbtn" onClick={() => setUI({ view: 'project', pid: p.id, tab: 'vc', vcStep: '', who: 'all', q: '' })}>
              Buka per step
            </button>
          </div>
          <VcStrip p={p} link />
        </section>
      ))}
      <div className="pgrid">
        {act.map((p) => (
          <ProjectCard key={p.id} p={p} onOpen={() => go(p.id)} />
        ))}
        <button className="pnew w wc" onClick={flows.startWizard}>
          <Icon name="plus" />
          <br />
          Project baru
        </button>
      </div>
      <div className="two">
        <section className="panel">
          <div className="panel-h">
            <h2>Milestone mendatang</h2>
            <span className="sub">semua project aktif</span>
          </div>
          <div className="dl">
            {upcoming.length ? (
              upcoming.map((m) => {
                const s = d.msState(m)
                const ts = d.mtasks(m.id)
                const done = ts.filter(d.isDone).length
                const e = d.msEnd(m)
                return (
                  <button key={m.id} className="dl-item" onClick={() => go(m.projectId)}>
                    <span className="ms-no" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 12 }}>
                      {d.msNo(m)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="tt">{m.title}</div>
                      <div className="sub">
                        {d.project(m.projectId)?.name ?? ''} · {done}/{ts.length} task diterima
                        {e ? ` · ${m.target ? 'target ' : 's/d '}${fmt(e)}` : ''}
                      </div>
                    </div>
                    {d.msLate(m) ? <span className="chip late">Lewat target</span> : <span className={`chip ${s}`}>{MS_LABEL[s]}</span>}
                  </button>
                )
              })
            ) : (
              <div className="empty">Belum ada milestone yang berjalan.</div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Beban kerja tim</h2>
            <span className="sub">task aktif per orang</span>
          </div>
          {load.length ? (
            load.map((x) => (
              <div key={x.m.id} className="load">
                <Avatar id={x.m.id} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.m.name}</div>
                  <div className="bar">
                    <i style={{ width: `${(x.n / mx) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
                <span className="sub" style={{ textAlign: 'right' }}>
                  {x.n} task
                  {x.v > 0 && (
                    <>
                      <br />
                      {x.v} perlu diperiksa
                    </>
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className="empty">
              Belum ada anggota tim.
              <br />
              <button className="btn sm w wa" onClick={() => setUI({ view: 'admin', adminTab: 'orang' })}>
                Tambah anggota
              </button>
            </div>
          )}
        </section>
      </div>
      {closed.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-h">
            <h2>Project selesai &amp; dihentikan</h2>
            <span className="sub">{closed.length} project</span>
          </div>
          <div className="dl">
            {closed.map((p) => (
              <button key={p.id} className="dl-item" onClick={() => go(p.id)}>
                <span className={`dot g-${p.color || 'samb3'}`} style={{ width: 26, height: 26, borderRadius: 9 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{p.name}</div>
                  <div className="sub">
                    {p.closedAt ? `${fmtTs(p.closedAt)} · ` : ''}
                    {p.closeNote ?? ''}
                  </div>
                </div>
                <span className={`chip ${p.status === 'selesai' ? 'lulus' : 'stop'}`}>{P_LABEL[p.status]}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const { d } = useBoard()
  const g = d.prog(p.id)
  const h = d.health(p)
  const cm = d.currentMs(p)
  const r = d.readiness(p)
  const ms = d.pms(p.id)
  const passed = ms.filter((m) => d.msState(m) === 'lulus').length
  const pm = d.pmOf(p)
  const hColor = h?.level === 'bad' ? '#c0392b' : h?.level === 'warn' ? '#b45309' : '#0b7a67'
  return (
    <button className={`pcard g-${p.color || 'samb3'}`} onClick={onOpen}>
      <div className="ring" style={{ background: `conic-gradient(#fff ${g.p * 3.6}deg,rgba(255,255,255,.28) 0)` }}>
        <b>{g.n ? `${g.p}%` : '–'}</b>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {p.entity && <span className="chip on-dark">{p.entity}</span>}
        {h && (
          <span className="chip" style={{ background: '#fff', color: hColor }}>
            {h.label}
          </span>
        )}
        {pm && <span className="chip on-dark">PM {initials(d.mname(pm))}</span>}
      </div>
      <h3>{p.name}</h3>
      <p>{cm ? `Sekarang ${d.msNo(cm)}: ${cm.title}` : ms.length ? 'Semua milestone lulus' : 'Belum ada milestone'}</p>
      <div className="foot">
        <div className="meta">
          {ms.length ? `${passed}/${ms.length} milestone lulus` : ''}
          {r && r.n ? ` · ${r.ready ? 'siap jalan' : `${r.ok}/${r.n} dikomit`}` : ''}
          {h && h.items.length > 0 && (
            <>
              <br />
              {h.items.slice(0, 2).join(' · ')}
              {h.items.length > 2 ? ` · +${h.items.length - 2} lainnya` : ''}
            </>
          )}
        </div>
      </div>
    </button>
  )
}

