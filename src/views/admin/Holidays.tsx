// Admin · Hari libur (BRIEF §6.6): national holidays (libur) and collective leave (cuti bersama).
import { useState } from 'react'
import { TwoStep } from '../../app/overlay.tsx'
import { useBoard } from '../../data/board-context.ts'
import { fmt } from '../../domain/index.ts'
import { useAdminData, useAdminWrite } from './shared.ts'

export function AdminHolidays() {
  const { board } = useBoard()
  const { holidays } = useAdminData()
  const { run, busy } = useAdminWrite()
  const [date, setDate] = useState('')
  const [type, setType] = useState<'libur' | 'cuti'>('libur')
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [err, setErr] = useState('')
  const rows = holidays.data ?? []
  const years = [...new Set(rows.map((h) => h.date.slice(0, 4)))].sort()
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="banner" style={{ margin: 0 }}>
        <span>
          Cuti bersama saat ini dihitung sebagai <b>{board.settings.cutiIsWorkday ? 'hari kerja' : 'hari libur'}</b>. Ubah di tab Pengaturan.
        </span>
      </div>
      {years.map((y) => {
        const ys = rows.filter((h) => h.date.startsWith(y))
        return (
          <section key={y} className="panel">
            <div className="panel-h">
              <h2>{y}</h2>
              <span className="sub">
                {ys.filter((h) => h.type === 'libur').length} libur nasional · {ys.filter((h) => h.type === 'cuti').length} cuti bersama
              </span>
            </div>
            <div className="dl">
              {ys.map((h) => (
                <div key={h.date} className="dl-item static">
                  <span className={`chip ${h.type === 'libur' ? 'late' : 'soon'}`}>{h.type === 'libur' ? 'Libur' : 'Cuti'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tt">
                      {fmt(h.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {h.name}
                    </div>
                    {h.source && <div className="sub">{h.source}</div>}
                  </div>
                  <TwoStep
                    className="btn sm ghost"
                    label="Hapus"
                    armed="Yakin?"
                    onConfirm={() => void run((s) => s.from('holidays').delete().eq('date', h.date), 'Hari libur dihapus', ['holidays', 'admin'])}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <section className="panel">
        <div className="panel-h">
          <h2>Tambah hari libur</h2>
        </div>
        <form
          className="addm"
          style={{ gridTemplateColumns: '160px 130px minmax(0,1fr) auto', marginTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!date) return setErr('Isi tanggal.')
            if (!name.trim()) return setErr('Isi nama hari libur.')
            setErr('')
            void run(
              (s) => s.from('holidays').upsert({ date, type, name: name.trim(), source: source.trim() }),
              'Hari libur disimpan',
              ['holidays', 'admin'],
            ).then((ok) => {
              if (ok) {
                setDate('')
                setName('')
              }
            })
          }}
        >
          <input className="inp" type="date" aria-label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="inp" aria-label="Jenis" value={type} onChange={(e) => setType(e.target.value as 'libur' | 'cuti')}>
            <option value="libur">Libur nasional</option>
            <option value="cuti">Cuti bersama</option>
          </select>
          <input className="inp" placeholder="Nama, mis. Idul Fitri" aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <button className="btn primary" disabled={busy}>
            Simpan
          </button>
        </form>
        <label className="f" style={{ marginTop: 10 }}>
          Sumber (opsional)
          <input className="inp" placeholder="mis. SKB 3 Menteri 2028" value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} />
        </label>
        <div className="err">{err}</div>
        <p className="sub" style={{ margin: 0 }}>Tanggal yang sudah ada akan ditimpa.</p>
      </section>
    </div>
  )
}
