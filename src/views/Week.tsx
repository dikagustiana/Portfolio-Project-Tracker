// Minggu ini (prototype viewWeek, spec §41): the weekly operating view. Current attention
// (Perlu tindakan, late work) is about now and does not move with the week arrows; the schedule
// (deadlines, starts, acceptances, decision deadlines, gate targets, commitments) follows the
// selected week. "Lihat sebagai" shows the same views for someone else or for everyone.
import { useEffect } from 'react'
import { Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { setUI, useUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays, dn, fmt, isoWeek, range, weekStartOf } from '../domain/index.ts'
import type { CalendarEntry, Id, Task } from '../domain/index.ts'
import { ActionRows, ScheduleRows } from './lists.tsx'
import { Section, TaskLine } from './record/parts.tsx'

export function Week() {
  const ui = useUI()
  const { d, board, viewer, today, extras } = useBoard()
  const me = viewer.personId ? d.person(viewer.personId) : undefined

  // Without a linked person there is no "me": show everyone (prototype viewWeek).
  useEffect(() => {
    if (ui.asWho === '' && !me) setUI({ asWho: '*' })
  }, [ui.asWho, me])
  // A saved "Lihat sebagai" person who is no longer visible falls back to me (or everyone).
  const known = ui.asWho === '' || ui.asWho === '*' || board.people.some((m) => m.id === ui.asWho)
  const who: Id = (known && ui.asWho) || (me ? '' : '*')
  const isP = (id: Id) => who === '*' || (who ? id === who : !!me && id === me.id)

  const ws = addDays(weekStartOf(today), ui.wkOff * 7)
  const we = addDays(ws, 6)
  const label = `Minggu ${isoWeek(ws)} · ${range(ws, we)} ${we.slice(0, 4)}`
  const hs = d.holsIn(ws, we)
  const actions = d.actions(who)
  const schedule = d.week(ws, who)
  const live = (t: Task) => d.pActive(d.project(t.projectId)) && d.isLeaf(t)
  const running = board.tasks
    .filter((t) => live(t) && isP(t.assignee) && !d.isDone(t) && t.start <= we && t.end >= ws && !d.isLate(t))
    .sort((a, b) => a.end.localeCompare(b.end))
  const late = board.tasks.filter((t) => live(t) && isP(t.assignee) && d.isLate(t)).sort((a, b) => a.end.localeCompare(b.end))

  return (
    <>
      <Head
        eyebrow={ui.wkOff === 0 ? 'Apa yang harus jalan minggu ini' : 'Rencana per minggu'}
        title={label}
        actions={
          <div className="wkbar">
            <button className="icon-btn" aria-label="Minggu sebelumnya" onClick={() => setUI({ wkOff: ui.wkOff - 1 })}>
              <Icon name="left" />
            </button>
            <button className="btn sm" disabled={ui.wkOff === 0} onClick={() => setUI({ wkOff: 0 })}>
              Minggu ini
            </button>
            <button className="icon-btn" aria-label="Minggu berikutnya" onClick={() => setUI({ wkOff: ui.wkOff + 1 })}>
              <Icon name="right" />
            </button>
            <label className="field">
              <span className="sub">Lihat</span>
              <select aria-label="Lihat sebagai" value={who} onChange={(e) => setUI({ asWho: e.target.value })}>
                {me && <option value="">Saya ({me.name})</option>}
                <option value="*">Semua orang</option>
                {board.people
                  .filter((m) => !me || m.id !== me.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        }
      />
      {hs.length > 0 ? (
        <div className="hols">
          {hs.map((h) => (
            <span key={h.date} className={`chip ${h.type === 'libur' ? 'late' : 'soon'}`}>
              {new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(dn(h.date) * 864e5))} ·{' '}
              {h.name}
            </span>
          ))}
        </div>
      ) : (
        (!d.holCovered(ws) || !d.holCovered(we)) && (
          <div className="hols">
            <span className="chip">Data libur nasional hanya tersedia untuk {d.holYears.join(' dan ')}</span>
          </div>
        )
      )}
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="col">
          {who === '' && <CalIssues entries={extras.calendar} />}
          <Section title="Perlu tindakan sekarang" n={actions.length}>
            <div className="sub" style={{ margin: '-4px 0 6px' }}>
              Semua yang menunggu tindakan hari ini, {fmt(today)}. Tidak ikut berganti dengan minggu yang dipilih.
            </div>
            <ActionRows items={actions} showWho={who !== ''} />
          </Section>
          <Section title="Telat" n={late.length}>
            {late.length ? (
              <div className="rows">
                {late.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada yang telat.</div>
            )}
          </Section>
        </div>
        <div className="col">
          <Section title={ui.wkOff === 0 ? 'Jadwal minggu ini' : `Jadwal ${range(ws, we)}`} n={schedule.length}>
            <ScheduleRows items={schedule} showWho={who !== ''} />
          </Section>
          <Section title="Berjalan di minggu ini" n={running.length}>
            {running.length ? (
              <div className="rows">
                {running.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada task aktif di minggu ini.</div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

/** "Perbarui kalendermu" (prototype calIssuesHtml): only the viewer's own private calendar. */
export function CalIssues({ entries }: { entries: readonly CalendarEntry[] }) {
  const { d } = useBoard()
  const flows = useFlows()
  const L = d.calIssues(entries)
  if (!L.length) return null
  return (
    <section className="sec" style={{ borderColor: 'var(--accent)' }}>
      <div className="sec-h">
        <h2>
          Perbarui kalendermu<span className="n">{L.length}</span>
        </h2>
      </div>
      <div className="rows">
        {L.map((x) =>
          x.kind === 'changed' ? (
            <div key={x.id} className="li static">
              <span className="ref">!</span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{x.title}</div>
                <div className="sub" style={{ whiteSpace: 'normal' }}>
                  Deadline berubah: di kalendermu {fmt(x.old)}, sekarang <b>{fmt(x.end)}</b>. Hapus event lama, lalu tambahkan lagi.
                </div>
              </div>
              <div className="end">
                <button className="btn sm" onClick={() => flows.openCal(x.id)}>
                  Tambah lagi
                </button>
                <button className="btn sm ghost" onClick={() => flows.calRecord(x.id)}>
                  Sudah diperbarui
                </button>
              </div>
            </div>
          ) : (
            <div key={x.id} className="li static">
              <span className="ref">–</span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{x.title}</div>
                <div className="sub" style={{ whiteSpace: 'normal' }}>
                  Task ini sudah dihapus atau project-nya tidak aktif. Hapus event &quot;Deadline: {x.title}&quot; ({fmt(x.end)}) dari kalendermu.
                </div>
              </div>
              <div className="end">
                <button className="btn sm ghost" onClick={() => flows.calRemove(x.id)}>
                  Sudah dihapus
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
