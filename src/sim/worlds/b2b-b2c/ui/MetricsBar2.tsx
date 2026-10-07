// World 2 metrics bar (brief 2 §7.3): five live figures, each clickable to its trace. The
// figures come from metrics2.ts, shared with the 3D KPI cards.

import type { Computed2 } from '../engine/index.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import type { Trace } from '../../../core/trace.ts'
import { metricItems2 } from './metrics2.ts'

interface MetricsBar2Props {
  data: Computed2
  day: number
  follow: PrincipalId | null
  followPlatform: string | null
  onTrace: (t: Trace) => void
}

export function MetricsBar2({ data, day, follow, followPlatform, onTrace }: MetricsBar2Props) {
  const { items } = metricItems2(data, day, follow, followPlatform)
  return (
    <div className="sim-metrics wide" role="group" aria-label="Metrik utama gudang B2B+B2C">
      {items.map((m) => (
        <button
          key={m.label}
          type="button"
          className="sim-metric"
          onClick={() => onTrace(m.trace)}
          style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: 'pointer' }}
          title="Lihat jejak angka"
        >
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{m.label}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
            {m.dot && <span aria-hidden style={{ color: m.dot, marginRight: 6 }}>●</span>}
            {m.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.sub}</div>
        </button>
      ))}
    </div>
  )
}
