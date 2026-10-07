// World-2 motion: vehicles follow the timetable, never jump, face where they drive, and never
// share a dock door.
import { describe, expect, it } from 'vitest'
import { computeAll2, DEFAULT_TOGGLES } from '../worlds/b2b-b2c/engine/index.ts'
import { DAY_END, DAY_START, pickupHour, tripDepartHour } from './bindings2.ts'
import { b2bRoute, BAY_SLOTS_Z, BAY_X, DOCK_SLOTS_X, DOCK_Z, DRIVE_HOURS, INBOUND_STOP, LOAD_HOURS, vehicles2 } from './motion2.ts'

const data = computeAll2(DEFAULT_TOGGLES)
const STEP = 0.02 // hours (72 s)
const DAYS = [1, 8, 15, 23, 30]

describe('3D motion — world 2', () => {
  it('moves every vehicle smoothly and nose first', () => {
    // Fastest leg: the longest route crossed in DRIVE_HOURS.
    const maxSpeed = 120 / DRIVE_HOURS
    for (const day of DAYS) {
      let prev = new Map(vehicles2(data, day, DAY_START).map((v) => [v.id, v]))
      for (let h = DAY_START + STEP; h <= DAY_END; h += STEP) {
        const now = vehicles2(data, day, h)
        for (const v of now) {
          const p = prev.get(v.id)
          if (!p) continue
          const dx = v.x - p.x
          const dz = v.z - p.z
          const d = Math.hypot(dx, dz)
          expect(d, `${v.id} day ${day} h ${h.toFixed(2)}`).toBeLessThanOrEqual(maxSpeed * STEP + 1e-9)
          // Driving vehicles (not forklifts, which reverse) face their direction of travel.
          if (d > 1e-6 && v.kind !== 'forklift') expect(Math.cos(v.heading) * dx - Math.sin(v.heading) * dz).toBeGreaterThan(0)
        }
        prev = new Map(now.map((v) => [v.id, v]))
      }
    }
  })

  it('keeps B2B trucks at their door while loading, and one truck per door', () => {
    for (const day of DAYS) {
      const trips = data.world.b2b.trips.filter((t) => t.day === day).slice(0, 6)
      trips.forEach((t, i) => {
        const depart = tripDepartHour(i)
        const v = vehicles2(data, day, depart - LOAD_HOURS / 2).find((x) => x.id === `trip:${t.id}`)
        expect(v?.x).toBeCloseTo(DOCK_SLOTS_X[i % DOCK_SLOTS_X.length] ?? NaN, 6)
        expect(v?.z).toBeCloseTo(DOCK_Z, 6)
        expect(vehicles2(data, day, depart + DRIVE_HOURS + 0.01).some((x) => x.id === `trip:${t.id}`)).toBe(false)
      })
      for (let h = DAY_START; h <= DAY_END; h += 0.25) {
        const docked = vehicles2(data, day, h).filter((v) => v.kind === 'truck' && Math.abs(v.z - DOCK_Z) < 1e-6)
        expect(new Set(docked.map((v) => v.x)).size).toBe(docked.length)
      }
    }
    expect(b2bRoute(0)[0]).toEqual([DOCK_SLOTS_X[0], DOCK_Z])
  })

  it('parks each courier at its bay slot until the pickup, then drives off', () => {
    for (const day of DAYS) {
      for (const m of data.world.manifests.filter((x) => x.day === day)) {
        const at = pickupHour(m.courier, m.pickup)
        const waiting = vehicles2(data, day, at - 0.25).find((v) => v.id === `mf:${m.id}`)
        expect(waiting?.x).toBeCloseTo(BAY_X, 6)
        expect(waiting?.z).toBeCloseTo(BAY_SLOTS_Z[m.courier] ?? NaN, 6)
        const leaving = vehicles2(data, day, at + DRIVE_HOURS / 2).find((v) => v.id === `mf:${m.id}`)
        expect(leaving?.z ?? -99).toBeGreaterThan(waiting?.z ?? 99)
      }
    }
  })

  it('unloads inbound POs beside the warehouse and keeps both forklifts on site', () => {
    const day = DAYS.find((d) => data.world.b2b.pos.some((p) => p.arrivalDay === d)) ?? 1
    const po = data.world.b2b.pos.find((p) => p.arrivalDay === day)
    const v = vehicles2(data, day, 9).find((x) => x.id === `po:${po?.id ?? ''}`)
    expect(v?.x).toBeCloseTo(INBOUND_STOP[0], 6)
    expect(v?.z).toBeCloseTo(INBOUND_STOP[1], 6)
    expect(v?.status).toBe('Bongkar')
    const fl = vehicles2(data, day, 9).filter((x) => x.kind === 'forklift')
    expect(fl.map((x) => x.id).sort()).toEqual(['fl:b2b', 'fl:inbound'])
    expect(fl.find((x) => x.id === 'fl:inbound')?.status).toBe('Memindahkan palet')
    expect(vehicles2(data, day, DAY_END).find((x) => x.id === 'fl:inbound')?.status).toBe('Siaga')
  })
})
