// Admin · Pengaturan (org_settings): cuti bersama as workdays, daily e-mail, app link.
import { useState } from 'react'
import type { Database } from '../../data/database.types.ts'
import { useBoard } from '../../data/board-context.ts'
import { EmailPanel } from './EmailStatus.tsx'
import { useAdminWrite } from './shared.ts'

export function AdminSettings() {
  const { board, extras } = useBoard()
  const s = board.settings
  const { run, busy } = useAdminWrite()
  const [time, setTime] = useState(s.emailTime)
  const [appUrl, setAppUrl] = useState(extras.appUrl)
  const save = (patch: Database['public']['Tables']['org_settings']['Update'], ok: string) =>
    void run((x) => x.from('org_settings').update(patch).eq('id', true), ok, ['org_settings'])

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <EmailPanel />
      <section className="panel">
        <div className="panel-h">
          <h2>Hari kerja</h2>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={s.cutiIsWorkday}
            disabled={busy}
            onChange={(e) =>
              save(
                { cuti_bersama_is_workday: e.target.checked },
                e.target.checked ? 'Cuti bersama dihitung sebagai hari kerja' : 'Cuti bersama dihitung sebagai hari libur',
              )
            }
          />
          <span>
            <b>Cuti bersama dihitung sebagai hari kerja</b>
            <br />
            <span className="sub">
              SKB 3 Menteri menyerahkan cuti bersama untuk perusahaan swasta ke pimpinan perusahaan. Kalau dinyalakan, cuti bersama ikut dihitung hari kerja di
              durasi task, email harian, dan peringatan jadwal. Libur nasional tetap libur.
            </span>
          </span>
        </label>
      </section>
      <section className="panel">
        <div className="panel-h">
          <h2>Email harian</h2>
          <span className={`chip ${s.emailPaused ? 'stop' : 'draft'}`}>{s.emailPaused ? 'Dijeda' : 'Uji coba'}</span>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={!s.emailPaused}
            disabled={busy}
            onChange={(e) => save({ email_paused: !e.target.checked }, e.target.checked ? 'Email harian aktif lagi' : 'Email harian dijeda')}
          />
          <span>
            <b>Susun email harian setiap pagi hari kerja</b>
            <br />
            <span className="sub">Fase 1 hanya menyusun dan mencatat email (uji coba). Pengiriman lewat Outlook (Microsoft Graph) menyusul di fase 2.</span>
          </span>
        </label>
        <div className="fgrid">
          <label className="f">
            Jam kirim (WIB)
            <input className="inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <span className="hint">Jadwal otomatis berjalan pukul 07.00 WIB.</span>
          </label>
          <label className="f">
            Pengirim
            <select className="inp" value={s.emailProvider} disabled>
              <option value="none">Belum ada (uji coba)</option>
              <option value="graph">Outlook / Microsoft Graph (fase 2)</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={busy || time === s.emailTime} onClick={() => save({ email_time: time }, 'Jam email disimpan')}>
            Simpan jam
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-h">
          <h2>Alamat app</h2>
        </div>
        <label className="f">
          Link yang dipakai di email dan kalender
          <input className="inp" type="url" placeholder="https://…" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} maxLength={300} />
          <span className="hint">Kosongkan untuk memakai alamat yang sedang dibuka.</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            disabled={busy || appUrl === extras.appUrl || (!!appUrl && !/^https?:\/\//.test(appUrl))}
            onClick={() => save({ app_url: appUrl.trim() }, 'Alamat app disimpan')}
          >
            Simpan alamat
          </button>
        </div>
      </section>
    </div>
  )
}
