// The input drawer (Brief B6 §3 "Entry"): the world's inputs with validation, a live conversion
// preview computed from the engine, the presets, and Mulai.
import { useId } from 'react'
import type { AnyScenario } from '../types.ts'
import { BADGE_LABEL } from '../types.ts'
import { FigView, LineView } from './Fig.tsx'

type Rec = Record<string, unknown>

export function Drawer({ def, inputs, onChange, onStart, onClose }: { def: AnyScenario; inputs: object; onChange: (next: object) => void; onStart: () => void; onClose: () => void }) {
  const uid = useId()
  const errors = def.validate(inputs)
  const ok = Object.keys(errors).length === 0
  const rec = inputs as Rec
  const set = (id: string, v: unknown): void => {
    const next = { ...rec, [id]: v }
    onChange(def.adjust ? def.adjust(next, inputs) : next)
  }
  const preview = def.preview(inputs)
  const table = def.previewTable?.(inputs) ?? null
  const previewView = (
    <section className="sc-preview" aria-live="polite" aria-label="Konversi">
      <span className="yd-kicker">Konversi</span>
      {preview.map((l, k) => [
        <p key={k} className={k === 0 ? 'lead' : undefined}>
          <LineView l={l} />
        </p>,
        k === 0 && table ? (
          <table key="t" className="sc-ptable">
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.cells.map((c, j) => (
                    <td key={j}>
                      <FigView f={{ ...c, unit: '' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null,
      ])}
    </section>
  )
  return (
    <form
      className="sc-drawer"
      aria-label={`Jalankan skenario · ${def.title}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onStart()
      }}
    >
      <div className="yd-head">
        <span className="yd-kicker">Jalankan skenario · {def.title.replace(/^Skenario /, '')}</span>
        <button type="button" className="yd-icon" aria-label="Tutup skenario" title="Tutup" onClick={onClose}>
          ×
        </button>
      </div>
      <section className="sc-presets" aria-label="Preset">
        <span className="yd-kicker">Preset</span>
        {def.presets.map((p) => (
          <button key={p.id} type="button" onClick={() => onChange(p.inputs)} aria-pressed={JSON.stringify(p.inputs) === JSON.stringify(inputs)}>
            {p.label}
            <span className={`sc-badge sc-b-${p.badge}`} data-tip={p.note ?? BADGE_LABEL[p.badge]} tabIndex={0}>
              {BADGE_LABEL[p.badge]}
            </span>
          </button>
        ))}
      </section>
      {def.fields.map((f) => {
        if (f.show && !f.show(inputs)) return null
        const err = errors[f.id]
        const id = `${uid}-${f.id}`
        return [
          <fieldset key={f.id} className={`sc-field${err ? ' bad' : ''}`} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}>
            <legend className="yd-kicker">{f.label}</legend>
            {f.kind === 'seg' && (
              <div className="yd-seg" role="radiogroup" aria-label={f.label}>
                {f.options(inputs).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={rec[f.id] === v} onClick={() => set(f.id, v)}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {f.kind === 'number' && (
              <label className="sc-num-in">
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  step={f.step}
                  value={Number.isFinite(rec[f.id]) ? String(rec[f.id]) : ''}
                  onChange={(e) => set(f.id, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                />
                {f.choice ? (
                  <span className="yd-seg" role="radiogroup" aria-label="Satuan">
                    {f.choice.options.map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={rec[f.choice?.id ?? ''] === v} onClick={() => set(f.choice?.id ?? '', v)}>
                        {l}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span>{f.unit(inputs)}</span>
                )}
              </label>
            )}
            {f.kind === 'checks' &&
              f.groups(inputs).map((g) => (
                <div key={g.label || 'all'} className="sc-checks" role="group" aria-label={g.label || f.label}>
                  {g.label && <span className="sc-glabel">{g.label}</span>}
                  {g.options.map(([v, l]) => {
                    const list = (rec[f.id] as string[] | undefined) ?? []
                    const on = list.includes(v)
                    return (
                      <label key={v} className={on ? 'on' : undefined}>
                        <input type="checkbox" checked={on} onChange={() => set(f.id, on ? list.filter((x) => x !== v) : [...list, v])} />
                        {l}
                      </label>
                    )
                  })}
                </div>
              ))}
            {f.help && <p className="sc-help">{f.help}</p>}
            {err && (
              <p className="sc-err" id={`${id}-err`} role="alert">
                {err}
              </p>
            )}
          </fieldset>,
          f.id === def.previewAfter ? <div key="preview">{previewView}</div> : null,
        ]
      })}
      {!def.previewAfter && previewView}
      <div className="sc-go">
        <button type="submit" className="sc-primary" disabled={!ok}>
          Mulai
        </button>
        <span>{ok ? `${def.count} langkah; berhenti di setiap data yang belum ada di engine.` : 'Perbaiki isian yang ditandai.'}</span>
      </div>
    </form>
  )
}
