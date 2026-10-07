// World 2 metrics bar (brief 2 §7.3): five live figures, each clickable to its trace.

import type { Computed2 } from '../engine/index.ts'
import type { PlatformId } from '../engine/config.ts'
import { PLATFORMS } from '../engine/config.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import { PLATFORM_COLOR as _PC } from './colors2.ts'
import { num, trace } from '../../../core/trace.ts'
import type { Trace } from '../../../core/trace.ts'
import { formatDays, formatNumber, formatRp, formatRpShort } from '../../../core/format.ts'

interface MetricsBar2Props {
  data: Computed2
  day: number
  follow: PrincipalId | null
  followPlatform: string | null
  onTrace: (t: Trace) => void
}

export function MetricsBar2({ data, day, follow, followPlatform, onTrace }: MetricsBar2Props) {
  const { world, alloc } = data
  const shipped = world.orders.filter((o) => o.shipDay <= day)
  const b2cCost = alloc.perOrder.filter((x) => shipped.some((o) => o.id === x.id)).reduce((s, x) => s + x.fee + x.sellerShipping + x.packaging + x.returnCost + x.teamCost + x.sharedCost + x.capital, 0)
  const costPerOrder = shipped.length > 0 ? b2cCost / shipped.length : 0
  const dosB2b = world.b2b.dos.filter((d) => d.day <= day)
  const b2bCost = alloc.b2bAlloc.trips.filter((t) => t.trip.day <= day).reduce((s, t) => s + t.absorbed, 0)
  const costPerDo = dosB2b.length > 0 ? b2bCost / dosB2b.length : 0
  const sharedTotal = alloc.pools.filter((p) => p.byPrincipal).reduce((s, p) => s + p.total, 0)
  const sharedB2b = alloc.pools.filter((p) => p.byPrincipal).reduce((s, p) => s + p.b2b, 0)
  const contribution =
    followPlatform && PLATFORMS.some((p) => p.id === followPlatform)
      ? alloc.platform[followPlatform as PlatformId].contribution
      : follow
        ? alloc.principalChannel[follow].b2b + alloc.principalChannel[follow].b2c
        : null
  const contributionTrace =
    followPlatform && PLATFORMS.some((p) => p.id === followPlatform)
      ? trace(`Kontribusi ${followPlatform}`, 'rp', '{0} − {1}', [num('pendapatan net', alloc.platform[followPlatform as PlatformId].gmv - alloc.platform[followPlatform as PlatformId].voucher - alloc.platform[followPlatform as PlatformId].fee, 'rp'), num('biaya', alloc.platform[followPlatform as PlatformId].gmv - alloc.platform[followPlatform as PlatformId].voucher - alloc.platform[followPlatform as PlatformId].fee - alloc.platform[followPlatform as PlatformId].contribution, 'rp')], (rev, cost) => rev - cost)
      : follow
        ? trace(`Kontribusi Prinsipal ${follow} (B2B+B2C)`, 'rp', '{0} + {1}', [num('kontribusi B2B', alloc.principalChannel[follow].b2b, 'rp'), num('kontribusi B2C', alloc.principalChannel[follow].b2c, 'rp')], (a, b) => a + b)
        : null
  const items: { label: string; value: string; sub: string; trace: Trace; dot?: string }[] = [
    {
      label: 'Biaya per order B2C',
      value: formatRp(costPerOrder),
      sub: `${formatNumber(shipped.length)} order s.d. hari ini`,
      trace: trace('Biaya per order B2C', 'rp', '{0} / {1}', [num('biaya B2C s.d. hari ini', b2cCost, 'rp'), num('order s.d. hari ini', shipped.length, 'count')], (c, n) => (n > 0 ? c / n : 0)),
    },
    {
      label: 'Biaya per DO B2B',
      value: formatRp(costPerDo),
      sub: `${formatNumber(dosB2b.length)} DO s.d. hari ini`,
      trace: trace('Biaya per DO B2B', 'rp', '{0} / {1}', [num('biaya trip B2B s.d. hari ini', b2bCost, 'rp'), num('DO s.d. hari ini', dosB2b.length, 'count')], (c, n) => (n > 0 ? c / n : 0)),
    },
    {
      label: 'Biaya gudang bersama',
      value: formatRpShort(sharedTotal),
      sub: `B2B ${formatRpShort(sharedB2b)} · B2C ${formatRpShort(sharedTotal - sharedB2b)}`,
      trace: trace('Biaya gudang bersama', 'rp', '{0} + {1}', [num('bagian B2B', sharedB2b, 'rp'), num('bagian B2C', sharedTotal - sharedB2b, 'rp')], (a, b) => a + b),
    },
    {
      label: 'Hari dana tertahan (B2C)',
      value: formatDays(PLATFORMS.reduce((s, p) => s + p.settlementDays * alloc.platform[p.id].orders, 0) / Math.max(1, PLATFORMS.reduce((s, p) => s + alloc.platform[p.id].orders, 0))),
      sub: 'rata-rata tertimbang order selesai',
      trace: trace('Hari dana tertahan B2C', 'day', 'Σ(hari × order) / Σ order', [num('Σ hari × order', PLATFORMS.reduce((s, p) => s + p.settlementDays * alloc.platform[p.id].orders, 0), 'day'), num('Σ order', PLATFORMS.reduce((s, p) => s + alloc.platform[p.id].orders, 0), 'count')], (a, b) => (b > 0 ? a / b : 0)),
    },
    {
      label: 'Kontribusi pilihan',
      value: contribution === null ? 'Pilih prinsipal/platform' : formatRpShort(contribution),
      sub: followPlatform ? `${followPlatform} — ikuti platform` : follow ? `Prinsipal ${follow} — B2B + B2C` : 'Klik ikuti di panel',
      trace: contributionTrace ?? trace('Kontribusi', 'rp', '0', [], () => 0),
      dot: follow ? PRINCIPAL_COLOR[follow] : followPlatform ? _PC[followPlatform] : undefined,
    },
  ]
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
