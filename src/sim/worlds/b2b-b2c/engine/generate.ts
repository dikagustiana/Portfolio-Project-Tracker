// World 2 generator (brief 2 §5). The B2B exit runs the Brief 1 generator at a smaller
// scale; the B2C exit adds marketplace/website orders with time-of-day priorities, one
// package per order, courier manifests, returns, and platform settlements. Both channels
// draw from ONE shared stock pool — the piece ledger subtracts both outs from one balance.

import { B2C_RETAIL_MARKUP, BOXES, CHARGEABLE_VOLUME_DIVISOR_CM3_PER_KG, COURIERS, DAYS, ORDERS_PER_DAY, PRIORITY, RESTOCK_SHARE, RETURN_RATE, SEED, VOUCHER_SHARE, PLATFORMS, B2C_VALUE_SHARE } from './config.ts'
import type { B2cOrder, Manifest, OrderItem, PieceLedgerDay, PickFaceDay, World2 } from './types.ts'
import { generateWorld } from '../../distribusi/engine/generate.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { mulberry32 } from '../../../core/rng.ts'
import { must } from '../../../core/trace.ts'

const PIDS: PrincipalId[] = ['A', 'B', 'C', 'D', 'E', 'F']
type Rng = ReturnType<typeof mulberry32>

/** World 2 adds piece attributes derived deterministically from each SKU's carton. */
function pieceAttributes(sku: { m3PerCarton: number; kgPerCarton: number; pricePerCarton: number; margin: number }): { pieces: number; cm3: number; kg: number; price: number; cost: number } {
  const pieces = Math.max(2, Math.round(64 / Math.cbrt(sku.m3PerCarton * 1_000_000) / 2) * 2)
  const perPieceVolume = (sku.m3PerCarton * 1_000_000) / pieces
  const cm3 = Math.round(perPieceVolume)
  const kg = Math.round((sku.kgPerCarton / pieces) * 100) / 100
  // B2C sells at the wholesale piece price plus the retail markup; the goods cost what they
  // cost B2B: the carton price less its margin, per piece.
  const price = Math.round((sku.pricePerCarton / pieces) * (1 + B2C_RETAIL_MARKUP))
  const cost = (sku.pricePerCarton * (1 - sku.margin)) / pieces
  return { pieces, cm3, kg, price, cost }
}

function pickHour(rng: Rng): number {
  const total = PRIORITY.hourWeights.reduce((s, x) => s + x, 0)
  let r = rng.next() * total
  for (let i = 0; i < PRIORITY.hourWeights.length; i++) {
    r -= PRIORITY.hourWeights[i] ?? 0
    if (r <= 0) return 6 + i
  }
  return 21
}

function chooseBox(volumeCm3: number, maxPieceCm3: number) {
  const fit = BOXES.find((b) => volumeCm3 <= b.maxVolumeCm3 && maxPieceCm3 <= b.wCm * b.hCm * b.dCm)
  return fit ?? must(BOXES[BOXES.length - 1], 'box L')
}

function pickCourier(rng: Rng): string {
  const r = rng.next()
  let acc = 0
  for (const c of COURIERS) {
    acc += c.share
    if (r <= acc) return c.id
  }
  return must(COURIERS[0], 'courier').id
}

function shippingCost(courierId: string, chargeableKg: number): number {
  const c = COURIERS.find((x) => x.id === courierId)
  if (!c) return 0
  return Math.round(c.basePerPackage + chargeableKg * c.perKg)
}

export function generateWorld2(seed = SEED): World2 {
  const rng = mulberry32(seed)

  // --- B2B exit: world 1's generator at 0,4× demand (brief 2 §5 "at a smaller scale").
  const b2b = generateWorld(20261108, { demandScale: 0.4 })
  const skus = b2b.skus
  const piecesPerCarton: Record<string, number> = {}
  const pieceVolumeCm3: Record<string, number> = {}
  const pieceKg: Record<string, number> = {}
  const piecePrice: Record<string, number> = {}
  const pieceCost: Record<string, number> = {}
  for (const code of Object.keys(skus)) {
    const a = pieceAttributes(must(skus[code], `sku ${code}`))
    piecesPerCarton[code] = a.pieces
    pieceVolumeCm3[code] = a.cm3
    pieceKg[code] = a.kg
    piecePrice[code] = a.price
    pieceCost[code] = a.cost
  }

  // --- B2C orders (§3.3 C1–C2): value weighted by the principal B2C profiles; D is B2B only.
  const weighted: PrincipalId[] = []
  for (const p of PIDS) for (let i = 0; i < B2C_VALUE_SHARE[p] * 100; i++) weighted.push(p)
  const orders: B2cOrder[] = []
  let seq = 0
  for (let day = 1; day <= DAYS; day++) {
    for (const platform of PLATFORMS) {
      const n = Math.round(ORDERS_PER_DAY * platform.orderShare * rng.range(0.85, 1.15))
      for (let i = 0; i < n; i++) {
        const hour = pickHour(rng)
        const roll = rng.next()
        let priority: B2cOrder['priority'] = roll < PRIORITY.p0Share ? 'P0' : roll < PRIORITY.p0Share + PRIORITY.p1Share ? 'P1' : 'P2'
        // Cut-off rule: a P1 order after its platform's cut-off slips to next day (P2).
        if (priority === 'P1' && hour >= platform.cutoffHour) priority = 'P2'
        const nItems = rng.int(1, 3)
        const items: OrderItem[] = []
        for (let k = 0; k < nItems; k++) {
          const principal = must(weighted[rng.int(0, weighted.length - 1)], 'principal pick')
          const codes = must(b2b.principals.find((p) => p.id === principal), 'principal').skus
          const sku = must(codes[rng.int(0, codes.length - 1)], 'sku pick')
          const pieces = rng.int(1, 2)
          items.push({
            sku, principal, pieces,
            pieceVolumeCm3: must(pieceVolumeCm3[sku], 'piece volume'),
            pieceKg: must(pieceKg[sku], 'piece kg'),
            gmv: pieces * must(piecePrice[sku], 'piece price'),
          })
        }
        const gmv = items.reduce((s, x) => s + x.gmv, 0)
        const voucherPct = VOUCHER_SHARE[must(items[0], 'item').principal]
        const voucher = Math.round(gmv * voucherPct)
        const fee = Math.round(gmv * platform.feePct)
        const volumeCm3 = items.reduce((s, x) => s + x.pieces * x.pieceVolumeCm3, 0)
        const actualKg = Math.round(items.reduce((s, x) => s + x.pieces * x.pieceKg, 0) * 100) / 100
        const box = chooseBox(volumeCm3, must(items[0], 'item').pieceVolumeCm3)
        const courier = pickCourier(rng)
        const chargeableKg = Math.max(actualKg, volumeCm3 / CHARGEABLE_VOLUME_DIVISOR_CM3_PER_KG)
        const shipping = shippingCost(courier, chargeableKg)
        const shipDay = priority === 'P2' ? day + 1 : day
        const completeDay = shipDay + (rng.chance(0.85) ? 0 : 1)
        const returned = rng.chance(RETURN_RATE[must(items[0], 'item').principal]) && completeDay + 2 <= DAYS + 12
        const returnDay = returned ? completeDay + rng.int(1, 3) : 0
        // Net settlement is platform-side: fee and the seller's vouchers come off the GMV;
        // shipping enters only when the seller bears it (toggle applied at allocation).
        seq += 1
        orders.push({
          id: `O-${String(seq).padStart(5, '0')}`,
          platform: platform.id, day, hour, priority, items, gmv, voucher, fee,
          shipping, box: box.label, boxCost: box.cost,
          chargeableKg: Math.round(chargeableKg * 1000) / 1000, actualKg,
          courier, shipDay, completeDay, returned, returnDay,
          restocked: returned && rng.chance(RESTOCK_SHARE),
          settlementDay: completeDay + platform.settlementDays,
          netSettlement: gmv - voucher - fee,
        })
      }
    }
  }

  // --- Shared stock pool: one piece ledger (control 2). The B2B POs were sized by world 1
  // for its own demand only, so every PO line is scaled up by the SKU's B2C share of the
  // combined demand — arrivals keep world 1's lead-time shape but cover both channels.
  const b2cMonthlyPieces: Record<string, number> = {}
  for (const o of orders) {
    if (o.shipDay > DAYS) continue
    for (const it of o.items) b2cMonthlyPieces[it.sku] = (b2cMonthlyPieces[it.sku] ?? 0) + it.pieces
  }
  const b2bMonthlyCartons: Record<string, number> = {}
  for (const d of b2b.dos) for (const l of d.lines) b2bMonthlyCartons[l.sku] = (b2bMonthlyCartons[l.sku] ?? 0) + l.cartons
  for (const po of b2b.pos) {
    for (const l of po.lines) {
      const b2bCartons = b2bMonthlyCartons[l.sku] ?? 0
      const b2cCartons = (b2cMonthlyPieces[l.sku] ?? 0) / must(piecesPerCarton[l.sku], `pieces ${l.sku}`)
      const factor = b2bCartons > 0 ? 1.05 + b2cCartons / b2bCartons : 1.05 + (b2cCartons > 0 ? 1 : 0)
      l.cartons = Math.ceil(l.cartons * Math.min(6, factor))
    }
  }

  const b2cPiecesBySkuDay = new Map<string, number[]>()
  const b2bCartonsBySkuDay = new Map<string, number[]>()
  for (const code of Object.keys(skus)) {
    b2cPiecesBySkuDay.set(code, Array.from({ length: DAYS }, () => 0))
    b2bCartonsBySkuDay.set(code, Array.from({ length: DAYS }, () => 0))
  }
  for (const o of orders) {
    if (o.shipDay > DAYS) continue
    for (const it of o.items) {
      const arr = must(b2cPiecesBySkuDay.get(it.sku), `b2c pieces ${it.sku}`)
      arr[o.shipDay - 1] = (arr[o.shipDay - 1] ?? 0) + it.pieces
    }
  }
  const doById = new Map(b2b.dos.map((d) => [d.id, d]))
  for (const trip of b2b.trips) {
    for (const doId of trip.dos) {
      const d = must(doById.get(doId), `DO ${doId}`)
      for (const l of d.lines) {
        const arr = must(b2bCartonsBySkuDay.get(l.sku), `b2b cartons ${l.sku}`)
        arr[trip.day - 1] = (arr[trip.day - 1] ?? 0) + l.cartons
      }
    }
  }
  // Restocked returns come back onto the shelf on their return day (within the month).
  const restockBySkuDay = new Map<string, number[]>()
  for (const o of orders) {
    if (!o.returned || !o.restocked || o.shipDay > DAYS || o.returnDay > DAYS) continue
    for (const it of o.items) {
      const arr = restockBySkuDay.get(it.sku) ?? Array.from({ length: DAYS }, () => 0)
      arr[o.returnDay - 1] = (arr[o.returnDay - 1] ?? 0) + it.pieces
      restockBySkuDay.set(it.sku, arr)
    }
  }
  const pc = (code: string): number => must(piecesPerCarton[code], `pieces ${code}`)
  const ledger: PieceLedgerDay[] = []
  for (const code of Object.keys(skus)) {
    const sku = must(skus[code], `sku ${code}`)
    const monthlyB2c = b2cPiecesBySkuDay.get(code)?.reduce((s, x) => s + x, 0) ?? 0
    const monthlyB2b = b2bCartonsBySkuDay.get(code)?.reduce((s, x) => s + x, 0) ?? 0
    const dailyDemandPieces = monthlyB2c / DAYS + (monthlyB2b / DAYS) * pc(code)
    const principal = must(b2b.principals.find((p) => p.id === sku.principal), 'principal')
    let close = Math.ceil(dailyDemandPieces * (principal.leadTimeDays + principal.minInventoryDays) * 1.08)
    const arrivals = new Map<number, number>()
    for (const po of b2b.pos) {
      for (const l of po.lines) {
        if (l.sku !== code) continue
        arrivals.set(po.arrivalDay, (arrivals.get(po.arrivalDay) ?? 0) + l.cartons * pc(code))
      }
    }
    for (let day = 1; day <= DAYS; day++) {
      const open = close
      const inPieces = arrivals.get(day) ?? 0
      const outB2b = (must(b2bCartonsBySkuDay.get(code), 'b2b day')[day - 1] ?? 0) * pc(code)
      const outB2c = must(b2cPiecesBySkuDay.get(code), 'b2c day')[day - 1] ?? 0
      const restocked = restockBySkuDay.get(code)?.[day - 1] ?? 0
      close = open + inPieces + restocked - outB2b - outB2c
      if (close < 0) throw new Error(`negative shared stock for ${code} on day ${day}: ${close}`)
      ledger.push({ sku: code, day, open, in: inPieces, restocked, outB2b, outB2c, close })
    }
  }

  // --- Pick face (C3): B2C picks cross the counter; replenishment refills what was picked.
  const pickFace: PickFaceDay[] = []
  for (const code of Object.keys(skus)) {
    const daily = (b2cPiecesBySkuDay.get(code)?.reduce((s, x) => s + x, 0) ?? 0) / DAYS
    const cover = Math.ceil(daily * 3)
    for (let day = 1; day <= DAYS; day++) {
      const picks = must(b2cPiecesBySkuDay.get(code), 'b2c')[day - 1] ?? 0
      pickFace.push({ sku: code, day, stockPieces: Math.max(0, cover - picks), replenishedPieces: picks })
    }
  }

  // --- Manifests (C6–C7): one per courier per pickup per day, built from the packages that
  // courier takes that day (orders by ship day), split across its pickups; signed at the
  // pickup, then closed.
  const manifests: Manifest[] = []
  let mSeq = 0
  const packagesByCourierDay = new Map<string, number>()
  for (const o of orders) {
    if (o.shipDay > DAYS) continue
    const key = `${o.courier}|${o.shipDay}`
    packagesByCourierDay.set(key, (packagesByCourierDay.get(key) ?? 0) + 1)
  }
  for (let day = 1; day <= DAYS; day++) {
    for (const c of COURIERS) {
      const total = packagesByCourierDay.get(`${c.id}|${day}`) ?? 0
      let left = total
      for (let p = 1; p <= c.pickupsPerDay && left > 0; p++) {
        const n = Math.ceil(left / (c.pickupsPerDay - p + 1))
        left -= n
        mSeq += 1
        manifests.push({ id: `MF-${String(mSeq).padStart(4, '0')}`, courier: c.id, day, pickup: p, packages: n, signedDay: day, closedDay: day })
      }
    }
  }

  // --- Quarantine units for the stock-mgmt driver (returns not restocked).
  const quarantinedPieces: Record<string, number> = {}
  for (const o of orders) {
    if (!o.returned || o.restocked) continue
    for (const it of o.items) quarantinedPieces[it.sku] = (quarantinedPieces[it.sku] ?? 0) + it.pieces
  }

  return {
    days: DAYS, b2b, skus, piecesPerCarton, pieceVolumeCm3, pieceKg, piecePrice, pieceCost,
    stores: b2b.stores, orders, manifests, ledger, pickFace, quarantinedPieces,
  }
}
