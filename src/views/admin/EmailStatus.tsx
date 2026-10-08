// Admin · Pengaturan: the daily e-mail's status (prototype emailPanel), with pause and the last run.
import { useOverlay } from '../../app/overlay-context.ts'
import { useBoard } from '../../data/board-context.ts'
import { EMAIL_RE, fmtLong } from '../../domain/index.ts'
import { supabase } from '../../lib/supabase.ts'

export function EmailPanel() {
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
      {viewer.isSuperAdmin && (
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
      {viewer.isSuperAdmin && noMail.length > 0 && (
        <div className="warn" style={{ marginTop: 12 }}>
          <div>
            {noMail.length} anggota belum punya email: {noMail.slice(0, 4).map((m) => m.name).join(', ')}
            {noMail.length > 4 ? ', …' : ''}. Isi di Orang & akun.
          </div>
        </div>
      )}
      {viewer.isSuperAdmin && log && (
        <div style={{ marginTop: 12 }} className="sub">
          Putaran terakhir: {fmtLong(log.run_date)} · {(results.emails ?? []).length} email disusun · {(results.skipped ?? []).length} dilewati
          {results.reason ? ` · ${results.reason}` : ''} ({log.provider === 'none' ? 'uji coba, tidak dikirim' : log.provider})
        </div>
      )}
    </section>
  )
}
