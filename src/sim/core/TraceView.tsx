// "Jejak angka" (brief §7.7): the formula and its inputs, each input clickable when it
// carries its own trace. The value is recomputed from the inputs on every render and
// shown next to the stored value — control 9 made visible.

import { useState } from 'react'
import type { Trace, TraceInput } from './trace.ts'
import { verifyTrace } from './trace.ts'
import { formatNumber } from './format.ts'

const UNIT_LABEL: Record<string, string> = {
  rp: 'Rp', m3: 'm³', kg: 'kg', km: 'km', day: 'hari', pallet: 'palet', palletDay: 'palet-hari',
  carton: 'karton', count: '×', pct: '%', po: 'PO', invoice: 'invoice', trip: 'trip',
}

function inputValue(i: TraceInput): string {
  const n = formatNumber(i.value, i.value < 10 && i.value % 1 !== 0 ? 2 : 0)
  return i.unit === 'rp' ? `Rp ${n}` : i.unit === 'pct' ? `${formatNumber(i.value * 100, 1)}%` : `${n} ${UNIT_LABEL[i.unit] ?? i.unit}`
}

export function TraceView({ root, onBack, onClose }: { root: Trace; onBack?: () => void; onClose: () => void }) {
  const [path, setPath] = useState<Trace[]>([])
  const current = path[path.length - 1] ?? root
  const ok = verifyTrace(current)
  return (
    <div className="sim-trace" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {path.length > 0 && (
          <button type="button" className="btn ghost" onClick={() => setPath(path.slice(0, -1))} style={{ padding: '2px 10px' }}>
            ← Kembali
          </button>
        )}
        {path.length === 0 && onBack && (
          <button type="button" className="btn ghost" onClick={onBack} style={{ padding: '2px 10px' }}>
            ← Panel
          </button>
        )}
        <b style={{ fontSize: 13 }}>{current.label}</b>
        <span
          title={ok ? 'Formula menghitung ulang ke nilai yang sama' : 'Tidak cocok — seharusnya tidak pernah terjadi'}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: ok ? 'var(--s-done)' : 'var(--danger)' }}
        >
          {ok ? '✓ hitung ulang sama' : '✗ tidak cocok'}
        </span>
        <button type="button" className="icon-btn" aria-label="Tutup jejak angka" onClick={onClose} style={{ marginLeft: path.length || onBack ? 0 : 'auto' }}>
          ✕
        </button>
      </div>
      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
        {current.formula.replace(/\{(\d+)\}/g, (_, k) => inputValue(current.inputs[Number(k)] ?? { value: 0, unit: 'count', label: '' }))}
        <span style={{ color: 'var(--muted)' }}> = </span>
        <b>{inputValue({ label: current.label, value: current.value, unit: current.unit })}</b>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {current.inputs.map((rawInput, idx) => {
          const i = rawInput
          const refTrace = i.ref
          return (
          <li key={idx}>
            {refTrace ? (
              <button
                type="button"
                onClick={() => setPath([...path, refTrace])}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'var(--accent-soft)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                title="Klik untuk menelusuri angka ini"
              >
                <span>{i.label} ↗</span>
                <b style={{ fontFamily: 'var(--f-mono)' }}>{inputValue(i)}</b>
              </button>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', border: '1px dashed var(--line)', borderRadius: 8 }}>
                <span style={{ color: 'var(--muted)' }}>{i.label}</span>
                <b style={{ fontFamily: 'var(--f-mono)' }}>{inputValue(i)}</b>
              </div>
            )}
          </li>
          )
        })}
      </ul>
    </div>
  )
}
