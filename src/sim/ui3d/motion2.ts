// World-2 motion for the 3D scene (Brief 3 V3): where every vehicle is at (day, hour), as a pure
// function of the engine's day records and the display-only schedules in bindings2.ts. The
// scene only draws what this returns; tests pin continuity and the timetable.
//
// Site layout (world units, x east, z south): main road z = 7,4 runs east to "Toko"; the right
// road x = 14,5 runs north–south past the courier bay to "Konsumen"; inbound trucks come down
// the left road x = −13,5, unload beside the warehouse's west wall and leave by the back road.

import type { Computed2 } from '../worlds/b2b-b2c/engine/index.ts'
import { COURIERS } from '../worlds/b2b-b2c/engine/config.ts'
import { inboundHour, pickupHour, TRIP_HOURS, tripDepartHour } from './bindings2.ts'
import type { SelectionView } from './bindings2.ts'
import { formatClock, formatNumber, formatPct, formatRpCard } from '../core/format.ts'

export type VehicleKind = 'truck' | 'van' | 'inbound' | 'forklift'

export interface VehicleView {
  id: string
  kind: VehicleKind
  x: number
  z: number
  /** Group rotation about y; the models face +x. */
  heading: number
  label: string
  /** What it is doing now (Bahasa Indonesia, shown on its card). */
  status: string
}

type P = [number, number]

// --- Fixed places --------------------------------------------------------------------------------

/** B2B dock doors on the warehouse's south face; trucks back in, cab facing the road. */
export const DOCK_SLOTS_X = [-3.52, -0.88, 1.76]
export const DOCK_Z = 5.8
/** Courier bay: vans stop in the west lane of the right road, one slot per courier. */
export const BAY_X = 13.4
export const BAY_SLOTS_Z: Record<string, number> = { K1: -0.4, K2: 1.6, K3: 3.6 }
/** Inbound unloading spot beside the warehouse's west wall. */
export const INBOUND_STOP: P = [-8.8, 0.4]

const EDGE = 44

// --- Routes ----------------------------------------------------------------------------------------

function routeLength(r: P[]): number {
  let l = 0
  for (let i = 1; i < r.length; i++) l += Math.hypot(r[i]![0] - r[i - 1]![0], r[i]![1] - r[i - 1]![1])
  return l
}

/** Point and heading at fraction `f` (0–1) along a polyline. */
export function along(r: P[], f: number): { x: number; z: number; heading: number } {
  const total = routeLength(r)
  let d = Math.max(0, Math.min(1, f)) * total
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1]!
    const b = r[i]!
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (d <= seg || i === r.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 0
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) }
    }
    d -= seg
  }
  const last = r[r.length - 1]!
  return { x: last[0], z: last[1], heading: 0 }
}

/** Out of a dock slot to the main road, then east past "Toko". */
export function b2bRoute(slot: number): P[] {
  const x = DOCK_SLOTS_X[slot % DOCK_SLOTS_X.length] ?? 0
  return [
    [x, DOCK_Z],
    [x, 8.4],
    [EDGE, 8.4],
  ]
}

/** Down the right road from the back, stop at the courier's slot, on south to "Konsumen". */
export function vanRouteIn(courier: string): P[] {
  return [
    [BAY_X, -EDGE],
    [BAY_X, BAY_SLOTS_Z[courier] ?? 0],
  ]
}
export function vanRouteOut(courier: string): P[] {
  return [
    [BAY_X, BAY_SLOTS_Z[courier] ?? 0],
    [BAY_X, EDGE],
  ]
}

/** Down the left road, east to the unloading spot; out north by the back road. */
export const INBOUND_IN: P[] = [
  [-14.3, -EDGE],
  [-14.3, 2.6],
  [-8.8, 2.6],
  INBOUND_STOP,
]
export const INBOUND_OUT: P[] = [INBOUND_STOP, [-8.8, -6.6], [-12.7, -6.6], [-12.7, -EDGE]]

// --- Timetable ----------------------------------------------------------------------------------

/** Hours a vehicle spends crossing the visible site on its way in or out. */
export const DRIVE_HOURS = 1
/** B2B trucks load at the dock this long before they leave. */
export const LOAD_HOURS = 1.5
/** Couriers wait at the bay this long before their pickup time. */
export const VAN_WAIT_HOURS = 1
/** Inbound unloading time (matches inboundHour's two-hour slots). */
export const UNLOAD_HOURS = 2

/** A forklift shuttles a → b → a while it has work, a whole number of round trips per work
 *  window, so it is back at `a` whenever a window starts or ends; idle, it waits at `a`. That
 *  keeps it continuous when work stops or moves to another door. */
function forkliftAt(id: string, label: string, a: P, b: P, work: { start: number; hours: number } | null, hour: number): VehicleView {
  const facing = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  if (!work) return { id, kind: 'forklift', x: a[0], z: a[1], heading: facing, label, status: 'Siaga' }
  const cycle = work.hours / Math.max(1, Math.round(work.hours / 0.4))
  const phase = ((hour - work.start) / cycle) % 1
  const t = phase < 0.5 ? phase * 2 : 2 - phase * 2
  return { id, kind: 'forklift', x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, heading: phase < 0.5 ? facing : facing + Math.PI, label, status: 'Memindahkan palet' }
}

export function vehicles2(data: Computed2, day: number, hour: number): VehicleView[] {
  const { world } = data
  const out: VehicleView[] = []

  // B2B trips: load at a door, then drive out east.
  let loading: { slot: number; start: number } | null = null
  const trips = world.b2b.trips.filter((t) => t.day === day).slice(0, 6)
  for (const [i, t] of trips.entries()) {
    const depart = tripDepartHour(i)
    const slot = i % DOCK_SLOTS_X.length
    const route = b2bRoute(slot)
    const label = `${t.truckCode} · Zona ${t.zone}`
    if (hour >= depart - LOAD_HOURS && hour < depart) {
      const p = along(route, 0)
      out.push({ id: `trip:${t.id}`, kind: 'truck', x: p.x, z: p.z, heading: p.heading, label, status: `Muat di dock, berangkat ${formatClock(depart)}` })
      loading = { slot, start: depart - LOAD_HOURS }
    } else if (hour >= depart && hour < depart + DRIVE_HOURS) {
      const p = along(route, (hour - depart) / DRIVE_HOURS)
      out.push({ id: `trip:${t.id}`, kind: 'truck', x: p.x, z: p.z, heading: p.heading, label, status: 'Menuju toko' })
    }
  }

  // Couriers: arrive from the north, wait at the bay, leave south at the pickup hour.
  for (const m of world.manifests.filter((x) => x.day === day)) {
    const at = pickupHour(m.courier, m.pickup)
    const label = `${COURIERS.find((c) => c.id === m.courier)?.label ?? m.courier} · ${m.id}`
    const arrive = at - VAN_WAIT_HOURS
    if (hour >= arrive - DRIVE_HOURS && hour < arrive) {
      const p = along(vanRouteIn(m.courier), (hour - (arrive - DRIVE_HOURS)) / DRIVE_HOURS)
      out.push({ id: `mf:${m.id}`, kind: 'van', x: p.x, z: p.z, heading: p.heading, label, status: `Menuju bay, jemput ${formatClock(at)}` })
    } else if (hour >= arrive && hour < at) {
      const p = along(vanRouteOut(m.courier), 0)
      out.push({ id: `mf:${m.id}`, kind: 'van', x: p.x, z: p.z, heading: p.heading, label, status: `Menunggu di bay, ${m.packages} paket` })
    } else if (hour >= at && hour < at + DRIVE_HOURS) {
      const p = along(vanRouteOut(m.courier), (hour - at) / DRIVE_HOURS)
      out.push({ id: `mf:${m.id}`, kind: 'van', x: p.x, z: p.z, heading: p.heading, label, status: 'Mengantar ke konsumen' })
    }
  }

  // Inbound POs: one truck per PO, one after another at the unloading spot.
  let unloading: number | null = null
  const pos = world.b2b.pos.filter((p) => p.arrivalDay === day).slice(0, 6)
  for (const [i, po] of pos.entries()) {
    const at = inboundHour(i)
    const label = `Truk inbound · ${po.id}`
    if (hour >= at - DRIVE_HOURS && hour < at) {
      const p = along(INBOUND_IN, (hour - (at - DRIVE_HOURS)) / DRIVE_HOURS)
      out.push({ id: `po:${po.id}`, kind: 'inbound', x: p.x, z: p.z, heading: p.heading, label, status: `Menuju dock, tiba ${formatClock(at)}` })
    } else if (hour >= at && hour < at + UNLOAD_HOURS) {
      const p = along(INBOUND_OUT, 0)
      out.push({ id: `po:${po.id}`, kind: 'inbound', x: p.x, z: p.z, heading: p.heading, label, status: 'Bongkar' })
      unloading = at
    } else if (hour >= at + UNLOAD_HOURS && hour < at + UNLOAD_HOURS + DRIVE_HOURS) {
      const p = along(INBOUND_OUT, (hour - at - UNLOAD_HOURS) / DRIVE_HOURS)
      out.push({ id: `po:${po.id}`, kind: 'inbound', x: p.x, z: p.z, heading: p.heading, label, status: 'Kembali kosong' })
    }
  }

  // Forklifts work while a truck is being loaded or unloaded.
  // B2B: between the staged pallets (east end of the dock apron) and the side of the truck.
  const slotX = DOCK_SLOTS_X[loading?.slot ?? 2] ?? 0
  out.push(forkliftAt('fl:b2b', 'Forklift FL-02 · dock B2B', [4.2, 5.3], [slotX + 1.1, 5.3], loading ? { start: loading.start, hours: LOAD_HOURS } : null, hour))
  // Inbound: between the truck and the warehouse's west wall.
  out.push(forkliftAt('fl:inbound', 'Forklift FL-01 · inbound', [-6.2, 1.4], [-7.6, 1.4], unloading !== null ? { start: unloading, hours: UNLOAD_HOURS } : null, hour))
  return out
}

// --- Vehicle cards ----------------------------------------------------------------------------

/** Card for a vehicle id from vehicles2 (`trip:…`, `mf:…`, `po:…`, `fl:…`), on or off the map. */
export function vehicleSelection2(data: Computed2, day: number, hour: number, id: string, onMap: VehicleView | undefined): SelectionView | null {
  const [kind, ref] = id.split(':')
  const { world, alloc } = data
  if (kind === 'trip') {
    const t = world.b2b.trips.find((x) => x.id === ref)
    if (!t) return null
    const i = world.b2b.trips.filter((x) => x.day === t.day).findIndex((x) => x.id === t.id)
    const depart = tripDepartHour(i)
    const a = alloc.b2bAlloc.trips.find((x) => x.trip.id === t.id)
    const away = t.day === day && hour >= depart && hour < depart + TRIP_HOURS
    const status = onMap?.status ?? (t.day !== day ? `Trip hari ${t.day}` : hour < depart ? 'Belum muat' : away ? 'Di jalan ke toko' : 'Sudah kembali')
    return {
      id,
      icon: '🚚',
      tone: 'blue',
      title: `${t.truckCode} · Zona ${t.zone}`,
      sub: `Trip B2B · ${t.dos.length} DO`,
      what: status,
      followable: !!onMap,
      rows: [
        { k: 'Berangkat · kembali', v: `${formatClock(depart)} · ${formatClock(depart + TRIP_HOURS)}` },
        { k: 'Muatan', v: `${formatNumber(t.kg)} kg${a ? ` · ${formatPct(a.loadFactor)} kapasitas` : ''}` },
        ...(a
          ? [
              { k: 'Biaya trip', v: formatRpCard(a.cost) },
              { k: 'Terserap ke DO', v: formatRpCard(a.absorbed) },
            ]
          : []),
      ],
    }
  }
  if (kind === 'mf') {
    const m = world.manifests.find((x) => x.id === ref)
    if (!m) return null
    const at = pickupHour(m.courier, m.pickup)
    const label = COURIERS.find((c) => c.id === m.courier)?.label ?? m.courier
    return {
      id,
      icon: '🛵',
      tone: 'green',
      title: `${label} · ${m.id}`,
      sub: 'Van kurir · manifest',
      what: onMap?.status ?? (m.day !== day ? `Manifest hari ${m.day}` : hour < at ? `Jemput ${formatClock(at)}` : 'Sudah diserahkan'),
      followable: !!onMap,
      rows: [
        { k: 'Jemput', v: formatClock(at) },
        { k: 'Paket di manifest', v: formatNumber(m.packages) },
      ],
    }
  }
  if (kind === 'po') {
    const po = world.b2b.pos.find((x) => x.id === ref)
    if (!po) return null
    const i = world.b2b.pos.filter((x) => x.arrivalDay === po.arrivalDay).findIndex((x) => x.id === po.id)
    return {
      id,
      icon: '📥',
      tone: 'amber',
      title: `Truk inbound · ${po.id}`,
      sub: `Prinsipal ${po.principal} · PO hari ${po.day}`,
      what: onMap?.status ?? (po.arrivalDay !== day ? `Tiba hari ${po.arrivalDay}` : 'Di luar lokasi'),
      followable: !!onMap,
      rows: [
        { k: 'Tiba · bongkar selesai', v: `${formatClock(inboundHour(i))} · ${formatClock(inboundHour(i) + UNLOAD_HOURS)}` },
        { k: 'Karton', v: formatNumber(po.lines.reduce((s, l) => s + l.cartons, 0)) },
      ],
    }
  }
  if (kind === 'fl' && onMap) {
    return { id, icon: '🛻', tone: 'amber', title: onMap.label, sub: 'Forklift', what: onMap.status, followable: true, rows: [] }
  }
  return null
}

/** The map object behind a vehicle, for "Detail" (the 2D panel works per object). */
export function objectOfVehicle(id: string): string {
  if (id.startsWith('trip:') || id === 'fl:b2b') return 'B2B'
  if (id.startsWith('mf:')) return 'BAY'
  return 'DOCK2'
}

/** When a vehicle is worth looking at (for jumps from the lists and search): loading trucks,
 *  waiting couriers, unloading inbound trucks. */
export function vehicleWhen(data: Computed2, id: string): { day: number; hour: number } | null {
  const [kind, ref] = id.split(':')
  const { world } = data
  if (kind === 'trip') {
    const t = world.b2b.trips.find((x) => x.id === ref)
    if (!t) return null
    const i = world.b2b.trips.filter((x) => x.day === t.day).findIndex((x) => x.id === t.id)
    return { day: t.day, hour: tripDepartHour(i) - LOAD_HOURS / 2 }
  }
  if (kind === 'mf') {
    const m = world.manifests.find((x) => x.id === ref)
    return m ? { day: m.day, hour: pickupHour(m.courier, m.pickup) - VAN_WAIT_HOURS / 2 } : null
  }
  if (kind === 'po') {
    const po = world.b2b.pos.find((x) => x.id === ref)
    if (!po) return null
    const i = world.b2b.pos.filter((x) => x.arrivalDay === po.arrivalDay).findIndex((x) => x.id === po.id)
    return { day: po.arrivalDay, hour: inboundHour(i) + UNLOAD_HOURS / 2 }
  }
  return null
}
