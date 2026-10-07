// Cost model (brief §4): team pools, truck trip costs, the allocation chain, pallet rules,
// the cash clock and contribution — all with traces. The world stays untouched; every
// toggle changes only how costs are spread over principals here.

import { DAYS, DENSITY_FACTOR_KG_PER_M3, DPO_DAYS, NORMAL_LOAD_FACTOR, PALLET_RULES, POOLS, PRINCIPALS, TRUCKS, TRUCK_COMMON, ZONES } from './config.ts'
import type { PoolDef, PrincipalId, Toggles, Zone } from './config.ts'
import { must, num, ref, trace } from './trace.ts'
import type { Trace } from './trace.ts'
import type { DoLine, InvoiceSent, Sku, Trip, World } from './types.ts'

const PIDS = PRINCIPALS.map((p) => p.id)
export type PoolId = PoolDef['id']
type ByPrincipal = Record<PrincipalId, number>

const zero = (): ByPrincipal => ({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 })
const skuOf = (world: World, code: string): Sku => must(world.skus[code], `SKU ${code}`)
const sumP = (r: ByPrincipal): number => PIDS.reduce((s, p) => s + r[p], 0)

// --- Pallets (§4.4) --------------------------------------------------------------------------

export interface PalletFit {
  perLayer: number
  layers: number
  perPallet: number
  /** Pallet rule label shown in traces. */
  rule: string
}

/** Best of the two straight orientations on the footprint; layers bounded by stack factor
 *  and the load height above the wooden pallet. */
export function palletFit(sku: Sku, toggles: Toggles): PalletFit {
  const rule = PALLET_RULES[toggles.palletRule]
  const w = sku.wCm / 100
  const d = sku.dCm / 100
  const h = sku.hCm / 100
  const perLayer = Math.max(1, Math.floor(rule.widthM / w) * Math.floor(rule.depthM / d), Math.floor(rule.widthM / d) * Math.floor(rule.depthM / w))
  const layers = Math.max(1, Math.min(sku.stackFactor, Math.floor((rule.heightM - rule.woodHeightM) / h)))
  return { perLayer, layers, perPallet: perLayer * layers, rule: rule.label }
}

export interface PalletVolumes {
  inByPrincipal: ByPrincipal
  outByPrincipal: ByPrincipal
  cartonsOutByPrincipal: ByPrincipal
  palletDaysByPrincipal: ByPrincipal
  /** Daily pallet positions per principal (rack visual and driver pop-ups). */
  palletsByDay: Record<number, ByPrincipal>
  palletsInByDay: Record<number, ByPrincipal>
  palletsOutByDay: Record<number, ByPrincipal>
}

export function palletVolumes(world: World, toggles: Toggles): PalletVolumes {
  const fit = new Map<string, PalletFit>()
  for (const code of Object.keys(world.skus)) fit.set(code, palletFit(skuOf(world, code), toggles))
  const fitOf = (code: string): PalletFit => must(fit.get(code), `pallet fit ${code}`)
  const v: PalletVolumes = {
    inByPrincipal: zero(), outByPrincipal: zero(), cartonsOutByPrincipal: zero(), palletDaysByPrincipal: zero(),
    palletsByDay: {}, palletsInByDay: {}, palletsOutByDay: {},
  }
  for (let day = 1; day <= DAYS; day++) {
    v.palletsByDay[day] = zero()
    v.palletsInByDay[day] = zero()
    v.palletsOutByDay[day] = zero()
  }
  for (const sd of world.stock) {
    const p = skuOf(world, sd.sku).principal
    const f = fitOf(sd.sku)
    const close = Math.ceil(sd.close / f.perPallet)
    const out = Math.ceil(sd.out / f.perPallet)
    v.palletDaysByPrincipal[p] += close
    v.outByPrincipal[p] += out
    v.cartonsOutByPrincipal[p] += sd.out
    must(v.palletsByDay[sd.day], `pallet day ${sd.day}`)[p] += close
    must(v.palletsOutByDay[sd.day], `pallet out day ${sd.day}`)[p] += out
  }
  for (const po of world.pos) {
    if (po.arrivalDay > DAYS || po.arrivalDay < 1) continue
    for (const l of po.lines) must(v.palletsInByDay[po.arrivalDay], `pallet in day ${po.arrivalDay}`)[po.principal] += Math.ceil(l.cartons / fitOf(l.sku).perPallet)
  }
  for (let day = 1; day <= DAYS; day++) {
    for (const p of PIDS) v.inByPrincipal[p] += must(v.palletsInByDay[day], `pallet in day ${day}`)[p]
  }
  return v
}

// --- Truck trip cost (§4.2) ------------------------------------------------------------------

export interface TripCostParts {
  depreciationMonth: number
  insuranceMonth: number
  vehicleTaxMonth: number
  capitalChargeMonth: number
  fixedMonth: number
  assetDaysAvailable: number
  fixedPerAssetDay: number
  assetDays: number
  driverWage: number
  timeBased: number
  fuelLoaded: number
  fuelEmpty: number
  tyreAndMaintenance: number
  distanceBased: number
  management: number
  toll: number
  unloading: number
  perTrip: number
  total: number
}

const zoneOf = (id: 1 | 2 | 3): Zone => must(ZONES.find((z) => z.id === id), `zone ${id}`)

export function tripCostParts(trip: Trip, toggles: Toggles): TripCostParts {
  const t = TRUCKS[trip.truckClass]
  const z = zoneOf(trip.zone)
  const depreciationMonth = t.bookValue / (TRUCK_COMMON.usefulLifeYears * 12)
  const insuranceMonth = (t.bookValue * TRUCK_COMMON.insuranceRatePerYear) / 12
  const vehicleTaxMonth = (t.bookValue * TRUCK_COMMON.vehicleTaxRatePerYear) / 12
  const capitalChargeMonth = (t.bookValue * TRUCK_COMMON.nbvFactor * toggles.costOfCapital) / 12
  const fixedMonth = depreciationMonth + insuranceMonth + vehicleTaxMonth + capitalChargeMonth
  const assetDaysAvailable = t.operatingDays * t.utilisation
  const fixedPerAssetDay = fixedMonth / assetDaysAvailable
  const assetDays = z.assetDaysPerTrip
  const driverWage = t.driverWagePerDay * assetDays
  const timeBased = (t.driverWagePerDay + fixedPerAssetDay) * assetDays
  const fuelLoaded = z.oneWayKm * t.litresPerKmLoaded * TRUCK_COMMON.dieselPricePerLitre
  const fuelEmpty = z.oneWayKm * t.litresPerKmEmpty * TRUCK_COMMON.dieselPricePerLitre
  const tyrePerKm = (t.tyrePrice * t.wheels) / t.tyreLifeKm
  const maintenancePerKm = t.maintenancePerMonth / t.kmPerMonth
  const tyreAndMaintenance = 2 * z.oneWayKm * (tyrePerKm + maintenancePerKm)
  const distanceBased = fuelLoaded + fuelEmpty + tyreAndMaintenance
  const management = TRUCK_COMMON.managementOverheadPerTrip
  const toll = z.tollPerTrip
  const unloading = TRUCK_COMMON.unloadingPerTrip
  const perTrip = management + toll + unloading
  return {
    depreciationMonth, insuranceMonth, vehicleTaxMonth, capitalChargeMonth, fixedMonth,
    assetDaysAvailable, fixedPerAssetDay, assetDays, driverWage, timeBased, fuelLoaded, fuelEmpty,
    tyreAndMaintenance, distanceBased, management, toll, unloading, perTrip,
    total: timeBased + distanceBased + perTrip,
  }
}

// --- Volume measure (§4.3 toggles) ------------------------------------------------------------

export const lineMeasure = (l: DoLine, toggles: Toggles): number =>
  toggles.volumeMeasure === 'chargeable' ? Math.max(l.m3, l.kg / DENSITY_FACTOR_KG_PER_M3) : l.m3

// --- Allocations ------------------------------------------------------------------------------

export interface PoolAllocation {
  def: PoolDef
  total: number
  volumeByPrincipal: ByPrincipal
  volumeTotal: number
  /** Cost per driver unit. */
  rate: number
  costByPrincipal: ByPrincipal
  allocatedTotal: number
  unallocated: number
  /** 'driver' allocated by volume, 'direct' straight to Prinsipal D, 'none'/'ga' unallocated. */
  mode: 'driver' | 'direct' | 'none' | 'ga'
  totalTrace: Trace
  rateTrace: Trace
  volumeByDay: Record<number, number>
}

export interface TripAllocation {
  trip: Trip
  parts: TripCostParts
  cost: number
  /** Active volume measure per DO and its total. */
  measureByDo: Record<string, number>
  measureTotal: number
  divisor: number
  absorbed: number
  unabsorbed: number
  doCost: Record<string, number>
  doCostTrace: Record<string, Trace>
  /** Line cost keyed by `${doId}|${sku}`. */
  lineCost: Record<string, number>
  measureByPrincipal: ByPrincipal
  costByPrincipal: ByPrincipal
  physicalM3: number
  capacityM3: number
  loadFactor: number
  totalTrace: Trace
}

export interface CapitalEntry {
  invoice: InvoiceSent
  days: number
  capital: number
  trace: Trace
}

export interface PrincipalRollup {
  id: PrincipalId
  revenue: number
  grossProfit: number
  poolCost: Record<PoolId, number>
  tripCost: number
  capitalCash: number
  capitalStock: number
  dedicatedAdmin: number
  contribution: number
  m3Delivered: number
  measureDelivered: number
  palletsIn: number
  palletsOut: number
  cartonsOut: number
  palletDays: number
  pos: number
  invoicesGen: number
  invoicesSent: number
  cashDays: number
  costPerM3: number
  costPerMeasure: number
}

export interface MetricPoint {
  day: number
  allocatedToDate: number
  m3ToDate: number
  costPerM3: number
  cashDays: number
  contribution: ByPrincipal
  /** Cumulative gross profit and allocated cost per principal, for the metrics bar. */
  gpToDate: ByPrincipal
  costToDate: ByPrincipal
}

export interface Allocations {
  toggles: Toggles
  pools: PoolAllocation[]
  pallets: PalletVolumes
  trips: TripAllocation[]
  capital: CapitalEntry[]
  capitalByPrincipal: ByPrincipal
  stockCapitalByPrincipal: ByPrincipal
  stockCapitalDetail: Record<PrincipalId, { avgStockValue: number; daysHeld: number; capital: number }>
  principal: Record<PrincipalId, PrincipalRollup>
  unallocated: { komersial: number; taxGa: number; truckCapacity: number; total: number }
  totals: { revenue: number; grossProfit: number; pools: number; trips: number; capital: number; costs: number; allocated: number }
  metrics: MetricPoint[]
}

export function allocate(world: World, toggles: Toggles): Allocations {
  const pallets = palletVolumes(world, toggles)

  // Driver volumes per principal (§3 table).
  const posByPrincipal = zero()
  for (const po of world.pos) posByPrincipal[po.principal] += 1
  const posReceivedByPrincipal = zero()
  for (const po of world.pos) if (po.arrivalDay >= 1 && po.arrivalDay <= DAYS) posReceivedByPrincipal[po.principal] += 1
  const invoicesGenBy = zero()
  for (const g of world.invoicesGen) invoicesGenBy[g.principal] += 1
  const invoicesSentBy = zero()
  for (const s of world.invoicesSent) invoicesSentBy[s.principal] += 1

  // --- Trips: cost, allocation to DOs, then to SKU lines and principals (§4.2–4.3).
  const doById = new Map(world.dos.map((d) => [d.id, d]))
  const trips: TripAllocation[] = []
  const tripCostByPrincipal = zero()
  const measureByPrincipalTotal = zero()
  const revenueByPrincipal = zero()
  const gpByPrincipal = zero()

  for (const trip of world.trips) {
    const parts = tripCostParts(trip, toggles)
    const measureByDo: Record<string, number> = {}
    let measureTotal = 0
    let physicalM3 = 0
    const measureByPrincipal = zero()
    for (const doId of trip.dos) {
      const d = must(doById.get(doId), `DO ${doId}`)
      let m = 0
      for (const l of d.lines) {
        const sku = skuOf(world, l.sku)
        const lm = lineMeasure(l, toggles)
        m += lm
        measureByPrincipal[sku.principal] += lm
        measureByPrincipalTotal[sku.principal] += lm
        revenueByPrincipal[sku.principal] += l.value
        gpByPrincipal[sku.principal] += l.value * sku.margin
      }
      measureByDo[doId] = m
      measureTotal += m
      physicalM3 += d.m3
    }
    const capacityM3 = TRUCKS[trip.truckClass].capacityM3
    const divisor = toggles.truckBasis === 'capacity' ? Math.max(measureTotal, capacityM3 * NORMAL_LOAD_FACTOR) : measureTotal
    const absorbed = divisor > 0 ? (parts.total * measureTotal) / divisor : 0
    const unabsorbed = parts.total - absorbed
    const costByPrincipal = zero()
    const doCost: Record<string, number> = {}
    const doCostTrace: Record<string, Trace> = {}
    const lineCost: Record<string, number> = {}
    const totalTrace = tripTotalTrace(trip, parts)
    for (const doId of trip.dos) {
      const mDo = must(measureByDo[doId], `measure of ${doId}`)
      const share = measureTotal > 0 ? mDo / measureTotal : 0
      // On the capacity basis the DOs share the absorbed part only; the unabsorbed
      // remainder is shown as "Kapasitas truk tak terpakai" and never allocated.
      const cost = absorbed * share
      doCost[doId] = cost
      doCostTrace[doId] = trace(
        `Biaya DO ${doId}`, 'rp', '{0} × {1} / {2}',
        [ref(num('biaya trip yang diserap barang', absorbed, 'rp'), totalTrace), num('m³ DO (ukuran aktif)', mDo, 'm3'), num('m³ trip (ukuran aktif)', measureTotal, 'm3')],
        (a, dm, tm) => (tm > 0 ? (a * dm) / tm : 0),
      )
      const d = must(doById.get(doId), `DO ${doId}`)
      for (const l of d.lines) {
        const sku = skuOf(world, l.sku)
        const lm = lineMeasure(l, toggles)
        const lc = mDo > 0 ? (cost * lm) / mDo : 0
        lineCost[`${doId}|${l.sku}`] = lc
        costByPrincipal[sku.principal] += lc
      }
    }
    for (const p of PIDS) tripCostByPrincipal[p] += costByPrincipal[p]
    trips.push({
      trip, parts, cost: parts.total, measureByDo, measureTotal, divisor, absorbed, unabsorbed,
      doCost, doCostTrace, lineCost, measureByPrincipal, costByPrincipal,
      physicalM3, capacityM3, loadFactor: physicalM3 / capacityM3, totalTrace,
    })
  }

  // --- Pools (§4.1).
  const pools: PoolAllocation[] = POOLS.map((def) => {
    const total = def.headcount * def.costPerPerson
    const totalTrace = trace(
      `Pool ${def.team}`, 'rp', '{0} × {1}',
      [num('jumlah orang', def.headcount, 'count'), num('biaya per orang per bulan', def.costPerPerson, 'rp')],
      (h, c) => h * c,
    )
    const volumeByDay: Record<number, number> = {}
    for (let day = 1; day <= DAYS; day++) volumeByDay[day] = 0
    let volumeByPrincipal = zero()
    let mode: PoolAllocation['mode'] = 'driver'
    let unitVolume: (p: PrincipalId) => number = () => 0
    if (def.id === 'komersial') {
      mode = 'none'
    } else if (def.id === 'salesAdminDedicated') {
      mode = 'direct'
    } else if (def.id === 'salesAdminShared') {
      volumeByPrincipal = { ...posByPrincipal }
      unitVolume = (p) => posByPrincipal[p]
      for (const po of world.pos) volumeByDay[po.day] = (volumeByDay[po.day] ?? 0) + 1
    } else if (def.id === 'inbound') {
      volumeByPrincipal = { ...pallets.inByPrincipal }
      unitVolume = (p) => pallets.inByPrincipal[p]
      for (let day = 1; day <= DAYS; day++) volumeByDay[day] = sumP(must(pallets.palletsInByDay[day], `day ${day}`))
    } else if (def.id === 'wms') {
      volumeByPrincipal = { ...posReceivedByPrincipal }
      unitVolume = (p) => posReceivedByPrincipal[p]
      for (const po of world.pos) if (po.arrivalDay >= 1 && po.arrivalDay <= DAYS) volumeByDay[po.arrivalDay] = (volumeByDay[po.arrivalDay] ?? 0) + 1
    } else if (def.id === 'gudang') {
      volumeByPrincipal = { ...pallets.palletDaysByPrincipal }
      unitVolume = (p) => pallets.palletDaysByPrincipal[p]
      for (let day = 1; day <= DAYS; day++) volumeByDay[day] = sumP(must(pallets.palletsByDay[day], `day ${day}`))
    } else if (def.id === 'packing') {
      volumeByPrincipal = toggles.outboundDriver === 'pallets' ? { ...pallets.outByPrincipal } : { ...pallets.cartonsOutByPrincipal }
      unitVolume = (p) => (toggles.outboundDriver === 'pallets' ? pallets.outByPrincipal[p] : pallets.cartonsOutByPrincipal[p])
      for (let day = 1; day <= DAYS; day++) {
        volumeByDay[day] =
          toggles.outboundDriver === 'pallets'
            ? sumP(must(pallets.palletsOutByDay[day], `day ${day}`))
            : world.dos.filter((d) => d.day === day).reduce((s, d) => s + d.lines.reduce((x, l) => x + l.cartons, 0), 0)
      }
    } else if (def.id === 'arFinance') {
      volumeByPrincipal = { ...invoicesGenBy }
      unitVolume = (p) => invoicesGenBy[p]
      for (const g of world.invoicesGen) volumeByDay[g.day] = (volumeByDay[g.day] ?? 0) + 1
    } else if (def.id === 'tax') {
      if (toggles.taxAllocation === 'ga') {
        mode = 'ga'
      } else {
        volumeByPrincipal = { ...invoicesSentBy }
        unitVolume = (p) => invoicesSentBy[p]
        for (const s of world.invoicesSent) volumeByDay[s.sentDay] = (volumeByDay[s.sentDay] ?? 0) + 1
      }
    }
    const volumeTotal = PIDS.reduce((s, p) => s + unitVolume(p), 0)
    const rate = mode === 'driver' && volumeTotal > 0 ? total / volumeTotal : 0
    const costByPrincipal = zero()
    let allocatedTotal = 0
    if (mode === 'driver') {
      for (const p of PIDS) {
        costByPrincipal[p] = unitVolume(p) * rate
        allocatedTotal += costByPrincipal[p]
      }
    } else if (mode === 'direct') {
      costByPrincipal.D = total
      allocatedTotal = total
    }
    const rateTrace =
      mode === 'driver'
        ? trace(
            `Tarif ${def.team} per ${def.unit ?? 'unit'}`, 'rp', '{0} / {1}',
            [ref(num('total pool', total, 'rp'), totalTrace), num(`volume driver (${def.driver ?? '-'})`, volumeTotal, 'count')],
            (t2, v) => (v > 0 ? t2 / v : 0),
          )
        : totalTrace
    return {
      def, total, volumeByPrincipal, volumeTotal, rate, costByPrincipal, allocatedTotal,
      unallocated: total - allocatedTotal, mode, totalTrace, rateTrace, volumeByDay,
    }
  })

  // --- Cash clock (§4.5).
  const capital: CapitalEntry[] = []
  const capitalByPrincipal = zero()
  for (const inv of world.invoicesSent) {
    const days = inv.seg1 + inv.seg2 + inv.seg3
    const t = trace(
      `Biaya modal invoice ${inv.id}`, 'rp', '{0} × {1} × {2} / 365',
      [num('asumsi biaya modal (per tahun)', toggles.costOfCapital, 'pct'), num('nilai invoice', inv.value, 'rp'), num('hari kas tertahan', days, 'day')],
      (r, v, d) => (r * v * d) / 365,
    )
    capital.push({ invoice: inv, days, capital: t.value, trace: t })
    capitalByPrincipal[inv.principal] += t.value
  }

  // --- Inventory capital (toggle, §4.5): stock value × max(0, days held − DPO).
  const stockCapitalByPrincipal = zero()
  const stockCapitalDetail = {} as Record<PrincipalId, { avgStockValue: number; daysHeld: number; capital: number }>
  if (toggles.stockCapital) {
    for (const p of PIDS) {
      let stockValueSum = 0
      let outValue = 0
      for (const sd of world.stock) {
        const sku = skuOf(world, sd.sku)
        if (sku.principal !== p) continue
        stockValueSum += sd.close * sku.pricePerCarton
        outValue += sd.out * sku.pricePerCarton
      }
      const avgStockValue = stockValueSum / DAYS
      const dailyOutValue = outValue / DAYS
      const daysHeld = dailyOutValue > 0 ? avgStockValue / dailyOutValue : 0
      const held = Math.max(0, daysHeld - DPO_DAYS)
      const cap = (toggles.costOfCapital * avgStockValue * held) / 365
      stockCapitalByPrincipal[p] = cap
      stockCapitalDetail[p] = { avgStockValue, daysHeld, capital: cap }
    }
  }

  // --- Principal rollups and contribution (§4.6).
  const poolCostByPrincipal: Record<PrincipalId, Record<PoolId, number>> = {} as Record<PrincipalId, Record<PoolId, number>>
  for (const p of PIDS) poolCostByPrincipal[p] = Object.fromEntries(POOLS.map((d) => [d.id, 0])) as Record<PoolId, number>
  for (const pool of pools) for (const p of PIDS) poolCostByPrincipal[p][pool.def.id] = pool.costByPrincipal[p]

  const principal = {} as Record<PrincipalId, PrincipalRollup>
  for (const p of PIDS) {
    const m3ByP = world.dos.reduce((s, d) => s + d.lines.filter((l) => skuOf(world, l.sku).principal === p).reduce((x, l) => x + l.m3, 0), 0)
    const poolAllocated = pools.filter((x) => x.def.id !== 'salesAdminDedicated').reduce((s, x) => s + x.costByPrincipal[p], 0)
    const dedicated = poolCostByPrincipal[p].salesAdminDedicated
    const totalCost = poolAllocated + dedicated + tripCostByPrincipal[p] + capitalByPrincipal[p] + stockCapitalByPrincipal[p]
    const mySent = world.invoicesSent.filter((i) => i.principal === p)
    const cashValue = mySent.reduce((s, i) => s + i.value, 0)
    const cashDaysSum = mySent.reduce((s, i) => s + i.value * (i.seg1 + i.seg2 + i.seg3), 0)
    principal[p] = {
      id: p,
      revenue: revenueByPrincipal[p],
      grossProfit: gpByPrincipal[p],
      poolCost: poolCostByPrincipal[p],
      tripCost: tripCostByPrincipal[p],
      capitalCash: capitalByPrincipal[p],
      capitalStock: stockCapitalByPrincipal[p],
      dedicatedAdmin: dedicated,
      contribution: gpByPrincipal[p] - totalCost,
      m3Delivered: m3ByP,
      measureDelivered: measureByPrincipalTotal[p],
      palletsIn: pallets.inByPrincipal[p],
      palletsOut: pallets.outByPrincipal[p],
      cartonsOut: pallets.cartonsOutByPrincipal[p],
      palletDays: pallets.palletDaysByPrincipal[p],
      pos: posByPrincipal[p],
      invoicesGen: invoicesGenBy[p],
      invoicesSent: invoicesSentBy[p],
      cashDays: cashValue > 0 ? cashDaysSum / cashValue : 0,
      costPerM3: m3ByP > 0 ? totalCost / m3ByP : 0,
      costPerMeasure: measureByPrincipalTotal[p] > 0 ? totalCost / measureByPrincipalTotal[p] : 0,
    }
  }

  // --- Company totals and the unallocated lines.
  const komersial = pools.find((x) => x.def.id === 'komersial')?.total ?? 0
  const taxGa = toggles.taxAllocation === 'ga' ? (pools.find((x) => x.def.id === 'tax')?.total ?? 0) : 0
  const truckCapacity = trips.reduce((s, t) => s + t.unabsorbed, 0)
  const poolsTotal = pools.reduce((s, x) => s + x.total, 0)
  const tripsTotal = trips.reduce((s, t) => s + t.cost, 0)
  const capitalTotal = capital.reduce((s, c) => s + c.capital, 0) + sumP(stockCapitalByPrincipal)
  const totalGrossProfit = PIDS.reduce((s, p) => s + principal[p].grossProfit, 0)
  const allocatedTotal = pools.reduce((s, x) => s + x.allocatedTotal, 0) + tripsTotal - truckCapacity + capitalTotal

  // --- Timeline metrics (§7.3): cumulative series following the scrubber.
  const dayShare = (pool: PoolAllocation, day: number): number => {
    if (pool.mode === 'driver') return pool.volumeTotal > 0 ? (pool.volumeByDay[day] ?? 0) / pool.volumeTotal : 0
    if (pool.mode === 'direct') return 1 / DAYS
    return 0
  }
  const tripAbsorbedByDay: number[] = []
  const capitalByDay: number[] = []
  for (let day = 1; day <= DAYS; day++) {
    tripAbsorbedByDay.push(trips.filter((t) => t.trip.day === day).reduce((s, t) => s + t.absorbed, 0))
    capitalByDay.push(capital.filter((c) => c.invoice.payDay === day).reduce((s, c) => s + c.capital, 0))
  }
  const gpByDayByPrincipal = new Map<PrincipalId, number[]>()
  const costByDayByPrincipal = new Map<PrincipalId, number[]>()
  for (const p of PIDS) {
    const gp: number[] = []
    const cost: number[] = []
    for (let day = 1; day <= DAYS; day++) {
      const lines = world.dos.filter((d) => d.day === day).flatMap((d) => d.lines.filter((l) => skuOf(world, l.sku).principal === p))
      gp.push(lines.reduce((s, l) => s + l.value * skuOf(world, l.sku).margin, 0))
      const tripLines = trips
        .filter((t) => t.trip.day === day)
        .reduce((s, t) => {
          for (const doId of t.trip.dos) {
            const d = must(doById.get(doId), `DO ${doId}`)
            for (const l of d.lines) if (skuOf(world, l.sku).principal === p) s += t.lineCost[`${doId}|${l.sku}`] ?? 0
          }
          return s
        }, 0)
      const poolDay = pools.reduce((s, pool) => s + pool.costByPrincipal[p] * dayShare(pool, day), 0)
      const cashDay = capital.filter((c) => c.invoice.principal === p && c.invoice.payDay === day).reduce((s, c) => s + c.capital, 0)
      const stockDay = toggles.stockCapital ? stockCapitalByPrincipal[p] / DAYS : 0
      cost.push(tripLines + poolDay + cashDay + stockDay)
    }
    gpByDayByPrincipal.set(p, gp)
    costByDayByPrincipal.set(p, cost)
  }
  const metrics: MetricPoint[] = []
  let allocatedAcc = 0
  let m3Acc = 0
  for (let day = 1; day <= DAYS; day++) {
    allocatedAcc += pools.reduce((s, pool) => s + pool.allocatedTotal * dayShare(pool, day), 0) + (tripAbsorbedByDay[day - 1] ?? 0) + (capitalByDay[day - 1] ?? 0)
    m3Acc += world.dos.filter((d) => d.day === day).reduce((s, d) => s + d.m3, 0)
    const sent = world.invoicesSent.filter((i) => i.sentDay <= day)
    const sentValue = sent.reduce((s, i) => s + i.value, 0)
    const sentDays = sent.reduce((s, i) => s + i.value * (i.seg1 + i.seg2 + i.seg3), 0)
    const contribution = zero()
    const gpToDate = zero()
    const costToDate = zero()
    for (const p of PIDS) {
      let gpAcc = 0
      let costAcc = 0
      for (let d2 = 1; d2 <= day; d2++) {
        gpAcc += must(gpByDayByPrincipal.get(p), `gp day ${p}`)[d2 - 1] ?? 0
        costAcc += must(costByDayByPrincipal.get(p), `cost day ${p}`)[d2 - 1] ?? 0
      }
      contribution[p] = gpAcc - costAcc
      gpToDate[p] = gpAcc
      costToDate[p] = costAcc
    }
    metrics.push({
      day,
      allocatedToDate: allocatedAcc,
      m3ToDate: m3Acc,
      costPerM3: m3Acc > 0 ? allocatedAcc / m3Acc : 0,
      cashDays: sentValue > 0 ? sentDays / sentValue : 0,
      contribution,
      gpToDate,
      costToDate,
    })
  }

  return {
    toggles,
    pools,
    pallets,
    trips,
    capital,
    capitalByPrincipal,
    stockCapitalByPrincipal,
    stockCapitalDetail,
    principal,
    unallocated: { komersial, taxGa, truckCapacity, total: komersial + taxGa + truckCapacity },
    totals: {
      revenue: PIDS.reduce((s, p) => s + principal[p].revenue, 0),
      grossProfit: totalGrossProfit,
      pools: poolsTotal,
      trips: tripsTotal,
      capital: capitalTotal,
      costs: poolsTotal + tripsTotal + capitalTotal,
      allocated: allocatedTotal,
    },
    metrics,
  }
}

function tripTotalTrace(trip: Trip, parts: TripCostParts): Trace {
  return trace(
    `Biaya trip ${trip.id} (${trip.truckCode}, Zona ${trip.zone})`, 'rp', '{0} + {1} + {2}',
    [
      num('berbasis waktu', parts.timeBased, 'rp'),
      num('berbasis jarak', parts.distanceBased, 'rp'),
      num('per trip', parts.perTrip, 'rp'),
    ],
    (a, b, c) => a + b + c,
  )
}

/** Lazy trace for one SKU line inside a DO (truck panel drill-down). */
export function lineCostTrace(world: World, alloc: Allocations, doId: string, skuCode: string): Trace {
  const trip = must(alloc.trips.find((t) => doId in t.doCost), `trip of ${doId}`)
  const d = must(world.dos.find((x) => x.id === doId), `DO ${doId}`)
  const line = must(d.lines.find((l) => l.sku === skuCode), `line ${skuCode} of ${doId}`)
  const lm = lineMeasure(line, alloc.toggles)
  return trace(
    `Biaya baris ${skuCode} di ${doId}`, 'rp', '{0} × {1} / {2}',
    [
      ref(num('biaya DO', must(trip.doCost[doId], `DO cost ${doId}`), 'rp'), must(trip.doCostTrace[doId], `DO trace ${doId}`)),
      num('m³ baris (ukuran aktif)', lm, 'm3'),
      num('m³ DO (ukuran aktif)', must(trip.measureByDo[doId], `DO measure ${doId}`), 'm3'),
    ],
    (c, lmv, dmv) => (dmv > 0 ? (c * lmv) / dmv : 0),
  )
}

/** Lazy traces for the metrics bar (§7.3). */
export function metricsTrace(kind: 'costPerM3' | 'cashDays', point: MetricPoint, alloc: Allocations): Trace {
  if (kind === 'costPerM3') {
    return trace(
      'Biaya layanan per m³ s.d. hari ini', 'rp', '{0} / {1}',
      [num('biaya teralokasi s.d. hari ini', point.allocatedToDate, 'rp'), num('m³ terkirim s.d. hari ini', point.m3ToDate, 'm3')],
      (c, m) => (m > 0 ? c / m : 0),
    )
  }
  const sent = alloc.capital.map((c) => c.invoice)
  const value = sent.filter((i) => i.sentDay <= point.day).reduce((s, i) => s + i.value, 0)
  const days = sent.filter((i) => i.sentDay <= point.day).reduce((s, i) => s + i.value * (i.seg1 + i.seg2 + i.seg3), 0)
  return trace(
    'Hari kas tertahan (rata-rata tertimbang)', 'day', 'Σ(nilai × hari) / Σ nilai',
    [num('Σ nilai invoice terkirim s.d. hari ini', value, 'rp'), num('Σ nilai × hari', days, 'rp')],
    (v, d) => (v > 0 ? d / v : 0),
  )
}
