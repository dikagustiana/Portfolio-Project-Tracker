// The distribution world's own models, in Factory Yard's way (local frame: +x forward, origin at
// the front bumper, +y left, +z up): the B2B truck, the principals' inbound truck, the courier van
// and motorbike, parcels and cages, drawn with the shared kernel. People, forklifts, pallets,
// desks and documents are the shell's (src/sim/yard/models.ts).
// Vehicles carry their channel as a tag on the roof (B2B on trucks, B2C on vans and motorbikes),
// so the channel reads on the object itself, from above, at any heading.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W } from '../../../yard/kernel.ts'
import type { Ink } from '../../../yard/kernel.ts'
import { lights } from '../../../yard/models.ts'

// ---- B2B truck: a rigid truck with a caged body, open on the sides so the pallets show ----------

/** pallet places on the deck: two across, three along (local x of each pallet centre, y) */
export const TRUCK_SLOTS: [number, number][] = [
  [-4.6, 1.15], [-4.6, -1.15], [-7.1, 1.15], [-7.1, -1.15], [-9.6, 1.15], [-9.6, -1.15],
]
export const TRUCK_LEN = 11.2
export const TRUCK_DECK = 1.45
export function buildTruck(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const L = TRUCK_LEN
  // chassis, cab, bumper
  p.box(-L + 0.2, -0.8, 0.55, L - 0.6, 1.6, 0.45)
  p.box(-0.45, -1.3, 0.4, 0.45, 2.6, 0.5)
  p.box(-2.9, -1.25, 0.85, 2.5, 2.5, 2.35)
  p.box(-3.0, -1.3, 3.2, 2.7, 2.6, 0.16)
  const fr = SIDE(-0.4, 1.25, 3.2)
  p.fill2(fr, 0.25, 0.25, 2.0, 1.0).rect2(fr, 0.25, 0.25, 2.0, 1.0, 'line').draw(fr, [0.4, 1.75, 2.1, 1.75, 0.4, 2.0, 2.1, 2.0])
  p.fill2(FRONT(-2.9, 1.25, 3.2), 1.1, 0.3, 1.2, 0.9).rect2(FRONT(-2.9, 1.25, 3.2), 1.1, 0.3, 1.2, 0.9, 'line')
  p.fill2(FRONT(-2.9, -1.25, 3.2), 1.1, 0.3, 1.2, 0.9, 'glass', -0.03).rect2(FRONT(-2.9, -1.25, 3.2), 1.1, 0.3, 1.2, 0.9, 'line', -0.04)
  // flat deck with low sides, and a cage of posts and rails above it (curtains open)
  const B0 = -L
  const BL = L - 3.2
  p.box(B0, -1.45, TRUCK_DECK - 0.3, BL, 2.9, 0.3)
  p.box(B0, 1.3, TRUCK_DECK, BL, 0.15, 0.35)
  p.box(B0, -1.45, TRUCK_DECK, BL, 0.15, 0.35)
  p.box(-3.35, -1.45, TRUCK_DECK, 0.2, 2.9, 2.6)
  const top = TRUCK_DECK + 2.6
  for (const x of [B0 + 0.05, B0 + BL / 2, -3.4]) for (const y of [1.38, -1.38]) p.seg('line', W(x, y, TRUCK_DECK + 0.35), W(x, y, top))
  for (const y of [1.38, -1.38]) p.seg('line', W(B0, y, top), W(-3.35, y, top))
  p.seg('line', W(B0, 1.38, top), W(B0, -1.38, top))
  for (let x = B0 + 1; x < -3.4; x += 1.4) p.seg('detail', W(x, 1.38, top), W(x, -1.38, top))
  // the channel tag on the cab roof
  p.fill2(TOP(-2.75, -1.0, 3.37), 0.2, 0.2, 2.2, 1.6, 'paper', 0.02).text(TOP(-2.75, -1.0, 3.37), 'B2B', 1.3, 1.45, 0.9, 'hi', 'middle', 0.05)
  for (const x of [-1.6, -8.4, -9.9]) {
    p.cylY(x, 1.05, 0.55, 0.55, 0.4, 12)
    p.cylY(x, -1.45, 0.55, 0.55, 0.4, 12)
  }
  lights(p, 0, [0.9, -0.9], 0.55)
  return p.build('truck')
}

// ---- inbound truck: the principal's box truck that brings the goods to the receiving docks ----
export const INBOUND_LEN = 12.6
export function buildInboundTruck(ink: Ink): THREE.Group {
  const g = new THREE.Group()
  g.name = 'inbound'
  const p = new Part(ink)
  const L = INBOUND_LEN
  p.box(-L + 0.3, -0.8, 0.5, L - 0.6, 1.6, 0.4)
  p.box(-0.4, -1.3, 0.35, 0.4, 2.6, 0.55)
  p.box(-2.8, -1.25, 0.85, 2.6, 2.5, 2.25)
  p.box(-2.9, -1.3, 3.1, 2.7, 2.6, 0.18)
  const fr = SIDE(-0.2, 1.25, 3.1)
  p.fill2(fr, 0.25, 0.25, 2.0, 0.95).rect2(fr, 0.25, 0.25, 2.0, 0.95, 'line')
  p.fill2(FRONT(-2.8, 1.25, 3.1), 1.2, 0.3, 1.1, 0.85).rect2(FRONT(-2.8, 1.25, 3.1), 1.2, 0.3, 1.1, 0.85, 'line')
  // box body: closed, ribbed
  const B0 = -L
  const BL = L - 3.2
  const H = 2.9
  p.box(B0, -1.45, 1.0, BL, 2.9, H)
  const ribs: number[] = []
  for (let u = 1.2; u < BL - 0.2; u += 1.2) ribs.push(u, 0.1, u, H - 0.1)
  p.draw(FRONT(B0, 1.45, 1.0 + H), ribs).draw(FRONT(B0, -1.45, 1.0 + H), ribs, 'detail', -0.04)
  p.text(FRONT(B0, 1.45, 1.0 + H), 'INBOUND', 0.8, 1.2, 0.7, 'paint')
  for (const x of [-1.7, -9.6, -11.0]) {
    p.cylY(x, 1.05, 0.55, 0.55, 0.4, 12)
    p.cylY(x, -1.45, 0.55, 0.55, 0.4, 12)
  }
  lights(p, 0, [0.9, -0.9], 0.5)
  g.add(p.build('inboundBody'))
  return g
}

// ---- B2C: courier van and motorbike ------------------------------------------------------------
export const VAN_LEN = 5.6
export function buildCourierVan(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.box(-VAN_LEN, -1.05, 0.35, VAN_LEN, 2.1, 2.2)
  const f = SIDE(0, 1.05, 2.55)
  p.fill2(f, 0.2, 0.25, 1.7, 0.85).rect2(f, 0.2, 0.25, 1.7, 0.85, 'line')
  p.draw(FRONT(-VAN_LEN, 1.05, 2.55), [1.6, 0, 1.6, 2.2, 3.2, 0, 3.2, 2.2])
  p.fill2(TOP(-4.6, -0.8, 2.55), 0.2, 0.2, 2.6, 1.2, 'paper', 0.02).text(TOP(-4.6, -0.8, 2.55), 'B2C', 1.5, 1.25, 0.85, 'hi', 'middle', 0.05)
  for (const x of [-0.95, -4.5]) {
    p.cylY(x, 0.72, 0.38, 0.38, 0.32, 10)
    p.cylY(x, -1.04, 0.38, 0.38, 0.32, 10)
  }
  lights(p, 0, [0.6, -0.6], 0.62, 0.2, 0.36)
  return p.build('van')
}
export function buildMotorbike(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.cylY(-0.35, -0.08, 0.32, 0.32, 0.16, 10)
  p.cylY(-1.75, -0.08, 0.32, 0.32, 0.16, 10)
  p.box(-1.7, -0.18, 0.45, 1.4, 0.36, 0.35)
  p.box(-0.55, -0.35, 0.8, 0.12, 0.7, 0.08)
  // rider and the parcel box behind
  p.box(-1.35, -0.22, 0.8, 0.45, 0.44, 0.8, 'k')
  p.box(-1.25, -0.13, 1.6, 0.26, 0.26, 0.28)
  p.box(-2.35, -0.38, 0.75, 0.75, 0.76, 0.66, 'paper')
  p.text(TOP(-2.35, -0.38, 1.41), 'B2C', 0.37, 0.52, 0.32, 'hi', 'middle', 0.04)
  return p.build('motorbike')
}

// ---- goods ---------------------------------------------------------------------------------------
export function buildParcel(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.box(-0.35, -0.3, 0, 0.7, 0.6, 0.45, 'paper')
  p.draw(TOP(-0.35, -0.3, 0.45), [0.35, 0, 0.35, 0.6])
  return p.build('parcel')
}
/** a roll cage of parcels at the courier bay; `fill` 0–1 */
export function buildCage(ink: Ink, fill: number): THREE.Group {
  const p = new Part(ink)
  const h = 1.8
  for (const [x, y] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]] as const) p.seg('line', W(x, y, 0.15), W(x, y, h))
  for (const z of [0.15, h]) {
    p.seg('line', W(-0.9, -0.7, z), W(0.9, -0.7, z)).seg('line', W(0.9, -0.7, z), W(0.9, 0.7, z))
    p.seg('line', W(0.9, 0.7, z), W(-0.9, 0.7, z)).seg('line', W(-0.9, 0.7, z), W(-0.9, -0.7, z))
  }
  const n = Math.round(fill * 6)
  for (let k = 0; k < n; k++) p.box(-0.8 + (k % 3) * 0.55, -0.6 + Math.floor(k / 3) * 0.6, 0.16 + 0.5 * Math.floor(k / 3) * 0, 0.5, 0.55, 0.45 + 0.4 * Math.floor(k / 3), 'paper')
  return p.build('cage')
}

