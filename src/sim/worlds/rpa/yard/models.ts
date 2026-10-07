// The slaughterhouse's own models, in Factory Yard's way (vehicles in a local frame: +x forward,
// origin at the front, +y left, +z up; machines in plate coordinates), drawn with the shared
// kernel. The chilled and frozen trucks are the shell's box truck (Factory Yard's buildVan) with
// a refrigeration unit.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W } from '../../../yard/kernel.ts'
import type { Ink, Tone } from '../../../yard/kernel.ts'
import { lights } from '../../../yard/models.ts'

// ---- vehicles ------------------------------------------------------------------------------------

/** An open truck stacked with crates of live birds (or, on the Trading path, a box of finished goods). */
export const BIRD_TRUCK_LEN = 9.6
export function buildBirdTruck(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const L = BIRD_TRUCK_LEN
  p.box(-L + 0.3, -0.75, 0.45, L - 0.6, 1.5, 0.4)
  p.box(-0.35, -1.2, 0.35, 0.35, 2.4, 0.5)
  p.box(-2.5, -1.15, 0.8, 2.2, 2.3, 2.0)
  p.box(-2.6, -1.2, 2.8, 2.4, 2.4, 0.16)
  const fr = SIDE(-0.3, 1.15, 2.8)
  p.fill2(fr, 0.2, 0.2, 1.9, 0.85).rect2(fr, 0.2, 0.2, 1.9, 0.85, 'line')
  p.fill2(FRONT(-2.5, 1.15, 2.8), 1.0, 0.25, 1.0, 0.75).rect2(FRONT(-2.5, 1.15, 2.8), 1.0, 0.25, 1.0, 0.75, 'line')
  const B0 = -L
  const BL = L - 2.8
  p.box(B0, -1.3, 0.85, BL, 2.6, 0.25)
  // crates of birds, four high, slatted so the load reads as live
  for (let l = 0; l < 4; l++)
    for (let i = 0; i < 5; i++)
      for (const y of [-1.2, 0.05]) {
        p.box(B0 + 0.2 + i * 1.32, y, 1.1 + l * 0.5, 1.25, 1.15, 0.47, l % 2 ? 'n' : 'k')
      }
  const F = FRONT(B0, 1.2, 3.1)
  for (let l = 0; l < 4; l++) p.draw(F, [0.2, 0.25 + l * 0.5, BL - 0.2, 0.25 + l * 0.5], 'detail', 0.05)
  for (const x of [-1.4, -7.6]) {
    p.cylY(x, 0.9, 0.5, 0.5, 0.36, 12)
    p.cylY(x, -1.26, 0.5, 0.5, 0.36, 12)
  }
  lights(p, 0, [0.8, -0.8], 0.5)
  return p.build('birdTruck')
}

// ---- the suppliers (external) --------------------------------------------------------------------

/** a broiler house: a long low shed with curtain sides and a ridge vent */
export function broilerHouse(p: Part, x: number, y: number, w: number, d: number, label: string): Part {
  const h = 3
  p.box(x, y, 0, w, d, 0.6)
  for (let u = 0; u <= w; u += 4) for (const yy of [y, y + d - 0.3]) p.box(x + Math.min(u, w - 0.3), yy, 0.6, 0.3, 0.3, h - 0.6)
  const F = FRONT(x, y + d, h)
  for (let v = 0.4; v < h - 0.6; v += 0.45) p.draw(F, [0, v, w, v], 'detail')
  p.extrude([[x - 0.4, y - 0.5, h], [x - 0.4, y + d + 0.5, h], [x - 0.4, y + d / 2, h + 1.8]], [w + 0.8, 0, 0])
  p.box(x, y + d / 2 - 0.6, h + 1.7, w, 1.2, 0.5)
  p.text(FRONT(x, y + d, 0.6), label, 1, 0.45, 0.4, 'ink', 'start', 0.05)
  return p
}

// ---- receiving and holding ---------------------------------------------------------------------

/** a stack of bird crates (keranjang): `n` high */
export function crateStack(p: Part, x: number, y: number, n: number, tone: Tone = 'k'): Part {
  for (let l = 0; l < n; l++) {
    p.box(x - 0.62, y - 0.55, l * 0.5, 1.24, 1.1, 0.47, l % 2 ? 'n' : tone)
    p.draw(FRONT(x - 0.62, y + 0.55, l * 0.5 + 0.47), [0.15, 0.24, 1.09, 0.24], 'detail', 0.04)
  }
  return p
}

/** the holding pens: an open shed on posts over rows of crate stacks */
export function holdingShed(p: Part, x0: number, y0: number, x1: number, y1: number): Part {
  for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 4) for (const y of [y0, y1 - 0.4]) p.box(Math.min(x, x1 - 0.4), y, 0, 0.4, 0.4, 4.4)
  const z = 4.6
  p.box(x0 - 0.6, y1 - 0.2, 4.4, x1 - x0 + 1.2, 0.8, 0.5)
  for (const [a, b] of [[[x0 - 0.6, y0 - 0.6], [x1 + 0.6, y0 - 0.6]], [[x1 + 0.6, y0 - 0.6], [x1 + 0.6, y1 + 0.6]], [[x0 - 0.6, y0 - 0.6], [x0 - 0.6, y1 + 0.6]]] as const)
    p.seg('line', W(a[0], a[1], z), W(b[0], b[1], z))
  for (let x = x0 + 2; x < x1; x += 4) p.seg('detail', W(x, y0 - 0.6, z), W(x, y1 + 0.6, z))
  // fans along the north side
  for (let x = x0 + 5; x < x1 - 2; x += 9) p.cylY(x, y0 + 0.2, 2.6, 1.1, 0.4, 12)
  return p
}

/** a platform scale with its indicator post */
export function scale(p: Part, x: number, y: number, w = 3.2, d = 2.6): Part {
  p.box(x - w / 2, y - d / 2, 0, w, d, 0.2)
  p.box(x + w / 2 + 0.3, y - 0.2, 0, 0.3, 0.3, 1.6).box(x + w / 2 + 0.05, y - 0.5, 1.6, 0.8, 1.0, 0.6, 'g')
  return p
}

// ---- the line ------------------------------------------------------------------------------------

/** the overhead shackle line along x at height z, birds hanging every `pitch` */
export function shackleLine(p: Part, x0: number, x1: number, y: number, z = 3.2, pitch = 1.2, from = x0, to = x1): Part {
  p.seg('line', W(x0, y, z), W(x1, y, z))
  p.seg('detail', W(x0, y, z + 0.25), W(x1, y, z + 0.25))
  for (let x = x0 + 4; x < x1; x += 8) p.box(x, y - 0.1, z + 0.25, 0.2, 0.2, 2)
  for (let x = from; x < to; x += pitch) {
    p.seg('detail', W(x, y, z), W(x, y, z - 0.5))
    p.box(x - 0.22, y - 0.3, z - 1.3, 0.44, 0.6, 0.8, 'paper')
  }
  return p
}

/** a long open tank (bleeding trough, scalder) */
export function tankOpen(p: Part, x: number, y: number, w: number, d: number, h: number, label: string, fill: 'glass' | 'deck' = 'glass'): Part {
  p.box(x, y, 0, w, 0.2, h).box(x, y + d - 0.2, 0, w, 0.2, h).box(x, y + 0.2, 0, 0.2, d - 0.4, h).box(x + w - 0.2, y + 0.2, 0, 0.2, d - 0.4, h)
  p.fill2(TOP(x + 0.2, y + 0.2, h * 0.8), 0, 0, w - 0.4, d - 0.4, fill, 0.02)
  p.text(FRONT(x, y + d, h), label, w / 2, Math.min(0.8, h * 0.7), 0.5, 'ink', 'middle', 0.05)
  return p
}

/** the plucker: a housing with rubber-finger drums seen through its side */
export function plucker(p: Part, x: number, y: number, w = 6): Part {
  p.box(x, y - 1.4, 0, w, 2.8, 2.6)
  const F = FRONT(x, y + 1.4, 2.6)
  for (let u = 0.8; u < w - 0.4; u += 1.2) for (const v of [0.8, 1.6]) {
    const c: number[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const b = ((i + 1) / 8) * Math.PI * 2
      c.push(u + 0.35 * Math.cos(a), v + 0.35 * Math.sin(a), u + 0.35 * Math.cos(b), v + 0.35 * Math.sin(b))
    }
    p.draw(F, c)
  }
  p.text(FRONT(x, y + 1.4, 2.6), 'PLUCKER', w / 2, 2.35, 0.45, 'ink', 'middle', 0.05)
  return p
}

/** a stainless work table */
export function steelTable(p: Part, x: number, y: number, w: number, d: number, h = 0.95): Part {
  p.box(x, y, h - 0.08, w, d, 0.08)
  for (const xx of [x + 0.15, x + w - 0.3]) for (const yy of [y + 0.15, y + d - 0.3]) p.box(xx, yy, 0, 0.15, 0.15, h - 0.08)
  return p
}

/** the chiller: a long auger tank along x */
export function chiller(p: Part, x: number, y: number, len: number): Part {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI
    pts.push([x, y + 1.6 * Math.cos(a), 1.9 + 1.6 * Math.sin(a)])
  }
  p.extrude(pts, [len, 0, 0], 'n', { seams: false })
  p.box(x, y - 1.6, 1.9, len, 3.2, 0.12)
  p.fill2(TOP(x + 0.3, y - 1.4, 1.95), 0, 0, len - 0.6, 2.8, 'glass', 0.02)
  for (const xx of [x + 0.5, x + len - 0.7]) for (const yy of [y - 1.4, y + 1.2]) p.box(xx, yy, 0, 0.2, 0.2, 0.6)
  p.text(FRONT(x, y + 1.6, 1.9), 'CHILLER', len / 2, 0.8, 0.6, 'ink', 'middle', 0.05)
  return p
}

/** a labelled split-off bin; `fill` 0–1; `lock` rings the bin that is never merged with another */
export function splitBin(p: Part, x: number, y: number, label: string, fill: number, tone: Tone = 'k', lock = false): Part {
  const w = 4
  const d = 3
  const h = 1.3
  p.box(x, y, 0, w, 0.2, h).box(x, y + d - 0.2, 0, w, 0.2, h).box(x, y + 0.2, 0, 0.2, d - 0.4, h).box(x + w - 0.2, y + 0.2, 0, 0.2, d - 0.4, h)
  if (fill > 0) p.box(x + 0.2, y + 0.2, 0, w - 0.4, d - 0.4, h * fill, tone)
  p.fill2(FRONT(x, y + d, h), 0, 0, w, 0.85, 'paper', 0.02).text(FRONT(x, y + d, h), label, w / 2, 0.66, label.length > 9 ? 0.32 : 0.4, 'hi', 'middle', 0.04)
  if (lock) p.rect2(TOP(x - 0.5, y - 0.5, 0), 0, 0, w + 1, d + 1, 'badl', 0.03)
  return p
}

/** the MDM machine: a hopper on a separator drum */
export function mdm(p: Part, x: number, y: number): Part {
  p.box(x, y - 1.5, 0, 5, 3, 1.6)
  p.extrude([[x + 0.5, y - 1.6, 3.2], [x + 3.5, y - 1.6, 3.2], [x + 2.8, y - 0.8, 1.6], [x + 1.2, y - 0.8, 1.6]], [0, 2.4, 0], 'n')
  p.cylY(x + 4.2, y - 1.5, 1.0, 0.7, 3.0, 12)
  p.text(FRONT(x, y + 1.5, 1.6), 'MDM', 2.5, 1.0, 0.7, 'ink', 'middle', 0.05)
  return p
}

/** a rack of crates in a cold room, `levels` high */
export function coldRack(p: Part, x: number, y: number, w: number, levels: number, fill: number, tone: Tone = 'paper'): Part {
  for (const xx of [x, x + w - 0.2]) for (const yy of [y - 0.9, y + 0.7]) p.box(xx, yy, 0, 0.2, 0.2, levels * 1.1 + 0.2)
  for (let l = 0; l <= levels; l++) p.box(x, y - 0.9, l * 1.1, w, 1.8, 0.08)
  const n = Math.round(w / 1.3)
  for (let l = 0; l < levels; l++) for (let i = 0; i < n; i++) if ((i * 7 + l * 3) % 10 < fill * 10) p.box(x + 0.25 + i * 1.3, y - 0.7, l * 1.1 + 0.1, 1.1, 1.4, 0.8, tone)
  return p
}

/** a gate marker for the readiness lens: a post with a flag carrying the open TBC's ID */
export function gateFlag(ink: Ink, id: string): THREE.Group {
  const p = new Part(ink)
  p.box(-0.1, -0.1, 0, 0.2, 0.2, 5.2, 'warn')
  p.box(0.1, -0.08, 3.9, 3.2, 0.16, 1.3, 'warn')
  p.text(FRONT(0.1, 0.08, 5.2), id, 1.6, 0.95, 0.62, 'hi', 'middle', 0.04)
  return p.build('gate')
}
