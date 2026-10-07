// Models shared by every world, in Factory Yard's way (local frame: +x forward, origin at the
// front, +y left, +z up). Forklift, person, tree and lamp post are ported from Factory Yard's
// buildForklift / buildPerson / tree / lampPost; desk, document and coin are drawn with the same
// kernel. Each world adds its own vehicles and plant in src/sim/worlds/<world>/yard/models.ts.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W } from './kernel.ts'
import type { Ink, Tone } from './kernel.ts'

/** headlights are lamp-toned, so they light up after dusk */
export const lights = (p: Part, x: number, ys: number[], z: number, h = 0.24, w = 0.42): Part => {
  for (const y of ys) p.box(x, y - w / 2, z, 0.07, w, h, 'l')
  return p
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
