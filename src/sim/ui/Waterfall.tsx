// Waterfall (brief §7.8): from gross profit down to contribution, one bar per cost step
// with the value on every bar, for the followed principal.

import type { Computed } from '../engine/index.ts'
import type { PrincipalId } from '../engine/config.ts'
import { formatRpShort } from '../engine/format.ts'
import { POOLS } from '../engine/config.ts'
import { PRINCIPAL_COLOR } from './colors.ts'

const TEAM_LABEL: Record<string, string> = Object.fromEntries(POOLS.map((p) => [p.id, p.team]))

export function Waterfall({ data, principal }: { data: Computed; principal: PrincipalId }) {
  const r = data.alloc.principal[principal]
  const steps: { label: string; value: number }[] = [
    { label: 'Laba kotor', value: r.grossProfit },
    ...Object.entries(r.poolCost)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({ label: TEAM_LABEL[k] ?? k, value: -(v ?? 0) })),
    { label: 'Armada (truk)', value: -r.tripCost },
    { label: 'Modal kas', value: -r.capitalCash },
    ...(r.capitalStock > 0 ? [{ label: 'Modal persediaan', value: -r.capitalStock }] : []),
    { label: 'Kontribusi', value: r.contribution },
  ]
  const max = Math.max(...steps.map((s) => Math.abs(s.value)))
  // Running level for the waterfall.
  let level = 0
  const bars = steps.map((s) => {
    const start = s.label === 'Kontribusi' ? 0 : level
    level += s.value
    const end = s.label === 'Kontribusi' ? r.contribution : level
    return { ...s, start, end }
  })
  return (
    <div role="img" aria-label={`Waterfall Prinsipal ${principal}: laba kotor ke kontribusi`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b style={{ fontSize: 13 }}>
        Waterfall Prinsipal {principal}
      </b>
      {bars.map((b) => {
        const positive = b.value >= 0
        const top = Math.max(b.start, b.end)
        const bottom = Math.min(b.start, b.end)
        const heightPct = (Math.abs(b.value) / max) * 100
        return (
          <div key={b.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 2 }}>
              <span style={{ fontWeight: b.label === 'Kontribusi' || b.label === 'Laba kotor' ? 800 : 500 }}>{b.label}</span>
              <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: b.label === 'Kontribusi' ? (r.contribution >= 0 ? 'var(--s-done)' : 'var(--danger)') : 'var(--ink)' }}>
                {positive ? '+' : '−'}
                {formatRpShort(Math.abs(b.value))}
              </span>
            </div>
            <div style={{ position: 'relative', height: 12, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }} aria-hidden>
              <div
                style={{
                  position: 'absolute',
                  left: `${(Math.min(bottom, top) / max) * 100}%`,
                  width: `${heightPct}%`,
                  height: '100%',
                  background: b.label === 'Kontribusi' ? (r.contribution >= 0 ? 'var(--s-done)' : 'var(--danger)') : b.label === 'Laba kotor' ? PRINCIPAL_COLOR[principal] : 'var(--muted)',
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
