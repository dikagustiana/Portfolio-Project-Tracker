// Tinjauan mingguan (spec §45): the management review, assembled from events and current state so
// nobody has to prepare it by hand. What moved since the last review, which commitments slipped,
// what is late or blocked, which decisions wait, what is due next week and which gates can be
// decided. Scope: every readable project, or one project.
import { Head } from '../app/bits.tsx'
import { setUI, useUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays, fmt, range } from '../domain/index.ts'
import { RecordLine, Section, TaskLine, Timeline } from './record/parts.tsx'

export function Review() {
  const ui = useUI()
  const { d, board, today } = useBoard()
  const since = addDays(today, -ui.rvDays)
  const scopeId = ui.sel && d.resolveProject(ui.sel) ? d.resolveProject(ui.sel) : ''
  const ids = scopeId ? [scopeId] : undefined
  const r = d.review(since, today, ids)
  const active = board.projects.filter((p) => d.pActive(p))
  return (
    <>
      <Head
        eyebrow={`${range(since, today)} · bahan rapat review mingguan`}
        title="Tinjauan mingguan"
        actions={
          <div className="row" style={{ gap: 8 }}>
            <div className="seg" role="group" aria-label="Rentang tinjauan">
              {[7, 14, 30].map((n) => (
                <button key={n} className={ui.rvDays === n ? 'on' : ''} onClick={() => setUI({ rvDays: n })}>
                  {n} hari
                </button>
              ))}
            </div>
            <select className="inp" style={{ width: 'auto' }} value={scopeId ? (d.project(scopeId)?.code ?? '') : ''} onChange={(e) => setUI({ sel: e.target.value })} aria-label="Project">
              <option value="">Semua project</option>
              {active.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="metrics">
        <div className="metric">
          <b>{r.moved.filter((e) => e.verb === 'task_accepted' || e.verb === 'task_completed').length}</b>
          <span>Task diterima</span>
        </div>
        <div className={`metric${r.slipped.length ? ' alert tone-amber' : ''}`}>
          <b>{r.slipped.length}</b>
          <span>Komitmen bergeser</span>
        </div>
        <div className={`metric${r.late.length + r.blocked.length ? ' alert tone-red' : ''}`}>
          <b>{r.late.length + r.blocked.length}</b>
          <span>Telat / terhambat</span>
        </div>
        <div className={`metric${r.decisions.length ? ' alert tone-amber' : ''}`}>
          <b>{r.decisions.length}</b>
          <span>Keputusan menunggu</span>
        </div>
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="col">
          <Section title="Bergerak sejak tinjauan lalu" n={r.moved.length}>
            <Timeline events={r.moved} limit={12} empty={`Tidak ada perubahan berarti sejak ${fmt(since)}.`} />
          </Section>
          <Section title="Milestone siap diputuskan" n={r.gatesReady.length}>
            {r.gatesReady.length ? (
              <div className="rows">
                {r.gatesReady.map((m) => (
                  <RecordLine key={m.id} target={{ kind: 'gate', id: m.id }} r={d.msNo(m)} title={m.title} sub={`${d.project(m.projectId)?.name ?? ''} · pemutus ${d.mname(d.approverOf(m)) || 'PM'}`} tone="violet" label="Siap diputuskan" />
                ))}
              </div>
            ) : (
              <div className="empty-line">Belum ada milestone yang semua task-nya diterima.</div>
            )}
          </Section>
          <Section title="Keputusan menunggu" n={r.decisions.length}>
            {r.decisions.length ? (
              <div className="rows">
                {r.decisions.map((a) => (
                  <RecordLine
                    key={a.id}
                    target={{ kind: 'ask', id: a.id }}
                    r={a.ref}
                    title={a.question}
                    sub={`${d.project(a.projectId)?.name ?? ''} · pemutus ${d.mname(d.deciderOf(a)) || 'PM'}`}
                    tone={a.due && a.due < today ? 'red' : 'amber'}
                    label={a.due ? fmt(a.due) : 'Terbuka'}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada keputusan yang menunggu.</div>
            )}
          </Section>
        </div>
        <div className="col">
          <Section title="Komitmen bergeser" n={r.slipped.length}>
            {r.slipped.length ? (
              <div className="rows">
                {r.slipped.map((x) => (
                  <TaskLine
                    key={x.t.id}
                    t={x.t}
                    sub={`${d.project(x.t.projectId)?.name ?? ''} · komitmen awal ${fmt(x.from)}, sekarang ${fmt(x.to)} · ${d.mname(x.t.assignee) || 'tanpa PIC'}`}
                    end={<span className="tag tone-amber">+{x.days} hari</span>}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada komitmen yang mundur dari komitmen awalnya.</div>
            )}
          </Section>
          <Section title="Telat" n={r.late.length}>
            {r.late.length ? (
              <div className="rows">
                {r.late.slice(0, 15).map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada yang telat.</div>
            )}
          </Section>
          <Section title="Terhambat" n={r.blocked.length}>
            {r.blocked.length ? (
              <div className="rows">
                {r.blocked.map(({ t, b }) => (
                  <TaskLine key={t.id} t={t} sub={`${d.project(t.projectId)?.name ?? ''} · ${b.reason}${b.neededFromPerson ? ` · butuh ${d.mname(b.neededFromPerson)}` : ''} · sejak ${fmt(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(b.raisedAt)))}`} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada task yang terhambat.</div>
            )}
          </Section>
          <Section title="Jatuh tempo minggu depan" n={r.dueNext.length}>
            {r.dueNext.length ? (
              <div className="rows">
                {r.dueNext.slice(0, 15).map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada deadline di tujuh hari berikutnya.</div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}
