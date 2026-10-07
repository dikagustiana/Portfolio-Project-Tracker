// The dummy world generator (brief §5): one warehouse, 30 days, 24 stores in 3 zones, six
// principals with the profiles from the config. Everything is rolled from one seeded PRNG
// in a fixed loop order, so the dataset hash is reproducible (control 1).
//
// The world is toggle-independent: it stores physical facts (cartons, m³, kg, dates).
// Pallet positions depend on the pallet rule and are derived during allocation instead.

import { CASH_TERMS, DAYS, PRINCIPALS, SEED, TRUCKS, ZONES } from './config.ts'
import type { PrincipalId, TruckClassId } from './config.ts'
import { mulberry32 } from '../../../core/rng.ts'
import { must } from '../../../core/trace.ts'
import type { DeliveryOrder, DoLine, InvoiceGen, InvoiceSent, Po, Principal, Sku, StockDay, Store, Trip, World } from './types.ts'

/** Days on which the commercial team re-checks order needs (§3 step 2). */
const PO_CHECK_DAYS = [1, 8, 15, 22]

export function generateWorld(seed = SEED): World {
  const rng = mulberry32(seed)

  // --- Stores: Toko 01–24, spread over the zones, with a "MT besar" group per zone.
  const mtPerZone: Record<1 | 2 | 3, number> = { 1: 3, 2: 2, 3: 1 }
  const stores: Store[] = []
  for (const z of ZONES) {
    const mtCount = mtPerZone[z.id]
    const mtIdx = new Set<number>()
    while (mtIdx.size < mtCount) mtIdx.add(rng.int(0, z.storeCount - 1))
    for (let i = 0; i < z.storeCount; i++) {
      const n = stores.length + 1
      stores.push({ id: `S${String(n).padStart(2, '0')}`, code: `Toko ${String(n).padStart(2, '0')}`, zone: z.id, mtBesar: mtIdx.has(i) })
    }
  }

  // --- SKU catalogue: dimensions, weight and stack factor rolled inside the template ranges.
  const skus: Record<string, Sku> = {}
  const principals: Principal[] = PRINCIPALS.map((p) => ({ id: p.id, name: `Prinsipal ${p.id}`, minInventoryDays: p.minInventoryDays, leadTimeDays: p.leadTimeDays, skus: [] }))
  const principalOf = new Map<PrincipalId, Principal>(principals.map((p) => [p.id, p]))
  for (const t of PRINCIPALS) {
    const principal = must(principalOf.get(t.id), `principal ${t.id}`)
    for (let i = 0; i < t.skus.count; i++) {
      const code = `${t.id}-${String(i + 1).padStart(2, '0')}`
      const w = rng.int(t.skus.w[0], t.skus.w[1])
      const h = rng.int(t.skus.h[0], t.skus.h[1])
      const d = rng.int(t.skus.d[0], t.skus.d[1])
      const sku: Sku = {
        id: code, principal: t.id, code,
        wCm: w, hCm: h, dCm: d,
        kgPerCarton: Math.round(rng.range(t.skus.kg[0], t.skus.kg[1]) * 10) / 10,
        stackFactor: rng.int(t.skus.stackFactor[0], t.skus.stackFactor[1]),
        pricePerCarton: t.skus.pricePerCarton, margin: t.skus.margin,
        m3PerCarton: (w * h * d) / 1_000_000,
      }
      skus[code] = sku
      principal.skus.push(code)
    }
  }
  const skuOf = (code: string): Sku => must(skus[code], `SKU ${code}`)
  const zoneFactor = new Map<number, number>(ZONES.map((z) => [z.id, z.demandFactor]))

  // --- Daily demand per SKU per store (§5 flow 1). C's small orders stay ≥ 1 carton on an
  // ordering day; Prinsipal E concentrates its demand on the MT besar stores.
  const demand: DoLine[][][] = [] // [day][storeIdx][lineIdx]
  const monthlyCartons: Record<string, number> = {}
  for (let day = 1; day <= DAYS; day++) {
    const perStore: DoLine[][] = []
    for (const store of stores) {
      const lines: DoLine[] = []
      const zf = must(zoneFactor.get(store.zone), `zone factor ${store.zone}`)
      for (const p of PRINCIPALS) {
        const offMt = p.skus.mtBias > 0 && !store.mtBesar
        const presence = offMt ? p.skus.demandPresence * (1 - p.skus.mtBias) : p.skus.demandPresence
        for (const code of must(principalOf.get(p.id), `principal ${p.id}`).skus) {
          const sku = skuOf(code)
          const expected = rng.range(p.skus.demandPerStoreDay[0], p.skus.demandPerStoreDay[1]) * zf * (offMt ? 1 - p.skus.mtBias : 1)
          const floor = p.skus.demandPresence >= 0.99 || offMt ? 1 : 0
          const cartons = Math.max(floor, Math.round(expected))
          if (rng.chance(presence) && cartons > 0) {
            lines.push({ sku: code, cartons, m3: cartons * sku.m3PerCarton, kg: cartons * sku.kgPerCarton, value: cartons * sku.pricePerCarton })
            monthlyCartons[code] = (monthlyCartons[code] ?? 0) + cartons
          }
        }
      }
      perStore.push(lines)
    }
    demand.push(perStore)
  }

  // --- Month-start forecast per SKU (§3 step 1): actuals with a per-SKU error, biased up.
  const forecast: Record<string, number> = {}
  for (const code of Object.keys(skus)) forecast[code] = Math.round((monthlyCartons[code] ?? 0) * (1 + rng.range(-0.08, 0.15)))
  const dailySales = (code: string): number => (forecast[code] ?? 0) / DAYS

  // --- Opening stock covers the lead time plus the principal's minimum inventory days,
  // sized on the stricter of forecast and actuals so the ledger never goes negative.
  const opening: Record<string, number> = {}
  for (const p of principals) {
    for (const code of p.skus) {
      const daily = Math.max(dailySales(code), (monthlyCartons[code] ?? 0) / DAYS)
      opening[code] = Math.ceil(daily * (p.leadTimeDays + p.minInventoryDays) * 1.08)
    }
  }
  const openingOf = (code: string): number => opening[code] ?? 0

  // --- Purchase orders: weekly re-checks (§3 step 2). Order need = remaining forecast +
  // minimum stock − current stock − stock in transit, with a small ordering safety.
  const outSoFar = (code: string, day: number): number => {
    let t = 0
    for (let d = 1; d < day; d++) {
      for (const ls of demand[d - 1] ?? []) for (const l of ls) if (l.sku === code) t += l.cartons
    }
    return t
  }
  const pos: Po[] = []
  let poSeq = 0
  for (const checkDay of PO_CHECK_DAYS) {
    for (const p of principals) {
      const lines: Po['lines'] = []
      const myPos = pos.filter((po) => po.principal === p.id)
      for (const code of p.skus) {
        const inPo = (po: Po): number => po.lines.filter((l) => l.sku === code).reduce((s, l) => s + l.cartons, 0)
        const arrived = myPos.filter((po) => po.arrivalDay < checkDay).reduce((s, po) => s + inPo(po), 0)
        const inTransit = myPos.filter((po) => po.arrivalDay >= checkDay).reduce((s, po) => s + inPo(po), 0)
        const current = openingOf(code) + arrived - outSoFar(code, checkDay)
        const remaining = dailySales(code) * (DAYS - checkDay + 1)
        const minStock = dailySales(code) * p.minInventoryDays
        const need = remaining + minStock - current - inTransit
        if (need > 0) lines.push({ sku: code, cartons: Math.ceil(need * 1.05) })
      }
      if (lines.length) {
        poSeq += 1
        pos.push({ id: `PO-${p.id}-${poSeq}`, principal: p.id, day: checkDay, lines, arrivalDay: checkDay + p.leadTimeDays })
      }
    }
  }
  const arrivals: Record<number, { sku: string; cartons: number }[]> = {}
  for (const po of pos) (arrivals[po.arrivalDay] ??= []).push(...po.lines.map((l) => ({ sku: l.sku, cartons: l.cartons })))

  // --- Stock ledger: opening + in − out = close, per SKU per day (control 5).
  const stock: StockDay[] = []
  for (const code of Object.keys(skus)) {
    let close = openingOf(code)
    for (let day = 1; day <= DAYS; day++) {
      const inCartons = (arrivals[day] ?? []).filter((l) => l.sku === code).reduce((s, l) => s + l.cartons, 0)
      const outCartons = demand[day - 1]?.flatMap((ls) => ls.filter((l) => l.sku === code)).reduce((s, l) => s + l.cartons, 0) ?? 0
      const open = close
      close = open + inCartons - outCartons
      if (close < 0) throw new Error(`negative stock for ${code} on day ${day}: ${close}`)
      stock.push({ sku: code, day, open, in: inCartons, out: outCartons, close })
    }
  }

  // --- Delivery orders: one per store per day that ordered (§5 flow 6), mixing principals.
  const dos: DeliveryOrder[] = []
  const sum = (lines: DoLine[], key: 'm3' | 'kg' | 'value'): number => lines.reduce((s, l) => s + l[key], 0)
  for (let day = 1; day <= DAYS; day++) {
    ;(demand[day - 1] ?? []).forEach((lines, storeIdx) => {
      if (!lines.length) return
      const store = must(stores[storeIdx], `store ${storeIdx}`)
      dos.push({
        id: `DO-${String(day).padStart(2, '0')}-${store.id}`,
        store: store.id, zone: store.zone, day,
        lines, m3: sum(lines, 'm3'), kg: sum(lines, 'kg'), value: sum(lines, 'value'),
        trip: '',
      })
    })
  }

  // --- Trips: DOs grouped by zone per day; the smallest fitting class takes the load,
  // and the counter keeps codes unique across the day.
  const trips: Trip[] = []
  const classUsed: Partial<Record<TruckClassId, number>> = {}
  for (let day = 1; day <= DAYS; day++) {
    for (const z of ZONES) {
      const zoneDos = dos.filter((d) => d.day === day && d.zone === z.id)
      if (!zoneDos.length) continue
      for (const group of splitByTruck(zoneDos)) {
        const m3 = group.reduce((s, d) => s + d.m3, 0)
        const kg = group.reduce((s, d) => s + d.kg, 0)
        const cls = smallestFittingClass(m3, kg)
        if (!cls) throw new Error(`DO group exceeds the heaviest truck: ${m3.toFixed(2)} m³ / ${kg.toFixed(0)} kg on day ${day}`)
        const n = (classUsed[cls] ?? 0) + 1
        classUsed[cls] = n
        const trip: Trip = {
          id: `TR-${String(day).padStart(2, '0')}-${z.id}-${n}`,
          day, zone: z.id, truckClass: cls,
          truckCode: `${cls}-${String((n % TRUCKS[cls].fleet) + 1).padStart(2, '0')}`,
          dos: group.map((d) => d.id), m3, kg,
        }
        trips.push(trip)
        for (const d of group) d.trip = trip.id
      }
    }
  }

  // --- Invoices generated: one per DO per principal; day = delivery + 0–1 (§5).
  const invoicesGen: InvoiceGen[] = []
  let genSeq = 0
  for (const d of dos) {
    for (const p of principals) {
      const lines = d.lines.filter((l) => skuOf(l.sku).principal === p.id)
      if (!lines.length) continue
      genSeq += 1
      invoicesGen.push({
        id: `IG-${String(genSeq).padStart(4, '0')}`, principal: p.id, store: d.store,
        deliveryDay: d.day, day: d.day + rng.int(CASH_TERMS.invoiceLagDays[0], CASH_TERMS.invoiceLagDays[1]),
        value: lines.reduce((s, l) => s + l.value, 0), dos: [d.id],
      })
    }
  }

  // --- Invoices sent: one per store per principal per week, consolidated, with faktur pajak.
  const invoicesSent: InvoiceSent[] = []
  let sentSeq = 0
  const prevEnd = (end: number): number => {
    const i = CASH_TERMS.weekEnds.indexOf(end)
    return i <= 0 ? 0 : (CASH_TERMS.weekEnds[i - 1] ?? 0)
  }
  for (const end of CASH_TERMS.weekEnds) {
    const from = prevEnd(end) + 1
    const gens = invoicesGen.filter((g) => g.deliveryDay >= from && g.deliveryDay <= end)
    const groups = new Map<string, InvoiceGen[]>()
    for (const g of gens) {
      const key = `${g.store}|${g.principal}`
      const list = groups.get(key) ?? []
      list.push(g)
      groups.set(key, list)
    }
    for (const [key, list] of groups) {
      const [storeId, principalId] = key.split('|') as [string, PrincipalId]
      const store = stores.find((s) => s.id === storeId)
      if (!store) continue
      const terms = store.mtBesar ? CASH_TERMS.mtBesar : CASH_TERMS.regular
      const value = list.reduce((s, g) => s + g.value, 0)
      const firstDelivery = Math.min(...list.map((g) => g.deliveryDay))
      const invoiceDay = Math.min(...list.map((g) => g.day))
      // A generated invoice can slip one day past the week end (delivery + 1); the
      // consolidated invoice waits for it so the dates stay in order (control 7).
      const sentDay = Math.max(end, ...list.map((g) => g.day))
      const tukarDay = sentDay + terms.tukarFakturDelayDays
      const dueDay = tukarDay + terms.topDays
      const payDay = dueDay + rng.int(CASH_TERMS.paymentSlipDays[0], CASH_TERMS.paymentSlipDays[1])
      sentSeq += 1
      invoicesSent.push({
        id: `IS-${String(sentSeq).padStart(4, '0')}`, principal: principalId, store: storeId,
        fromDay: from, toDay: end, sentDay, tukarDay, dueDay, payDay, value,
        genInvoices: list.map((g) => g.id),
        seg1: invoiceDay - firstDelivery, seg2: tukarDay - invoiceDay, seg3: payDay - tukarDay,
      })
    }
  }

  return { days: DAYS, principals, skus, stores, stock, pos, dos, trips, invoicesGen, invoicesSent, forecast }
}

/** Split a zone-day's DOs into truckloads; each truck keeps whole DOs (§3 step 7). */
function splitByTruck(zoneDos: DeliveryOrder[]): DeliveryOrder[][] {
  const totalM3 = zoneDos.reduce((s, d) => s + d.m3, 0)
  const totalKg = zoneDos.reduce((s, d) => s + d.kg, 0)
  if (smallestFittingClass(totalM3, totalKg)) return [zoneDos]
  const groups: DeliveryOrder[][] = []
  let current: DeliveryOrder[] = []
  let m3 = 0
  let kg = 0
  for (const d of zoneDos) {
    if (current.length && (m3 + d.m3 > TRUCKS.H.capacityM3 || kg + d.kg > TRUCKS.H.payloadKg)) {
      groups.push(current)
      current = []
      m3 = 0
      kg = 0
    }
    current.push(d)
    m3 += d.m3
    kg += d.kg
  }
  if (current.length) groups.push(current)
  return groups
}

function smallestFittingClass(m3: number, kg: number): TruckClassId | null {
  for (const id of ['L', 'M', 'H'] as const) {
    if (m3 <= TRUCKS[id].capacityM3 && kg <= TRUCKS[id].payloadKg) return id
  }
  return null
}
