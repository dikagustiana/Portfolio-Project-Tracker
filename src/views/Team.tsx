// Tim (prototype viewTeam + emailPanel): people, their project roles, e-mail status and the daily
// digest preview. E-mail addresses appear only where RLS lets the viewer read them.
import { Avatar, Head, Tip } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { setUI } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { EMAIL_RE, fmtLong } from '../domain/index.ts'
import type { Person, ProjectRole } from '../domain/index.ts'
import { supabase } from '../lib/supabase.ts'

const ROLE_LABEL: Record<ProjectRole, string> = { pm: 'Project Manager', officer: 'Officer', viewer: 'Viewer' }

export function Team() {
  const { d, board, viewer } = useBoard()
  const flows = useFlows()
  const act = board.tasks.filter((t) => d.pActive(d.project(t.projectId)) && !d.isDone(t))

  const rolesOf = (m: Person) => {
    const by: Record<ProjectRole, string[]> = { pm: [], officer: [], viewer: [] }
    for (const ms of board.memberships.filter((x) => x.personId === m.id)) {
      const p = d.project(ms.projectId)
      if (p) by[ms.role].push(p.name)
    }
    return by
  }

  return (
    <>
      <Head eyebrow="Anggota yang bisa ditugaskan sebagai PIC, pemeriksa, atau pemutus" title="Tim" />
      <div className="stack" style={{ maxWidth: 860 }}>
        <EmailPanel />
        <div className="panel">
          <div className="panel-h">
            <h2>{board.people.length} anggota</h2>
            <Tip k="peran" />
          </div>
          <div className="mlist">
            {board.people.length ? (
              board.people.map((m) => {
                const n = act.filter((t) => t.assignee === m.id).length
                const v = act.filter((t) => t.stage === 'review' && d.validatorOf(t) === m.id).length
                const isMe = !!viewer.userId && m.userId === viewer.userId
                const roles = rolesOf(m)
                const top: ProjectRole | null = roles.pm.length ? 'pm' : roles.officer.length ? 'officer' : roles.viewer.length ? 'viewer' : null
                const where = (['pm', 'officer', 'viewer'] as const)
                  .filter((r) => roles[r].length)
                  .map((r) => `${r === 'pm' ? 'PM' : ROLE_LABEL[r]}: ${roles[r].join(', ')}`)
                  .join(' · ')
                return (
                  <div key={m.id} className="mrow">
                    <Avatar id={m.id} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {m.name}
                        {isMe && (
                          <>
                            {' '}
                            <span className="chip ok">Kamu</span>
                          </>
                        )}
                      </div>
                      <div className="sub" style={{ overflowWrap: 'anywhere' }}>
                        {m.role || '—'}
                        {m.email ? (
                          <>
                            {' · '}
                            {m.email}
                            {m.emailDaily === false ? ' · email harian mati' : ''}
                          </>
                        ) : viewer.isOwner ? (
                          <>
                            {' · '}
                            <span style={{ color: 'var(--warn-ink)' }}>Belum ada email</span>
                          </>
                        ) : null}
                      </div>
                      <div className="sub">
                        {n} task aktif{v ? ` · ${v} perlu diperiksa` : ''}
                        {where ? ` · ${where}` : ''}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {top ? (
                        <span className={`chip ${top === 'pm' ? 'rv' : top === 'officer' ? 'ok' : ''}`}>{ROLE_LABEL[top]}</span>
                      ) : (
                        <span className="chip">Belum di project</span>
                      )}
                      {m.userId ? <span className="chip">Akun terhubung</span> : <span className="chip late">Akun belum terhubung</span>}
                      <button className="btn sm" onClick={() => flows.openPreview(m.id)}>
                        Pratinjau email
                      </button>
                    </div>
                    {viewer.isOwner && (
                      <div className="row wa" style={{ gap: 4 }}>
                        <button className="btn sm ghost" onClick={() => setUI({ view: 'admin', adminTab: 'orang' })}>
                          Edit anggota
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="empty">Belum ada anggota. {viewer.isOwner ? 'Tambahkan orang di menu Admin.' : 'Owner akan menambahkan anggota tim.'}</div>
            )}
          </div>
          <p className="sub" style={{ margin: '10px 0 0' }}>
            {viewer.isOwner
              ? 'Tambah orang, isi email kantornya, undang, dan atur aksesnya per project di menu Admin. Setelah masuk, app otomatis mengenali siapa yang membuka.'
              : 'Peran dan akses per project diatur oleh owner.'}
          </p>
        </div>
      </div>
    </>
  )
}

function EmailPanel() {
  const { d, board, extras, viewer, today, refreshTable } = useBoard()
  const { toast } = useOverlay()
  const s = board.settings
  const log = extras.emailLog[0]
  const status: [string, string] = s.emailPaused
    ? ['stop', 'Dijeda']
    : s.emailProvider === 'none'
      ? ['draft', 'Uji coba · email belum dikirim']
      : log
        ? ['ok', 'Aktif']
        : ['draft', 'Belum aktif']
  const withMail = board.people.filter((m) => m.email && EMAIL_RE.test(m.email) && m.emailDaily !== false)
  const noMail = board.people.filter((m) => !m.email)
  const all = d.digestAll(today)
  const pending = board.reminders.filter((r) => r.status === 'menunggu' && !d.remWhy(r)).length

  const togglePause = async () => {
    if (!supabase) return
    const { error } = await supabase.from('org_settings').update({ email_paused: !s.emailPaused }).eq('id', true)
    if (error) return toast(error.message)
    await refreshTable('org_settings')
    toast(s.emailPaused ? 'Email harian aktif lagi' : 'Email harian dijeda')
  }

  const results = (log?.results ?? {}) as { emails?: unknown[]; skipped?: unknown[]; reason?: string | null }

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Email harian</h2>
        <span className={`chip ${status[0]}`}>{status[1]}</span>
      </div>
      <p className="sub" style={{ margin: '0 0 12px', fontSize: 13 }}>
        Setiap pagi hari kerja pukul {s.emailTime.replace(':', '.')} WIB, tiap anggota menerima satu email berisi yang harus ia lakukan hari itu: deadline,
        task telat, tanggal yang perlu dikomit, dan yang perlu diperiksa atau diputuskan. Isinya sama dengan halaman Minggu ini. Hari libur, atau kalau tidak
        ada yang perlu dilakukan, email tidak dikirim.
        {s.emailProvider === 'none' && ' Untuk sementara email hanya disusun dan dicatat (uji coba), belum dikirim, sampai pengiriman lewat Outlook disambungkan.'}
      </p>
      {viewer.isOwner && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="sub">
            {pending ? `${pending} pengingat menunggu dikirim · ` : ''}
            {withMail.length} dari {board.people.length} anggota siap menerima
            {all.workday && !all.paused ? ` · hari ini ${all.emails.length} email disusun` : ` · hari ini tidak ada pengiriman (${all.reason ?? ''})`}
          </span>
          <button className="btn sm" onClick={() => void togglePause()}>
            {s.emailPaused ? 'Aktifkan lagi' : 'Jeda email harian'}
          </button>
        </div>
      )}
      {viewer.isOwner && noMail.length > 0 && (
        <div className="warn" style={{ marginTop: 12 }}>
          <div>
            {noMail.length} anggota belum punya email: {noMail.slice(0, 4).map((m) => m.name).join(', ')}
            {noMail.length > 4 ? ', …' : ''}. Isi lewat menu Admin.
          </div>
        </div>
      )}
      {viewer.isOwner && log && (
        <div style={{ marginTop: 12 }} className="sub">
          Putaran terakhir: {fmtLong(log.run_date)} · {(results.emails ?? []).length} email disusun · {(results.skipped ?? []).length} dilewati
          {results.reason ? ` · ${results.reason}` : ''} ({log.provider === 'none' ? 'uji coba, tidak dikirim' : log.provider})
        </div>
      )}
    </section>
  )
}
