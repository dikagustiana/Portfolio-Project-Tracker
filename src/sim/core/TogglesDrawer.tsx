// "Aturan alokasi" drawer (brief §7.9): every toggle with one line on what it changes, plus
// an optional assumed-rate slider. Generic: each world builds the sections; changing a
// toggle recomputes that world's allocations.

export interface ToggleOption {
  value: string
  label: string
  note: string
}

export interface ToggleSection {
  label: string
  options: ToggleOption[]
  current: string
  onSelect: (value: string) => void
}

export interface SliderSection {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  onChange: (v: number) => void
}

interface TogglesDrawerProps {
  open: boolean
  sections: ToggleSection[]
  slider?: SliderSection
  onReset: () => void
  onClose: () => void
}

export function TogglesDrawer({ open, sections, slider, onReset, onClose }: TogglesDrawerProps) {
  if (!open) return null
  return (
    <div role="dialog" aria-label="Aturan alokasi" style={{ position: 'absolute', right: 12, top: 12, bottom: 12, width: 340, maxWidth: '90%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)', padding: 16, overflowY: 'auto', zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <b style={{ fontSize: 14 }}>Aturan alokasi</b>
        <button type="button" className="icon-btn" aria-label="Tutup aturan alokasi" onClick={onClose} style={{ marginLeft: 'auto' }}>
          ✕
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Setiap toggle mengubah cara biaya dibagi. Angka di panel dan metrik ikut terhitung ulang.</div>
      {sections.map((sec) => (
        <div key={sec.label} role="radiogroup" aria-label={sec.label}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{sec.label}</div>
          {sec.options.map((opt) => (
            <label key={opt.value} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', cursor: 'pointer' }}>
              <input type="radio" name={sec.label} checked={sec.current === opt.value} onChange={() => sec.onSelect(opt.value)} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
              <span>
                <b>{opt.label}</b> — <span style={{ color: 'var(--muted)' }}>{opt.note}</span>
              </span>
            </label>
          ))}
        </div>
      ))}
      {slider && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
            {slider.label}: <span style={{ fontFamily: 'var(--f-mono)' }}>{slider.format(slider.value)}</span> (asumsi)
          </div>
          <input type="range" min={slider.min} max={slider.max} step={slider.step} value={slider.value} onChange={(e) => slider.onChange(Number(e.currentTarget.value))} aria-label={slider.label} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)' }}>
            <span>{slider.format(slider.min)}</span>
            <span>{slider.format(slider.max)}</span>
          </div>
        </div>
      )}
      <button type="button" className="btn ghost" onClick={onReset} style={{ alignSelf: 'flex-start' }}>
        Kembalikan default
      </button>
    </div>
  )
}
