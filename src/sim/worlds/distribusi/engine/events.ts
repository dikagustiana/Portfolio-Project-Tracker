// The precomputed event log (brief §5): one pass over the world and its allocations
// produces day-ordered events plus per-day aggregates. The animation only reads this log —
// it never recomputes costs — and the sample-cycle markers come from here too (§7.6).

import type { PrincipalId } from './config.ts'
import type { Allocations } from './cost.ts'
import { must } from '../../../core/trace.ts'
import type { World } from './types.ts'

export type EventKind =
  | 'po' // PO envelope flies to the principal
  | 'arrival' // the principal's truck reaches the dock
  | 'inbound' // forklifts carry pallets from dock to racks
  | 'wms' // admin WMS records the receipt
  | 'outbound' // goods picked from racks to staging
  | 'trip' // truck loads mixed colours and drives to the zone
  | 'doSigned' // the store signs its DO
  | 'invGen' // SAP generates the invoice
  | 'invSent' // invoice + faktur pajak go out
  | 'tukar' // tukar faktur with the store
  | 'paid' // payment lands; coins go to the bank

export interface SimEvent {
  day: number
  kind: EventKind
  ref: string
  principal?: PrincipalId
  zone?: 1 | 2 | 3
  /** Up to a few figures for pop-ups and panel preloading. */
  pallets?: number
  cartons?: number
  m3?: number
  value?: number
  cost?: number
}

export interface DailyAgg {
  day: number
  palletsIn: number
  palletsOut: number
  cartonsOut: number
  palletPositions: number
  palletDays: number
  dos: number
  m3: number
  value: number
  trips: { zone: 1 | 2 | 3; truckClass: string; truckCode: string; m3: number }[]
  invoicesGen: number
  invoicesSent: number
  paid: number
}

export interface CycleMarker {
  step: number
  day: number
  label: string
  ref: string
}

export interface EventLog {
  events: SimEvent[]
  daily: DailyAgg[]
  /** The 11 steps of one sample cycle, for the timeline markers (§7.6). */
  cycle: CycleMarker[]
}

const P = (world: World, sku: string): PrincipalId => must(world.skus[sku], `SKU ${sku}`).principal

export function buildEvents(world: World, alloc: Allocations): EventLog {
  const events: SimEvent[] = []

  for (const po of world.pos) {
    events.push({ day: po.day, kind: 'po', ref: po.id, principal: po.principal })
    if (po.arrivalDay >= 1 && po.arrivalDay <= world.days) {
      const dayIn = alloc.pallets.palletsInByDay[po.arrivalDay]
      const pallets = dayIn ? dayIn[po.principal] : 0
      const cartons = po.lines.reduce((s, l) => s + l.cartons, 0)
      events.push({ day: po.arrivalDay, kind: 'arrival', ref: po.id, principal: po.principal, cartons })
      events.push({ day: po.arrivalDay, kind: 'inbound', ref: po.id, principal: po.principal, pallets })
      events.push({ day: po.arrivalDay, kind: 'wms', ref: po.id, principal: po.principal })
    }
  }

  for (let day = 1; day <= world.days; day++) {
    const dos = world.dos.filter((d) => d.day === day)
    const palletsOut = sumRec(alloc.pallets.palletsOutByDay[day])
    const cartonsOut = dos.reduce((s, d) => s + d.lines.reduce((x, l) => x + l.cartons, 0), 0)
    events.push({ day, kind: 'outbound', ref: `day-${day}`, pallets: palletsOut, cartons: cartonsOut })
    for (const t of world.trips.filter((t2) => t2.day === day)) {
      const allocTrip = alloc.trips.find((x) => x.trip.id === t.id)
      events.push({ day, kind: 'trip', ref: t.id, zone: t.zone, m3: t.m3, cost: allocTrip?.absorbed ?? 0 })
    }
    for (const d of dos) events.push({ day, kind: 'doSigned', ref: d.id, zone: d.zone, value: d.value, m3: d.m3 })
  }

  for (const g of world.invoicesGen) events.push({ day: g.day, kind: 'invGen', ref: g.id, principal: g.principal, value: g.value })
  for (const s of world.invoicesSent) {
    events.push({ day: s.sentDay, kind: 'invSent', ref: s.id, principal: s.principal, value: s.value })
    events.push({ day: s.tukarDay, kind: 'tukar', ref: s.id, principal: s.principal, value: s.value })
    events.push({ day: s.payDay, kind: 'paid', ref: s.id, principal: s.principal, value: s.value })
  }
  events.sort((a, b) => a.day - b.day || a.kind.localeCompare(b.kind))

  // --- Daily aggregates for the pop-ups and the rack visual.
  const daily: DailyAgg[] = []
  for (let day = 1; day <= world.days; day++) {
    const dos = world.dos.filter((d) => d.day === day)
    daily.push({
      day,
      palletsIn: sumRec(alloc.pallets.palletsInByDay[day]),
      palletsOut: sumRec(alloc.pallets.palletsOutByDay[day]),
      cartonsOut: dos.reduce((s, d) => s + d.lines.reduce((x, l) => x + l.cartons, 0), 0),
      palletPositions: sumRec(alloc.pallets.palletsByDay[day]),
      palletDays: sumRec(alloc.pallets.palletsByDay[day]),
      dos: dos.length,
      m3: dos.reduce((s, d) => s + d.m3, 0),
      value: dos.reduce((s, d) => s + d.value, 0),
      trips: world.trips
        .filter((t) => t.day === day)
        .map((t) => ({ zone: t.zone, truckClass: t.truckClass, truckCode: t.truckCode, m3: t.m3 })),
      invoicesGen: world.invoicesGen.filter((g) => g.day === day).length,
      invoicesSent: world.invoicesSent.filter((s) => s.sentDay === day).length,
      paid: world.invoicesSent.filter((s) => s.payDay === day).reduce((s2, i) => s2 + i.value, 0),
    })
  }

  // --- One sample cycle for the timeline markers: Prinsipal A's first PO through to cash.
  const cycle: CycleMarker[] = [
    { step: 1, day: 1, label: 'Forecast dan cek stok', ref: 'komersial' },
    { step: 2, day: 1, label: 'Cek minimum inventory', ref: 'komersial' },
  ]
  const po = world.pos.find((p) => p.principal === 'A')
  if (po) {
    cycle.push({ step: 3, day: po.day, label: 'PO ke prinsipal', ref: po.id })
    if (po.arrivalDay <= world.days) {
      cycle.push({ step: 4, day: po.arrivalDay, label: 'Inbound fisik dan input WMS', ref: po.id })
      cycle.push({ step: 5, day: po.arrivalDay, label: 'Simpan di rak', ref: 'rak' })
    }
  }
  const firstDo = world.dos.find((d) => d.day >= (po?.arrivalDay ?? 8) && d.lines.some((l) => P(world, l.sku) === 'A'))
  if (firstDo) {
    cycle.push({ step: 6, day: firstDo.day, label: 'Outbound ke staging', ref: firstDo.id })
    cycle.push({ step: 7, day: firstDo.day, label: 'Muat dan jalan', ref: firstDo.trip })
    cycle.push({ step: 8, day: firstDo.day, label: 'Serah terima di toko', ref: firstDo.id })
    const gen = world.invoicesGen.find((g) => g.principal === 'A' && g.dos.includes(firstDo.id))
    if (gen) {
      cycle.push({ step: 9, day: gen.day, label: 'Invoice dibuat', ref: gen.id })
      const sent = world.invoicesSent.find((s) => s.genInvoices.includes(gen.id))
      if (sent) {
        cycle.push({ step: 10, day: sent.sentDay, label: 'Invoice dikirim dan faktur pajak', ref: sent.id })
        cycle.push({ step: 11, day: sent.payDay, label: 'TOP dan kas masuk', ref: sent.id })
      }
    }
  }

  return { events, daily, cycle }
}

function sumRec(r: Record<PrincipalId, number> | undefined): number {
  if (!r) return 0
  return ['A', 'B', 'C', 'D', 'E', 'F'].reduce((s, p) => s + (r[p as PrincipalId] ?? 0), 0)
}
