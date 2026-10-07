// The cassava plant's static world, drawn with Factory Yard's kernel. The line hall is Factory
// Yard's Plant 01 (buildFactory: the sawtooth roof with its glazed steep faces turned to the
// viewer, the corrugated walls, the chimney) made into a closed building that opens as a section
// drawing the way its Warehouse 01 does (buildWarehouse): a base that is always there, a shell
// that hides the inside, and a cut with the walls cut low and hatched and the roof as an outline.
// The finished-goods store is Warehouse 01 itself; the conveyor out of the hall is its Line A.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W, makeRng, plane } from '../../../yard/kernel.ts'
import type { Ink, V3 } from '../../../yard/kernel.ts'
import { lampPost, tree } from '../../../yard/models.ts'
import type { PeekDef } from '../../../yard/types.ts'
import { BINS, BRIDGE, CANOPY, CONVEYOR_X, DOCKS, GUDANG, HALL, KANTOR, PLATE, ROAD, SKIDS, STATIONS } from './layout.ts'
import { beltX, beltY, buildBin, buildWeighbridge, cartonPallet, crate, dosingTank, fryer, gradeBin, slicer, table, tank, washer } from './models.ts'

/** the low hatched wall of a section cut (Factory Yard's "low" helper) */
function lowWall(c: Part, x: number, y: number, w: number, d: number, LOW: number, T: number): void {
  c.box(x, y, 0, w, d, LOW)
  const segs: number[] = []
  for (let u = 0.4; u < Math.max(w, d); u += 0.8) segs.push(...(w > d ? [u, 0, u + T, d] : [0, u, w, u + T]))
  c.draw(TOP(x, y, LOW), segs)
}

// ---- ground, road, yards --------------------------------------------------------------------------

export function buildGround(ink: Ink): THREE.Group {
  const rng = makeRng(20261009)
  const rand = (a: number, b: number): number => a + (b - a) * rng()
  const p = new Part(ink)
  const G = TOP(0, 0, 0)
  p.box(PLATE.x0, PLATE.y0, -4, PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 4, 'gr')
  // grass at the plate's north and south edges and in the middle of the yard; paved yards between
  p.fill2(G, 0, 0, PLATE.x1, 10, 'grass', 0.012)
  p.fill2(G, 0, ROAD.y1, PLATE.x1, PLATE.y1 - ROAD.y1, 'grass', 0.012)
  p.fill2(G, 0, 10, PLATE.x1, ROAD.y0 - 10, 'road', 0.015)
  p.fill2(G, 112, 114, 76, 52, 'grass', 0.016)
  p.fill2(G, 62, 118, 44, 48, 'grass', 0.016)
  // the road and its paint
  p.fill2(G, 0, ROAD.y0, PLATE.x1, ROAD.y1 - ROAD.y0, 'glass', 0.02)
  for (const y of [ROAD.y0, ROAD.y1]) p.draw(G, [0, y, PLATE.x1, y], 'detail', 0.05)
  const mid = (ROAD.y0 + ROAD.y1) / 2
  for (let x = 2; x < PLATE.x1 - 4; x += 6) p.draw(G, [x, mid, x + 3, mid], 'line', 0.05)
  p.text(G, '← KEBUN SINGKONG', 4, ROAD.y0 + 4.4, 1.5, 'paint')
  p.text(G, 'SEMARANG · CIKOKOL (IFM) →', PLATE.x1 - 4, ROAD.y1 - 2.0, 1.5, 'paint', 'end')
  p.text(G, 'JL. RAYA', 140, ROAD.y1 - 2.0, 1.6, 'paint')
  // the fence along the road, with gates for receiving and for the loading yard
  for (const [a, b] of [[0, 14], [50, 276], [304, PLATE.x1]] as const) p.draw(G, [a, ROAD.y0 - 1.5, b, ROAD.y0 - 1.5], 'line', 0.05)
  // painted names, large, beside each place
  p.text(G, 'PENERIMAAN', 6, 164, 3.2, 'paint')
  p.text(G, 'SKID CNG', SKIDS.x0, SKIDS.y1 + 4, 1.6, 'paint')
  p.text(G, 'MUAT', GUDANG.x1 + 4, GUDANG.y1 + 10, 2.6, 'paint')
  // receiving lanes: trucks back up to the bins from the south; the weighbridge lane
  for (const b of BINS) p.draw(G, [b.x - 3.5, 36, b.x - 3.5, 58, b.x + 3.5, 36, b.x + 3.5, 58], 'detail', 0.05)
  p.rect2(G, BRIDGE.x - 3, BRIDGE.y0 - 1, 6, BRIDGE.y1 - BRIDGE.y0 + 2, 'line', 0.05)
  // dock aprons on the store's east wall
  for (const d of DOCKS) {
    p.draw(G, [GUDANG.x1 + 1, d.y - 3.4, GUDANG.x1 + 18, d.y - 3.4, GUDANG.x1 + 1, d.y + 3.4, GUDANG.x1 + 18, d.y + 3.4], 'line', 0.05)
    p.text(G, `DOK ${d.id}`, GUDANG.x1 + 20, d.y + 0.6, 1.2, 'paint')
  }
  // trees on the verges and in the yard's lawns, lamps along the road
  for (let x = 4; x < PLATE.x1 - 2; x += rand(11, 17)) tree(p, x, 5, rand(0.8, 1.05), 0, rand(0, 3))
  for (let x = 6; x < PLATE.x1 - 2; x += rand(12, 18)) tree(p, x, ROAD.y1 + 6 + rand(0, 6), rand(0.8, 1.05), 0, rand(0, 3))
  for (const [x, y] of [[118, 122], [132, 130], [148, 120], [164, 132], [178, 122], [124, 150], [142, 156], [160, 148], [176, 158], [70, 128], [86, 136], [98, 126], [76, 154], [94, 158]] as const) tree(p, x, y, rand(0.85, 1.05), 0, rand(0, 3))
  for (const x of [30, 110, 190, 270]) lampPost(p, x, ROAD.y0 - 0.8, 0, 1, 0)
  return p.build('ground')
}

// ---- the line hall: Factory Yard's Plant 01, opened as a section ----------------------------------

const PRISM = 20
const RISE = 5

export function buildHall(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const g = new THREE.Group()
  g.name = 'hall'
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = HALL
  const T = 0.6
  const LOW = 1.2
  const westDoor: [number, number] = [26, 34]
  // doors in the south wall: people, the CNG line, and (low) the conveyor to the store
  const southDoors: [number, number][] = [[84, 90], [166, 170], [234, 240], [CONVEYOR_X - 3, CONVEYOR_X + 3]]

  // always there: the floor, the north and west walls, floor paint
  const p = new Part(ink)
  p.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  p.box(X0, Y0, 0, X1 - X0, T, H)
  p.box(X0, Y0 + T, 0, T, westDoor[0] - Y0 - T, H)
  p.box(X0, westDoor[1], 0, T, Y1 - westDoor[1], H)
  p.box(X0, westDoor[0], 4, T, westDoor[1] - westDoor[0], H - 4)
  const B = FRONT(X0 + T, Y0 + T, H)
  p.draw(B, [0, 4.6, X1 - X0 - T, 4.6]).text(B, 'BMG · LINI KERIPIK SINGKONG (FCC)', 6, 3.6, 2.4)
  for (let u = 2; u < X1 - X0; u += 2) p.draw(B, [u, 4.6, u, H])
  const G = TOP(0, 0, 0)
  // stations marked on the floor, named along the south aisle
  const names: [keyof typeof STATIONS, string][] = [['kupas', 'PENGUPASAN'], ['cuci', 'CUCI · POTONG'], ['goreng', 'PENGGORENGAN'], ['sortir', 'SORTIR · QC'], ['kemas', 'PENGEMASAN']]
  for (const [k, label] of names) {
    const s = STATIONS[k]
    p.rect2(G, s.x0, Y0 + 3, s.x1 - s.x0, Y1 - Y0 - 6, 'detail', 0.04)
    p.text(G, label, s.x0 + 1, Y1 - 1.4, 1.4, 'paint')
  }
  g.add(p.build('hallBase'))

  // the cut: south and east walls low and hatched, posts, the sawtooth roof as an outline
  const c = new Part(ink)
  let cx = X0 + T
  for (const [a, b] of southDoors) {
    lowWall(c, cx, Y1 - T, a - cx, T, LOW, T)
    cx = b
  }
  lowWall(c, cx, Y1 - T, X1 - T - cx, T, LOW, T)
  lowWall(c, X1 - T, Y0 + T, T, Y1 - Y0 - 2 * T, LOW, T)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) c.box(x, y, 0, T, T, H)
  for (let x = X0; x < X1 - 1; x += PRISM) {
    const outline: [V3, V3][] = [
      [[x, Y1, H], [x + PRISM, Y1, H + RISE]], [[x + PRISM, Y1, H + RISE], [x + PRISM, Y1, H]], [[x + PRISM, Y0, H + RISE], [x + PRISM, Y1, H + RISE]],
    ]
    for (const [a, b] of outline) c.seg('line', W(...a), W(...b))
    for (let y = Y0 + 6; y < Y1; y += 6) c.seg('detail', W(x, y, H), W(x + PRISM, y, H + RISE))
  }
  c.seg('line', W(X0, Y1, H), W(X1, Y1, H)).seg('line', W(X1, Y0, H), W(X1, Y1, H))
  const cut = c.build('hallCut')
  cut.visible = false
  g.add(cut)

  // the shell: walls with their doors and corrugation, the sawtooth roof with glazed steep faces
  const s = new Part(ink)
  cx = X0 + T
  for (const [a, b] of southDoors) {
    s.box(cx, Y1 - T, 0, a - cx, T, H)
    s.box(a, Y1 - T, 4.2, b - a, T, H - 4.2)
    cx = b
  }
  s.box(cx, Y1 - T, 0, X1 - cx, T, H)
  s.box(X1 - T, Y0, 0, T, Y1 - T - Y0, H)
  for (let x = X0; x < X1 - 1; x += PRISM) {
    s.extrude([[x, Y0, H], [x + PRISM, Y0, H], [x + PRISM, Y0, H + RISE]], [0, Y1 - Y0, 0])
    const M = SIDE(x + PRISM, Y1, H + RISE)
    s.fill2(M, 1, 0.8, Y1 - Y0 - 2, 3.4, 'window').rect2(M, 1, 0.8, Y1 - Y0 - 2, 3.4, 'line')
    for (let u = 3.5; u < Y1 - Y0 - 1; u += 2.5) s.draw(M, [u, 0.8, u, 4.2])
    for (let y = Y0 + 3; y < Y1; y += 3) s.seg('detail', W(x + 0.4, y, H + 0.15), W(x + PRISM - 0.4, y, H + RISE - 0.05))
  }
  const F = FRONT(X0, Y1, H)
  s.draw(F, [0, 4.2, X1 - X0, 4.2])
  // Factory Yard's invented glyph and the plant's name on the sign band
  const hex: number[] = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    const b = a + Math.PI / 3
    hex.push(5 + 1.6 * Math.cos(a), 2.1 + 1.6 * Math.sin(a), 5 + 1.6 * Math.cos(b), 2.1 + 1.6 * Math.sin(b))
  }
  s.draw(F, hex, 'line').text(F, 'BMG · PABRIK KERIPIK SINGKONG', 8.4, 3.1, 2.3)
  for (let u = 1.6; u < X1 - X0; u += 1.6) if (!southDoors.some(([a, b]) => u + X0 > a - 0.3 && u + X0 < b + 0.3)) s.draw(F, [u, 4.2, u, H])
  for (const [a, b] of southDoors) {
    const dh = a === CONVEYOR_X - 3 ? 3 : 4.2
    s.rect2(F, a - X0, H - dh, b - a, dh, 'line')
    if (dh > 3) for (let v = H - 3.9; v < H; v += 0.6) s.draw(F, [a - X0, v, b - X0, v])
  }
  const E = SIDE(X1, Y1, H)
  for (let u = 1.6; u < Y1 - Y0; u += 1.6) s.draw(E, [u, 0, u, H])
  const shell = s.build('hallShell')
  g.add(shell)

  const inside = new THREE.Group()
  inside.name = 'hallInside'
  inside.visible = false
  g.add(inside)
  return { group: g, peek: { shell, cut, inside, box: [X0, X1, Y0, Y1] } }
}

// ---- the stations: each its own group, so each is clickable --------------------------------------

/** the line's main belt along the south aisle, peeling to packing */
export const BELT_Y = 66

export function buildStation(ink: Ink, id: keyof typeof STATIONS): THREE.Group {
  const p = new Part(ink)
  const s = STATIONS[id]
  if (id === 'kupas') {
    // piece-rate peeling crews at three long tables; crates of cassava in, peeled cassava onto the belt
    for (const y of [24, 34, 44]) {
      table(p, s.x0 + 4, y, 28, 2.4)
      for (let x = s.x0 + 6; x < s.x0 + 31; x += 6) crate(p, x, y + 4.4, x % 12 < 6)
    }
    for (let x = s.x0 + 4; x < s.x0 + 32; x += 3) crate(p, x, 54, true)
    beltX(p, s.x0 + 2, s.x1 + 2, BELT_Y)
  } else if (id === 'cuci') {
    washer(p, s.x0 + 2, 30)
    slicer(p, s.x0 + 20, 48)
    dosingTank(p, s.x0 + 30, 30, 'NH4HCO3')
    beltX(p, s.x0, s.x0 + 20, 48, 0.9, 1.2)
    beltX(p, s.x0 - 2, s.x1 + 2, BELT_Y)
  } else if (id === 'goreng') {
    // three fryers in parallel rows, their stacks up through the roof; olein tanks at the east end
    for (const y of [27, 39, 51]) fryer(p, s.x0 + 4, y, 30, HALL.h + RISE + 3)
    tank(p, s.x1 - 4, 26, 2.2, 6, 'OLEIN')
    tank(p, s.x1 - 4, 38, 2.2, 6, 'OLEIN')
    // the CNG line from the south wall to the burners
    p.box(s.x0 + 22, 56, 0.4, 0.3, HALL.y1 - 56, 0.3)
    p.box(s.x0 + 2, 56, 0.4, 20.3, 0.3, 0.3)
    beltX(p, s.x0 - 2, s.x1 + 2, BELT_Y)
  } else if (id === 'sortir') {
    // the sorting belt splits three ways: premium on, KW 2 and waste into their bins
    beltX(p, s.x0 + 2, s.x0 + 26, 36, 0.95, 2.4)
    table(p, s.x0 + 4, 31, 20, 1.2, 0.95)
    gradeBin(p, s.x0 + 2, 42, 'PREMIUM', 0.7, 6)
    gradeBin(p, s.x0 + 10, 42, 'KW 2', 0.3)
    gradeBin(p, s.x0 + 16.4, 42, 'WASTE', 0.25)
    p.box(s.x0 + 26, 22, 0, 5, 2.4, 0.9).box(s.x0 + 26.4, 22.4, 0.9, 1.6, 0.4, 0.6, 'g')
    p.text(TOP(s.x0 + 26, 22, 0.9), 'QC', 2.5, 1.9, 0.9, 'paint', 'middle', 0.04)
    beltX(p, s.x0 - 2, s.x1 + 2, BELT_Y)
  } else {
    // HDPE bags filled at the tables, sealed, boxed in cartons, stacked on pallets for the store
    table(p, s.x0 + 3, 24, 22, 2.4)
    table(p, s.x0 + 3, 34, 22, 2.4)
    p.box(s.x0 + 26, 24, 0, 3, 2.4, 1.6).text(FRONT(s.x0 + 26, 26.4, 1.6), 'SEALER', 1.5, 0.9, 0.5, 'ink', 'middle', 0.05)
    for (const [x, y, l] of [[s.x0 + 6, 46, 3], [s.x0 + 10, 46, 2], [s.x0 + 14, 46, 3], [s.x0 + 18, 46, 1]] as const) cartonPallet(p, x, y, l)
    beltX(p, s.x0 - 2, CONVEYOR_X + 1, BELT_Y)
    beltY(p, CONVEYOR_X, BELT_Y, HALL.y1, 0.95, 1.6)
  }
  return p.build(`station-${id}`)
}

// ---- receiving: the canopy over the bins, the weighbridge ----------------------------------------

export function buildReceiving(ink: Ink): THREE.Group {
  const g = new THREE.Group()
  g.name = 'receiving'
  const p = new Part(ink)
  const { x0, x1, y0, y1 } = CANOPY
  for (const x of [x0, x0 + 15, x0 + 30, x1 - 0.4]) for (const y of [y0, y1 - 0.4]) p.box(x, y, 0, 0.4, 0.4, 5.6)
  p.box(x0 - 0.6, y1 - 0.2, 5.6, x1 - x0 + 1.2, 0.8, 0.7)
  p.text(FRONT(x0 - 0.6, y1 + 0.6, 6.3), 'PENERIMAAN SINGKONG · MAKS. 1 HARI', 1, 0.55, 0.5, 'ink')
  const z = 6.3
  for (const [a, b] of [[[x0 - 0.6, y0 - 0.6], [x1 + 0.6, y0 - 0.6]], [[x1 + 0.6, y0 - 0.6], [x1 + 0.6, y1 + 0.6]], [[x0 - 0.6, y0 - 0.6], [x0 - 0.6, y1 + 0.6]]] as const)
    p.seg('line', W(a[0], a[1], z), W(b[0], b[1], z))
  for (let x = x0 + 2; x < x1; x += 4) p.seg('detail', W(x, y0 - 0.6, z), W(x, y1 + 0.6, z))
  // the in-feed belt from the bins into the hall's west door
  beltX(p, x1 - 2, HALL.x0 + 0.6, 30, 1.1, 1.4)
  g.add(p.build('canopy'))
  BINS.forEach((b, i) => g.add(buildBin(ink, b.x, b.y, i === 4 ? 0.6 : [0.9, 0.7, 0.4, 0.2][i] ?? 0.5, i === 4 ? 'KUPAS' : `BAK ${i + 1}`)))
  g.add(buildWeighbridge(ink, BRIDGE.x, BRIDGE.y0, BRIDGE.y1))
  return g
}

// ---- the office annex ------------------------------------------------------------------------------

export function buildKantor(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const g = new THREE.Group()
  g.name = 'kantor'
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = KANTOR
  const T = 0.5
  const LOW = 1.0
  const DOOR: [number, number] = [96, 101]
  const p = new Part(ink)
  p.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  p.box(X0, Y0, 0, X1 - X0, T, H)
  p.box(X0, Y0 + T, 0, T, Y1 - Y0 - T, H)
  // the cost card on the north wall: standard against actual per element
  const B = FRONT(X0 + T, Y0 + T, H)
  p.fill2(B, 3, 0.8, 18, 3.6, 'paper', 0.02).rect2(B, 3, 0.8, 18, 3.6, 'line', 0.03).text(B, 'KARTU BIAYA · STANDAR vs AKTUAL', 4, 1.7, 0.55, 'ink', 'start', 0.04)
  for (let k = 0; k < 8; k++) p.draw(B, [4 + k * 2, 4.1, 4 + k * 2, 4.1 - 0.4 - ((k * 37) % 11) / 8], 'line', 0.04)
  const G = TOP(0, 0, 0)
  for (const [x, y, w, d, label] of [[X0 + 2, Y0 + 3, 16, 11, 'COSTING'], [X0 + 20, Y0 + 3, 15, 11, 'GM PABRIK']] as const) p.rect2(G, x, y, w, d, 'detail', 0.03).text(G, label, x + 0.8, y + d - 0.7, 1.0, 'paint')
  g.add(p.build('ktBase'))

  const c = new Part(ink)
  lowWall(c, X0 + T, Y1 - T, DOOR[0] - X0 - T, T, LOW, T)
  lowWall(c, DOOR[1], Y1 - T, X1 - T - DOOR[1], T, LOW, T)
  lowWall(c, X1 - T, Y0 + T, T, Y1 - Y0 - 2 * T, LOW, T)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) c.box(x, y, 0, T, T, H)
  c.seg('line', W(X0, Y1, H), W(X1, Y1, H)).seg('line', W(X1, Y0, H), W(X1, Y1, H))
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
  for (let u = 2; u + 2.4 < X1 - X0 - 1; u += 3.6) if (u + 2.4 < DOOR[0] - X0 || u > DOOR[1] - X0) s.fill2(F, u, 1.6, 2.4, 2.4, 'window').rect2(F, u, 1.6, 2.4, 2.4, 'line')
  s.rect2(F, DOOR[0] - X0, 3, DOOR[1] - DOOR[0], H - 3, 'line').text(F, 'KANTOR PABRIK', 2, 1.05, 0.8)
  const SE = SIDE(X1, Y1, H)
  for (let u = 2; u + 2.4 < Y1 - Y0 - 1; u += 3.6) s.fill2(SE, u, 1.4, 2.4, 2.4, 'window').rect2(SE, u, 1.4, 2.4, 2.4, 'line')
  s.box(X0 + 6, Y0 + 6, H + 0.4, 6, 4, 1.3)
  const shell = s.build('ktShell')
  g.add(shell)
  const inside = new THREE.Group()
  inside.name = 'ktInside'
  inside.visible = false
  g.add(inside)
  return { group: g, peek: { shell, cut, inside, box: [X0, X1, Y0, Y1] } }
}

// ---- the finished-goods store: Factory Yard's Warehouse 01 -----------------------------------------

export const RACK_Y = [112, 124, 136]
export const RACK_X0 = 206
export const RACK_BAYS = 7
export const RACK_PITCH = 6

export function buildGudang(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const g = new THREE.Group()
  g.name = 'gudang'
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = GUDANG
  const LOW = 1.2
  const T = 0.6
  const RZ = 13.5
  const RY = (Y0 + Y1) / 2
  const northGap: [number, number] = [CONVEYOR_X - 3, CONVEYOR_X + 3]
  const dockGaps = DOCKS.map((d) => [d.y - 3, d.y + 3] as const)

  // always there: the floor, the north wall (with the conveyor's opening) and the west wall, the racks
  const p = new Part(ink)
  p.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  p.box(X0, Y0, 0, northGap[0] - X0, T, H)
  p.box(northGap[1], Y0, 0, X1 - northGap[1], T, H)
  p.box(northGap[0], Y0, 3, northGap[1] - northGap[0], T, H - 3)
  p.box(X0, Y0 + T, 0, T, Y1 - Y0 - T, H)
  const B = FRONT(X0 + T, Y0 + T, H)
  p.draw(B, [0, 4.6, X1 - X0 - T, 4.6]).text(B, 'GUDANG BARANG JADI · FCC', 4, 3.6, 2.2)
  for (let u = 2; u < X1 - X0; u += 2) if (!(u + X0 > northGap[0] - 0.4 && u + X0 < northGap[1] + 0.4)) p.draw(B, [u, 4.6, u, H])
  for (const ry of RACK_Y) {
    for (let j = 0; j <= RACK_BAYS; j++) for (const y of [ry - 1.3, ry + 1.1]) p.box(RACK_X0 + RACK_PITCH * j - 0.1, y, 0, 0.2, 0.2, 5.6)
    for (const z of [2.85, 5.45]) for (const y of [ry - 1.3, ry + 1.15]) p.box(RACK_X0, y, z, RACK_PITCH * RACK_BAYS, 0.15, 0.15)
  }
  const G = TOP(0, 0, 0)
  for (let b = 0; b < RACK_BAYS; b++) p.text(G, `R${b + 1}`, RACK_X0 + 3 + RACK_PITCH * b, 147.6, 0.8, 'paint', 'middle', 0.05)
  p.rect2(G, 254, Y0 + 4, 14, Y1 - Y0 - 8, 'detail', 0.05).text(plane([266.4, 125, 0], [0, -1, 0], [1, 0, 0]), 'STAGING MUAT', 0, 0, 1.3, 'paint', 'middle', 0.05)
  for (const d of DOCKS) p.draw(G, [254, d.y, 268, d.y], 'detail', 0.05)
  g.add(p.build('gdBase'))

  // the cut: the south and east walls low and hatched, posts, the roof as an outline
  const c = new Part(ink)
  lowWall(c, X0 + T, Y1 - T, X1 - X0 - 2 * T, T, LOW, T)
  let cy = Y0 + T
  for (const [a, b] of dockGaps) {
    lowWall(c, X1 - T, cy, T, a - cy, LOW, T)
    cy = b
  }
  lowWall(c, X1 - T, cy, T, Y1 - T - cy, LOW, T)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) c.box(x, y, 0, T, T, H)
  const outline: [V3, V3][] = [[[X0, Y1, H], [X1, Y1, H]], [[X1, Y0, H], [X1, Y1, H]], [[X0, RY, RZ], [X1, RY, RZ]], [[X0, Y0, H], [X0, RY, RZ]], [[X0, RY, RZ], [X0, Y1, H]], [[X1, Y0, H], [X1, RY, RZ]], [[X1, RY, RZ], [X1, Y1, H]]]
  for (const [a, b] of outline) c.seg('line', W(...a), W(...b))
  for (let x = X0 + 8; x < X1; x += 8) c.seg('detail', W(x, Y0, H), W(x, RY, RZ)).seg('detail', W(x, RY, RZ), W(x, Y1, H))
  const cut = c.build('gdCut')
  cut.visible = false
  g.add(cut)

  // the shell: the south wall, the east wall with its dock doors, a gabled roof
  const s = new Part(ink)
  s.box(X0 + T, Y1 - T, 0, X1 - X0 - T, T, H)
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
  for (const u of [10, 28, 46, 60]) s.fill2(SL, u, 6, 5, 9, 'window', 0.03).rect2(SL, u, 6, 5, 9, 'line', 0.04)
  const F = FRONT(X0, Y1, H)
  s.draw(F, [0, 1.8, X1 - X0, 1.8]).text(F, 'GUDANG BARANG JADI', 2, 1.45, 1.3)
  for (let u = 1.2; u < X1 - X0; u += 1.2) s.draw(F, [u, 1.8, u, H])
  s.rect2(F, 30, H - 4.2, 3, 4.2, 'line')
  const E = SIDE(X1, Y1, H)
  for (const [a, b] of dockGaps) s.rect2(E, Y1 - b, H - 5, b - a, 5, 'line')
  const shell = s.build('gdShell')
  g.add(shell)

  // dock bumpers stay with the building
  const d = new Part(ink)
  for (const dk of DOCKS) d.box(X1, dk.y - 3.6, 0, 0.5, 7.2, 1.3)
  g.add(d.build('gdDocks'))

  const inside = new THREE.Group()
  inside.name = 'gdInside'
  inside.visible = false
  g.add(inside)
  return { group: g, peek: { shell, cut, inside, box: [X0, X1, Y0, Y1] } }
}

/** Factory Yard's Line A: the belt that carries packed cartons from the hall to the store */
export function buildConveyorOut(ink: Ink): THREE.Group {
  const p = new Part(ink)
  beltY(p, CONVEYOR_X, HALL.y1, GUDANG.y0 + 0.6, 1.0, 1.6)
  // a light canopy over the gap between the buildings
  for (const y of [HALL.y1 + 5, HALL.y1 + 14, GUDANG.y0 - 3]) for (const x of [CONVEYOR_X - 2, CONVEYOR_X + 1.8]) p.box(x, y, 0, 0.2, 0.2, 3.4)
  p.box(CONVEYOR_X - 2.4, HALL.y1, 3.4, 4.8, GUDANG.y0 - HALL.y1, 0.15)
  return p.build('conveyorOut')
}

/** the CNG skid bay: a hard standing, a pressure-reducing station, the pipe into the hall */
export function buildSkidBay(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const { x0, x1, y0, y1 } = SKIDS
  p.fill2(TOP(x0, y0, 0), 0, 0, x1 - x0, y1 - y0, 'deck', 0.018).rect2(TOP(x0, y0, 0), 0, 0, x1 - x0, y1 - y0, 'line', 0.03)
  p.box(x0 + 18, y0 - 6, 0, 4, 3, 2.2).text(FRONT(x0 + 18, y0 - 3, 2.2), 'PRS', 2, 1.1, 0.7, 'ink', 'middle', 0.05)
  p.box(x0 + 19.85, HALL.y1, 0.4, 0.3, y0 - 6 - HALL.y1, 0.3)
  p.box(x0 + 19.85, y0 - 3, 0.4, 0.3, 3, 0.3)
  return p.build('skidBay')
}
