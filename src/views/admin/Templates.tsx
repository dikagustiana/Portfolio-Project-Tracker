// Admin · Template value chain (BRIEF §6.3): per-project step templates. chain = chevrons in order,
// output = the outlined Report box, side = a separate block (e.g. Logistics services).
import { useState } from 'react'
import { TwoStep } from '../../app/overlay.tsx'
import { useBoard } from '../../data/board-context.ts'
import type { StepKind, StepTemplate, TemplateStep } from '../../domain/index.ts'
import { useAdminWrite } from './shared.ts'

const KINDS: [StepKind, string][] = [
  ['chain', 'Rantai (chevron)'],
  ['output', 'Output (kotak Report)'],
  ['side', 'Blok terpisah'],
]
const TABLES = ['step_templates', 'template_steps', 'task_steps', 'projects'] as const

export function AdminTemplates() {
  const { board } = useBoard()
  const { run, busy } = useAdminWrite()
  const [name, setName] = useState('')
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      {board.templates.map((t) => (
        <TemplateCard key={t.id} t={t} />
      ))}
      <section className="panel">
        <div className="panel-h">
          <h2>Template baru</h2>
          <span className="sub">Pasang template ke project lewat Edit project.</span>
        </div>
        <form
          className="addm"
          style={{ gridTemplateColumns: 'minmax(0,1fr) auto', marginTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            void run((s) => s.from('step_templates').insert({ name: name.trim() }), 'Template dibuat', [...TABLES]).then((ok) => ok && setName(''))
          }}
        >
          <input className="inp" placeholder="Nama template, mis. Manufaktur BMG" aria-label="Nama template" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <button className="btn primary" disabled={busy || !name.trim()}>
            + Buat template
          </button>
        </form>
      </section>
    </div>
  )
}

function TemplateCard({ t }: { t: StepTemplate }) {
  const { board } = useBoard()
  const { run, busy } = useAdminWrite()
  const used = board.projects.filter((p) => p.stepTemplateId === t.id)
  const [code, setCode] = useState('')
  const [stepName, setStepName] = useState('')
  const [kind, setKind] = useState<StepKind>('chain')
  const [err, setErr] = useState('')
  const nextSort = Math.max(0, ...t.steps.map((s) => s.sort)) + 1
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>{t.name}</h2>
        <span className="sub">
          {t.steps.length} step · dipakai {used.length ? used.map((p) => p.name).join(', ') : 'belum ada project'}
        </span>
      </div>
      <div className="mlist">
        {t.steps.map((s) => (
          <StepRow key={s.id} s={s} />
        ))}
      </div>
      <form
        className="addm"
        style={{ gridTemplateColumns: '140px minmax(0,1fr) 190px auto' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!/^[a-z][a-z0-9_-]{0,31}$/.test(code.trim())) return setErr('Kode huruf kecil tanpa spasi, mis. produksi.')
          if (!stepName.trim()) return setErr('Isi nama step.')
          setErr('')
          void run(
            (x) => x.from('template_steps').insert({ template_id: t.id, code: code.trim(), name: stepName.trim(), kind, sort: nextSort }),
            'Step ditambahkan',
            [...TABLES],
          ).then((ok) => {
            if (ok) {
              setCode('')
              setStepName('')
            }
          })
        }}
      >
        <input className="inp" placeholder="kode" aria-label="Kode step" value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} />
        <input className="inp" placeholder="Nama step" aria-label="Nama step" value={stepName} onChange={(e) => setStepName(e.target.value)} maxLength={80} />
        <select className="inp" aria-label="Jenis step" value={kind} onChange={(e) => setKind(e.target.value as StepKind)}>
          {KINDS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn primary" disabled={busy}>
          + Step
        </button>
      </form>
      <div className="err">{err}</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <TwoStep
          className="btn sm danger"
          label="Hapus template"
          armed={used.length ? `Yakin? ${used.length} project kehilangan value chain` : 'Yakin? Klik lagi'}
          onConfirm={() => void run((x) => x.from('step_templates').delete().eq('id', t.id), 'Template dihapus', [...TABLES])}
        />
      </div>
    </section>
  )
}

function StepRow({ s }: { s: TemplateStep }) {
  const { run, busy } = useAdminWrite()
  const [no, setNo] = useState(s.no)
  const [name, setName] = useState(s.name)
  const [need, setNeed] = useState(s.need)
  const [kind, setKind] = useState<StepKind>(s.kind)
  const [sort, setSort] = useState(String(s.sort))
  const dirty = no !== s.no || name !== s.name || need !== s.need || kind !== s.kind || sort !== String(s.sort)
  return (
    <div className="mrow" style={{ gridTemplateColumns: '90px 50px minmax(0,0.8fr) minmax(0,1.4fr) 150px 56px auto auto' }}>
      <code className="sub">{s.code}</code>
      <input className="inp" aria-label="Nomor" value={no} onChange={(e) => setNo(e.target.value)} maxLength={8} />
      <input className="inp" aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <input className="inp" aria-label="Yang dibutuhkan" placeholder="Yang dibutuhkan" value={need} onChange={(e) => setNeed(e.target.value)} maxLength={500} />
      <select className="inp" aria-label="Jenis" value={kind} onChange={(e) => setKind(e.target.value as StepKind)}>
        {KINDS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <input className="inp" aria-label="Urutan" inputMode="numeric" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ''))} />
      <button
        className="btn sm"
        disabled={!dirty || busy || !name.trim()}
        onClick={() =>
          void run(
            (x) => x.from('template_steps').update({ label_no: no, name: name.trim(), need, kind, sort: Number(sort) || 0 }).eq('id', s.id),
            'Step disimpan',
            [...TABLES],
          )
        }
      >
        Simpan
      </button>
      <TwoStep
        className="btn sm ghost"
        label="Hapus"
        armed="Yakin?"
        onConfirm={() => void run((x) => x.from('template_steps').delete().eq('id', s.id), 'Step dihapus', [...TABLES])}
      />
    </div>
  )
}
