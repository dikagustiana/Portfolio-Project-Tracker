// World-2 bindings for the 3D overlay: the cards must show the engine's numbers (the same as
// the 2D metrics bar), order progress must never run backwards in time, and every map object
// must open a card whose traces recompute.
import { describe, expect, it } from 'vitest'
import { computeAll2, DEFAULT_TOGGLES } from '../worlds/b2b-b2c/engine/index.ts'
import { metricItems2 } from '../worlds/b2b-b2c/ui/metrics2.ts'
import { OBJECTS2 } from '../worlds/b2b-b2c/ui/objects2.ts'
import { verifyTrace } from '../core/trace.ts'
import { formatRpCard } from '../core/format.ts'
import { DAY_END, DAY_START, FLOW_STEPS, handoverHour, kpis2, lists2, orderStep, pickupHour, search2, selection2, summary2, track2 } from './bindings2.ts'

const data = computeAll2(DEFAULT_TOGGLES)
const days = data.world.days
const HOURS = Array.from({ length: (DAY_END - DAY_START) * 2 + 1 }, (_, i) => DAY_START + i / 2)

describe('3D bindings — world 2', () => {
  it('KPI cards show the same figures and traces as the 2D metrics bar', () => {
    for (const day of [1, 8, 17, days]) {
      const metrics = metricItems2(data, day, null, null).items
      const cards = kpis2(data, day)
      expect(cards.map((k) => k.id)).toEqual(['costPerOrderB2c', 'costPerDoB2b', 'sharedWarehouse'])
      for (const k of cards) {
        const m = metrics.find((x) => x.id === k.id)
        expect(m?.raw).not.toBeNull()
        expect(k.value).toBe(formatRpCard(m?.raw ?? NaN))
        expect(k.trace.value).toBeCloseTo(m?.raw ?? NaN, 4)
        expect(verifyTrace(k.trace)).toBe(true)
      }
    }
  })

  it('splits the shared warehouse cost B2B/B2C, or says it is not charged to channels', () => {
    expect(kpis2(data, 8).find((k) => k.id === 'sharedWarehouse')?.note?.text).toMatch(/^\d+\/\d+$/)
    const none = computeAll2({ ...DEFAULT_TOGGLES, sharedSplit: 'none' })
    const card = kpis2(none, 8).find((k) => k.id === 'sharedWarehouse')
    expect(card?.note?.text).toBe('tidak dibagi')
    expect(card && verifyTrace(card.trace)).toBe(true)
    expect(metricItems2(none, 8, null, null).items.find((m) => m.id === 'sharedWarehouse')?.sub).toBe('tidak dibagi ke channel')
  })

  it('compares cost per order and per DO with the previous day', () => {
    const day = 12
    const now = metricItems2(data, day, null, null).items
    const prev = metricItems2(data, day - 1, null, null).items
    for (const k of kpis2(data, day).filter((x) => x.id !== 'sharedWarehouse')) {
      const a = now.find((x) => x.id === k.id)?.raw ?? 0
      const b = prev.find((x) => x.id === k.id)?.raw ?? 0
      expect(k.delta?.dir).toBe(a <= b ? 'down' : 'up')
    }
    expect(kpis2(data, 1).every((k) => k.delta === undefined)).toBe(true)
  })

  it('never moves an order backwards, and pays it out on its settlement day', () => {
    const sample = data.world.orders.filter((_, i) => i % 97 === 0)
    expect(sample.length).toBeGreaterThan(20)
    for (const o of sample) {
      let last = -1
      for (let day = o.day; day <= Math.min(days + 12, o.settlementDay); day++) {
        for (const hour of HOURS) {
          const step = orderStep(o, day, hour, data)
          expect(step).toBeGreaterThanOrEqual(last)
          last = step
        }
      }
      expect(orderStep(o, o.settlementDay, DAY_START, data)).toBe(FLOW_STEPS.length)
      expect(orderStep(o, o.day, o.hour - 0.5, data)).toBe(-1)
    }
  })

  it('hands each order to one of its courier pickups, after it can be packed when possible', () => {
    for (const o of data.world.orders.filter((x) => x.shipDay <= days).slice(0, 400)) {
      const pickups = data.world.manifests.filter((m) => m.courier === o.courier && m.day === o.shipDay).map((m) => pickupHour(m.courier, m.pickup))
      const h = handoverHour(o, data)
      if (pickups.length) expect(pickups).toContain(h)
      const ready = o.shipDay === o.day ? o.hour + 1.5 : DAY_START + 2
      if (pickups.some((p) => p >= ready)) expect(h).toBeGreaterThanOrEqual(ready)
    }
  })

  it('lists only what exists at that hour', () => {
    for (const [day, hour] of [
      [3, 9],
      [8, 10.75],
      [20, 18],
    ] as const) {
      const l = lists2(data, day, hour)
      for (const tab of ['dock', 'truk', 'order'] as const) expect(l[tab].length).toBeLessThanOrEqual(6)
      for (const item of l.order) {
        const o = data.world.orders.find((x) => x.id === item.key)
        expect(o?.day).toBe(day)
        expect(o?.hour ?? 99).toBeLessThanOrEqual(hour)
      }
      expect(l.truk.length).toBe(Math.min(6, data.world.b2b.trips.filter((t) => t.day === day).length))
    }
  })

  it('opens a card with recomputable traces for every map object', () => {
    for (const obj of OBJECTS2) {
      const v = selection2(data, 8, 10.75, obj.id, metricItems2(data, 8, null, null).items)
      expect(v, obj.id).not.toBeNull()
      expect(v?.rows.length ?? 0, obj.id).toBeGreaterThan(0)
      for (const r of v?.rows ?? []) if (r.trace) expect(verifyTrace(r.trace), `${obj.id} ${r.k}`).toBe(true)
    }
    expect(selection2(data, 8, 10, 'nope', [])).toBeNull()
  })

  it('follows the requested order, else a same-day order already placed', () => {
    const o = data.world.orders[100]
    expect(track2(data, 8, 12, o?.id ?? null)?.orderId).toBe(o?.id)
    const t = track2(data, 8, 12, null)
    const picked = data.world.orders.find((x) => x.id === t?.orderId)
    expect(picked?.day).toBe(8)
    expect(picked?.hour ?? 99).toBeLessThanOrEqual(12)
  })

  it('summarises the day and finds objects, orders and trucks', () => {
    const s = summary2(data, 8, 18, metricItems2(data, 8, null, null).items)
    expect(s.rows.length).toBe(4)
    expect(summary2(data, 8, 18, metricItems2(data, 8, 'C', null).items).rows.length).toBe(5)
    expect(search2(data, 'dock')[0]?.target).toEqual({ kind: 'object', id: 'DOCK2' })
    const id = data.world.orders[5]?.id ?? ''
    expect(search2(data, id).some((r) => r.target.kind === 'order' && r.target.id === id)).toBe(true)
    expect(search2(data, 'x')).toEqual([])
  })
})
