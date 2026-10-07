// Daily digest preview for one person (prototype openPreview), built by the same digestFor /
// emailFor as the e-mail run. The address shows only where the viewer may read it (owner, or a
// PM of a project the person is on); otherwise it is simply not shown.
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import type { Id } from '../domain/index.ts'
import { Gone } from './parts.tsx'

export function PreviewDialog({ personId }: { personId: Id }) {
  const { d, board, viewer, today } = useBoard()
  const { close } = useOverlay()
  const m = d.person(personId)
  const dg = m ? d.digestFor(m.id, today) : null
  if (!m || !dg) return <Gone />
  const e = d.emailFor(dg)
  const mayReadEmail = viewer.isSuperAdmin || board.memberships.some((x) => x.personId === m.id && d.isAdminIn(x.projectId))
  const off = d.offHol(today)
  let note = ''
  if (!m.email && mayReadEmail) note = 'Belum ada email, jadi email ini belum bisa dikirim. Super admin mengisinya di Admin · Orang & akun.'
  else if (!m.emailDaily) note = 'Email harian untuk anggota ini dimatikan.'
  else if (!d.isWork(today))
    note = `Hari ini ${off ? `libur (${off.name})` : 'akhir pekan'}, jadi tidak ada pengiriman. Ini contoh isinya kalau hari kerja.`
  else if (board.settings.emailPaused) note = 'Email harian sedang dijeda.'

  return (
    <>
      <h2>Pratinjau email harian</h2>
      {note && (
        <div className="warn">
          <div>{note}</div>
        </div>
      )}
      {dg.count ? (
        <>
          <div className="prompt">
            <span className="sub">Kepada:</span> {m.name}
            {m.email ? ` <${m.email}>` : ''}
            <br />
            <span className="sub">Subjek:</span> <b>{e.subject}</b>
          </div>
          <div className="evidence" style={{ whiteSpace: 'normal', background: 'var(--surface)', border: '1px solid var(--line)' }}>
            {dg.sections.map((s) => (
              <div key={s.title} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  {s.title}
                </div>
                {s.items.map((i, k) => (
                  <div key={k} style={{ marginTop: 6 }}>
                    <b>{i.title}</b>
                    <br />
                    <span className="sub">{i.sub}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="sub">+ tombol &quot;Buka SAMB Project Board&quot;</div>
          </div>
        </>
      ) : (
        <div className="empty" style={{ padding: 20 }}>
          Hari ini tidak ada yang perlu dilakukan {m.name}, jadi tidak ada email untuknya.
        </div>
      )}
      <div className="mfoot">
        <span className="sub">Isi dihitung dari data saat ini.</span>
        <button className="btn primary" onClick={close}>
          Tutup
        </button>
      </div>
    </>
  )
}
