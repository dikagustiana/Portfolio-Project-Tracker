// The assumption pause (Brief B6 §2.3, §3): at a gap the step's card opens with each missing
// value — name, unit, the role that owns it, why it is needed (and for KGR the gate and its
// owner). Nothing is pre-filled except a value a repository source documents, shown with that
// source. "Simpan sebagai asumsi" continues the run.
import { useId, useState } from 'react'
import { formatNumber } from '../../core/format.ts'
import type { GapDef, Row } from '../types.ts'

const valid = (g: GapDef, raw: string): string | null => {
  if (raw.trim() === '') return 'Isi nilainya'
  const v = Number(raw.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(v)) return 'Bukan angka'
  if (g.min !== undefined && v < g.min) return `Minimal ${formatNumber(g.min)}`
  if (g.max !== undefined && v > g.max) return `Maksimal ${formatNumber(g.max)}`
  if (g.integer && !Number.isInteger(v)) return 'Harus bilangan bulat'
  return null
}
const parse = (raw: string): number => Number(raw.replace(/\./g, '').replace(',', '.'))

export function PauseCard({ row, count, gaps, onSave }: { row: Row; count: number; gaps: GapDef[]; onSave: (values: Record<string, number>) => void }) {
  const uid = useId()
  const [vals, setVals] = useState<Record<string, string>>({})
  const errs = Object.fromEntries(gaps.map((g) => [g.id, valid(g, vals[g.id] ?? '')]))
  const ok = gaps.every((g) => !errs[g.id])
  return (
    <form
      className="sc-pause"
      aria-label="Asumsi dibutuhkan"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onSave(Object.fromEntries(gaps.map((g) => [g.id, parse(vals[g.id] ?? '')])))
      }}
    >
      <span className="yd-kicker">
        Asumsi dibutuhkan · langkah {row.n} dari {count}
      </span>
      <h2 className="yd-title">{row.title}</h2>
      <span className="yd-status warn">engine belum punya nilai ini</span>
      <p className="sc-help">Skenario berhenti di sini. Nilai yang diisi menjadi Asumsi skenario: disimpan di link, ditandai di buku biaya dan didaftar di kartu hasil. Format angka: titik untuk ribuan, koma untuk desimal.</p>
      {gaps.map((g) => {
        const id = `${uid}-${g.id}`
        const e = vals[g.id] !== undefined ? errs[g.id] : null
        return (
          <fieldset key={g.id} className={`sc-gap${e ? ' bad' : ''}`}>
            <legend>{g.label}</legend>
            <label className="sc-num-in" htmlFor={id}>
              <input id={id} inputMode="decimal" autoComplete="off" value={vals[g.id] ?? ''} aria-invalid={!!e} aria-describedby={`${id}-why`} onChange={(ev) => setVals((v) => ({ ...v, [g.id]: ev.target.value }))} />
              <span>{g.unit}</span>
            </label>
            <dl className="sc-cells">
              <dt>Pemilik</dt>
              <dd>{g.owner}</dd>
              {g.gate && (
                <>
                  <dt>Gerbang</dt>
                  <dd>
                    {g.gate}
                    {g.gateOwner ? ` · ${g.gateOwner}` : ''}
                  </dd>
                </>
              )}
            </dl>
            <p className="sc-help" id={`${id}-why`}>
              {g.why}
            </p>
            {g.source && (
              <p className="sc-source">
                Sumber repositori: {g.source.text} · {formatNumber(g.source.value, 2)} {g.unit}{' '}
                <button type="button" onClick={() => setVals((v) => ({ ...v, [g.id]: String(g.source?.value ?? '') }))}>
                  Pakai nilai sumber
                </button>
              </p>
            )}
            {e && (
              <p className="sc-err" role="alert">
                {e}
              </p>
            )}
          </fieldset>
        )
      })}
      <div className="sc-go">
        <button type="submit" className="sc-primary" disabled={!ok}>
          Simpan sebagai asumsi
        </button>
      </div>
    </form>
  )
}
