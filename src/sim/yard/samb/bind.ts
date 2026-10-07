// Engine bindings for the yard: every figure a card or the metrics bar shows comes from the
// engine's computed month (world 2's computeAll2, whose B2B exit is the world-1 model), read
// here and formatted with the engine's own formatters. Where the cycle needs something the
// engine does not hold, the card names it as "Belum ada di engine" instead of a number.
// Nothing here changes a cost or an engine number.
import type { Computed2 } from '../../worlds/b2b-b2c/engine/index.ts'
import { metricItems2 } from '../../worlds/b2b-b2c/ui/metrics2.ts'
import { POOLS as POOLS1, TRUCKS, ZONES } from '../../worlds/distribusi/engine/config.ts'
import type { PrincipalId } from '../../core/colors.ts'
import { PRINCIPAL_COLOR } from '../../core/colors.ts'
import { formatM3, formatNumber, formatPct, formatRp, formatRpCard } from '../../core/format.ts'
import type { Trace } from '../../core/trace.ts'
import type { TripAllocation } from '../../worlds/distribusi/engine/cost.ts'

export const MISSING = 'Belum ada di engine'

/** One engine figure on a card: a value (with its trace when the engine has one) or a named gap. */
export type Fig = { label: string; value: string; trace?: Trace } | { label: string; missing: string }

export interface Share {
  p: PrincipalId
  color: string
  value: number
  label: string
}

export interface Card {
  /** small caps line above the title */
  kind: string
  title: string
  status: string
  tone?: 'ok' | 'warn' | 'bad' | 'live'
  channel?: 'B2B' | 'B2C'
  progress?: { v: number; max: number; label: string }
  /** a bar split by principal (m³ on a mixed truck, …) */
  shares?: { label: string; items: Share[] }
  rows: [string, string][]
  /** the cost driver this object moves */
  driver?: string
  engine: Fig[]
  next?: string
  /** open points from the brief, shown as notes (A and B) */
  notes?: string[]
  followable?: boolean
  /** B2B or B2C stage tracker: index of the current stage */
  stage?: { channel: 'B2B' | 'B2C'; at: number; done?: boolean }
}

export const STAGES = {
  B2B: ['Order', 'Pick', 'Muat', 'Jalan', 'Diterima toko', 'Invoice', 'Tukar faktur', 'Dana'],
  B2C: ['Order', 'Pick', 'Packing', 'Kurir', 'Selesai', 'Dana'],
} as const

const PIDS: PrincipalId[] = ['A', 'B', 'C', 'D', 'E', 'F']

// ---- trucks and trips ---------------------------------------------------------------------------

export interface TripView {
  ta: TripAllocation
  cartons: number
  stores: string[]
}

export function tripsOfDay(data: Computed2, day: number): TripView[] {
  const b = data.world.b2b
  const doById = new Map(b.dos.map((d) => [d.id, d]))
  const storeById = new Map(b.stores.map((s) => [s.id, s]))
  return data.alloc.b2bAlloc.trips
    .filter((t) => t.trip.day === day)
    .map((ta) => {
      const dos = ta.trip.dos.map((id) => doById.get(id)).filter((d) => d !== undefined)
      return {
        ta,
        cartons: dos.reduce((s, d) => s + d.lines.reduce((x, l) => x + l.cartons, 0), 0),
        stores: dos.map((d) => storeById.get(d.store)?.code ?? d.store),
      }
    })
}

/** The truck card (brief §5 step 7): three cost groups, m³ per principal, load factor, the split
 *  trip → DO → SKU, cost per carton; drops and detour named as missing. */
export function tripCard(v: TripView, stopsDone: number, status: string, tone: Card['tone'] = 'live', nextStop?: string): Card {
  const { ta } = v
  const t = ta.trip
  const zone = ZONES.find((z) => z.id === t.zone)
  const cls = TRUCKS[t.truckClass]
  const p = ta.parts
  const shares: Share[] = PIDS.filter((id) => ta.measureByPrincipal[id] > 0).map((id) => ({
    p: id, color: PRINCIPAL_COLOR[id], value: ta.measureByPrincipal[id], label: `${id} ${formatM3(ta.measureByPrincipal[id])}`,
  }))
  const firstDo = t.dos[0]
  return {
    kind: `Truk B2B · kelas ${t.truckClass} · ${formatNumber(cls.capacityM3)} m³`,
    title: `${t.truckCode} · ${t.id}`,
    status,
    tone,
    channel: 'B2B',
    progress: { v: ta.physicalM3, max: ta.capacityM3, label: `muatan ${formatPct(ta.loadFactor, 0)} · ${formatM3(ta.physicalM3)} dari ${formatNumber(ta.capacityM3)} m³` },
    shares: { label: `m³ per prinsipal · ${shares.length} prinsipal satu truk`, items: shares },
    rows: [
      ['Zona', `Zona ${t.zone} · ${formatNumber(zone?.oneWayKm ?? 0)} km sekali jalan`],
      ['Pemberhentian', `${formatNumber(Math.min(stopsDone, t.dos.length))} dari ${formatNumber(t.dos.length)} DO diterima`],
      ['Karton', formatNumber(v.cartons)],
    ],
    driver: 'm³ termuat: trip → DO menurut porsi m³ → SKU menurut porsi m³',
    engine: [
      { label: 'Berbasis waktu (sopir + tetap per hari-aset)', value: formatRpCard(p.timeBased, 'full') },
      { label: 'Berbasis jarak (BBM isi + kosong, ban, perawatan)', value: formatRpCard(p.distanceBased, 'full') },
      { label: 'Per trip (overhead, tol, bongkar)', value: formatRpCard(p.perTrip, 'full') },
      { label: 'Biaya trip', value: formatRp(ta.cost), trace: ta.totalTrace },
      ...(firstDo ? [{ label: `${firstDo} (porsi m³)`, value: formatRp(ta.doCost[firstDo] ?? 0), trace: ta.doCostTrace[firstDo] }] : []),
      { label: 'Biaya per karton', value: formatRp(v.cartons > 0 ? ta.absorbed / v.cartons : 0) },
      { label: 'Waktu per drop (0,25 jam) dan faktor detour 1,15', missing: `${MISSING}: engine memakai km zona tetap, jumlah drop tidak memperpanjang trip` },
    ],
    next: stopsDone < t.dos.length ? `Antar ke ${nextStop ?? v.stores[stopsDone] ?? 'toko berikutnya'}, lalu kembali ke pool; surat jalan (DO) yang ditandatangani dibawa ke Finance AR` : 'Kembali ke pool; DO ke Finance AR',
    notes: ['Titik terbuka C: di data SAMB tiap surat jalan milik satu prinsipal; truk campuran butuh tabel trip (truk, sopir, tanggal, km, daftar DO). Engine dummy sudah menggabungkan prinsipal dalam satu trip.'],
    followable: true,
    stage: { channel: 'B2B', at: stopsDone >= t.dos.length ? 4 : 3 },
  }
}

// ---- the metrics bar ----------------------------------------------------------------------------

export interface Pulse {
  label: string
  value: string
  sub: string
  tone?: 'ok' | 'warn' | 'bad'
  missing?: string
}

/** The operation's pulse (brief §7.2) at a day and hour. Trucks and pending loads come from the
 *  scene's own state, passed in; orders and pallets from the engine. */
export function pulse(data: Computed2, day: number, hour: number, fleet: { available: number; road: number; dock: number }, pendingB2b: number, pendingB2c: number): Pulse[] {
  const b2c = data.world.orders.filter((o) => o.day === day && o.hour <= hour).length
  const b2b = data.world.b2b.dos.filter((d) => d.day === day).length
  const pallets = data.alloc.b2bAlloc.pallets.palletsByDay[day]
  const onHand = pallets ? PIDS.reduce((s, p) => s + pallets[p], 0) : 0
  return [
    { label: 'Order hari ini', value: `${formatNumber(b2b)} DO · ${formatNumber(b2c)} order`, sub: 'B2B · B2C s.d. jam ini' },
    { label: 'Utilisasi gudang', value: `${formatNumber(onHand)} palet`, sub: MISSING, missing: 'kapasitas gudang (posisi palet)' },
    { label: 'Truk siap / jalan', value: `${fleet.available} / ${fleet.road}`, sub: `${fleet.dock} di dok · armada ${fleet.available + fleet.road + fleet.dock}`, tone: fleet.available < 2 ? 'warn' : 'ok' },
    { label: 'Ketepatan kirim', value: '—', sub: MISSING, missing: 'janji jam kirim per DO dan per order' },
    { label: 'Muatan tertunda', value: `${formatNumber(pendingB2b)} · ${formatNumber(pendingB2c)}`, sub: 'palet B2B · paket B2C', tone: pendingB2b + pendingB2c > 40 ? 'warn' : 'ok' },
  ]
}

/** Lensa biaya: the engine's cost metrics (the same function the 2D bar and the old 3D cards use). */
export function costLens(data: Computed2, day: number): Pulse[] {
  const { items } = metricItems2(data, day, null, null)
  return items.slice(0, 3).map((m) => ({ label: m.label, value: m.value, sub: m.sub }))
}

/** the shared sales admin pool's rate per PO and the dedicated admin of Prinsipal D */
export function salesAdminPools(data: Computed2): { shared: { total: number; pos: number; rate: number }; dedicated: { total: number } } {
  const pools = data.alloc.b2bAlloc.pools
  const shared = pools.find((p) => p.def.id === 'salesAdminShared')
  const dedicated = pools.find((p) => p.def.id === 'salesAdminDedicated')
  return {
    shared: { total: shared?.total ?? 0, pos: shared?.volumeTotal ?? 0, rate: shared?.rate ?? 0 },
    dedicated: { total: dedicated?.total ?? 0 },
  }
}

/** headcount per team, from the engine's pool definitions (desks in the kantor) */
export const TEAM_SEATS = Object.fromEntries(POOLS1.map((p) => [p.id, p.headcount])) as Record<(typeof POOLS1)[number]['id'], number>
