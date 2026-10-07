// World-2 bindings for the 3D overlay (Brief 3 V2): pure functions from the engine's computed
// state + the clock (day, hour) to what each card shows. Numbers come straight from the
// engine and the shared metric items (metrics2.ts) — nothing here allocates cost.
//
// Intra-day times the engine does not model (when a truck leaves, when a courier picks up,
// when an inbound PO docks) are display-only schedules defined below and listed in
// docs/sim/ASSUMPTIONS.md; they move objects on screen, never a rupiah.

import type { Computed2 } from '../worlds/b2b-b2c/engine/index.ts'
import { COURIERS, PLATFORMS, POOLS } from '../worlds/b2b-b2c/engine/config.ts'
import type { B2cOrder } from '../worlds/b2b-b2c/engine/types.ts'
import { metricItems2 } from '../worlds/b2b-b2c/ui/metrics2.ts'
import type { Metric2, MetricId2 } from '../worlds/b2b-b2c/ui/metrics2.ts'
import { object2ById } from '../worlds/b2b-b2c/ui/objects2.ts'
import type { Kind2 } from '../worlds/b2b-b2c/ui/objects2.ts'
import type { Trace } from '../core/trace.ts'
import { formatClock, formatNumber, formatPct, formatRpCard } from '../core/format.ts'

export type Tone = 'grey' | 'green' | 'amber' | 'blue'
export type ListTab = 'dock' | 'truk' | 'order'

export interface KpiView {
  id: MetricId2
  icon: string
  tone: Tone
  label: string
  value: string
  delta?: { text: string; dir: 'up' | 'down'; hint: string }
  note?: { text: string; hint: string }
  trace: Trace
}

export type Target = { kind: 'object'; id: string } | { kind: 'order'; id: string } | { kind: 'vehicle'; id: string }

export interface ListItemView {
  key: string
  icon: string
  tone: Tone
  name: string
  sub: string
  status: string
  statusTone: Tone
  target: Target
}

export interface TrackView {
  orderId: string
  steps: string[]
  /** Index of the step in progress; steps before it are done. `steps.length` = all done. */
  current: number
  itemLine: string
  subLine: string
  value: string
  valueHint: string
}

export interface RowView {
  k: string
  v: string
  trace?: Trace
}

export interface SelectionView {
  id: string
  icon: string
  tone: Tone
  title: string
  sub: string
  what: string
  rows: RowView[]
  /** A vehicle on the map: the card offers "Ikuti" (camera follows it). */
  followable?: boolean
}

export interface SummaryView {
  title: string
  rows: RowView[]
}

// --- Display-only schedules (ASSUMPTIONS.md, "Brief 3 tampilan") -----------------------------

export const DAY_START = 6
export const DAY_END = 22

/** Courier pickups: two-pickup couriers come at 11.00 and 17.00, one-pickup couriers at 17.00
 *  (after the 16.00 same-day cut-off, so P1 orders can still leave the same day). */
export function pickupHour(courierId: string, pickup: number): number {
  const c = COURIERS.find((x) => x.id === courierId)
  if (!c || c.pickupsPerDay === 1) return 17
  return pickup === 1 ? 11 : 17
}

/** B2B trips leave from 07.00, one every 90 minutes, the last by 14.00; four hours out. */
export function tripDepartHour(indexInDay: number): number {
  return Math.min(14, 7 + indexInDay * 1.5)
}
export const TRIP_HOURS = 4

/** Inbound POs dock from 08.00, one every two hours; unloading takes two hours. */
export function inboundHour(indexInDay: number): number {
  return Math.min(18, 8 + indexInDay * 2)
}

// --- KPI row -----------------------------------------------------------------------------------

const KPI_LOOK: Partial<Record<MetricId2, { icon: string; tone: Tone }>> = {
  costPerOrderB2c: { icon: '📦', tone: 'blue' },
  costPerDoB2b: { icon: '🚚', tone: 'green' },
  sharedWarehouse: { icon: '🏭', tone: 'amber' },
}

/** The three §4 KPI cards. Cost per order/DO compare with the previous day (down = good);
 *  the shared warehouse cost shows its B2B / B2C split instead. */
export function kpis2(data: Computed2, day: number): KpiView[] {
  const now = metricItems2(data, day, null, null)
  const prev = day > 1 ? metricItems2(data, day - 1, null, null) : null
  const out: KpiView[] = []
  for (const m of now.items) {
    const look = KPI_LOOK[m.id]
    if (!look || m.raw === null) continue
    const kpi: KpiView = { id: m.id, icon: look.icon, tone: look.tone, label: m.label, value: formatRpCard(m.raw), trace: m.trace }
    if (m.id === 'sharedWarehouse') {
      const { sharedB2b, sharedB2c } = now.extras
      const charged = sharedB2b + sharedB2c
      const share = charged > 0 ? sharedB2b / charged : 0
      kpi.note =
        charged > 0
          ? { text: `${formatNumber(share * 100)}/${formatNumber((1 - share) * 100)}`, hint: `Porsi B2B / B2C: ${formatPct(share)} ke B2B, ${formatPct(1 - share)} ke B2C` }
          : { text: 'tidak dibagi', hint: 'Tampil sebagai baris sendiri, tidak dibebankan ke channel' }
    } else {
      const before = prev?.items.find((x) => x.id === m.id)?.raw ?? null
      if (before !== null && before > 0 && m.raw > 0) {
        const change = m.raw / before - 1
        const dir = change <= 0 ? 'down' : 'up'
        kpi.delta = { text: formatPct(Math.abs(change)), dir, hint: `${dir === 'down' ? 'turun' : 'naik'} ${formatPct(Math.abs(change))} dari hari ${day - 1}` }
      }
    }
    out.push(kpi)
  }
  return out
}

// --- Lists: Dock / Truk / Order -----------------------------------------------------------------

function tripStatus(depart: number, hour: number): { status: string; tone: Tone } {
  if (hour < depart) return { status: 'Muat', tone: 'amber' }
  if (hour < depart + TRIP_HOURS) return { status: 'Jalan', tone: 'green' }
  return { status: 'Kembali', tone: 'grey' }
}

/** Where an order is at (day, hour), on the six-step flow of the "Pelacakan alur" card. */
export const FLOW_STEPS = ['Order', 'Pick', 'Packing', 'Kurir', 'Selesai', 'Dana']

export function orderStep(o: B2cOrder, day: number, hour: number, data: Computed2): number {
  if (day < o.day || (day === o.day && hour < o.hour)) return -1
  if (day >= o.settlementDay) return FLOW_STEPS.length
  if (day >= o.completeDay && day > o.shipDay) return 5
  if (day > o.shipDay) return 3
  if (day < o.shipDay) return 0
  // Ship day: picked and packed during the day, handed over at the courier's pickup; a
  // same-day completion shows three hours after the handover.
  const start = o.shipDay === o.day ? o.hour : DAY_START + 1
  const pickup = handoverHour(o, data)
  if (hour >= pickup) return day >= o.completeDay && hour >= pickup + 3 ? 5 : 3
  if (hour >= start + 1.5) return 2
  if (hour >= start + 0.5) return 1
  return 0
}

/** Courier pickup that takes this order: the first pickup of its courier at or after the hour
 *  it can be packed (same-day orders) or the day's first pickup (next-day orders). */
export function handoverHour(o: B2cOrder, data: Computed2): number {
  const pickups = data.world.manifests.filter((m) => m.courier === o.courier && m.day === o.shipDay).map((m) => pickupHour(m.courier, m.pickup))
  const ready = o.shipDay === o.day ? o.hour + 1.5 : DAY_START + 2
  const hours = (pickups.length ? pickups : [17]).sort((a, b) => a - b)
  return hours.find((h) => h >= ready) ?? hours[hours.length - 1] ?? 17
}

/** List status by flow position (index = orderStep; 5 = done, waiting for the payout). */
const STEP_STATUS: { status: string; tone: Tone }[] = [
  { status: 'Antre', tone: 'grey' },
  { status: 'Pick', tone: 'amber' },
  { status: 'Packing', tone: 'blue' },
  { status: 'Kurir', tone: 'green' },
  { status: 'Selesai', tone: 'green' },
  { status: 'Selesai', tone: 'green' },
  { status: 'Dana cair', tone: 'green' },
]

export function lists2(data: Computed2, day: number, hour: number): Record<ListTab, ListItemView[]> {
  const { world } = data
  const b2b = world.b2b

  const inbound = b2b.pos.filter((po) => po.arrivalDay === day)
  const dock: ListItemView[] = inbound.slice(0, 4).map((po, i) => {
    const at = inboundHour(i)
    const cartons = po.lines.reduce((s, l) => s + l.cartons, 0)
    const st = hour < at ? { status: 'Dijadwalkan', tone: 'grey' as Tone } : hour < at + 2 ? { status: 'Bongkar', tone: 'amber' as Tone } : { status: 'Masuk rak', tone: 'green' as Tone }
    return { key: po.id, icon: '📥', tone: 'amber', name: `${po.id} · Prinsipal ${po.principal}`, sub: `${formatNumber(cartons)} karton · tiba ${formatClock(at)}`, status: st.status, statusTone: st.tone, target: { kind: 'vehicle', id: `po:${po.id}` } }
  })
  for (const m of world.manifests.filter((x) => x.day === day).slice(0, 6 - dock.length)) {
    const at = pickupHour(m.courier, m.pickup)
    const label = COURIERS.find((c) => c.id === m.courier)?.label ?? m.courier
    dock.push({ key: m.id, icon: '🛵', tone: 'green', name: `${m.id} · ${label}`, sub: `${formatNumber(m.packages)} paket · jemput ${formatClock(at)}`, status: hour < at ? 'Antre' : 'Diserahkan', statusTone: hour < at ? 'grey' : 'green', target: { kind: 'vehicle', id: `mf:${m.id}` } })
  }

  const truk: ListItemView[] = b2b.trips
    .filter((t) => t.day === day)
    .slice(0, 6)
    .map((t, i) => {
      const depart = tripDepartHour(i)
      const st = tripStatus(depart, hour)
      return { key: t.id, icon: '🚚', tone: 'blue', name: `${t.truckCode} · Zona ${t.zone}`, sub: `${t.dos.length} DO · ${formatNumber(t.kg)} kg · berangkat ${formatClock(depart)}`, status: st.status, statusTone: st.tone, target: { kind: 'vehicle', id: `trip:${t.id}` } }
    })

  const order: ListItemView[] = world.orders
    .filter((o) => o.day === day && o.hour <= hour)
    .sort((a, b) => b.hour - a.hour || b.id.localeCompare(a.id))
    .slice(0, 6)
    .map((o) => {
      const st = STEP_STATUS[Math.max(0, Math.min(STEP_STATUS.length - 1, orderStep(o, day, hour, data)))] ?? { status: 'Antre', tone: 'grey' as Tone }
      return { key: o.id, icon: o.priority === 'P0' ? '⚡' : '📦', tone: o.priority === 'P2' ? 'blue' : 'amber', name: `${o.id} · ${PLATFORMS.find((p) => p.id === o.platform)?.label ?? o.platform}`, sub: `${o.priority} · masuk ${formatClock(o.hour)}`, status: st.status, statusTone: st.tone, target: { kind: 'order', id: o.id } }
    })

  return { dock, truk, order }
}

// --- "Pelacakan alur" ---------------------------------------------------------------------------

/** The order the flow card follows: the one asked for, else the latest same-day (P1) order
 *  placed by now, else the latest order of the day, else the first order of the month. */
export function pickTrackedOrder(data: Computed2, day: number, hour: number, orderId: string | null): B2cOrder | undefined {
  const { orders } = data.world
  if (orderId) {
    const o = orders.find((x) => x.id === orderId)
    if (o) return o
  }
  const placed = orders.filter((o) => o.day === day && o.hour <= hour)
  return [...placed].reverse().find((o) => o.priority === 'P1') ?? placed[placed.length - 1] ?? orders.find((o) => o.day === day) ?? orders[0]
}

export function track2(data: Computed2, day: number, hour: number, orderId: string | null): TrackView | null {
  const o = pickTrackedOrder(data, day, hour, orderId)
  if (!o) return null
  const pieces = o.items.reduce((s, i) => s + i.pieces, 0)
  const box = o.box
  const platform = PLATFORMS.find((p) => p.id === o.platform)?.label ?? o.platform
  return {
    orderId: o.id,
    steps: FLOW_STEPS,
    current: Math.max(0, orderStep(o, day, hour, data)),
    itemLine: `${formatNumber(pieces)} item · ${box}`,
    subLine: `${platform} · ${o.priority} · berat tagih ${formatNumber(o.chargeableKg, 1)} kg`,
    value: formatRpCard(o.netSettlement),
    valueHint: `Dana cair hari ${o.settlementDay} (setelah fee dan voucher)`,
  }
}

// --- Selected object + day summary ----------------------------------------------------------

const KIND_LOOK: Record<Kind2, { icon: string; tone: Tone }> = {
  platform: { icon: '🛍', tone: 'blue' },
  oms: { icon: '💻', tone: 'blue' },
  isdZone: { icon: '⚡', tone: 'amber' },
  returnsDesk: { icon: '🔄', tone: 'amber' },
  csDesk: { icon: '🎧', tone: 'blue' },
  shopDesk: { icon: '🏪', tone: 'blue' },
  settleLedger: { icon: '📒', tone: 'green' },
  bank: { icon: '🏦', tone: 'green' },
  dock: { icon: '📥', tone: 'amber' },
  bulkRack: { icon: '🏬', tone: 'blue' },
  replLane: { icon: '🔁', tone: 'amber' },
  pickFace: { icon: '🧺', tone: 'blue' },
  regularPick: { icon: '🛒', tone: 'blue' },
  packing: { icon: '📦', tone: 'blue' },
  boxShelf: { icon: '📚', tone: 'blue' },
  dispatch: { icon: '🏷', tone: 'green' },
  courierLane: { icon: '🛵', tone: 'green' },
  courierBay: { icon: '🛵', tone: 'green' },
  b2bLane: { icon: '🚚', tone: 'blue' },
}

const POOL_OF_KIND: Partial<Record<Kind2, string>> = {
  dock: 'inbound',
  bulkRack: 'storage',
  replLane: 'replenishment',
  pickFace: 'pickers',
  regularPick: 'pickers',
  packing: 'packers',
  boxShelf: 'packers',
  dispatch: 'dispatchers',
  courierLane: 'dispatchers',
  courierBay: 'dispatchers',
  isdZone: 'isd',
  returnsDesk: 'returnsDesk',
  csDesk: 'cs',
  shopDesk: 'shopMgmt',
  oms: 'shopMgmt',
}

/** `metrics`: metricItems2 for the same day (computed once by the caller). */
export function selection2(data: Computed2, day: number, hour: number, id: string, metrics: Metric2[]): SelectionView | null {
  const o = object2ById(id)
  if (!o) return null
  const { world, alloc } = data
  const look = KIND_LOOK[o.kind]
  const rows: RowView[] = []
  const today = world.orders.filter((x) => x.day === day)
  const shippedToday = world.orders.filter((x) => x.shipDay === day)

  switch (o.kind) {
    case 'dock': {
      const pos = world.b2b.pos.filter((p) => p.arrivalDay === day)
      rows.push({ k: 'PO tiba hari ini', v: formatNumber(pos.length) })
      rows.push({ k: 'Karton masuk', v: formatNumber(pos.reduce((s, p) => s + p.lines.reduce((t, l) => t + l.cartons, 0), 0)) })
      break
    }
    case 'bulkRack':
    case 'replLane':
    case 'pickFace': {
      const ledger = world.ledger.filter((r) => r.day === day)
      rows.push({ k: 'Stok akhir hari (unit)', v: formatNumber(ledger.reduce((s, r) => s + r.close, 0)) })
      rows.push({ k: 'Replenish hari ini (unit)', v: formatNumber(world.pickFace.filter((f) => f.day === day).reduce((s, f) => s + f.replenishedPieces, 0)) })
      break
    }
    case 'regularPick':
    case 'packing':
    case 'boxShelf': {
      rows.push({ k: 'Paket dikemas hari ini', v: formatNumber(shippedToday.length) })
      rows.push({ k: 'Menit standar B2C / B2B', v: `${formatNumber(alloc.outbound.b2cMinutes)} / ${formatNumber(alloc.outbound.b2bMinutes)}` })
      break
    }
    case 'dispatch':
    case 'courierLane':
    case 'courierBay': {
      const lane = o.courier ? shippedToday.filter((x) => x.courier === o.courier) : shippedToday
      const mf = world.manifests.filter((m) => m.day === day && (!o.courier || m.courier === o.courier))
      rows.push({ k: 'Paket diserahkan hari ini', v: formatNumber(lane.length) })
      rows.push({ k: 'Manifest hari ini', v: formatNumber(mf.length) })
      const next = mf.map((m) => pickupHour(m.courier, m.pickup)).filter((h) => h > hour).sort((a, b) => a - b)[0]
      rows.push({ k: 'Jemput berikutnya', v: next === undefined ? 'besok' : formatClock(next) })
      break
    }
    case 'b2bLane': {
      const trips = world.b2b.trips.filter((t) => t.day === day)
      rows.push({ k: 'Trip hari ini', v: formatNumber(trips.length) })
      rows.push({ k: 'DO hari ini', v: formatNumber(world.b2b.dos.filter((d) => d.day === day).length) })
      const m = metrics.find((x) => x.id === 'costPerDoB2b')
      if (m && m.raw !== null) rows.push({ k: 'Biaya per DO s.d. hari ini', v: formatRpCard(m.raw), trace: m.trace })
      break
    }
    case 'oms':
      rows.push({ k: 'Order masuk hari ini', v: formatNumber(today.length) })
      rows.push({ k: 'P0 · P1 · P2', v: (['P0', 'P1', 'P2'] as const).map((p) => today.filter((x) => x.priority === p).length).join(' · ') })
      break
    case 'isdZone': {
      const p0p1 = today.filter((x) => x.priority !== 'P2').length
      rows.push({ k: 'Order P0 + P1 hari ini', v: formatNumber(p0p1) })
      const p1 = alloc.priority.find((x) => x.priority === 'P1')
      const p2 = alloc.priority.find((x) => x.priority === 'P2')
      if (p1 && p2) rows.push({ k: 'Harga kecepatan (P1 − P2)', v: `${formatRpCard(p1.avgCost - p2.avgCost)} / order` })
      break
    }
    case 'returnsDesk':
      rows.push({ k: 'Retur hari ini', v: formatNumber(world.orders.filter((x) => x.returned && x.returnDay === day).length) })
      rows.push({ k: 'Retur s.d. hari ini', v: formatNumber(world.orders.filter((x) => x.returned && x.returnDay <= day).length) })
      break
    case 'csDesk':
    case 'shopDesk':
      rows.push({ k: 'Order masuk hari ini', v: formatNumber(today.length) })
      break
    case 'platform': {
      const pf = PLATFORMS.find((p) => p.id === o.platform)
      if (pf) {
        const v = alloc.platform[pf.id]
        rows.push({ k: 'Order hari ini', v: formatNumber(today.filter((x) => x.platform === pf.id).length) })
        rows.push({ k: 'Kontribusi sebulan', v: formatRpCard(v.contribution) })
        rows.push({ k: 'Cut-off · settlement', v: `${formatClock(pf.cutoffHour)} · ${pf.settlementDays} hari` })
      }
      break
    }
    case 'settleLedger':
    case 'bank': {
      const cair = world.orders.filter((x) => x.settlementDay === day)
      rows.push({ k: 'Dana cair hari ini', v: formatRpCard(cair.reduce((s, x) => s + x.netSettlement, 0)) })
      rows.push({ k: 'Order yang cair', v: formatNumber(cair.length) })
      break
    }
  }
  const poolId = POOL_OF_KIND[o.kind]
  const pool = poolId ? alloc.pools.find((p) => p.id === poolId) : undefined
  if (pool) rows.push({ k: `Biaya tim ${POOLS.find((p) => p.id === pool.id)?.team.toLowerCase() ?? pool.team} (sebulan)`, v: formatRpCard(pool.total), trace: pool.totalTrace })
  return { id: o.id, icon: look.icon, tone: look.tone, title: o.label, sub: `${o.step} · ${o.team}`, what: o.what, rows }
}

/** `metrics`: metricItems2 for the same day and follow state (computed once by the caller). */
export function summary2(data: Computed2, day: number, hour: number, metrics: Metric2[]): SummaryView {
  const { world } = data
  const placed = world.orders.filter((o) => o.day === day && o.hour <= hour)
  const handed = world.orders.filter((o) => o.shipDay === day && handoverHour(o, data) <= hour)
  const rows: RowView[] = [
    { k: 'Order masuk s.d. jam ini', v: formatNumber(placed.length) },
    { k: 'Paket diserahkan ke kurir', v: formatNumber(handed.length) },
    { k: 'DO B2B hari ini', v: formatNumber(world.b2b.dos.filter((d) => d.day === day).length) },
    { k: 'Retur masuk hari ini', v: formatNumber(world.orders.filter((o) => o.returned && o.returnDay === day).length) },
  ]
  const contribution = metrics.find((m) => m.id === 'contribution')
  if (contribution && contribution.raw !== null) rows.push({ k: contribution.sub, v: formatRpCard(contribution.raw), trace: contribution.trace })
  return { title: `Ringkasan hari ${day}`, rows }
}

/** Search across objects (by label), orders (by id) and B2B trucks (by code). */
export function search2(data: Computed2, q: string): { label: string; sub: string; target: Target }[] {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const out: { label: string; sub: string; target: Target }[] = []
  for (const o of OBJECT_IDS) {
    const obj = object2ById(o)
    if (obj && (obj.label.toLowerCase().includes(s) || obj.step.toLowerCase().includes(s))) out.push({ label: obj.label, sub: obj.step, target: { kind: 'object', id: obj.id } })
  }
  for (const o of data.world.orders) {
    if (out.length >= 8) break
    if (o.id.toLowerCase().includes(s)) out.push({ label: o.id, sub: `${o.platform} · hari ${o.day} · ${o.priority}`, target: { kind: 'order', id: o.id } })
  }
  const truck = data.world.b2b.trips.find((t) => t.truckCode.toLowerCase().includes(s))
  if (truck && out.length < 8) out.push({ label: truck.truckCode, sub: `Truk B2B · hari ${truck.day}`, target: { kind: 'vehicle', id: `trip:${truck.id}` } })
  return out.slice(0, 8)
}

const OBJECT_IDS = ['DOCK2', 'BULK-1', 'REPL', 'PICK-1', 'RPICK', 'PACK', 'BOXES', 'DISP', 'BAY', 'B2B', 'OMS', 'ISD', 'RET', 'CS', 'SHOP', 'LEDGER', 'BANK2', 'PF-MP-A', 'PF-MP-B', 'PF-MP-C', 'PF-MP-D', 'PF-MP-E', 'PF-WEB', 'CL-K1', 'CL-K2', 'CL-K3', 'BULK-2', 'PICK-2']
