// Controls 1–9 of brief §6, run for every toggle combination. The formatter control (10)
// lives in format.test.ts and the import guard (11) in tests/sim-import-guard.test.ts.

import { describe, expect, it } from 'vitest'
import { DEFAULT_TOGGLES, PRINCIPALS, TRUCKS } from './config.ts'
import type { Toggles } from './config.ts'
import { lineCostTrace, palletFit } from './cost.ts'
import { computeAll, generateWorld } from './index.ts'
import { hashJson } from '../../../core/rng.ts'
import { must, verifyTrace } from '../../../core/trace.ts'
import type { World } from './types.ts'

const PIDS = PRINCIPALS.map((p) => p.id)
const skuOf = (world: World, code: string) => must(world.skus[code], `SKU ${code}`)

const close = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9)

/** All 64 combinations of the six binary toggles, plus two spot costs of capital. */
function allToggles(): Toggles[] {
  const out: Toggles[] = []
  for (let mask = 0; mask < 64; mask++) {
    out.push({
      volumeMeasure: mask & 1 ? 'chargeable' : 'cbm',
      truckBasis: mask & 2 ? 'capacity' : 'loaded',
      palletRule: mask & 4 ? 'tall' : 'std',
      outboundDriver: mask & 8 ? 'cartons' : 'pallets',
      taxAllocation: mask & 16 ? 'ga' : 'allocated',
      stockCapital: !!(mask & 32),
      costOfCapital: 0.12,
    })
  }
  out.push({ ...DEFAULT_TOGGLES, costOfCapital: 0.05 })
  out.push({ ...DEFAULT_TOGGLES, costOfCapital: 0.2 })
  return out
}

describe('control 1 — determinism', () => {
  it('the same seed produces the identical dataset hash', () => {
    const a = generateWorld(20261007)
    const b = generateWorld(20261007)
    expect(hashJson(b)).toBe(hashJson(a))
    expect(hashJson(a)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('a different seed produces a different dataset', () => {
    expect(hashJson(generateWorld(19991231))).not.toBe(hashJson(generateWorld(20261007)))
  })
})

describe('controls 2–9 — invariants for every toggle combination', () => {
  for (const toggles of allToggles()) {
    const label = `${toggles.volumeMeasure}/${toggles.truckBasis}/${toggles.palletRule}/${toggles.outboundDriver}/${toggles.taxAllocation}/${toggles.stockCapital ? 'stock' : 'nostock'}/wacc${toggles.costOfCapital}`
    it(label, () => {
      const { world, alloc } = computeAll(toggles)

      // Control 2 — pool reconciliation: allocated + unallocated = pool total.
      for (const pool of alloc.pools) {
        expect(close(pool.allocatedTotal + pool.unallocated, pool.total), `pool ${pool.def.id}`).toBe(true)
        const sumByPrincipal = PIDS.reduce((s, p) => s + pool.costByPrincipal[p], 0)
        expect(close(sumByPrincipal, pool.allocatedTotal), `pool ${pool.def.id} split`).toBe(true)
      }

      // Control 3 — trips: DO costs plus unabsorbed capacity reconcile to the trip cost,
      // and line costs reconcile to their DO.
      for (const trip of alloc.trips) {
        const doSum = Object.values(trip.doCost).reduce((s, x) => s + x, 0)
        expect(close(doSum + trip.unabsorbed, trip.cost), `trip ${trip.trip.id} DO sum`).toBe(true)
        for (const doId of trip.trip.dos) {
          const d = must(world.dos.find((x) => x.id === doId), `DO ${doId}`)
          const lineSum = d.lines.reduce((s, l) => s + must(trip.lineCost[`${doId}|${l.sku}`], `line cost ${doId}|${l.sku}`), 0)
          expect(close(lineSum, must(trip.doCost[doId], `DO cost ${doId}`)), `lines of ${doId}`).toBe(true)
        }
      }

      // Control 4 — physical m³ and kg per trip stay within the truck's capacity.
      for (const trip of world.trips) {
        const cap = TRUCKS[trip.truckClass]
        expect(trip.m3).toBeLessThanOrEqual(cap.capacityM3 + 1e-9)
        expect(trip.kg).toBeLessThanOrEqual(cap.payloadKg + 1e-9)
      }

      // Control 5 — stock ledger: opening + in − out = closing, closing ≥ 0, and pallets
      // derived from closing stock never negative.
      const bySku = new Map<string, typeof world.stock>()
      for (const sd of world.stock) {
        const list = bySku.get(sd.sku) ?? []
        list.push(sd)
        bySku.set(sd.sku, list)
      }
      for (const [sku, days] of bySku) {
        for (let i = 0; i < days.length; i++) {
          const sd = must(days[i], `stock day ${i} of ${sku}`)
          expect(sd.day).toBe(i + 1)
          expect(sd.open + sd.in - sd.out).toBe(sd.close)
          expect(sd.close).toBeGreaterThanOrEqual(0)
          if (i > 0) expect(sd.open).toBe(must(days[i - 1], `stock day ${i - 1} of ${sku}`).close)
          expect(Math.ceil(sd.close / palletFit(skuOf(world, sku), toggles).perPallet)).toBeGreaterThanOrEqual(0)
        }
      }

      // Control 6 — pallet-days equal the sum of daily pallet positions, per principal.
      for (const p of PIDS) {
        let sum = 0
        for (let day = 1; day <= world.days; day++) {
          for (const sd of world.stock) {
            if (sd.day !== day || skuOf(world, sd.sku).principal !== p) continue
            sum += Math.ceil(sd.close / palletFit(skuOf(world, sd.sku), toggles).perPallet)
          }
        }
        expect(sum).toBe(alloc.pallets.palletDaysByPrincipal[p])
      }

      // Control 7 — invoices sent ≤ invoices generated, and every date in order.
      for (const p of PIDS) {
        const gen = world.invoicesGen.filter((g) => g.principal === p).length
        const sent = world.invoicesSent.filter((s) => s.principal === p).length
        expect(sent).toBeLessThanOrEqual(gen)
      }
      for (const s of world.invoicesSent) {
        expect(s.sentDay).toBeGreaterThanOrEqual(s.fromDay)
        expect(s.tukarDay).toBeGreaterThanOrEqual(s.sentDay)
        expect(s.dueDay).toBeGreaterThanOrEqual(s.tukarDay)
        expect(s.payDay).toBeGreaterThanOrEqual(s.dueDay)
        for (const gid of s.genInvoices) {
          const g = must(world.invoicesGen.find((x) => x.id === gid), `generated invoice ${gid}`)
          expect(g.day).toBeLessThanOrEqual(s.sentDay)
          expect(g.deliveryDay).toBeLessThanOrEqual(g.day)
        }
      }

      // Control 8 — Σ contribution − unallocated = Σ gross profit − total costs. The
      // brief's identity holds with the unallocated line carried as a deduction, because
      // per-principal contributions are stated before unallocated costs.
      const sumContribution = PIDS.reduce((s, p) => s + alloc.principal[p].contribution, 0)
      expect(close(sumContribution - alloc.unallocated.total, alloc.totals.grossProfit - alloc.totals.costs)).toBe(true)

      // Control 9 — every stored trace recomputes to its own value.
      const traces = [
        ...alloc.pools.flatMap((x) => [x.totalTrace, x.rateTrace]),
        ...alloc.trips.flatMap((t) => [t.totalTrace, ...Object.values(t.doCostTrace)]),
        ...alloc.capital.map((c) => c.trace),
      ]
      for (const t of traces) expect(verifyTrace(t), `trace ${t.label}`).toBe(true)
      // Lazy line traces, sampled across trips, recompute too.
      for (const trip of alloc.trips.slice(0, 5)) {
        const doId = trip.trip.dos[0]
        if (!doId) continue
        const d = must(world.dos.find((x) => x.id === doId), `DO ${doId}`)
        for (const l of d.lines) expect(verifyTrace(lineCostTrace(world, alloc, doId, l.sku))).toBe(true)
      }
    })
  }
})

describe('world shape', () => {
  it('keeps the six profiles distinguishable', () => {
    const { world } = computeAll(DEFAULT_TOGGLES)
    expect(world.principals).toHaveLength(6)
    expect(world.stores).toHaveLength(24)
    const mt = world.stores.filter((s) => s.mtBesar)
    expect(mt.length).toBeGreaterThanOrEqual(4)
    // C: many small-order lines across the month.
    const cLines = world.dos.flatMap((d) => d.lines.filter((l) => l.sku.startsWith('C-')))
    expect(cLines.length).toBeGreaterThan(1000)
    // E: concentrated in the MT besar stores.
    const eValueMt = world.dos
      .flatMap((d) => d.lines.filter((l) => l.sku.startsWith('E-') && world.stores.find((s) => s.id === d.store)?.mtBesar))
      .reduce((s, l) => s + l.value, 0)
    const eValueAll = world.dos.flatMap((d) => d.lines.filter((l) => l.sku.startsWith('E-'))).reduce((s, l) => s + l.value, 0)
    expect(eValueMt / eValueAll).toBeGreaterThan(0.6)
    // Truck classes mix: every class appears at least once.
    const classes = new Set(world.trips.map((t) => t.truckClass))
    expect(classes).toEqual(new Set(['L', 'M', 'H']))
    // Trips mix principals: a trip carries goods of at least three.
    const mixed = world.trips.filter((t) => {
      const ps = new Set(
        t.dos.flatMap((id) => must(world.dos.find((d) => d.id === id), `DO ${id}`).lines.map((l) => skuOf(world, l.sku).principal)),
      )
      return ps.size >= 3
    })
    expect(mixed.length).toBe(world.trips.length)
  })
})
