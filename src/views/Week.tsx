// "Minggu ini" (prototype viewWeek, actionList, calIssuesHtml): the action inbox for me, for
// someone else, or for everyone, plus this week's work, late work and accepted work.
import { useEffect } from 'react'
import { Avatar, ChipView, Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { setUI, useUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays, dn, fmt, fmtTs, isoWeek, range, tsToDate, weekStartOf } from '../domain/index.ts'
import type { CalendarEntry, Id, Inbox, Task } from '../domain/index.ts'

export function Week() {
  const ui = useUI()
  const { d, board, viewer, today, extras } = useBoard()
  const me = viewer.personId ? d.person(viewer.personId) : undefined

  // Without a linked person there is no "me": show everyone (prototype viewWeek).
  useEffect(() => {
    if (ui.asWho === '' && !me) setUI({ asWho: '*' })
  }, [ui.asWho, me])
  const who = ui.asWho || (me ? '' : '*')
  const isP = (id: Id) => who === '*' || (who ? id === who : !!me && id === me.id)

  const ws = addDays(weekStartOf(today), ui.wkOff * 7)
  const we = addDays(ws, 6)
  const label = `Minggu ${isoWeek(ws)} · ${range(ws, we)} ${we.slice(0, 4)}`
  const hs = d.holsIn(ws, we)
  const ib = d.inbox(who)
  const live = (t: Task) => d.pActive(d.project(t.projectId))
  const mine = board.tasks.filter((t) => live(t) && isP(t.assignee) && !d.isDone(t))
  const thisWeek = mine.filter((t) => t.start <= we && t.end >= ws && !d.isLate(t)).sort((a, b) => a.end.localeCompare(b.end))
  const late = mine.filter(d.isLate).sort((a, b) => a.end.localeCompare(b.end))
  const doneWk = board.tasks.filter((t) => {
    const at = t.acceptedAt ?? t.doneAt
    if (!live(t) || !isP(t.assignee) || !d.isDone(t) || !at) return false
    const day = tsToDate(at)
    return day >= ws && day <= we
  })

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
      <div className="wkgrid">
        <div className="stack">
          {who === '' && <CalIssues entries={extras.calendar} />}
          <section className="panel">
            <div className="panel-h">
              <h2>Perlu tindakan</h2>
              <span className="sub">{ib.n} item</span>
            </div>
            <ActionList ib={ib} showWho={who !== ''} />
          </section>
          <TaskPanel title="Dikerjakan minggu ini" rows={thisWeek} empty="Tidak ada task aktif di minggu ini." />
        </div>
        <div className="stack">
          <TaskPanel title="Telat" rows={late} empty="Tidak ada yang telat." />
          <TaskPanel title="Diterima minggu ini" rows={doneWk} empty="Belum ada task yang diterima minggu ini." />
        </div>
      </div>
    </>
  )
}

function TaskPanel({ title, rows, empty }: { title: string; rows: Task[]; empty: string }) {
  const { d } = useBoard()
  const flows = useFlows()
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>{title}</h2>
        <span className="sub">{rows.length} task</span>
      </div>
      {rows.length ? (
        <div className="dl">
          {rows.map((t) => (
            <button key={t.id} className="dl-item" onClick={() => flows.openTask(t.id)}>
              <Avatar id={t.assignee} />
              <div style={{ minWidth: 0 }}>
                <div className="tt">{t.title}</div>
                <div className="sub">
                  {d.project(t.projectId)?.name ?? ''} · {range(t.start, t.end)}
                  {d.needsCommit(t) && (
                    <>
                      {' · '}
                      <b>tanggal belum dikomit</b>
                    </>
                  )}
                </div>
              </div>
              <ChipView chip={d.due(t)} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: 20 }}>
          {empty}
        </div>
      )}
    </section>
  )
}

/** Inbox rows (prototype actionList). showWho adds "· pemeriksa X" style suffixes. */
export function ActionList({ ib, showWho }: { ib: Inbox; showWho: boolean }) {
  const { d, today } = useBoard()
  const flows = useFlows()
  if (!ib.n)
    return (
      <div className="empty" style={{ padding: 20 }}>
        Tidak ada yang menunggu tindakan.
      </div>
    )
  const w = (id: Id, lbl: string) => (showWho ? ` · ${lbl} ${d.mname(id) || 'Project Manager'}` : '')
  const pname = (x: { projectId: Id }) => d.project(x.projectId)?.name ?? ''
  const msNoChip = (no: string) => (
    <span className="ms-no" style={{ width: 30, height: 30, borderRadius: 10, fontSize: 12 }}>
      {no}
    </span>
  )
  return (
    <div className="dl">
      {ib.toValidate.map((t) => (
        <button key={`v${t.id}`} className="dl-item" onClick={() => flows.openReview(t.id)}>
          <Avatar id={t.assignee} />
          <div style={{ minWidth: 0 }}>
            <div className="tt">{t.title}</div>
            <div className="sub">
              Diajukan {d.mname(t.assignee)}
              {t.submittedAt ? ` · ${fmtTs(t.submittedAt)}` : ''} · {pname(t)}
              {w(d.validatorOf(t), 'pemeriksa')}
            </div>
          </div>
          <span className="chip rv">Periksa</span>
        </button>
      ))}
      {ib.gates.map((m) => (
        <button key={`g${m.id}`} className="dl-item" onClick={() => flows.openGate(m.id)}>
          {msNoChip(d.msNo(m))}
          <div style={{ minWidth: 0 }}>
            <div className="tt">{m.title}</div>
            <div className="sub">
              Semua task diterima · {pname(m)}
              {w(d.approverOf(m), 'pemutus')}
            </div>
          </div>
          <span className="chip siap">Putuskan milestone</span>
        </button>
      ))}
      {ib.stops.map((m) => (
        <button key={`s${m.id}`} className="dl-item" onClick={() => setUI({ view: 'project', pid: m.projectId, tab: 'milestone' })}>
          {msNoChip(d.msNo(m))}
          <div style={{ minWidth: 0 }}>
            <div className="tt">{m.title}</div>
            <div className="sub">
              Milestone dihentikan · jalankan rencana cadangan atau hentikan project · {pname(m)}
              {w(d.approverOf(m), 'pemutus')}
            </div>
          </div>
          <span className="chip stop">Tindak lanjut</span>
        </button>
      ))}
      {ib.closes.map((p) => (
        <button key={`c${p.id}`} className="dl-item" onClick={() => flows.openClose(p.id, 'close')}>
          <span className={`dot g-${p.color || 'samb3'}`} style={{ width: 30, height: 30, borderRadius: 10 }} />
          <div style={{ minWidth: 0 }}>
            <div className="tt">{p.name}</div>
            <div className="sub">
              Semua milestone lulus · buktikan hasil akhir lalu tutup project{w(d.pmOf(p), 'PM')}
            </div>
          </div>
          <span className="chip lulus">Tutup project</span>
        </button>
      ))}
      {ib.asks.map((a) => {
        const late = !!a.due && a.due < today
        return (
          <button key={`a${a.id}`} className="dl-item" onClick={() => flows.openAsk(a.projectId, a.id)}>
            <Avatar id={d.deciderOf(a)} />
            <div style={{ minWidth: 0 }}>
              <div className="tt">{a.question}</div>
              <div className="sub">
                Keputusan · {pname(a)}
                {a.due ? ` · batas ${fmt(a.due)}` : ''}
                {w(d.deciderOf(a), 'oleh')}
              </div>
            </div>
            <span className={`chip ${late ? 'late' : 'soon'}`}>{late ? 'Lewat batas' : 'Putuskan'}</span>
          </button>
        )
      })}
      {ib.commits.map((t) => (
        <button key={`k${t.id}`} className="dl-item" onClick={() => flows.openReview(t.id)}>
          <Avatar id={t.assignee} />
          <div style={{ minWidth: 0 }}>
            <div className="tt">{t.title}</div>
            <div className="sub">
              {range(t.start, t.end)} · {d.workdays(t.start, t.end)} hari kerja · {pname(t)}
              {w(t.assignee, 'PIC')}
            </div>
          </div>
          <span className="chip draft">Komit tanggal</span>
        </button>
      ))}
      {ib.rejected.map((t) => (
        <button key={`r${t.id}`} className="dl-item" onClick={() => flows.openTask(t.id)}>
          <Avatar id={t.assignee} />
          <div style={{ minWidth: 0 }}>
            <div className="tt">{t.title}</div>
            <div className="sub">Ditolak: {t.rejectReason}</div>
          </div>
          <span className="chip late">Perbaiki</span>
        </button>
      ))}
    </div>
  )
}

/** "Perbarui kalendermu" (prototype calIssuesHtml): only the viewer's own private calendar. */
function CalIssues({ entries }: { entries: readonly CalendarEntry[] }) {
  const { d } = useBoard()
  const flows = useFlows()
  const L = d.calIssues(entries)
  if (!L.length) return null
  return (
    <section className="panel" style={{ border: '2px solid var(--accent)' }}>
      <div className="panel-h">
        <h2>Perbarui kalendermu</h2>
        <span className="sub">{L.length} event</span>
      </div>
      <div className="dl">
        {L.map((x) =>
          x.kind === 'changed' ? (
            <div key={x.id} className="dl-item static">
              <span className="nx-ic" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                !
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{x.title}</div>
                <div className="sub">
                  Deadline berubah: di kalendermu {fmt(x.old)}, sekarang <b>{fmt(x.end)}</b>. Hapus event lama, lalu tambahkan lagi.
                </div>
              </div>
              <div className="acts">
                <button className="btn sm" onClick={() => flows.openReview(x.id)}>
                  Tambah lagi
                </button>
                <button className="btn sm ghost" onClick={() => flows.calRecord(x.id)}>
                  Sudah diperbarui
                </button>
              </div>
            </div>
          ) : (
            <div key={x.id} className="dl-item static">
              <span className="nx-ic" style={{ borderColor: 'var(--muted)' }}>
                –
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{x.title}</div>
                <div className="sub">
                  Task ini sudah dihapus atau project-nya tidak aktif. Hapus event &quot;Deadline: {x.title}&quot; ({fmt(x.end)}) dari kalendermu.
                </div>
              </div>
              <div className="acts">
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
