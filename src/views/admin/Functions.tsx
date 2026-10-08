// Admin · Fungsi: the business functions (Accounting, Commercial, Distribution, …) that own work
// before a named PIC exists, and that people belong to. Renaming keeps every link; a function in
// use cannot be deleted.
import { useState } from 'react'
import { TwoStep } from '../../app/overlay.tsx'
import { useBoard } from '../../data/board-context.ts'
import type { BusinessFunction } from '../../domain/index.ts'
import { useAdminWrite } from './shared.ts'

export function AdminFunctions() {
  const { board } = useBoard()
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState('')
  const used = (f: BusinessFunction) => ({
    people: board.people.filter((m) => m.functionId === f.id).length,
    tasks: board.tasks.filter((t) => t.ownerFunctionId === f.id).length,
  })
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const sort = Math.max(0, ...board.functions.map((f) => f.sort)) + 10
    if (await run((s) => s.from('functions').insert({ name: name.trim(), sort }), `Fungsi ${name.trim()} ditambahkan`, ['functions'])) setName('')
  }
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="panel">
        <div className="panel-h">
          <h2>{board.functions.length} fungsi</h2>
          <span className="sub">Tanggung jawab per fungsi, sebelum ada PIC bernama.</span>
        </div>
        <div className="mlist">
          {board.functions.map((f) => {
            const u = used(f)
            return <FunctionRow key={f.id} f={f} people={u.people} tasks={u.tasks} />
          })}
        </div>
        <form className="addm" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onSubmit={(e) => void add(e)}>
          <input className="inp" placeholder="Nama fungsi, mis. Treasury" aria-label="Nama fungsi" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <button className="btn primary" disabled={busy || !name.trim()}>
            + Tambah fungsi
          </button>
        </form>
      </section>
    </div>
  )
}

function FunctionRow({ f, people, tasks }: { f: BusinessFunction; people: number; tasks: number }) {
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState(f.name)
  const dirty = name.trim() !== f.name
  return (
    <div className="mrow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
      <div style={{ minWidth: 0 }}>
        <input className="inp" aria-label={`Nama fungsi ${f.name}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="sub" style={{ marginTop: 4 }}>
          {people} orang · {tasks} task
        </div>
      </div>
      <button
        className="btn sm"
        disabled={!dirty || busy || !name.trim()}
        onClick={() => void run((s) => s.from('functions').update({ name: name.trim() }).eq('id', f.id), 'Nama fungsi disimpan', ['functions'])}
      >
        Simpan
      </button>
      {people + tasks === 0 ? (
        <TwoStep
          className="btn sm ghost"
          label="Hapus"
          armed="Yakin? Klik lagi"
          onConfirm={() => void run((s) => s.from('functions').delete().eq('id', f.id), `Fungsi ${f.name} dihapus`, ['functions'])}
        />
      ) : (
        <span className="sub">Dipakai</span>
      )}
    </div>
  )
}
