// Generic waterfall (brief §7.8): from a starting value down (or up) to the result, one
// bar per step with the value on every bar. Worlds build the steps; this only draws.

import { formatRpShort } from './format.ts'

export interface WaterfallStep {
  label: string
  value: number
  /** 'start' renders in the row colour, 'result' in the done/danger colour. */
  kind?: 'start' | 'cost' | 'result'
}

export function Waterfall({ title, steps, color, accent }: { title: string; steps: WaterfallStep[]; color?: string; accent?: string }) {
  const max = Math.max(...steps.map((s) => Math.abs(s.value)), 1)
  const resultColor = (steps[steps.length - 1]?.value ?? 0) >= 0 ? 'var(--s-done)' : 'var(--danger)'
  return (
    <div role="img" aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b style={{ fontSize: 13 }}>{title}</b>
      {steps.map((s, i) => {
        const isResult = i === steps.length - 1 && s.kind !== 'cost' ? true : s.kind === 'result'
        const barColor = isResult ? resultColor : s.kind === 'start' ? color ?? 'var(--accent)' : accent ?? 'var(--muted)'
        return (
          <div key={s.label + i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 2 }}>
              <span style={{ fontWeight: isResult || s.kind === 'start' ? 800 : 500 }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: isResult ? resultColor : 'var(--ink)' }}>
                {s.value >= 0 ? '+' : '−'}
                {formatRpShort(Math.abs(s.value))}
              </span>
            </div>
            <div style={{ position: 'relative', height: 12, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }} aria-hidden>
              <div style={{ position: 'absolute', left: `${Math.max(0, ((max - Math.abs(s.value)) / 2 / max) * 100)}%`, width: `${(Math.abs(s.value) / max) * 100}%`, height: '100%', background: barColor, borderRadius: 6 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
