// Drawer bodies for the 3D overlay. "Aturan alokasi" uses world 2's own toggle definitions
// (TOGGLE_DEFS + the cost-of-capital slider): picking an option recomputes the allocation and
// every card follows (brief §7.9, control 9 visible through "Jejak angka").

import { DEFAULT_TOGGLES, TOGGLE_DEFS } from '../worlds/b2b-b2c/engine/config.ts'
import type { Toggles2 } from '../worlds/b2b-b2c/engine/config.ts'
import { formatPct } from '../core/format.ts'

export function RulesBody({ toggles, onChange }: { toggles: Toggles2; onChange: (t: Toggles2) => void }) {
  return (
    <>
      <div className="s3-note">Setiap pilihan mengubah cara biaya dibagi. Semua kartu ikut dihitung ulang.</div>
      {TOGGLE_DEFS.map((def) => {
        const current = String(typeof toggles[def.key] === 'boolean' ? (toggles[def.key] ? 'on' : 'off') : toggles[def.key])
        const note = def.options.find((o) => o.value === current)?.note
        return (
          <div key={def.key}>
            <div className="s3-field-label">{def.label}</div>
            <div className="s3-options" role="radiogroup" aria-label={def.label}>
              {def.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={current === opt.value}
                  className="s3-seg"
                  onClick={() => onChange({ ...toggles, [def.key]: opt.value === 'on' ? true : opt.value === 'off' ? false : opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {note && <div className="s3-note" style={{ marginTop: 5 }}>{note}</div>}
          </div>
        )
      })}
      <div>
        <div className="s3-field-label">Biaya modal: {formatPct(toggles.costOfCapital, 1)} per tahun (asumsi)</div>
        <input type="range" className="s3-range" min={0} max={0.2} step={0.005} value={toggles.costOfCapital} aria-label="Biaya modal" aria-valuetext={formatPct(toggles.costOfCapital, 1)} onChange={(e) => onChange({ ...toggles, costOfCapital: Number(e.target.value) })} />
      </div>
      <button type="button" className="s3-action" style={{ flex: 'none', padding: '7px 0' }} onClick={() => onChange(DEFAULT_TOGGLES)}>
        Kembalikan ke bawaan
      </button>
    </>
  )
}
