// World 2 cost model (brief 2 §4). Shared warehouse pools (S1–S5) go to principals by
// their drivers, then split to channels by m³ shipped (toggle). Regular outbound teams
// split by pick lines × standard minutes (toggle: shared vs separate). ISD lands only on
// P0/P1 orders. B2C order economics per §4.3; B2B reuses world 1's trip chain and cash
// clock (assumption 7). Every pool reconciles down to the orders and principals that carry
// it; every figure carries a trace.

import { DAYS, POOLS, SEPARATE_TEAM_OVERHEAD, STANDARD_MINUTES, TICKETS_PER_ORDER, PLATFORMS } from './config.ts'
import type { PlatformId, Toggles2 } from './config.ts'
import type { World2 } from './types.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { DEFAULT_TOGGLES as D1, allocate as allocateD1, palletFit } from '../../distribusi/engine/index.ts'
import type { Allocations as Allocations1 } from '../../distribusi/engine/index.ts'
import { num, trace } from '../../../core/trace.ts'
import type { Trace } from '../../../core/trace.ts'
import { must } from '../../../core/trace.ts'

const PIDS: PrincipalId[] = ['A', 'B', 'C', 'D', 'E', 'F']
type ByP = Record<PrincipalId, number>
const zero = (): ByP => ({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 })
type ByPlat = Record<PlatformId, number>
const zeroPlat = (): ByPlat => ({ 'MP-A': 0, 'MP-B': 0, 'MP-C': 0, 'MP-D': 0, 'MP-E': 0, WEB: 0 })

export interface PoolAllocation2 {
  id: string
  team: string
  total: number
  /** Shared pools: principal split then channel split. Others: channel split directly. */
  byPrincipal?: ByP
  b2b: number
  b2c: number
  unallocated: number
  driver: string
  totalTrace: Trace
}

export interface OrderEconomics {
  id: string
  platform: PlatformId
  priority: string
  /** Lead principal (first item), for colour and labels. Baskets can mix principals; the
   *  principal views use `byPrincipal`. */
  principal: PrincipalId
  /** The order split over its items' principals: revenue and order-level costs by item GMV,
   *  shared warehouse cost by each item's own principal and m³. */
  byPrincipal: Partial<Record<PrincipalId, { revenue: number; cost: number }>>
  revenue: number
  fee: number
  sellerShipping: number
  packaging: number
  returnCost: number
  teamCost: number
  sharedCost: number
  capital: number
  contribution: number
}

export interface PlatformView {
  id: PlatformId
  orders: number
  gmv: number
  voucher: number
  fee: number
  sellerShipping: number
  packaging: number
  returnCost: number
  cs: number
  shop: number
  outbound: number
  shared: number
  capital: number
  netSettlement: number
  settlementDays: number
  contribution: number
}

export interface PriorityView {
  priority: 'P0' | 'P1' | 'P2'
  orders: number
  avgCost: number
  avgRevenue: number
  avgContribution: number
}

export interface Allocations2 {
  toggles: Toggles2
  pools: PoolAllocation2[]
  /** The "Biaya gudang bersama" line when the principal split is not charged to channels. */
  sharedUnsplit: number
  /** B2B trip chain, reused from world 1 on the embedded smaller world. */
  b2bAlloc: Allocations1
  /** Regular outbound minutes and their cost per channel. */
  outbound: { b2bMinutes: number; b2cMinutes: number; b2bCost: number; b2cCost: number; separateOverhead: number }
  isd: { total: number; p0p1Orders: number; perOrder: number }
  replenishment: { total: number; b2bUnits: number; b2cUnits: number }
  perOrder: OrderEconomics[]
  platform: Record<PlatformId, PlatformView>
  priority: PriorityView[]
  principalChannel: Record<PrincipalId, { b2b: number; b2c: number; revenueB2b: number; revenueB2c: number }>
  capitalB2c: number
  totals: { revenue: number; costs: number; ordersB2c: number; dosB2b: number }
}

const RETURN_REVERSE_FACTOR = 0.7
const RESTOCK_COST_PER_PIECE = 500

export function allocate2(world: World2, toggles: Toggles2): Allocations2 {
  const { b2b } = world
  const pc = (code: string): number => must(world.piecesPerCarton[code], `pieces ${code}`)

  // --- World 1 machinery on the embedded B2B world (trips, capital, revenue; assumption 7).
  const b2bAlloc = allocateD1(b2b, { ...D1, costOfCapital: toggles.costOfCapital, stockCapital: toggles.stockCapital })

  // --- Driver volumes per principal.
  const asnByP = zero()
  for (const po of b2b.pos) asnByP[po.principal] += 1
  const cartonsInByP = zero()
  const palletsPutawayByP = zero()
  for (const po of b2b.pos) {
    for (const l of po.lines) {
      cartonsInByP[po.principal] += l.cartons
      palletsPutawayByP[po.principal] += Math.ceil(l.cartons / palletFit(must(world.skus[l.sku], `sku ${l.sku}`), { ...D1 }).perPallet)
    }
  }
  const bulkPalletDaysByP = zero()
  const locationsCountedByP = zero()
  const pickLocationsByP = zero()
  const quarantinedByP = zero()
  for (const row of world.ledger) {
    const p = must(world.skus[row.sku], `sku ${row.sku}`).principal
    bulkPalletDaysByP[p] += Math.ceil(row.close / pc(row.sku) / palletFit(must(world.skus[row.sku], 'sku'), { ...D1 }).perPallet)
  }
  for (const f of world.pickFace) {
    const p = must(world.skus[f.sku], `sku ${f.sku}`).principal
    if (f.replenishedPieces > 0 || f.stockPieces > 0) {
      locationsCountedByP[p] += 1
      pickLocationsByP[p] += 1
    }
  }
  for (const [sku, pieces] of Object.entries(world.quarantinedPieces)) {
    quarantinedByP[must(world.skus[sku], 'sku').principal] += pieces
  }
  const m3B2bByP = zero()
  for (const d of b2b.dos) for (const l of d.lines) m3B2bByP[must(world.skus[l.sku], 'sku').principal] += l.m3
  const m3B2cByP = zero()
  const piecesB2cByP = zero()
  const piecesB2bByP = zero()
  for (const o of world.orders) {
    if (o.shipDay > DAYS) continue
    for (const it of o.items) {
      m3B2cByP[it.principal] += (it.pieces * it.pieceVolumeCm3) / 1_000_000
      piecesB2cByP[it.principal] += it.pieces
    }
  }
  for (const row of world.ledger) {
    piecesB2bByP[must(world.skus[row.sku], 'sku').principal] += row.outB2b
  }
  const doCount = b2b.dos.length
  const ordersShipped = world.orders.filter((o) => o.shipDay <= DAYS)

  // --- Shared pools S1–S5 → principals → channels (§4.1).
  const driverOf: Record<string, ByP> = {
    asnAdmin: asnByP,
    inbound: cartonsInByP,
    putaway: palletsPutawayByP,
    storage: addByP(bulkPalletDaysByP, pickLocationsByP),
    stockMgmt: addByP(scaleByP(locationsCountedByP, 0.5), quarantinedByP),
  }
  const sharedCostByP: ByP = zero()
  const pools: PoolAllocation2[] = POOLS.filter((d) => d.stage === 'shared').map((def) => {
    const total = def.headcount * def.costPerPerson
    const driver = must(driverOf[def.id], `driver ${def.id}`)
    const driverTotal = PIDS.reduce((s, p) => s + driver[p], 0)
    const byPrincipal = zero()
    for (const p of PIDS) byPrincipal[p] = driverTotal > 0 ? (total * driver[p]) / driverTotal : 0
    for (const p of PIDS) sharedCostByP[p] += byPrincipal[p]
    const split = channelSplitByP(byPrincipal, m3B2bByP, m3B2cByP, toggles.sharedSplit)
    return {
      id: def.id, team: def.team, total, byPrincipal, b2b: split.b2b, b2c: split.b2c,
      unallocated: split.unsplit, driver: def.driver,
      totalTrace: trace(`Pool ${def.team}`, 'rp', '{0} × {1}', [num('orang', def.headcount, 'count'), num('biaya per orang', def.costPerPerson, 'rp')], (h, c) => h * c),
    }
  })

  // --- Regular outbound teams by standard minutes (§4.2): pick lines plus the dispatch work
  // per B2C package and per B2B carton — the same minutes the orders and DOs are charged.
  const b2bLineMinutes = (lines: { cartons: number }[]): number => lines.reduce((s, l) => s + STANDARD_MINUTES.b2bLine + l.cartons * STANDARD_MINUTES.b2bCarton, 0)
  const b2cOrderMinutes = (itemCount: number): number => itemCount * STANDARD_MINUTES.b2cLine + STANDARD_MINUTES.b2cPackage
  const b2bMinutes = b2b.dos.reduce((s, d) => s + b2bLineMinutes(d.lines), 0)
  const b2cMinutes = ordersShipped.reduce((s, o) => s + b2cOrderMinutes(o.items.length), 0)
  const outboundPools = POOLS.filter((d) => d.stage === 'outbound').map((def) => {
    const base = def.headcount * def.costPerPerson
    const total = toggles.sharedTeams ? base : base * (1 + SEPARATE_TEAM_OVERHEAD)
    const minuteShare = b2bMinutes + b2cMinutes > 0 ? b2bMinutes / (b2bMinutes + b2cMinutes) : 0.5
    return {
      id: def.id, team: def.team, total, b2b: total * minuteShare, b2c: total * (1 - minuteShare),
      unallocated: 0, driver: def.driver,
      totalTrace: trace(`Pool ${def.team}`, 'rp', '{0} × {1}', [num('orang', def.headcount, 'count'), num('biaya per orang', def.costPerPerson, 'rp')], (h, c) => h * c),
    }
  })
  pools.push(...outboundPools)
  const outboundB2b = outboundPools.reduce((s, p) => s + p.b2b, 0)
  const outboundB2c = outboundPools.reduce((s, p) => s + p.b2c, 0)

  // --- ISD team: P0 and P1 orders only (§3.3, control 4).
  const isdDef = must(POOLS.find((d) => d.stage === 'isd'), 'isd pool')
  const isdTotal = isdDef.headcount * isdDef.costPerPerson
  const p0p1 = ordersShipped.filter((o) => o.priority !== 'P2')
  const isdPerOrder = p0p1.length > 0 ? isdTotal / p0p1.length : 0
  pools.push({ id: 'isd', team: isdDef.team, total: isdTotal, b2b: 0, b2c: isdTotal, unallocated: 0, driver: isdDef.driver, totalTrace: trace('Pool ISD', 'rp', '{0} × {1}', [num('orang', isdDef.headcount, 'count'), num('biaya per orang', isdDef.costPerPerson, 'rp')], (h, c) => h * c) })

  // --- Replenishment by units picked from the pick face per channel (§4.2).
  const repDef = must(POOLS.find((d) => d.stage === 'replenishment'), 'replenishment pool')
  const repTotal = repDef.headcount * repDef.costPerPerson
  const b2bUnits = PIDS.reduce((s, p) => s + piecesB2bByP[p], 0)
  const b2cUnits = PIDS.reduce((s, p) => s + piecesB2cByP[p], 0)
  const unitTotal = b2bUnits + b2cUnits
  const repB2b = unitTotal > 0 ? (repTotal * b2bUnits) / unitTotal : 0
  const repB2c = repTotal - repB2b
  pools.push({ id: 'replenishment', team: repDef.team, total: repTotal, b2b: repB2b, b2c: repB2c, unallocated: 0, driver: repDef.driver, totalTrace: trace('Pool Replenishment', 'rp', '{0} × {1}', [num('orang', repDef.headcount, 'count'), num('biaya per orang', repDef.costPerPerson, 'rp')], (h, c) => h * c) })

  // --- CS by tickets, shop management by orders per platform, returns desk by returns.
  const ticketsByPlat = zeroPlat()
  const ordersByPlat = zeroPlat()
  const returnsByPlat = zeroPlat()
  for (const o of ordersShipped) {
    ordersByPlat[o.platform] += 1
    ticketsByPlat[o.platform] += TICKETS_PER_ORDER + (o.returned ? 1 : 0)
    if (o.returned) returnsByPlat[o.platform] += 1
  }
  const csDef = must(POOLS.find((d) => d.stage === 'cs'), 'cs pool')
  const csTotal = csDef.headcount * csDef.costPerPerson
  const csByPlat = splitPlat(csTotal, ticketsByPlat)
  pools.push({ id: 'cs', team: csDef.team, total: csTotal, b2b: 0, b2c: csTotal, unallocated: 0, driver: csDef.driver, totalTrace: trace('Pool CS', 'rp', '{0} × {1}', [num('orang', csDef.headcount, 'count'), num('biaya per orang', csDef.costPerPerson, 'rp')], (h, c) => h * c) })

  const shopDef = must(POOLS.find((d) => d.stage === 'shop'), 'shop pool')
  const shopTotal = shopDef.headcount * shopDef.costPerPerson
  const shopByPlat = splitPlat(shopTotal, ordersByPlat)
  pools.push({ id: 'shopMgmt', team: shopDef.team, total: shopTotal, b2b: 0, b2c: shopTotal, unallocated: 0, driver: shopDef.driver, totalTrace: trace('Pool Shop management', 'rp', '{0} × {1}', [num('orang', shopDef.headcount, 'count'), num('biaya per orang', shopDef.costPerPerson, 'rp')], (h, c) => h * c) })

  const retDef = must(POOLS.find((d) => d.stage === 'returns'), 'returns pool')
  const retTotal = retDef.headcount * retDef.costPerPerson
  const returnsPiecesByP = zero()
  for (const o of ordersShipped) {
    if (!o.returned) continue
    for (const it of o.items) returnsPiecesByP[it.principal] += it.pieces
  }
  const retPiecesTotal = PIDS.reduce((s, p) => s + returnsPiecesByP[p], 0)
  pools.push({ id: 'returnsDesk', team: retDef.team, total: retTotal, b2b: 0, b2c: retTotal, unallocated: 0, driver: retDef.driver, totalTrace: trace('Pool Meja retur', 'rp', '{0} × {1}', [num('orang', retDef.headcount, 'count'), num('biaya per orang', retDef.costPerPerson, 'rp')], (h, c) => h * c) })

  // --- Per-order economics (§4.3, §4.4).
  const costPerB2cMinute = b2cMinutes > 0 ? outboundB2c / b2cMinutes : 0
  const costPerUnit = unitTotal > 0 ? repTotal / unitTotal : 0
  // The shared-warehouse share of channel costs is only the S1–S5 pools (replenishment,
  // CS, shop management, ISD and the returns desk belong to the channels directly). It flows
  // pool → principal (drivers) → channel (m³) → order item (m³ within its principal).
  const sharedB2bByP = zero()
  const sharedB2cByP = zero()
  for (const p of PIDS) {
    const m = m3B2bByP[p] + m3B2cByP[p]
    if (toggles.sharedSplit !== 'volume' || m <= 0) continue
    sharedB2bByP[p] = sharedCostByP[p] * (m3B2bByP[p] / m)
    sharedB2cByP[p] = sharedCostByP[p] * (m3B2cByP[p] / m)
  }
  const perOrder: OrderEconomics[] = []
  const platform = {} as Record<PlatformId, PlatformView>
  for (const pf of PLATFORMS) {
    platform[pf.id] = {
      id: pf.id, orders: 0, gmv: 0, voucher: 0, fee: 0, sellerShipping: 0, packaging: 0,
      returnCost: 0, cs: csByPlat[pf.id], shop: shopByPlat[pf.id], outbound: 0, shared: 0,
      capital: 0, netSettlement: 0, settlementDays: pf.settlementDays, contribution: 0,
    }
  }
  for (const o of ordersShipped) {
    const pfConf = must(PLATFORMS.find((x) => x.id === o.platform), 'platform')
    const sellerShipping = toggles.shippingBearer === 'penjual' ? o.shipping : 0
    const reverse = o.returned ? o.shipping * RETURN_REVERSE_FACTOR : 0
    const restockOrWriteoff = o.returned ? (o.restocked ? o.items.reduce((s, x) => s + x.pieces, 0) * RESTOCK_COST_PER_PIECE : o.gmv * 0.5) : 0
    const returnCost = reverse + restockOrWriteoff
    const outboundCost = b2cOrderMinutes(o.items.length) * costPerB2cMinute
    const isdCost = o.priority !== 'P2' ? isdPerOrder : 0
    const replenishCost = o.items.reduce((s, x) => s + x.pieces, 0) * costPerUnit
    const itemShared = o.items.map((x) => (m3B2cByP[x.principal] > 0 ? (sharedB2cByP[x.principal] * ((x.pieces * x.pieceVolumeCm3) / 1_000_000)) / m3B2cByP[x.principal] : 0))
    const sharedCost = itemShared.reduce((s, x) => s + x, 0)
    const net = o.netSettlement - sellerShipping
    const capital = (toggles.costOfCapital * Math.max(0, net) * pfConf.settlementDays) / 365
    const tickets = TICKETS_PER_ORDER + (o.returned ? 1 : 0)
    const csOrder = ticketsByPlat[o.platform] > 0 ? csByPlat[o.platform] * (tickets / ticketsByPlat[o.platform]) : 0
    const shopOrder = ordersByPlat[o.platform] > 0 ? shopByPlat[o.platform] / ordersByPlat[o.platform] : 0
    const retDeskOrder = o.returned && retPiecesTotal > 0 ? retTotal * (o.items.reduce((s, x) => s + x.pieces, 0) / retPiecesTotal) : 0
    const principal = must(o.items[0], 'item').principal
    const revenue = o.gmv - o.voucher
    const teamCost = outboundCost + isdCost + replenishCost + csOrder + shopOrder + retDeskOrder
    const orderLevelCost = o.fee + sellerShipping + o.boxCost + returnCost + teamCost + capital
    const contribution = revenue - orderLevelCost - sharedCost
    const byPrincipal: OrderEconomics['byPrincipal'] = {}
    o.items.forEach((it, i) => {
      const w = o.gmv > 0 ? it.gmv / o.gmv : 1 / o.items.length
      const row = byPrincipal[it.principal] ?? { revenue: 0, cost: 0 }
      row.revenue += revenue * w
      row.cost += orderLevelCost * w + (itemShared[i] ?? 0)
      byPrincipal[it.principal] = row
    })
    perOrder.push({
      id: o.id, platform: o.platform, priority: o.priority, principal, byPrincipal,
      revenue, fee: o.fee, sellerShipping, packaging: o.boxCost, returnCost,
      teamCost, sharedCost, capital, contribution,
    })
    const v = must(platform[o.platform], 'platform view')
    v.orders += 1
    v.gmv += o.gmv
    v.voucher += o.voucher
    v.fee += o.fee
    v.sellerShipping += sellerShipping
    v.packaging += o.boxCost
    v.returnCost += returnCost
    v.outbound += outboundCost + isdCost + replenishCost + retDeskOrder
    v.shared += sharedCost
    v.capital += capital
    v.netSettlement += net
    v.contribution += contribution
  }

  // --- Priority views: cost to serve per order (§4.5).
  const priority: PriorityView[] = (['P0', 'P1', 'P2'] as const).map((pr) => {
    const rows = perOrder.filter((x) => x.priority === pr)
    const n = rows.length
    const cost = rows.reduce((s, x) => s + x.fee + x.sellerShipping + x.packaging + x.returnCost + x.teamCost + x.sharedCost + x.capital, 0)
    const revenue = rows.reduce((s, x) => s + x.revenue, 0)
    return { priority: pr, orders: n, avgCost: n > 0 ? cost / n : 0, avgRevenue: n > 0 ? revenue / n : 0, avgContribution: n > 0 ? rows.reduce((s, x) => s + x.contribution, 0) / n : 0 }
  })

  // --- Contribution per principal × channel (§4.5).
  const principalChannel = {} as Record<PrincipalId, { b2b: number; b2c: number; revenueB2b: number; revenueB2c: number }>
  for (const p of PIDS) {
    const gp1 = b2bAlloc.principal[p]
    const b2bOutboundByP = b2b.dos.reduce((s, d) => s + b2bLineMinutes(d.lines.filter((l) => must(world.skus[l.sku], 'sku').principal === p)), 0) * (outboundB2b / (b2bMinutes || 1))
    const b2bRep = b2bUnits > 0 ? (repB2b * piecesB2bByP[p]) / b2bUnits : 0
    // B2C: each order's share for this principal; its shared cost is already inside.
    let b2cRev = 0
    let b2cCost = 0
    for (const x of perOrder) {
      const row = x.byPrincipal[p]
      if (!row) continue
      b2cRev += row.revenue
      b2cCost += row.cost
    }
    principalChannel[p] = {
      b2b: gp1.grossProfit - gp1.tripCost - gp1.capitalCash - gp1.capitalStock - b2bOutboundByP - b2bRep - sharedB2bByP[p],
      b2c: b2cRev - b2cCost,
      revenueB2b: gp1.revenue,
      revenueB2c: b2cRev,
    }
  }

  const sharedUnsplit = toggles.sharedSplit === 'none' ? pools.filter((x) => x.byPrincipal).reduce((s, x) => s + x.total, 0) : 0
  const capitalB2c = perOrder.reduce((s, x) => s + x.capital, 0)

  return {
    toggles,
    pools,
    sharedUnsplit,
    b2bAlloc,
    outbound: { b2bMinutes, b2cMinutes, b2bCost: outboundB2b, b2cCost: outboundB2c, separateOverhead: toggles.sharedTeams ? 0 : SEPARATE_TEAM_OVERHEAD },
    isd: { total: isdTotal, p0p1Orders: p0p1.length, perOrder: isdPerOrder },
    replenishment: { total: repTotal, b2bUnits, b2cUnits },
    perOrder,
    platform,
    priority,
    principalChannel,
    capitalB2c,
    // World-2 cost model: world 1's trips and capital for the B2B exit (its warehouse pools are
    // replaced by world 2's), every world-2 pool in full (channel-allocated or not), and each
    // B2C order's direct costs. Team and shared costs on orders are pool shares, not added again.
    totals: {
      revenue: b2bAlloc.totals.revenue + perOrder.reduce((s, x) => s + x.revenue, 0),
      costs: b2bAlloc.totals.trips + b2bAlloc.totals.capital + pools.reduce((s, x) => s + x.total, 0) + perOrder.reduce((s, x) => s + x.fee + x.sellerShipping + x.packaging + x.returnCost + x.capital, 0),
      ordersB2c: ordersShipped.length,
      dosB2b: doCount,
    },
  }
}

function channelSplitByP(byPrincipal: ByP, m3B2b: ByP, m3B2c: ByP, mode: 'volume' | 'none'): { b2b: number; b2c: number; unsplit: number } {
  if (mode === 'none') return { b2b: 0, b2c: 0, unsplit: PIDS.reduce((s, p) => s + byPrincipal[p], 0) }
  let b2b = 0
  let b2c = 0
  for (const p of PIDS) {
    const m = m3B2b[p] + m3B2c[p]
    if (m <= 0) continue
    b2b += byPrincipal[p] * (m3B2b[p] / m)
    b2c += byPrincipal[p] * (m3B2c[p] / m)
  }
  return { b2b, b2c, unsplit: 0 }
}

function splitPlat(total: number, driver: ByPlat): ByPlat {
  const sum = Object.values(driver).reduce((s, x) => s + x, 0)
  const out = zeroPlat()
  for (const k of Object.keys(driver) as PlatformId[]) out[k] = sum > 0 ? (total * driver[k]) / sum : 0
  return out
}

function addByP(a: ByP, b: ByP): ByP {
  const out = zero()
  for (const p of PIDS) out[p] = a[p] + b[p]
  return out
}

function scaleByP(a: ByP, f: number): ByP {
  const out = zero()
  for (const p of PIDS) out[p] = a[p] * f
  return out
}
