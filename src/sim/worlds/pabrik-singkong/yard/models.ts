// The cassava plant's own models, in Factory Yard's way (local frame: +x forward, origin at the
// front, +y left, +z up; machines are drawn in plate coordinates). The finished-goods truck is
// Factory Yard's covered delivery truck (buildVan) and the CNG skid rides its flatbed trailer
// (buildTrailer); the cassava truck, the bins and the line's machines are drawn with the same kernel.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W } from '../../../yard/kernel.ts'
import type { Ink, Tone } from '../../../yard/kernel.ts'
import { lights } from '../../../yard/models.ts'

// ---- vehicles ------------------------------------------------------------------------------------

/** A small open-bed truck heaped with cassava roots (or sacks of bought-peeled cassava). */
export const CASSAVA_TRUCK_LEN = 8.6
export function buildCassavaTruck(ink: Ink, peeled = false): THREE.Group {
  const p = new Part(ink)
  const L = CASSAVA_TRUCK_LEN
  p.box(-L + 0.3, -0.75, 0.45, L - 0.6, 1.5, 0.4)
  p.box(-0.35, -1.2, 0.35, 0.35, 2.4, 0.5)
  p.box(-2.5, -1.15, 0.8, 2.2, 2.3, 2.0)
  p.box(-2.6, -1.2, 2.8, 2.4, 2.4, 0.16)
  const fr = SIDE(-0.3, 1.15, 2.8)
  p.fill2(fr, 0.2, 0.2, 1.9, 0.85).rect2(fr, 0.2, 0.2, 1.9, 0.85, 'line')
  p.fill2(FRONT(-2.5, 1.15, 2.8), 1.0, 0.25, 1.0, 0.75).rect2(FRONT(-2.5, 1.15, 2.8), 1.0, 0.25, 1.0, 0.75, 'line')
  // the bed: drop sides, a tailgate, and the load heaped above the sides
  const B0 = -L
  const BL = L - 2.8
  p.box(B0, -1.3, 0.85, BL, 2.6, 0.25)
  p.box(B0, 1.15, 1.1, BL, 0.15, 0.9).box(B0, -1.3, 1.1, BL, 0.15, 0.9).box(B0, -1.3, 1.1, 0.15, 2.6, 0.9)
  p.draw(FRONT(B0, 1.3, 2.0), [1.4, 0, 1.4, 0.9, 2.8, 0, 2.8, 0.9, 4.2, 0, 4.2, 0.9])
  if (peeled) {
    // sacks of peeled cassava in two layers
    for (let i = 0; i < 4; i++) for (const y of [-0.65, 0.55]) p.box(B0 + 0.3 + i * 1.4, y - 0.5, 1.1, 1.25, 1.0, 0.55, 'paper')
    for (let i = 0; i < 3; i++) p.box(B0 + 1.0 + i * 1.4, -0.55, 1.65, 1.25, 1.1, 0.5, 'paper')
  } else {
    // roots heaped in the bed: a low ridge of stacked logs along the bed
    const ridge = (z: number, w: number): void => {
      for (let x = B0 + 0.3; x < B0 + BL - 0.6; x += 1.15) p.cylY(x + 0.5, -w / 2, z, 0.28, w, 6, 'k')
    }
    ridge(1.45, 2.3)
    ridge(1.9, 1.6)
    ridge(2.3, 0.8)
  }
  for (const x of [-1.4, -6.8]) {
    p.cylY(x, 0.9, 0.5, 0.5, 0.36, 12)
    p.cylY(x, -1.26, 0.5, 0.5, 0.36, 12)
  }
  lights(p, 0, [0.8, -0.8], 0.5)
  return p.build(peeled ? 'cassavaTruckPeeled' : 'cassavaTruck')
}

/** Factory Yard's covered delivery truck (buildVan): a box body, rear swing doors, its
 *  destination on the roof so it reads from above. Pallets of cartons ride in one row. */
export const VAN_SLOTS = [-4.4, -6.9, -9.4, -11.9]
export const VAN_DECK = 1.3
export const VAN_LEN = 13.4
export const VAN_BH = 2.85
export function buildBoxTruck(ink: Ink, dest: string): THREE.Group {
  const g = new THREE.Group()
  g.name = 'boxTruck'
  const p = new Part(ink)
  const B0 = -VAN_LEN
  const BL = 10.4
  const D = VAN_DECK
  const BH = VAN_BH
  p.box(-12.9, -0.8, 0.5, 12.6, 1.6, 0.4)
  p.box(-0.4, -1.3, 0.35, 0.4, 2.6, 0.55)
  p.box(-2.8, -1.25, 0.85, 2.6, 2.5, 2.25)
  p.box(-2.9, -1.3, 3.1, 2.7, 2.6, 0.18)
  const fr = SIDE(-0.2, 1.25, 3.1)
  p.fill2(fr, 0.25, 0.25, 2.0, 0.95).rect2(fr, 0.25, 0.25, 2.0, 0.95, 'line').draw(fr, [0.4, 1.7, 2.1, 1.7, 0.4, 1.95, 2.1, 1.95])
  p.fill2(FRONT(-2.8, 1.25, 3.1), 1.2, 0.3, 1.1, 0.85).rect2(FRONT(-2.8, 1.25, 3.1), 1.2, 0.3, 1.1, 0.85, 'line')
  p.fill2(FRONT(-2.8, -1.25, 3.1), 1.2, 0.3, 1.1, 0.85, 'glass', -0.03).rect2(FRONT(-2.8, -1.25, 3.1), 1.2, 0.3, 1.1, 0.85, 'line', -0.04)
  p.box(B0, -1.4, D - 0.35, BL, 2.8, 0.35)
  p.box(B0, 1.25, D, BL, 0.15, BH).box(B0, -1.4, D, BL, 0.15, BH)
  p.box(-3.15, -1.4, D, 0.15, 2.8, BH)
  p.box(B0, -1.4, D + BH, BL, 2.8, 0.15)
  const ribs: number[] = []
  for (let u = 1.3; u < BL - 0.2; u += 1.3) ribs.push(u, 0.1, u, BH + 0.1)
  p.draw(FRONT(B0, 1.4, D + BH + 0.15), ribs).draw(FRONT(B0, -1.4, D + BH + 0.15), ribs, 'detail', -0.04)
  // the destination on the roof
  const R = TOP(B0 + 0.6, -1.0, D + BH + 0.15)
  p.fill2(R, 0, 0, 7.4, 2.0, 'paper', 0.02).text(R, dest.toUpperCase(), 3.7, 1.45, 1.0, 'hi', 'middle', 0.05)
  for (const x of [-1.7, -10.7]) {
    p.cylY(x, 1.0, 0.55, 0.55, 0.42, 12)
    p.cylY(x, -1.42, 0.55, 0.55, 0.42, 12)
  }
  lights(p, 0, [0.9, -0.9], 0.5)
  g.add(p.build('boxTruckBody'))
  for (const [n, y, s] of [['doorL', 1.4, -1], ['doorR', -1.4, 1]] as const) {
    const d = new Part(ink)
    const y0 = s < 0 ? -1.4 : 0
    d.box(-0.08, y0, 0, 0.08, 1.4, BH + 0.12)
    for (const k of [0.35, 1.05]) d.seg('line', W(-0.09, y0 + k, 0.2), W(-0.09, y0 + k, BH - 0.1))
    const dg = d.build(n)
    dg.position.copy(W(B0, y, D))
    g.add(dg)
  }
  return g
}

/** CNG in tube skids: Factory Yard's flatbed trailer carrying a bundle of long cylinders. */
export function buildTubeSkid(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const L = 14
  p.box(-L, -1.3, 1.0, L, 2.6, 0.35)
  p.box(-L + 0.4, -0.5, 0.5, L - 0.8, 1.0, 0.5)
  for (const x of [-0.4, -L + 0.2]) p.box(x, -1.3, 1.35, 0.2, 2.6, 2.5)
  // nine tubes in three rows, banded
  for (const [y, z] of [[-0.8, 1.75], [0, 1.75], [0.8, 1.75], [-0.4, 2.45], [0.4, 2.45], [-0.8, 3.15], [0, 3.15], [0.8, 3.15]] as const) {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      pts.push([-L + 0.4, y + 0.36 * Math.cos(a), z + 0.36 * Math.sin(a)])
    }
    p.extrude(pts, [L - 0.8, 0, 0], 'n', { seams: false })
  }
  for (const x of [-3.5, -L / 2, -L + 3.5]) p.box(x, -1.3, 1.35, 0.2, 2.6, 2.3, 'k')
  p.text(SIDE(-0.2, 1.3, 3.8), 'CNG', 1.3, 1.0, 0.9, 'ink', 'middle', 0.05)
  for (const x of [-L + 2, -L + 3.5]) {
    p.cylY(x, 1.1, 0.55, 0.55, 0.4, 12)
    p.cylY(x, -1.5, 0.55, 0.55, 0.4, 12)
  }
  p.box(-0.6, -0.15, 0.2, 0.3, 0.3, 0.8)
  return p.build('tubeSkid')
}

// ---- receiving -----------------------------------------------------------------------------------

/** an open bin of cassava at receiving; fill 0–1 heaps the roots */
export function buildBin(ink: Ink, x: number, y: number, fill: number, label: string): THREE.Group {
  const p = new Part(ink)
  const w = 7
  const d = 9
  const h = 1.6
  p.box(x - w / 2, y - d / 2, 0, w, 0.3, h).box(x - w / 2, y + d / 2 - 0.3, 0, w, 0.3, h)
  p.box(x - w / 2, y - d / 2 + 0.3, 0, 0.3, d - 0.6, h).box(x + w / 2 - 0.3, y - d / 2 + 0.3, 0, 0.3, d - 0.6, h)
  p.fill2(TOP(x - w / 2, y - d / 2, 0), 0, 0, w, d, 'deck', 0.012)
  if (fill > 0) {
    const n = Math.max(1, Math.round(fill * 3))
    for (let l = 0; l < n; l++) for (let k = 0; k < 5 - l; k++) p.cylY(x - w / 2 + 0.9 + k * 1.25 + l * 0.6, y - d / 2 + 0.6 + l * 0.6, 0.35 + l * 0.5, 0.32, d - 1.2 - l * 1.2, 6, 'k')
  }
  p.text(FRONT(x - w / 2, y + d / 2, h), label, w / 2, 1.05, 0.7, 'ink', 'middle', 0.05)
  return p.build('bin')
}

/** the weighbridge: a steel deck flush with the yard and a scale house beside it */
export function buildWeighbridge(ink: Ink, x: number, y0: number, y1: number): THREE.Group {
  const p = new Part(ink)
  p.box(x - 2.2, y0, 0, 4.4, y1 - y0, 0.18)
  const T = TOP(x - 2.2, y0, 0.18)
  for (let v = 2; v < y1 - y0; v += 2) p.draw(T, [0, v, 4.4, v])
  p.box(x + 4, y0 + 6, 0, 4.4, 5, 3.0)
  p.box(x + 3.8, y0 + 5.8, 3.0, 4.8, 5.4, 0.25)
  const F = FRONT(x + 4, y0 + 11, 3.0)
  p.fill2(F, 0.6, 0.6, 3.2, 1.1, 'window').rect2(F, 0.6, 0.6, 3.2, 1.1, 'line')
  p.text(SIDE(x + 8.4, y0 + 11, 3.0), 'TIMBANGAN', 2.5, 0.8, 0.55, 'ink', 'middle', 0.05)
  return p.build('weighbridge')
}

// ---- the line ------------------------------------------------------------------------------------

/** a long work table (peeling, packing), plate coordinates */
export function table(p: Part, x: number, y: number, w: number, d: number, h = 0.95, tone: Tone = 'n'): Part {
  p.box(x, y, h - 0.08, w, d, 0.08, tone)
  for (const xx of [x + 0.2, x + w - 0.35]) for (const yy of [y + 0.15, y + d - 0.3]) p.box(xx, yy, 0, 0.15, 0.15, h - 0.08)
  return p
}

/** a crate of cassava: open slatted box, heaped when full */
export function crate(p: Part, x: number, y: number, full: boolean, tone: Tone = 'k'): Part {
  p.box(x - 0.6, y - 0.45, 0, 1.2, 0.9, 0.6)
  p.draw(FRONT(x - 0.6, y + 0.45, 0.6), [0, 0.2, 1.2, 0.2, 0, 0.4, 1.2, 0.4])
  if (full) p.box(x - 0.5, y - 0.35, 0.6, 1.0, 0.7, 0.25, tone)
  return p
}

/** a fryer: a long oil bath with a hood and an exhaust stack through the roof */
export function fryer(p: Part, x: number, y: number, len: number, stackTo: number): Part {
  p.box(x, y - 1.6, 0, len, 3.2, 1.3)
  p.fill2(TOP(x, y - 1.6, 1.3), 0.4, 0.4, len - 0.8, 2.4, 'glass', 0.02)
  // the in-feed and out-feed belts
  p.box(x - 2.2, y - 0.8, 0.9, 2.2, 1.6, 0.2).box(x + len, y - 0.8, 0.9, 2.2, 1.6, 0.2)
  // the hood on four posts, the stack rising out of it
  for (const xx of [x + 0.2, x + len - 0.4]) for (const yy of [y - 1.5, y + 1.3]) p.box(xx, yy, 1.3, 0.2, 0.2, 1.6)
  p.extrude([[x, y - 1.7, 2.9], [x + len, y - 1.7, 2.9], [x + len - 1.2, y - 0.5, 3.8], [x + 1.2, y - 0.5, 3.8]], [0, 2.2, 0], 'n')
  p.cylZ(x + len / 2, y, 3.8, 0.45, stackTo - 3.8, 10)
  // burner under the bath: the CNG flame's housing on the front
  const F = FRONT(x, y + 1.6, 1.3)
  for (let u = 1; u < len - 0.6; u += 1.2) p.draw(F, [u, 0.85, u + 0.6, 0.85], 'line')
  return p
}

/** a washing drum on its frame, with a water tank */
export function washer(p: Part, x: number, y: number): Part {
  for (const xx of [x, x + 7.6]) for (const yy of [y - 1.3, y + 1.1]) p.box(xx, yy, 0, 0.2, 0.2, 1.4)
  const pts: [number, number, number][] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    pts.push([x, y + 1.25 * Math.cos(a), 2.4 + 1.25 * Math.sin(a)])
  }
  p.extrude(pts, [7.8, 0, 0], 'n', { seams: false })
  // hoops round the drum
  for (let u = 1; u < 7.8; u += 1.3)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const b = ((i + 1) / 12) * Math.PI * 2
      p.seg('detail', W(x + u, y + 1.27 * Math.cos(a), 2.4 + 1.27 * Math.sin(a)), W(x + u, y + 1.27 * Math.cos(b), 2.4 + 1.27 * Math.sin(b)))
    }
  p.box(x + 9, y - 1.5, 0, 3.2, 3.0, 2.2)
  p.text(FRONT(x + 9, y + 1.5, 2.2), 'AIR', 1.6, 1.1, 0.6, 'ink', 'middle', 0.05)
  return p
}

/** a slicer: a hopper over a cutting head, chips dropping onto the belt */
export function slicer(p: Part, x: number, y: number): Part {
  p.box(x, y - 1.2, 0, 3.4, 2.4, 1.8)
  p.extrude([[x - 0.3, y - 1.5, 2.8], [x + 3.7, y - 1.5, 2.8], [x + 2.9, y - 0.7, 1.8], [x + 0.5, y - 0.7, 1.8]], [0, 2.2, 0], 'n')
  p.text(FRONT(x, y + 1.2, 1.8), 'SLICER', 1.7, 1.0, 0.55, 'ink', 'middle', 0.05)
  return p
}

/** a dosing tank on legs (texture improver), labelled on its face */
export function dosingTank(p: Part, x: number, y: number, label: string): Part {
  for (const [dx, dy] of [[-0.8, -0.8], [0.6, -0.8], [-0.8, 0.6], [0.6, 0.6]] as const) p.box(x + dx, y + dy, 0, 0.2, 0.2, 1.2)
  p.cylZ(x, y, 1.2, 1.05, 2.0, 14)
  p.text(FRONT(x - 1.0, y + 1.05, 3.0), label, 1.0, 1.1, 0.42, 'ink', 'middle', 0.06)
  return p
}

/** an upright storage tank (oil), labelled */
export function tank(p: Part, x: number, y: number, r: number, h: number, label: string): Part {
  p.cylZ(x, y, 0, r, h, 16)
  for (const z of [h * 0.33, h * 0.66]) for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const b = ((i + 1) / 16) * Math.PI * 2
    p.seg('detail', W(x + r * 1.01 * Math.cos(a), y + r * 1.01 * Math.sin(a), z), W(x + r * 1.01 * Math.cos(b), y + r * 1.01 * Math.sin(b), z))
  }
  p.text(FRONT(x - r, y + r, h * 0.66), label, r, 1.2, 0.6, 'ink', 'middle', 0.08)
  return p
}

/** a grade bin at sorting: open, with its grade on the front and a fill level */
export function gradeBin(p: Part, x: number, y: number, label: string, fill: number, w = 4.4): Part {
  const d = 3.2
  const h = 1.4
  p.box(x, y, 0, w, 0.2, h).box(x, y + d - 0.2, 0, w, 0.2, h).box(x, y + 0.2, 0, 0.2, d - 0.4, h).box(x + w - 0.2, y + 0.2, 0, 0.2, d - 0.4, h)
  if (fill > 0) p.box(x + 0.2, y + 0.2, 0, w - 0.4, d - 0.4, h * fill, 'k')
  p.fill2(FRONT(x, y + d, h), 0, 0, w, 0.9, 'paper', 0.02).text(FRONT(x, y + d, h), label, w / 2, 0.7, 0.55, 'hi', 'middle', 0.04)
  return p
}

/** a stack of cartons (packed FCC) on a pallet */
export function cartonPallet(p: Part, x: number, y: number, layers = 3): Part {
  p.box(x - 1.1, y - 1.1, 0, 2.2, 2.2, 0.3)
  p.draw(FRONT(x - 1.1, y + 1.1, 0.3), [0, 0.1, 2.2, 0.1, 0.5, 0.1, 0.5, 0.3, 1.6, 0.1, 1.6, 0.3])
  for (let l = 0; l < layers; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) p.box(x - 1.05 + 1.07 * i, y - 1.05 + 1.07 * j, 0.3 + 0.62 * l, 1.03, 1.03, 0.6, 'paper')
  return p
}

/** a belt conveyor segment along x at height z, with its legs */
export function beltX(p: Part, x0: number, x1: number, y: number, z = 0.9, w = 1.4): Part {
  p.box(x0, y - w / 2, z - 0.25, x1 - x0, w, 0.25)
  p.box(x0, y - w / 2 - 0.12, z, x1 - x0, 0.12, 0.18).box(x0, y + w / 2, z, x1 - x0, 0.12, 0.18)
  const T = TOP(x0, y - w / 2, z + 0.01)
  const segs: number[] = []
  for (let u = 0.6; u < x1 - x0; u += 0.8) segs.push(u, 0.1, u, w - 0.1)
  p.draw(T, segs)
  for (let x = x0 + 1.5; x < x1; x += 5) for (const yy of [y - w / 2, y + w / 2 - 0.2]) p.box(x, yy, 0, 0.2, 0.2, z - 0.25)
  return p
}

/** a belt conveyor segment along y at height z, with its legs */
export function beltY(p: Part, x: number, y0: number, y1: number, z = 0.9, w = 1.4): Part {
  p.box(x - w / 2, y0, z - 0.25, w, y1 - y0, 0.25)
  p.box(x - w / 2 - 0.12, y0, z, 0.12, y1 - y0, 0.18).box(x + w / 2, y0, z, 0.12, y1 - y0, 0.18)
  const T = TOP(x - w / 2, y0, z + 0.01)
  const segs: number[] = []
  for (let v = 0.6; v < y1 - y0; v += 0.8) segs.push(0.1, v, w - 0.1, v)
  p.draw(T, segs)
  for (let y = y0 + 1.5; y < y1; y += 5) for (const xx of [x - w / 2, x + w / 2 - 0.2]) p.box(xx, y, 0, 0.2, 0.2, z - 0.25)
  return p
}
