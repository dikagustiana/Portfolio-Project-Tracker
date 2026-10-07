// "Aturan alokasi" drawer (brief §7.9): every toggle with its default, one line on what it
// changes, plus the cost-of-capital slider (labelled as an assumption). Changing a toggle
// recomputes the allocations; the metrics animate to their new values.

import type { Toggles } from '../engine/config.ts'
import { TOGGLE_DEFS } from '../engine/config.ts'
import { formatPct } from '../engine/format.ts'

interface TogglesDrawerProps {
  open: boolean
  toggles: Toggles
  onChange: (t: Toggles) => void
  onClose: () => void
}

export function TogglesDrawer({ open, toggles, onChange, onClose }: TogglesDrawerProps) {
  if (!open) return null
  const set = <K extends keyof Toggles>(key: K, value: Toggles[K]) => onChange({ ...toggles, [key]: value })
  return (
    <div role="dialog" aria-label="Aturan alokasi" style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 340, maxWidth: '90%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)', padding: 16, overflowY: 'auto', zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <b style={{ fontSize: 14 }}>Aturan alokasi</b>
        <button type="button" className="icon-btn" aria-label="Tutup aturan alokasi" onClick={onClose} style={{ marginLeft: 'auto' }}>
          ✕
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Setiap toggle mengubah cara biaya dibagi. Angka di panel dan metrik ikut terhitung ulang.</div>
      {TOGGLE_DEFS.map((def) => (
        <div key={def.key} role="radiogroup" aria-label={def.label}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{def.label}</div>
          {def.key === 'stockCapital' ? (
            def.options.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', cursor: 'pointer' }}>
                <input type="radio" name={def.key} checked={(toggles.stockCapital ? 'on' : 'off') === opt.value} onChange={() => set('stockCapital', opt.value === 'on')} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                <span>
                  <b>{opt.label}</b> — <span style={{ color: 'var(--muted)' }}>{opt.note}</span>
                </span>
              </label>
            ))
          ) : (
            def.options.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={def.key}
                  checked={toggles[def.key] === opt.value}
                  onChange={() => onChange({ ...toggles, [def.key]: opt.value })}
                  style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                />
                <span>
                  <b>{opt.label}</b> — <span style={{ color: 'var(--muted)' }}>{opt.note}</span>
                </span>
              </label>
            ))
          )}
        </div>
      ))}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
          Biaya modal: <span style={{ fontFamily: 'var(--f-mono)' }}>{formatPct(toggles.costOfCapital, 0)}</span> (asumsi)
        </div>
        <input
          type="range"
          min={0}
          max={0.2}
          step={0.005}
          value={toggles.costOfCapital}
          onChange={(e) => set('costOfCapital', Number(e.currentTarget.value))}
          aria-label="Asumsi biaya modal"
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)' }}>
          <span>0%</span>
          <span>20%</span>
        </div>
      </div>
      <button type="button" className="btn ghost" onClick={() => onChange({ volumeMeasure: 'cbm', truckBasis: 'loaded', palletRule: 'std', outboundDriver: 'pallets', taxAllocation: 'allocated', stockCapital: false, costOfCapital: 0.12 })} style={{ alignSelf: 'flex-start' }}>
        Kembalikan default
      </button>
    </div>
  )
}
