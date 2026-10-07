// Portofolio (spec §28–35): the cross-project management surface. Compact metrics that drill into
// the views behind them, filters (Semua project · Project saya · Perlu perhatian · Blocked ·
// Selesai), search over readable projects only, a dense project table with progress bars, and a
// preview of the selected project built from the same records. Projects without membership are
// not on the board, so no count, name or search result can reveal them.
import { Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { openProject, peek } from '../app/nav.ts'
import { go, setUI, useUI } from '../app/ui.ts'
import type { PortfolioFilterKey } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { fmt, fmtLong, MS_LABEL, P_LABEL } from '../domain/index.ts'
import type { PortfolioRow, Tone } from '../domain/index.ts'
import { VcModules } from './project/ValueChain.tsx'
import { ago, ProgBar, RecordLine, Section, Tag, TaskLine, Timeline } from './record/parts.tsx'

const FILTERS: [PortfolioFilterKey, string][] = [
  ['all', 'Semua project'],
  ['mine', 'Project saya'],
  ['attention', 'Perlu perhatian'],
  ['blocked', 'Blocked'],
  ['done', 'Selesai'],
]

/** Status of a project row as one signal. */
export function rowStatus(r: PortfolioRow): { tone: Tone; text: string } {
  if (r.p.status !== 'aktif') return { tone: r.p.status === 'selesai' ? 'green' : 'grey', text: P_LABEL[r.p.status] }
  if (r.blocked > 0) return { tone: 'red', text: `${r.blocked} terhambat` }
  if (!r.health || r.health.level === 'ok') return { tone: 'green', text: 'On track' }
  return { tone: r.health.level === 'bad' ? 'red' : 'amber', text: r.health.level === 'bad' ? 'Bermasalah' : 'Perlu perhatian' }
}
const progTone = (r: PortfolioRow): Tone => (r.p.status !== 'aktif' ? 'grey' : r.prog.p === 100 ? 'green' : rowStatus(r).tone === 'red' ? 'red' : 'indigo')

export function Portfolio() {
  const ui = useUI()
  const { d, board, viewer, today } = useBoard()
  const flows = useFlows()
  const rows = d.portfolio()
  const shown = d.portfolioFilter(rows, ui.pf, ui.pq)
  const active = rows.filter((r) => d.pActive(r.p))
  const msPassed = active.reduce((n, r) => n + r.msPassed, 0)
  const msTotal = active.reduce((n, r) => n + r.msTotal, 0)
  const decisions = d.openAsks().length
  const blockedLate = d.portfolioFilter(rows, 'blocked').length
  const attention = d.portfolioFilter(rows, 'attention').length
  const sel = rows.find((r) => r.p.code === ui.sel || r.p.id === ui.sel)
  const filter = (pf: PortfolioFilterKey) => setUI({ pf })

  return (
    <>
      <Head
        eyebrow={fmtLong(today)}
        title="Portofolio project SAMB Group"
        actions={
          <>
            <button className="btn primary w wc" onClick={flows.startWizard}>
              <Icon name="plus" /> Project baru
            </button>
            {rows.some((r) => d.isAdminIn(r.p.id)) && (
              <button className="btn" onClick={() => flows.invite()}>
                Undang anggota
              </button>
            )}
          </>
        }
      />
      <p className="lede">
        {viewer.isSuperAdmin ? (
          <>
            Seluruh portofolio: <b>{active.length} project aktif</b> dari {rows.length}.
          </>
        ) : (
          <>
            Kamu memiliki akses ke <b>{rows.length} project</b>.
          </>
        )}{' '}
        {attention ? (
          <>
            <b>{attention} project</b> membutuhkan perhatian.
          </>
        ) : (
          'Tidak ada project yang perlu perhatian.'
        )}
      </p>

      <div className="metrics">
        <button className="metric" onClick={() => filter('all')}>
          <b>{active.length}</b>
          <span>Project aktif</span>
        </button>
        <div className="metric" style={{ cursor: 'default' }}>
          <b>
            {msPassed} <small>/ {msTotal}</small>
          </b>
          <span>Milestone selesai</span>
        </div>
        <button className={`metric${decisions ? ' alert tone-amber' : ''}`} onClick={() => go({ view: 'decisions' })}>
          <b>{decisions}</b>
          <span>Perlu keputusan</span>
        </button>
        <button className={`metric${blockedLate ? ' alert tone-red' : ''}`} onClick={() => filter('blocked')}>
          <b>{blockedLate}</b>
          <span>Blocked / terlambat</span>
        </button>
      </div>

      <div className="fbar">
        <div className="seg" role="group" aria-label="Filter project">
          {FILTERS.map(([k, l]) => (
            <button key={k} className={ui.pf === k ? 'on' : ''} aria-pressed={ui.pf === k} onClick={() => filter(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="search">
          <Icon name="search" />
          <input value={ui.pq} placeholder="Cari project, kode, entitas" aria-label="Cari project" onChange={(e) => setUI({ pq: e.target.value })} />
        </label>
      </div>

      <div className={`pfgrid${sel ? '' : ' solo'}`}>
        <div className="ptable" role="table" aria-label="Daftar project">
          <div className="prow head" role="row">
            <span>Project</span>
            <span>Progress</span>
            <span>Milestone</span>
            <span>Status</span>
            <span>Milestone berikutnya</span>
            <span>PM</span>
            <span>Gerak terakhir</span>
          </div>
          {shown.length ? (
            shown.map((r) => {
              const st = rowStatus(r)
              return (
                <button
                  key={r.p.id}
                  role="row"
                  className={`prow${sel?.p.id === r.p.id ? ' sel' : ''}`}
                  onClick={() => setUI({ sel: sel?.p.id === r.p.id ? '' : r.p.code || r.p.id })}
                  onDoubleClick={() => openProject(d, r.p.id)}
                >
                  <span className="pn">
                    <span className={`dot g-${r.p.color || 'samb3'}`} style={{ width: 10, height: 10 }} />
                    <span style={{ minWidth: 0 }}>
                      <b>{r.p.name}</b>
                      <small>
                        {r.p.code} · {r.p.entity}
                      </small>
                    </span>
                  </span>
                  <ProgBar p={r.prog.p} tone={progTone(r)} label={`${r.prog.d} dari ${r.prog.n} task diterima`} />
                  <span className="c mono">
                    {r.msPassed} / {r.msTotal}
                  </span>
                  <span className="c">
                    <span className={`tag tone-${st.tone}`}>{st.text}</span>
                  </span>
                  <span className="c">{r.next ? `${d.msNo(r.next)} · ${r.next.title}` : r.msTotal ? 'Semua lulus' : '—'}</span>
                  <span className="c">{d.mname(r.pm) || '—'}</span>
                  <span className="c m">{r.lastMovement ? ago(r.lastMovement.at, today) : '—'}</span>
                </button>
              )
            })
          ) : (
            <div className="empty" style={{ padding: 28 }}>
              {rows.length ? 'Tidak ada project yang cocok dengan filter ini.' : 'Belum ada project yang bisa kamu akses.'}
            </div>
          )}
        </div>
        {sel && <Preview r={sel} />}
      </div>
      {!sel && shown.length > 0 && <p className="sub" style={{ marginTop: 8 }}>Klik baris untuk pratinjau, klik dua kali untuk membuka project.</p>}
      {board.projects.length === 0 && viewer.isSuperAdmin && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={flows.startWizard}>
            <Icon name="plus" /> Buat project pertama
          </button>
        </div>
      )}
    </>
  )
}

/** Condensed operating view of one project, from the same records as its page. */
function Preview({ r }: { r: PortfolioRow }) {
  const { d, today } = useBoard()
  const p = r.p
  const st = rowStatus(r)
  const blocked = d.blockedList(p.id)
  const asks = d.openAsks(p.id)
  const review = d.waitingReview(p.id)
  const events = d.projectEvents(p.id)
  return (
    <aside className="preview col" aria-label={`Pratinjau ${p.name}`}>
      <section className="sec">
        <div className="sec-h">
          <h2>{p.name}</h2>
          <button className="icon-btn" aria-label="Tutup pratinjau" onClick={() => setUI({ sel: '' })}>
            ✕
          </button>
        </div>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <span className="ref">{p.code}</span>
          <Tag tone={st.tone} box>
            {st.text}
          </Tag>
          <span className="sub">PM {d.mname(r.pm) || '—'}</span>
        </div>
        <ProgBar p={r.prog.p} tone={progTone(r)} label="Progress" />
        <div className="sub" style={{ margin: '4px 0 10px' }}>
          {r.prog.d}/{r.prog.n} task diterima · {r.msPassed}/{r.msTotal} milestone lulus
        </div>
        {r.next && (
          <button className="li" style={{ width: '100%' }} onClick={() => peek(d, { kind: 'gate', id: r.next?.id ?? '' })}>
            <span className="ref">{d.msNo(r.next)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="tt">{r.next.title}</div>
              <div className="sub">
                {MS_LABEL[d.msState(r.next)]}
                {d.msEnd(r.next) ? ` · ${r.next.target ? 'target' : 's/d'} ${fmt(d.msEnd(r.next) ?? '')}` : ''} · {d.msProg(r.next).d}/{d.msProg(r.next).n} task
              </div>
            </div>
            <span className="end">{d.msLate(r.next) && <Tag tone="red">Lewat target</Tag>}</span>
          </button>
        )}
        {r.health && r.health.items.length > 0 && <div className="sub" style={{ marginTop: 8 }}>{r.health.items.join(' · ')}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary sm" onClick={() => openProject(d, p.id)}>
            Buka project
          </button>
          <button className="btn sm ghost" onClick={() => openProject(d, p.id, 'aktivitas')}>
            Aktivitas
          </button>
        </div>
      </section>
      {d.hasVC(p) && (
        <Section title="Value chain">
          <VcModules p={p} link />
        </Section>
      )}
      {blocked.length > 0 && (
        <Section title="Terhambat" n={blocked.length}>
          <div className="rows">
            {blocked.slice(0, 4).map(({ t, b }) => (
              <TaskLine key={t.id} t={t} showProject={false} sub={`${b.reason}${b.neededFromPerson ? ` · butuh ${d.mname(b.neededFromPerson)}` : ''}`} />
            ))}
          </div>
        </Section>
      )}
      {asks.length > 0 && (
        <Section title="Perlu keputusan" n={asks.length}>
          <div className="rows">
            {asks.slice(0, 4).map((a) => (
              <RecordLine
                key={a.id}
                target={{ kind: 'ask', id: a.id }}
                r={a.ref}
                title={a.question}
                sub={`Pemutus ${d.mname(d.deciderOf(a)) || 'PM'}`}
                tone={a.due && a.due < today ? 'red' : 'amber'}
                label={a.due ? fmt(a.due) : 'Terbuka'}
              />
            ))}
          </div>
        </Section>
      )}
      {review.length > 0 && (
        <Section title="Menunggu pemeriksaan" n={review.length}>
          <div className="rows">
            {review.slice(0, 4).map((t) => (
              <TaskLine key={t.id} t={t} showProject={false} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Gerak terakhir">
        <Timeline events={events} limit={4} withObject />
      </Section>
    </aside>
  )
}
