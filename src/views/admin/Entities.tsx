// Admin · Entitas (BRIEF §6.2): the entity codes projects are filed under.
import { useState } from 'react'
import { useBoard } from '../../data/board-context.ts'
import type { Entity } from '../../data/adapter.ts'
import { TwoStep } from '../../app/overlay.tsx'
import { useAdminWrite } from './shared.ts'

export function AdminEntities() {
  const { extras, board } = useBoard()
  const { run, busy } = useAdminWrite()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [err, setErr] = useState('')
  const nextSort = Math.max(0, ...extras.entities.map((e) => e.sort)) + 1
  return (
    <section className="panel" style={{ maxWidth: 860 }}>
      <div className="panel-h">
        <h2>{extras.entities.length} entitas</h2>
        <span className="sub">Kode tampil di kartu project dan filter dashboard.</span>
      </div>
      <div className="mlist">
        {extras.entities.map((e) => (
          <EntityRow key={e.code} e={e} used={board.projects.filter((p) => p.entity === e.code).length} />
        ))}
      </div>
      <form
        className="addm"
        style={{ gridTemplateColumns: 'minmax(0,0.6fr) minmax(0,1.4fr) auto' }}
        onSubmit={(ev) => {
          ev.preventDefault()
          const c = code.trim()
          if (!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(c)) return setErr('Kode 1–16 huruf/angka, diawali huruf, mis. MAM.')
          if (!label.trim()) return setErr('Isi nama tampilan.')
          setErr('')
          void run((s) => s.from('entities').insert({ code: c, label: label.trim(), sort: nextSort }), `Entitas ${c} ditambahkan`, ['entities']).then(
            (ok) => {
              if (ok) {
                setCode('')
                setLabel('')
              }
            },
          )
        }}
      >
        <input className="inp" placeholder="Kode, mis. MAM" aria-label="Kode" value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} />
        <input className="inp" placeholder="Nama tampilan" aria-label="Nama tampilan" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
        <button className="btn primary" disabled={busy}>
          + Tambah entitas
        </button>
      </form>
      <div className="err">{err}</div>
    </section>
  )
}

function EntityRow({ e, used }: { e: Entity; used: number }) {
  const { run, busy } = useAdminWrite()
  const [label, setLabel] = useState(e.label)
  const [legal, setLegal] = useState(e.legalName ?? '')
  const [sort, setSort] = useState(String(e.sort))
  const dirty = label !== e.label || legal !== (e.legalName ?? '') || sort !== String(e.sort)
  return (
    <div className="mrow" style={{ gridTemplateColumns: '70px minmax(0,1fr) minmax(0,1.3fr) 70px auto auto' }}>
      <b>{e.code}</b>
      <input className="inp" aria-label={`Nama tampilan ${e.code}`} value={label} onChange={(x) => setLabel(x.target.value)} maxLength={80} />
      <input className="inp" aria-label={`Nama legal ${e.code}`} placeholder="Nama legal lengkap" value={legal} onChange={(x) => setLegal(x.target.value)} maxLength={200} />
      <input className="inp" aria-label={`Urutan ${e.code}`} inputMode="numeric" value={sort} onChange={(x) => setSort(x.target.value.replace(/\D/g, ''))} />
      <button
        className="btn sm"
        disabled={!dirty || busy || !label.trim()}
        onClick={() =>
          void run(
            (s) => s.from('entities').update({ label: label.trim(), legal_name: legal.trim() || null, sort: Number(sort) || 0 }).eq('code', e.code),
            `Entitas ${e.code} disimpan`,
            ['entities'],
          )
        }
      >
        Simpan
      </button>
      {used ? (
        <span className="sub">{used} project</span>
      ) : (
        <TwoStep
          className="btn sm ghost"
          label="Hapus"
          armed="Yakin?"
          onConfirm={() => void run((s) => s.from('entities').delete().eq('code', e.code), `Entitas ${e.code} dihapus`, ['entities'])}
        />
      )}
    </div>
  )
}
