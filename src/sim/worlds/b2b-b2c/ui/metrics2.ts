// World 2 headline metrics (brief 2 §7.3) as data: one source for the 2D metrics bar and the
// 3D KPI cards, so both always show the same number with the same trace.

import type { Computed2 } from '../engine/index.ts'
import type { PlatformId } from '../engine/config.ts'
import { PLATFORMS } from '../engine/config.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import { PLATFORM_COLOR } from './colors2.ts'
import { num, trace } from '../../../core/trace.ts'
import type { Trace } from '../../../core/trace.ts'
import { formatDays, formatNumber, formatRp, formatRpShort } from '../../../core/format.ts'

export type MetricId2 = 'costPerOrderB2c' | 'costPerDoB2b' | 'sharedWarehouse' | 'cashDaysB2c' | 'contribution'

export interface Metric2 {
  id: MetricId2
  label: string
  /** The figure itself (null when nothing is followed yet). */
  raw: number | null
  /** House-format value as the 2D bar shows it. */
  value: string
  sub: string
  trace: Trace
  dot?: string
}

export interface Metric2Extras {
  /** Biaya gudang bersama per channel; `sharedUnsplit` is what "Tidak dibagi" leaves uncharged. */
  sharedB2b: number
  sharedB2c: number
  sharedUnsplit: number
  sharedTotal: number
  shippedOrders: number
  dosB2b: number
}

export function metricItems2(data: Computed2, day: number, follow: PrincipalId | null, followPlatform: string | null): { items: Metric2[]; extras: Metric2Extras } {
  const { world, alloc } = data
  const shipped = world.orders.filter((o) => o.shipDay <= day)
  // Same rows in the same order as before (perOrder order), via a Set instead of a nested scan.
  const shippedIds = new Set(shipped.map((o) => o.id))
  const b2cCost = alloc.perOrder.filter((x) => shippedIds.has(x.id)).reduce((s, x) => s + x.fee + x.sellerShipping + x.packaging + x.returnCost + x.teamCost + x.sharedCost + x.capital, 0)
  const costPerOrder = shipped.length > 0 ? b2cCost / shipped.length : 0
  const dosB2b = world.b2b.dos.filter((d) => d.day <= day)
  const b2bCost = alloc.b2bAlloc.trips.filter((t) => t.trip.day <= day).reduce((s, t) => s + t.absorbed, 0)
  const costPerDo = dosB2b.length > 0 ? b2bCost / dosB2b.length : 0
  const sharedPools = alloc.pools.filter((p) => p.byPrincipal)
  const sharedTotal = sharedPools.reduce((s, p) => s + p.total, 0)
  const sharedB2b = sharedPools.reduce((s, p) => s + p.b2b, 0)
  // "Tidak dibagi" leaves the shared cost on its own line: neither channel carries it.
  const sharedB2c = sharedPools.reduce((s, p) => s + p.b2c, 0)
  const sharedUnsplit = sharedPools.reduce((s, p) => s + p.unallocated, 0)
  const followedPlatform = followPlatform && PLATFORMS.some((p) => p.id === followPlatform) ? alloc.platform[followPlatform as PlatformId] : null
  const contribution = followedPlatform ? followedPlatform.contribution : follow ? alloc.principalChannel[follow].b2b + alloc.principalChannel[follow].b2c : null
  const contributionTrace = followedPlatform
    ? trace(`Kontribusi ${followPlatform}`, 'rp', '{0} − {1}', [num('pendapatan net', followedPlatform.gmv - followedPlatform.voucher - followedPlatform.fee, 'rp'), num('biaya', followedPlatform.gmv - followedPlatform.voucher - followedPlatform.fee - followedPlatform.contribution, 'rp')], (rev, cost) => rev - cost)
    : follow
      ? trace(`Kontribusi Prinsipal ${follow} (B2B+B2C)`, 'rp', '{0} + {1}', [num('kontribusi B2B', alloc.principalChannel[follow].b2b, 'rp'), num('kontribusi B2C', alloc.principalChannel[follow].b2c, 'rp')], (a, b) => a + b)
      : null
  const daysWeighted = PLATFORMS.reduce((s, p) => s + p.settlementDays * alloc.platform[p.id].orders, 0)
  const ordersAll = PLATFORMS.reduce((s, p) => s + alloc.platform[p.id].orders, 0)
  const items: Metric2[] = [
    {
      id: 'costPerOrderB2c',
      label: 'Biaya per order B2C',
      raw: costPerOrder,
      value: formatRp(costPerOrder),
      sub: `${formatNumber(shipped.length)} order s.d. hari ini`,
      trace: trace('Biaya per order B2C', 'rp', '{0} / {1}', [num('biaya B2C s.d. hari ini', b2cCost, 'rp'), num('order s.d. hari ini', shipped.length, 'count')], (c, n) => (n > 0 ? c / n : 0)),
    },
    {
      id: 'costPerDoB2b',
      label: 'Biaya per DO B2B',
      raw: costPerDo,
      value: formatRp(costPerDo),
      sub: `${formatNumber(dosB2b.length)} DO s.d. hari ini`,
      trace: trace('Biaya per DO B2B', 'rp', '{0} / {1}', [num('biaya trip B2B s.d. hari ini', b2bCost, 'rp'), num('DO s.d. hari ini', dosB2b.length, 'count')], (c, n) => (n > 0 ? c / n : 0)),
    },
    {
      id: 'sharedWarehouse',
      label: 'Biaya gudang bersama',
      raw: sharedTotal,
      value: formatRpShort(sharedTotal),
      sub: sharedUnsplit > 0 && sharedB2b + sharedB2c === 0 ? 'tidak dibagi ke channel' : `B2B ${formatRpShort(sharedB2b)} · B2C ${formatRpShort(sharedB2c)}`,
      trace: trace('Biaya gudang bersama', 'rp', '{0} + {1} + {2}', [num('bagian B2B', sharedB2b, 'rp'), num('bagian B2C', sharedB2c, 'rp'), num('tidak dibagi ke channel', sharedUnsplit, 'rp')], (a, b, c) => a + b + c),
    },
    {
      id: 'cashDaysB2c',
      label: 'Hari dana tertahan (B2C)',
      raw: daysWeighted / Math.max(1, ordersAll),
      value: formatDays(daysWeighted / Math.max(1, ordersAll)),
      sub: 'rata-rata tertimbang order selesai',
      trace: trace('Hari dana tertahan B2C', 'day', 'Σ(hari × order) / Σ order', [num('Σ hari × order', daysWeighted, 'day'), num('Σ order', ordersAll, 'count')], (a, b) => (b > 0 ? a / b : 0)),
    },
    {
      id: 'contribution',
      label: 'Kontribusi pilihan',
      raw: contribution,
      value: contribution === null ? 'Pilih prinsipal/platform' : formatRpShort(contribution),
      sub: followPlatform ? `${followPlatform} — ikuti platform` : follow ? `Prinsipal ${follow} — B2B + B2C` : 'Klik ikuti di panel',
      trace: contributionTrace ?? trace('Kontribusi', 'rp', '0', [], () => 0),
      dot: follow ? PRINCIPAL_COLOR[follow] : followPlatform ? PLATFORM_COLOR[followPlatform] : undefined,
    },
  ]
  return { items, extras: { sharedB2b, sharedB2c, sharedUnsplit, sharedTotal, shippedOrders: shipped.length, dosB2b: dosB2b.length } }
}
