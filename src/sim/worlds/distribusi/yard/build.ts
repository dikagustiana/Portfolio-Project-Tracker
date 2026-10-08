// The static world: ground, roads and the six places, drawn with Factory Yard's kernel. The gudang
// and the kantor are closed buildings that open as section drawings (Factory Yard's
// buildWarehouse pattern): a base that is always there, a shell that hides the inside, and a cut
// with the walls cut low and hatched and the roof as an outline only.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W, makeRng, plane } from '../../../yard/kernel.ts'
import type { Ink, V3 } from '../../../yard/kernel.ts'
import { lampPost, tree } from '../../../yard/models.ts'
import type { PeekDef } from '../../../yard/types.ts'
import {
  A1, A2, BAY, COURIER_SLOTS, GUDANG, HOUSES, HOUSE_LANES, KANTOR, LOAD_DOCKS, PLANTS, PLATE, POOL_BAYS, R1, R2, RACK_BAYS, RACK_PITCH,
  RACK_ROWS, RACK_X0, RECV_DOCKS, STORES, STORE_LANES, STORE_LINK,
} from './layout.ts'

export type Peek = PeekDef

// ---- ground, roads, paint ---------------------------------------------------------------------

export function buildGround(ink: Ink): THREE.Group {
  const rng = makeRng(20261007)
  const rand = (a: number, b: number): number => a + (b - a) * rng()
  const p = new Part(ink)
  const G = TOP(0, 0, 0)
  // the slab in section
  p.box(PLATE.x0, PLATE.y0, -4, PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 4, 'gr')
  // paved yards: the principals' estate, the truck pool, the gudang compound, the store lanes
  for (const [x, y, w, d] of [[0, 118, 118, 162], [132, 0, 168, 104], [132, 118, 168, 104]]) p.fill2(G, x ?? 0, y ?? 0, w ?? 0, d ?? 0, 'road', 0.015)
  for (const l of STORE_LANES) p.fill2(G, 314, l.y0, 126, l.y1 - l.y0, 'road', 0.015)
  p.fill2(G, STORE_LINK.x0, 50, STORE_LINK.x1 - STORE_LINK.x0, 31, 'road', 0.015)
  for (const l of HOUSE_LANES) p.fill2(G, l.x0, l.y0, l.x1 - l.x0, l.y1 - l.y0, 'road', 0.015)
  // lawns round the kantor and the housing
  p.fill2(G, 0, 0, 118, 104, 'grass', 0.012)
  p.fill2(G, 314, 118, 126, 104, 'grass', 0.012)
  p.fill2(G, 132, 236, 308, 44, 'grass', 0.012)
  p.fill2(G, 314, 0, 126, 104, 'deck', 0.012)
  // asphalt
  p.fill2(G, 0, R1.y0, PLATE.x1, R1.y1 - R1.y0, 'glass', 0.02)
  p.fill2(G, R2.x0, R2.y0, PLATE.x1 - R2.x0, R2.y1 - R2.y0, 'glass', 0.02)
  p.fill2(G, A1.x0, 0, A1.x1 - A1.x0, PLATE.y1, 'glass', 0.02)
  p.fill2(G, A2.x0, 0, A2.x1 - A2.x0, PLATE.y1, 'glass', 0.02)
  // kerbs and centre dashes
  const dashes = (x0: number, y0: number, x1: number, y1: number, skip: (x: number, y: number) => boolean = () => false): void => {
    const L = Math.hypot(x1 - x0, y1 - y0)
    const ux = (x1 - x0) / L
    const uy = (y1 - y0) / L
    for (let d = 1; d < L - 3; d += 6) {
      const x = x0 + ux * d
      const y = y0 + uy * d
      if (!skip(x, y) && !skip(x + ux * 3, y + uy * 3)) p.draw(G, [x, y, x + ux * 3, y + uy * 3], 'line', 0.05)
    }
  }
  const nearX = (x: number): boolean => (x > A1.x0 - 1 && x < A1.x1 + 1) || (x > A2.x0 - 1 && x < A2.x1 + 1)
  const nearY = (y: number): boolean => (y > R1.y0 - 1 && y < R1.y1 + 1) || (y > R2.y0 - 1 && y < R2.y1 + 1)
  dashes(0, (R1.y0 + R1.y1) / 2, PLATE.x1, (R1.y0 + R1.y1) / 2, (x) => nearX(x))
  dashes(R2.x0, (R2.y0 + R2.y1) / 2, PLATE.x1, (R2.y0 + R2.y1) / 2, (x) => nearX(x))
  dashes((A1.x0 + A1.x1) / 2, 0, (A1.x0 + A1.x1) / 2, PLATE.y1, (_, y) => nearY(y))
  dashes((A2.x0 + A2.x1) / 2, 0, (A2.x0 + A2.x1) / 2, PLATE.y1, (_, y) => nearY(y))
  for (const y of [R1.y0, R1.y1]) p.draw(G, [0, y, PLATE.x1, y], 'detail', 0.05)
  for (const y of [R2.y0, R2.y1]) p.draw(G, [R2.x0, y, PLATE.x1, y], 'detail', 0.05)
  for (const x of [A1.x0, A1.x1, A2.x0, A2.x1]) p.draw(G, [x, 0, x, PLATE.y1], 'detail', 0.05)
  // street names and the exit east to zona 2 and 3
  p.text(G, 'JL. RAYA', 6, 112.6, 1.6, 'paint').text(G, 'JL. RAYA', 330, 112.6, 1.6, 'paint')
  p.text(G, 'JL. PERUMAHAN', 340, 230.6, 1.6, 'paint')
  p.text(plane([A1.x0 + 9, 60, 0], [0, -1, 0], [1, 0, 0]), 'JL. PRINSIPAL', 0, 0, 1.6, 'paint', 'middle', 0.05)
  p.text(plane([A2.x0 + 9, 260, 0], [0, -1, 0], [1, 0, 0]), 'JL. NIAGA', 0, 0, 1.6, 'paint', 'middle', 0.05)
  p.text(G, 'ZONA 2 · 80 KM  ZONA 3 · 180 KM  →', 437, 109.4, 1.2, 'paint', 'end')
  // place names, painted large on the ground beside each place
  p.text(G, 'KANTOR', 18, 82, 4.2, 'paint').text(G, 'PRINSIPAL', 6, 276, 4.2, 'paint')
  p.text(G, 'GUDANG', 142, 214, 4.2, 'paint').text(G, 'POOL TRUK', 160, 96, 4.2, 'paint')
  p.text(G, 'TOKO · ZONA 1', 320, 102, 3.4, 'paint').text(G, 'KONSUMEN', 320, 218, 4.2, 'paint')
  p.text(G, 'BAY KURIR', 212, 199.6, 1.4, 'paint')
  // the principals' estate: dispatch bays painted in front of each plant
  for (const pl of PLANTS) {
    p.rect2(G, pl.bay[0] - 5, pl.bay[1] - 12, 10, 16, 'line', 0.05)
    p.text(G, `BAY ${pl.id}`, pl.bay[0], pl.bay[1] + 6, 1.3, 'paint', 'middle')
  }
  // truck pool bays
  for (const b of POOL_BAYS) p.rect2(G, b.x - 7, b.y - 18, 14, 20, 'line', 0.05)
  // gudang compound: dock aprons and the receiving lanes
  for (const d of LOAD_DOCKS) p.draw(G, [GUDANG.x1 + 1, d.y - 3.4, GUDANG.x1 + 16, d.y - 3.4, GUDANG.x1 + 1, d.y + 3.4, GUDANG.x1 + 16, d.y + 3.4], 'line', 0.05)
  for (const d of LOAD_DOCKS) p.text(G, `DOK ${d.id}`, GUDANG.x1 + 18, d.y + 0.6, 1.2, 'paint')
  for (const d of RECV_DOCKS) {
    p.draw(G, [d.x - 3.4, GUDANG.y1 + 1, d.x - 3.4, GUDANG.y1 + 16, d.x + 3.4, GUDANG.y1 + 1, d.x + 3.4, GUDANG.y1 + 16], 'line', 0.05)
    p.text(G, `TERIMA ${d.id}`, d.x, GUDANG.y1 + 19, 1.1, 'paint', 'middle')
  }
  p.text(G, 'B2B', GUDANG.x1 + 18, 194, 1.6, 'paint')
  // store lanes: a stop line in front of each store
  for (const s of STORES) p.draw(G, [s.stop[0] - 4, s.stop[1] - 3, s.stop[0] + 4, s.stop[1] - 3], 'detail', 0.05)
  // trees: round the kantor, along Jl. Raya, between the housing rows
  for (const [x, y] of [[8, 8], [8, 30], [8, 52], [8, 74], [106, 10], [108, 34], [108, 58], [108, 88], [40, 92], [64, 94], [88, 92]] as const) tree(p, x, y, rand(0.85, 1.1), 0, rand(0, 3))
  for (let x = 140; x < 296; x += rand(14, 20)) tree(p, x, 100, rand(0.8, 1.0), 0, rand(0, 3))
  for (let x = 318; x < 438; x += rand(13, 18)) tree(p, x, 164, rand(0.8, 1.0), 0, rand(0, 3))
  for (let x = 136; x < 438; x += rand(16, 22)) if (x < 296 || x > 316) tree(p, x, 277, rand(0.8, 1.0), 0, rand(0, 3))
  for (const x of [60, 190, 250, 370]) lampPost(p, x, R1.y0 - 0.8, 0, 1, 0)
  for (const x of [190, 280, 370]) lampPost(p, x, R2.y1 + 0.8, 0, -1, 0)
  return p.build('ground')
}

// ---- the gudang: a closed building that opens as a section --------------------------------------

export function buildGudang(ink: Ink): { group: THREE.Group; peek: Peek } {
  const g = new THREE.Group()
  g.name = 'gudang'
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = GUDANG
  const LOW = 1.2
  const T = 0.6
  const RY = (Y0 + Y1) / 2
  const RZ = 13.5
  const dockGaps = LOAD_DOCKS.map((d) => [d.y - 3, d.y + 3] as const)
  const recvGaps = [...RECV_DOCKS.map((d) => [d.x - 3, d.x + 3] as const), [229, 237] as const]

  // always there: floor, north and west walls, racks, floor paint
  const p = new Part(ink)
  p.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  p.box(X0, Y0, 0, X1 - X0, T, H)
  p.box(X0, Y0 + T, 0, T, Y1 - Y0 - T, H)
  const B = FRONT(X0 + T, Y0 + T, H)
  p.draw(B, [0, 4.6, X1 - X0 - T, 4.6]).text(B, 'GUDANG · STOK BERSAMA B2B + B2C', 6, 3.6, 2.2)
  for (let u = 2; u < X1 - X0; u += 2) p.draw(B, [u, 4.6, u, H])
  for (const ry of RACK_ROWS) {
    for (let j = 0; j <= RACK_BAYS; j++) for (const y of [ry - 1.3, ry + 1.1]) p.box(RACK_X0 + RACK_PITCH * j - 0.1, y, 0, 0.2, 0.2, 5.6)
    for (const z of [2.85, 5.45]) for (const y of [ry - 1.3, ry + 1.15]) p.box(RACK_X0, y, z, RACK_PITCH * RACK_BAYS, 0.15, 0.15)
  }
  const G = TOP(0, 0, 0)
  for (let x = RACK_X0; x < RACK_X0 + RACK_PITCH * RACK_BAYS; x += 4) for (const ay of [144, 156, 168]) p.draw(G, [x, ay, x + 2, ay], 'detail', 0.05)
  p.rect2(G, 144, 179, 60, 10, 'detail', 0.05).text(G, 'PENERIMAAN', 146, 187.6, 1.3, 'paint')
  p.rect2(G, 240, 130, 15, 58, 'detail', 0.05).text(plane([253.4, 159, 0], [0, -1, 0], [1, 0, 0]), 'STAGING B2B', 0, 0, 1.3, 'paint', 'middle', 0.05)
  p.rect2(G, 208, 179, 30, 10, 'detail', 0.05).text(G, 'PACKING B2C', 209, 187.6, 1.3, 'paint')
  for (const d of LOAD_DOCKS) p.draw(G, [240, d.y, 255, d.y], 'detail', 0.05)
  // packing benches and the admin GR desk with its screen
  for (const x of [212, 222]) p.box(x, 181, 0, 8, 2, 0.9)
  p.box(142, 181, 0, 4, 2.2, 0.75)
  g.add(p.build('gdBase'))

  // the cut: low south and east walls hatched on the cut, posts, the roof as an outline
  const c = new Part(ink)
  const low = (x: number, y: number, w: number, d: number): void => {
    c.box(x, y, 0, w, d, LOW)
    const M = TOP(x, y, LOW)
    const n = Math.max(w, d)
    const segs: number[] = []
    for (let u = 0.4; u < n; u += 0.8) segs.push(...(w > d ? [u, 0, u + T, d] : [0, u, w, u + T]))
    c.draw(M, segs)
  }
  let cx = X0 + T
  for (const [a, b] of recvGaps) {
    low(cx, Y1 - T, a - cx, T)
    cx = b
  }
  low(cx, Y1 - T, X1 - T - cx, T)
  let cy = Y0 + T
  for (const [a, b] of dockGaps) {
    low(X1 - T, cy, T, a - cy)
    cy = b
  }
  low(X1 - T, cy, T, Y1 - T - cy)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) c.box(x, y, 0, T, T, H)
  const outline: [V3, V3][] = [[[X0, Y1, H], [X1, Y1, H]], [[X1, Y0, H], [X1, Y1, H]], [[X0, RY, RZ], [X1, RY, RZ]], [[X0, Y0, H], [X0, RY, RZ]], [[X0, RY, RZ], [X0, Y1, H]], [[X1, Y0, H], [X1, RY, RZ]], [[X1, RY, RZ], [X1, Y1, H]]]
  for (const [a, b] of outline) c.seg('line', W(...a), W(...b))
  for (let x = X0 + 8; x < X1; x += 8) c.seg('detail', W(x, Y0, H), W(x, RY, RZ)).seg('detail', W(x, RY, RZ), W(x, Y1, H))
  const cut = c.build('gdCut')
  cut.visible = false
  g.add(cut)

  // the shell: full walls with door openings, a gabled roof
  const s = new Part(ink)
  cx = X0 + T
  for (const [a, b] of recvGaps) {
    s.box(cx, Y1 - T, 0, a - cx, T, H)
    s.box(a, Y1 - T, 5, b - a, T, H - 5)
    cx = b
  }
  s.box(cx, Y1 - T, 0, X1 - cx, T, H)
  cy = Y0
  for (const [a, b] of dockGaps) {
    s.box(X1 - T, cy, 0, T, a - cy, H)
    s.box(X1 - T, a, 5, T, b - a, H - 5)
    cy = b
  }
  s.box(X1 - T, cy, 0, T, Y1 - T - cy, H)
  s.extrude([[X0 - 0.4, Y0 - 0.5, H - 0.12], [X0 - 0.4, Y1 + 0.5, H - 0.12], [X0 - 0.4, RY, RZ]], [X1 - X0 + 0.8, 0, 0])
  const sl = Math.hypot(Y1 + 0.5 - RY, RZ - H + 0.12)
  const SL = plane([X0 - 0.4, RY, RZ], [1, 0, 0], [0, (Y1 + 0.5 - RY) / sl, -(RZ - H + 0.12) / sl])
  for (let u = 2.4; u < X1 - X0; u += 2.4) s.draw(SL, [u, 0, u, sl])
  for (const u of [14, 38, 62, 86]) s.fill2(SL, u, 7, 8, 12, 'window', 0.03).rect2(SL, u, 7, 8, 12, 'line', 0.04)
  const F = FRONT(X0, Y1, H)
  s.draw(F, [0, 1.8, X1 - X0, 1.8]).text(F, 'GUDANG', 2, 1.45, 1.3)
  const E = SIDE(X1, Y1, H)
  for (const [a, b] of dockGaps) s.rect2(E, Y1 - b, H - 5, b - a, 5, 'line')
  for (const [a, b] of recvGaps) s.rect2(F, a - X0, H - 5, b - a, 5, 'line')
  const shell = s.build('gdShell')
  g.add(shell)

  // dock bumpers and lamps stay with the building (a lamp glows while its dock is busy)
  const d = new Part(ink)
  for (const dk of LOAD_DOCKS) d.box(X1, dk.y - 3.6, 0, 0.5, 7.2, 1.3)
  for (const dk of RECV_DOCKS) d.box(dk.x - 3.6, Y1, 0, 7.2, 0.5, 1.3)
  g.add(d.build('gdDocks'))

  const inside = new THREE.Group()
  inside.name = 'gdInside'
  inside.visible = false
  g.add(inside)
  return { group: g, peek: { shell, cut, inside, box: [X0, X1, Y0, Y1] } }
}

/** dock lamps: one per door, glowing while that dock is busy */
export function buildDockLamp(ink: Ink, x: number, y: number): THREE.Group {
  return new Part(ink).box(x - 0.4, y - 0.4, 5.6, 0.8, 0.8, 0.6, 'l').build('dockLamp')
}

// ---- the bay kurir: an open canopy with courier slots ------------------------------------------

export function buildBay(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const { x0, x1, y0, y1 } = BAY
  // posts, a fascia with the name, and the roof drawn as an outline with its purlins, so the couriers show under it
  for (const x of [x0, x0 + 16, x0 + 32, x1 - 0.4]) for (const y of [y0, y1 - 0.4]) p.box(x, y, 0, 0.4, 0.4, 4.6)
  p.box(x0 - 0.6, y1 - 0.2, 4.6, x1 - x0 + 1.2, 0.8, 0.7)
  p.text(FRONT(x0 - 0.6, y1 + 0.6, 5.3), 'BAY KURIR · MARKETPLACE PICKUP', 1, 0.55, 0.5, 'ink')
  const z = 5.3
  for (const [a, b] of [[[x0 - 0.6, y0 - 0.6], [x1 + 0.6, y0 - 0.6]], [[x1 + 0.6, y0 - 0.6], [x1 + 0.6, y1 + 0.6]], [[x0 - 0.6, y0 - 0.6], [x0 - 0.6, y1 + 0.6]]] as const)
    p.seg('line', W(a[0], a[1], z), W(b[0], b[1], z))
  for (let x = x0 + 2; x < x1; x += 4) p.seg('detail', W(x, y0 - 0.6, z), W(x, y1 + 0.6, z))
  const G = TOP(0, 0, 0)
  for (const s of COURIER_SLOTS) p.rect2(G, s.x - 2.6, y0 + 4, 5.2, 14, 'line', 0.05)
  return p.build('bay')
}

// ---- the kantor ----------------------------------------------------------------------------------

export function buildKantor(ink: Ink): { group: THREE.Group; peek: Peek } {
  const g = new THREE.Group()
  g.name = 'kantor'
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = KANTOR
  const T = 0.5
  const LOW = 1.0
  const DOOR: [number, number] = [50, 58]
  const p = new Part(ink)
  p.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  p.box(X0, Y0, 0, X1 - X0, T, H)
  p.box(X0, Y0 + T, 0, T, Y1 - Y0 - T, H)
  // the forecast board on the north wall, over the commercial desks
  const B = FRONT(X0 + T, Y0 + T, H)
  p.fill2(B, 2, 0.8, 17, 3.4, 'paper', 0.02).rect2(B, 2, 0.8, 17, 3.4, 'line', 0.03).text(B, 'FORECAST · STOK', 3, 1.7, 0.6, 'ink', 'start', 0.04)
  for (let k = 0; k < 5; k++) p.draw(B, [3 + k * 3.2, 3.9, 3 + k * 3.2, 3.9 - 0.5 - ((k * 37) % 13) / 9, 3 + k * 3.2 + 2.2, 3.9 - 0.5 - ((k * 37) % 13) / 9, 3 + k * 3.2 + 2.2, 3.9], 'line', 0.04)
  const G = TOP(0, 0, 0)
  for (const [x, y, w, d, label] of [[27, 29, 19, 14, 'KOMERSIAL'], [48, 29, 33, 14, 'SALES ADMIN'], [27, 46, 24, 13, 'FINANCE AR'], [53, 46, 15, 13, 'PAJAK']] as const) {
    p.rect2(G, x, y, w, d, 'detail', 0.03).text(G, label, x + 0.8, y + d - 0.7, 1.0, 'paint')
  }
  p.box(70, Y1 - 4.4, 0, 9, 1.4, 1.05)
  p.text(G, 'TUKAR FAKTUR', 70, Y1 - 1.2, 0.9, 'paint')
  g.add(p.build('ktBase'))

  const c = new Part(ink)
  const low = (x: number, y: number, w: number, d: number): void => {
    c.box(x, y, 0, w, d, LOW)
    const segs: number[] = []
    for (let u = 0.4; u < Math.max(w, d); u += 0.8) segs.push(...(w > d ? [u, 0, u + T, d] : [0, u, w, u + T]))
    c.draw(TOP(x, y, LOW), segs)
  }
  low(X0 + T, Y1 - T, DOOR[0] - X0 - T, T)
  low(DOOR[1], Y1 - T, X1 - T - DOOR[1], T)
  low(X1 - T, Y0 + T, T, Y1 - Y0 - 2 * T)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) c.box(x, y, 0, T, T, H)
  const outline: [V3, V3][] = [[[X0, Y1, H], [X1, Y1, H]], [[X1, Y0, H], [X1, Y1, H]]]
  for (const [a, b] of outline) c.seg('line', W(...a), W(...b))
  for (let x = X0 + 6; x < X1; x += 6) c.seg('detail', W(x, Y0, H), W(x, Y1, H))
  const cut = c.build('ktCut')
  cut.visible = false
  g.add(cut)

  const s = new Part(ink)
  s.box(X0 + T, Y1 - T, 0, DOOR[0] - X0 - T, T, H)
  s.box(DOOR[1], Y1 - T, 0, X1 - DOOR[1], T, H)
  s.box(DOOR[0], Y1 - T, 3, DOOR[1] - DOOR[0], T, H - 3)
  s.box(X1 - T, Y0 + T, 0, T, Y1 - Y0 - T, H)
  s.box(X0 - 0.3, Y0 - 0.3, H, X1 - X0 + 0.6, Y1 - Y0 + 0.6, 0.4)
  const F = FRONT(X0, Y1, H)
  for (let u = 2; u + 2.4 < X1 - X0 - 1; u += 3.6) if (u + 2.4 < DOOR[0] - X0 || u > DOOR[1] - X0) s.fill2(F, u, 1.6, 2.4, 2.6, 'window').rect2(F, u, 1.6, 2.4, 2.6, 'line')
  s.rect2(F, DOOR[0] - X0, 3, DOOR[1] - DOOR[0], 3, 'line').text(F, 'KANTOR · PT SAMB', 2, 1.05, 0.8)
  const SE = SIDE(X1, Y1, H)
  for (let u = 2; u + 2.4 < Y1 - Y0 - 1; u += 3.6) s.fill2(SE, u, 1.2, 2.4, 2.6, 'window').rect2(SE, u, 1.2, 2.4, 2.6, 'line')
  for (const [x, y] of [[30, 31], [42, 31], [68, 42]] as const) {
    s.box(x, y, H + 0.4, 6, 4, 1.4)
    s.draw(FRONT(x, y + 4, H + 1.8), [0.5, 0.4, 5.5, 0.4, 0.5, 0.8, 5.5, 0.8])
  }
  const shell = s.build('ktShell')
  g.add(shell)
  const inside = new THREE.Group()
  inside.name = 'ktInside'
  inside.visible = false
  g.add(inside)
  return { group: g, peek: { shell, cut, inside, box: [X0, X1, Y0, Y1] } }
}

// ---- the principals' plants ------------------------------------------------------------------

export function buildPlant(ink: Ink, id: string, x0: number, y0: number): THREE.Group {
  const p = new Part(ink)
  const w = 34
  const d = 24
  const h = 8
  p.box(x0, y0, 0, w, d, h)
  for (let i = 0; i < 2; i++) {
    const xa = x0 + 17 * i
    p.extrude([[xa, y0, h], [xa + 17, y0, h], [xa + 17, y0, h + 4]], [0, d, 0])
    const M = SIDE(xa + 17, y0 + d, h + 4)
    p.fill2(M, 1, 0.6, d - 2, 2.8, 'window').rect2(M, 1, 0.6, d - 2, 2.8, 'line')
  }
  const F = FRONT(x0, y0 + d, h)
  p.draw(F, [0, 2.6, w, 2.6]).text(F, `PRINSIPAL ${id}`, 1.4, 1.9, 1.5)
  for (let u = 1.6; u < w; u += 1.6) p.draw(F, [u, 2.6, u, h])
  const S = SIDE(x0 + w, y0 + d, h)
  p.rect2(S, 6, h - 5, 7, 5, 'line')
  for (let v = h - 4.6; v < h; v += 0.6) p.draw(S, [6, v, 13, v])
  return p.build(`plant${id}`)
}

// ---- the truck pool --------------------------------------------------------------------------

export function buildPool(ink: Ink): THREE.Group {
  const p = new Part(ink)
  p.box(268, 8, 0, 22, 16, 6)
  const F = FRONT(268, 24, 6)
  p.rect2(F, 6, 1.5, 9, 4.5, 'line').text(F, 'BENGKEL', 1, 1.0, 0.9)
  for (let v = 2; v < 6; v += 0.6) p.draw(F, [6, v, 15, v])
  p.box(144, 14, 0, 6, 3, 1.4)
  p.box(143, 12, 4.2, 8, 7, 0.2)
  for (const [x, y] of [[143.4, 12.4], [150.4, 12.4], [143.4, 18.4], [150.4, 18.4]] as const) p.box(x, y, 0, 0.2, 0.2, 4.2)
  p.text(TOP(0, 0, 0), 'BBM', 147, 25, 1.2, 'paint', 'middle')
  return p.build('pool')
}

// ---- stores ------------------------------------------------------------------------------------

export function buildStore(ink: Ink, code: string, x0: number, y0: number): THREE.Group {
  const p = new Part(ink)
  const w = 18
  const d = 20
  const h = 5.4
  p.box(x0, y0, 0, w, d, h)
  p.box(x0 - 0.2, y0 - 0.2, h, w + 0.4, d + 0.4, 0.3)
  const F = FRONT(x0, y0 + d, h)
  p.fill2(F, 0, 0, w, 1.1, 'kob', 0.02).text(F, code.toUpperCase(), 1, 0.82, 0.62, 'hi', 'start', 0.04)
  p.fill2(F, 1, 1.7, 6.5, h - 2.2, 'window').rect2(F, 1, 1.7, 6.5, h - 2.2, 'line')
  p.fill2(F, 10.5, 1.7, 6.5, h - 2.2, 'window').rect2(F, 10.5, 1.7, 6.5, h - 2.2, 'line')
  p.rect2(F, 8, 2.4, 2, h - 2.4, 'line')
  p.extrude([[x0 + 0.5, y0 + d, h - 1.4], [x0 + 0.5, y0 + d + 1.8, h - 2.0], [x0 + 0.5, y0 + d + 1.8, h - 2.15], [x0 + 0.5, y0 + d, h - 1.55]], [w - 1, 0, 0], 'k')
  const S = SIDE(x0 + w, y0 + d, h)
  p.fill2(S, 2, 1.6, 6, 1.8, 'window').rect2(S, 2, 1.6, 6, 1.8, 'line')
  return p.build('store')
}
/** the DO sign-off lamp above a store's door: glows soft green once the store has signed */
export function buildSignLamp(ink: Ink, x: number, y: number): THREE.Group {
  return new Part(ink).box(x - 0.5, y - 0.3, 4.2, 1.0, 0.6, 0.5, 'l').build('signLamp')
}

// ---- housing -------------------------------------------------------------------------------------

export function buildHousing(ink: Ink): THREE.Group {
  const rng = makeRng(20261008)
  const p = new Part(ink)
  for (const hs of HOUSES) {
    const { x, y, w, d } = hs
    const h = 3.8 + (rng() < 0.4 ? 1.4 : 0)
    const rh = 2.6
    const ov = 0.5
    p.box(x, y, 0, w, d, h)
    p.extrude([[x - ov, y - ov, h - 0.12], [x - ov, y + d / 2, h + rh], [x - ov, y + d + ov, h - 0.12]], [w + 2 * ov, 0, 0])
    for (let t = 0.25; t < 1; t += 0.25) {
      const yy = y + d / 2 + t * (d / 2 + ov)
      const zz = h + rh - t * (rh + 0.12)
      p.seg('detail', W(x - ov, yy, zz), W(x + w + ov, yy, zz))
    }
    const F = FRONT(x, y + d, h)
    p.fill2(F, 2, h - 2.2, 1.1, 2.2).rect2(F, 2, h - 2.2, 1.1, 2.2, 'line')
    for (let u = 4.5; u + 1.3 < w - 0.4; u += 3) p.fill2(F, u, h - 1.9, 1.4, 1.1, rng() < 0.55 ? 'window' : 'glass').rect2(F, u, h - 1.9, 1.4, 1.1, 'line')
    const S = SIDE(x + w, y + d, h)
    for (let u = 1.6; u + 1.3 < d - 0.4; u += 3.4) p.fill2(S, u, h - 1.9, 1.3, 1.1, rng() < 0.5 ? 'window' : 'glass').rect2(S, u, h - 1.9, 1.3, 1.1, 'line')
    // a path to the street and a picket fence
    const L = TOP(0, 0, 0)
    p.fill2(L, x + 2, y + d, 1.2, hs.door[1] - 3.5 - y - d, 'deck', 0.03)
    tree(p, x + w - 2.5, y + d + 3.5, 0.75, 0, rng() * 3)
  }
  return p.build('housing')
}
