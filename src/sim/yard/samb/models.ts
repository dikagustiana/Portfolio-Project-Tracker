// Models in Factory Yard's way (local frame: +x forward, origin at the front bumper, +y left,
// +z up). Forklift, person and car are ported from Factory Yard's buildForklift / buildPerson /
// buildCar; the trucks, courier vehicles, desks and documents are new, drawn with the same kernel.
// Vehicles carry their channel as a tag on the roof (B2B on trucks, B2C on vans and motorbikes),
// so the channel reads on the object itself, from above, at any heading.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W } from '../kernel.ts'
import type { Ink, Tone } from '../kernel.ts'

const lights = (p: Part, x: number, ys: number[], z: number, h = 0.24, w = 0.42): Part => {
  for (const y of ys) p.box(x, y - w / 2, z, 0.07, w, h, 'l')
  return p
}

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

// ---- forklift (Factory Yard's buildForklift) -----------------------------------------------------
export function buildForklift(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.box(-3.5, -1.0, 0.35, 3.1, 2.0, 0.85)
  p.box(-3.75, -1.05, 0.35, 0.9, 2.1, 1.45)
  p.box(-2.5, -0.55, 1.2, 0.7, 1.1, 0.45)
  p.box(-2.6, -0.55, 1.65, 0.18, 1.1, 0.6)
  for (const [x, y] of [[-0.85, -0.95], [-0.85, 0.8], [-2.75, -0.95], [-2.75, 0.8]] as const) p.box(x, y, 1.2, 0.15, 0.15, 2.2)
  p.box(-2.9, -1.05, 3.4, 2.2, 2.1, 0.12)
  p.draw(TOP(-2.9, -1.05, 3.52), [0.55, 0, 0.55, 2.1, 1.1, 0, 1.1, 2.1, 1.65, 0, 1.65, 2.1])
  p.box(-0.4, -0.85, 0.2, 0.22, 0.25, 4.6)
  p.box(-0.4, 0.6, 0.2, 0.22, 0.25, 4.6)
  p.box(-0.4, -0.85, 4.62, 0.22, 1.7, 0.18)
  for (const x of [-0.95, -3.05]) {
    p.cylY(x, 0.72, 0.42, 0.42, 0.42, 10)
    p.cylY(x, -1.14, 0.42, 0.42, 0.42, 10)
  }
  const g = p.build('forklift')
  const c = new Part(ink)
  c.box(-0.2, -0.9, 0, 0.16, 1.8, 1.1)
  for (const y of [-0.62, 0.38]) c.box(-0.04, y, 0, 2.2, 0.24, 0.1)
  g.add(c.build('carriage'))
  g.add(new Part(ink).box(-1.95, -0.15, 3.52, 0.3, 0.3, 0.25).build('beacon'))
  return g
}

// ---- people (Factory Yard's buildPerson): staff wear the two-tone shirt -------------------------
export type Look = 'staff' | 'office' | 'driver' | 'resident'
export function buildPerson(ink: Ink, look: Look, lite = false): THREE.Group {
  const tone: Tone = look === 'staff' || look === 'driver' ? 'k' : 'n'
  const p = new Part(ink)
  p.box(-0.13, -0.25, 0.85, 0.26, 0.5, 0.62, tone)
  p.box(-0.1, 0.25, 0.92, 0.2, 0.12, 0.52, tone)
  p.box(-0.1, -0.37, 0.92, 0.2, 0.12, 0.52, tone)
  p.box(-0.12, -0.12, 1.5, 0.24, 0.24, 0.27)
  if (look === 'staff') {
    p.box(-0.15, -0.15, 1.77, 0.3, 0.3, 0.07, 'k')
    p.box(0.15, -0.15, 1.77, 0.12, 0.3, 0.03, 'k')
  }
  if (lite) {
    for (const y of [0.04, -0.2]) p.box(-0.08, y, 0, 0.16, 0.16, 0.85)
    return p.build('personLite')
  }
  const g = p.build('person')
  for (const [n, y] of [['legL', 0.12], ['legR', -0.12]] as const) {
    const l = new Part(ink).box(-0.08, -0.08, -0.85, 0.16, 0.16, 0.85).build(n)
    l.position.copy(W(0, y, 0.85))
    g.add(l)
  }
  const c = new Part(ink)
  c.box(0.16, -0.24, 0.95, 0.46, 0.48, 0.42, 'paper')
  g.add(c.build('carry'))
  return g
}
/** someone seated at a desk: no legs to swing, a little lower */
export function buildSeated(ink: Ink, tone: Tone = 'n'): THREE.Group {
  const p = new Part(ink)
  p.box(-0.13, -0.25, 0.55, 0.26, 0.5, 0.6, tone)
  p.box(-0.12, -0.12, 1.15, 0.24, 0.24, 0.27)
  p.box(0.1, -0.22, 0.45, 0.45, 0.44, 0.12, tone)
  return p.build('seated')
}

// ---- goods ---------------------------------------------------------------------------------------
/** A pallet of cartons. tone 'k' is the neutral two-tone; a principal fill colours it (only where
 *  the spec asks: pallets on a mixed truck). `layers` 1–3 shows a low or full stack. */
export function buildPallet(ink: Ink, tone: Tone = 'k', layers = 3, s = 1): THREE.Group {
  const p = new Part(ink)
  const a = 0.95 * s
  p.box(-a, -a, 0, 2 * a, 2 * a, 0.3)
  const slats = [0, 0.1, 2 * a, 0.1, 0.5 * s, 0.1, 0.5 * s, 0.3, 1.4 * s, 0.1, 1.4 * s, 0.3]
  p.draw(FRONT(-a, a, 0.3), slats).draw(SIDE(a, a, 0.3), slats)
  for (let l = 0; l < layers; l++)
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) p.box(-a + 0.05 + a * i, -a + 0.05 + a * j, 0.3 + 0.55 * l, a - 0.1, a - 0.1, 0.53, tone)
  return p.build('pallet')
}
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

// ---- office ------------------------------------------------------------------------------------
/** A desk with a monitor, facing −y (the person sits on its +y side). tone colours the desk top. */
export function buildDesk(ink: Ink, tone: Tone = 'n'): THREE.Group {
  const p = new Part(ink)
  p.box(-1.1, -0.5, 0.72, 2.2, 1.0, 0.08, tone)
  for (const x of [-1.0, 0.9]) p.box(x, -0.45, 0, 0.1, 0.9, 0.72)
  p.box(-0.45, -0.35, 0.8, 0.9, 0.06, 0.55, 'g')
  p.box(-0.06, -0.3, 0.8, 0.12, 0.12, 0.05)
  return p.build('desk')
}
/** a document envelope (PO, DO, invoice, faktur pajak), flat; the kind is printed on it */
export function buildEnvelope(ink: Ink, label: string, tone: Tone = 'paper'): THREE.Group {
  const p = new Part(ink)
  p.box(-0.9, -0.6, 0, 1.8, 1.2, 0.12, tone)
  p.draw(TOP(-0.9, -0.6, 0.12), [0, 0, 0.9, 0.55, 0.9, 0.55, 1.8, 0])
  p.text(TOP(-0.9, -0.6, 0.12), label, 0.9, 1.08, 0.38, 'hi', 'middle', 0.04)
  return p.build('envelope')
}
export function buildCoin(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.cylZ(0, 0, 0, 0.7, 0.18, 16, 'warn')
  p.text(TOP(0, 0, 0.18), 'Rp', 0, 0.2, 0.42, 'hi', 'middle', 0.04)
  return p.build('coin')
}

// ---- trees and street furniture (Factory Yard's tree, lampPost) --------------------------------
const crown = new THREE.IcosahedronGeometry(1, 0)
const yaw = (a: number): THREE.Quaternion => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a)
export function tree(p: Part, x: number, y: number, s = 1, z = 0, turn = 0): void {
  p.box(x - 0.22 * s, y - 0.22 * s, z, 0.44 * s, 0.44 * s, 2.2 * s)
  p.geo(crown, new THREE.Matrix4().compose(W(x, y, z + 2.2 * s + 1.7 * s), yaw(turn), new THREE.Vector3(2 * s, 2.2 * s, 2 * s)), 'gs')
}
export function lampPost(p: Part, x: number, y: number, ax: number, ay: number, z = 0.15): void {
  p.box(x - 0.1, y - 0.1, z, 0.2, 0.2, 6)
  const hx = x + ax * 2.2
  const hy = y + ay * 2.2
  p.seg('line', W(x, y, z + 5.9), W(hx, hy, z + 5.9))
  p.box(hx - 0.7, hy - 0.4, z + 5.6, 1.4, 0.8, 0.3, 'l')
}
