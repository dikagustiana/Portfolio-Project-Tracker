// The slaughterhouse's static world, drawn with Factory Yard's kernel. The processing hall, the
// Fresh store, the cold building and the Kantor are closed buildings that open as section
// drawings the way Factory Yard's Warehouse 01 does: a base that is always there, a shell that
// hides the inside, and a cut with the walls cut low and hatched and the roof as an outline.
import * as THREE from 'three'
import { FRONT, Part, SIDE, TOP, W, makeRng } from '../../../yard/kernel.ts'
import type { Ink } from '../../../yard/kernel.ts'
import { lampPost, tree } from '../../../yard/models.ts'
import type { PeekDef } from '../../../yard/types.ts'
import { BEKU, BRIDGE, CHUTE_X, DOCK_BEKU, DOCK_FRESH, FENCE_X, FRESH, HALL, KANTOR, PENS, PLATE, RAIL_Y, ROAD, SECTIONS, VET } from './layout.ts'
import { broilerHouse, chiller, coldRack, crateStack, holdingShed, mdm, plucker, scale, shackleLine, splitBin, steelTable, tankOpen } from './models.ts'

function lowWall(c: Part, x: number, y: number, w: number, d: number, LOW: number, T: number): void {
  c.box(x, y, 0, w, d, LOW)
  const segs: number[] = []
  for (let u = 0.4; u < Math.max(w, d); u += 0.8) segs.push(...(w > d ? [u, 0, u + T, d] : [0, u, w, u + T]))
  c.draw(TOP(x, y, LOW), segs)
}

/** A flat-roofed closed building with a section cut: back walls (north and west) always there,
 *  the south and east walls in the shell and cut low in the section, doors as gaps in the south
 *  wall ([x0, x1, height]) and the east wall ([y0, y1, height]). */
function closedBuilding(ink: Ink, name: string, b: { x0: number; x1: number; y0: number; y1: number; h: number }, opts: { south?: [number, number, number][]; east?: [number, number, number][]; north?: [number, number, number][]; west?: [number, number, number][]; sign: string; roofPlant?: [number, number][] }): {
  base: Part
  cut: Part
  shell: Part
  finish: () => { group: THREE.Group; peek: PeekDef }
} {
  const { x0: X0, x1: X1, y0: Y0, y1: Y1, h: H } = b
  const T = 0.5
  const LOW = 1.1
  const base = new Part(ink)
  base.fill2(TOP(X0, Y0, 0), 0, 0, X1 - X0, Y1 - Y0, 'deck', 0.012)
  // north wall, with any openings
  let cx = X0
  for (const [a, c, h] of opts.north ?? []) {
    base.box(cx, Y0, 0, a - cx, T, H).box(a, Y0, h, c - a, T, H - h)
    cx = c
  }
  base.box(cx, Y0, 0, X1 - cx, T, H)
  let cy = Y0 + T
  for (const [a, c, h] of opts.west ?? []) {
    base.box(X0, cy, 0, T, a - cy, H).box(X0, a, h, T, c - a, H - h)
    cy = c
  }
  base.box(X0, cy, 0, T, Y1 - cy, H)
  const B = FRONT(X0 + T, Y0 + T, H)
  base.draw(B, [0, 2.8, X1 - X0 - T, 2.8]).text(B, opts.sign, 3, 2.1, 1.3)
  const cut = new Part(ink)
  cx = X0 + T
  for (const [a, c] of opts.south ?? []) {
    lowWall(cut, cx, Y1 - T, a - cx, T, LOW, T)
    cx = c
  }
  lowWall(cut, cx, Y1 - T, X1 - T - cx, T, LOW, T)
  cy = Y0 + T
  for (const [a, c] of opts.east ?? []) {
    lowWall(cut, X1 - T, cy, T, a - cy, LOW, T)
    cy = c
  }
  lowWall(cut, X1 - T, cy, T, Y1 - T - cy, LOW, T)
  for (const [x, y] of [[X1 - T, Y1 - T], [X0, Y1 - T], [X1 - T, Y0]] as const) cut.box(x, y, 0, T, T, H)
  cut.seg('line', W(X0, Y1, H), W(X1, Y1, H)).seg('line', W(X1, Y0, H), W(X1, Y1, H))
  for (let x = X0 + 6; x < X1; x += 6) cut.seg('detail', W(x, Y0, H), W(x, Y1, H))
  const shell = new Part(ink)
  cx = X0 + T
  for (const [a, c, h] of opts.south ?? []) {
    shell.box(cx, Y1 - T, 0, a - cx, T, H).box(a, Y1 - T, h, c - a, T, H - h)
    cx = c
  }
  shell.box(cx, Y1 - T, 0, X1 - cx, T, H)
  cy = Y0
  for (const [a, c, h] of opts.east ?? []) {
    shell.box(X1 - T, cy, 0, T, a - cy, H).box(X1 - T, a, h, T, c - a, H - h)
    cy = c
  }
  shell.box(X1 - T, cy, 0, T, Y1 - T - cy, H)
  // a flat roof with a parapet, and refrigeration plant on it
  shell.box(X0 - 0.3, Y0 - 0.3, H, X1 - X0 + 0.6, Y1 - Y0 + 0.6, 0.35)
  shell.box(X0 - 0.3, Y1 - 0.1, H + 0.35, X1 - X0 + 0.6, 0.4, 0.6).box(X1 - 0.1, Y0 - 0.3, H + 0.35, 0.4, Y1 - Y0 + 0.2, 0.6)
  for (const [x, y] of opts.roofPlant ?? []) {
    shell.box(x, y, H + 0.35, 6, 3.4, 1.6)
    for (const u of [1.5, 4.5]) shell.cylZ(x + u, y + 1.7, H + 1.95, 1.1, 0.1, 14)
  }
  const F = FRONT(X0, Y1, H)
  for (const [a, c, h] of opts.south ?? []) shell.rect2(F, a - X0, H - h, c - a, h, 'line')
  shell.draw(F, [0, 1.4, X1 - X0, 1.4]).text(F, opts.sign, 1.5, 1.05, 0.8)
  const E = SIDE(X1, Y1, H)
  for (const [a, c, h] of opts.east ?? []) shell.rect2(E, Y1 - c, H - h, c - a, h, 'line')
  return {
    base, cut, shell,
    finish() {
      const g = new THREE.Group()
      g.name = name
      g.add(base.build(`${name}Base`))
      const cutG = cut.build(`${name}Cut`)
      cutG.visible = false
      g.add(cutG)
      const shellG = shell.build(`${name}Shell`)
      g.add(shellG)
      const inside = new THREE.Group()
      inside.name = `${name}Inside`
      inside.visible = false
      g.add(inside)
      return { group: g, peek: { shell: shellG, cut: cutG, inside, box: [X0, X1, Y0, Y1] } }
    },
  }
}

// ---- ground ------------------------------------------------------------------------------------

export function buildGround(ink: Ink): THREE.Group {
  const rng = makeRng(20261010)
  const rand = (a: number, b: number): number => a + (b - a) * rng()
  const p = new Part(ink)
  const G = TOP(0, 0, 0)
  p.box(PLATE.x0, PLATE.y0, -4, PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 4, 'gr')
  // the suppliers' land west of the fence is grass; the KGR site is paved; verges north and south
  p.fill2(G, 0, 0, FENCE_X, ROAD.y0, 'grass', 0.012)
  p.fill2(G, FENCE_X, 0, PLATE.x1 - FENCE_X, 8, 'grass', 0.012)
  p.fill2(G, 0, ROAD.y1, PLATE.x1, PLATE.y1 - ROAD.y1, 'grass', 0.012)
  p.fill2(G, FENCE_X, 8, PLATE.x1 - FENCE_X, ROAD.y0 - 8, 'road', 0.015)
  p.fill2(G, 140, 92, 70, 100, 'grass', 0.016)
  // the road
  p.fill2(G, 0, ROAD.y0, PLATE.x1, ROAD.y1 - ROAD.y0, 'glass', 0.02)
  for (const y of [ROAD.y0, ROAD.y1]) p.draw(G, [0, y, PLATE.x1, y], 'detail', 0.05)
  const mid = (ROAD.y0 + ROAD.y1) / 2
  for (let x = 2; x < PLATE.x1 - 4; x += 6) p.draw(G, [x, mid, x + 3, mid], 'line', 0.05)
  p.text(G, 'JL. RAYA', 150, ROAD.y1 - 2.0, 1.6, 'paint')
  p.text(G, 'PELANGGAN →', PLATE.x1 - 4, ROAD.y1 - 2.0, 1.5, 'paint', 'end')
  // the site fence: west along the suppliers' land, and along the road with two gates
  p.draw(G, [FENCE_X, 8, FENCE_X, ROAD.y0 - 1.5], 'line', 0.05)
  for (const [a, b] of [[FENCE_X, 66], [86, 212], [334, PLATE.x1]] as const) p.draw(G, [a, ROAD.y0 - 1.5, b, ROAD.y0 - 1.5], 'line', 0.05)
  for (let y = 10; y < ROAD.y0 - 2; y += 4) p.box(FENCE_X - 0.1, y, 0, 0.2, 0.2, 1.4)
  // the external side is marked as such
  p.text(TOP(0, 0, 0), 'EKSTERNAL', 6, 188, 2.6, 'paint')
  p.text(G, 'PENGIRIMAN · BST', 214, 190, 2.0, 'paint')
  // the weighbridge lane, the dock aprons
  p.rect2(G, BRIDGE.x - 3, BRIDGE.y0 - 1, 6, BRIDGE.y1 - BRIDGE.y0 + 2, 'line', 0.05)
  for (const x of [DOCK_FRESH, DOCK_BEKU]) p.draw(G, [x - 3.4, 151, x - 3.4, 170, x + 3.4, 151, x + 3.4, 170], 'line', 0.05)
  p.text(G, 'DOK FRESH', DOCK_FRESH, 173, 1.1, 'paint', 'middle').text(G, 'DOK FROZEN', DOCK_BEKU, 173, 1.1, 'paint', 'middle')
  // trees on the verges and the lawn, lamps along the road
  for (let x = 4; x < PLATE.x1 - 2; x += rand(11, 17)) tree(p, x, 4, rand(0.8, 1.05), 0, rand(0, 3))
  for (let x = 6; x < PLATE.x1 - 2; x += rand(12, 18)) tree(p, x, ROAD.y1 + 4 + rand(0, 4), rand(0.8, 1.05), 0, rand(0, 3))
  for (const [x, y] of [[148, 100], [164, 108], [182, 98], [200, 110], [152, 126], [172, 134], [192, 128], [146, 152], [166, 160], [188, 156], [204, 146], [156, 182], [178, 186], [198, 178]] as const) tree(p, x, y, rand(0.85, 1.05), 0, rand(0, 3))
  for (const x of [80, 160, 240, 320]) lampPost(p, x, ROAD.y0 - 0.8, 0, 1, 0)
  return p.build('ground')
}

// ---- the suppliers (external) --------------------------------------------------------------------

export function buildPemasok(ink: Ink): THREE.Group {
  const p = new Part(ink)
  broilerHouse(p, 6, 16, 44, 12, 'KANDANG PEMASOK A')
  broilerHouse(p, 6, 40, 44, 12, 'KANDANG PEMASOK B')
  broilerHouse(p, 6, 64, 44, 12, 'KANDANG PEMASOK C')
  // a finished-goods supplier's cold store (Trading)
  p.box(8, 108, 0, 40, 22, 6)
  const F = FRONT(8, 130, 6)
  p.draw(F, [0, 1.4, 40, 1.4]).text(F, 'PEMASOK BARANG JADI · TRADING', 1.2, 1.05, 0.7)
  for (const x of [12, 22, 32]) p.rect2(F, x, 2.4, 6, 3.6, 'line')
  p.box(10, 112, 6, 6, 3.4, 1.4)
  return p.build('pemasok')
}

// ---- receiving, holding and weighing ---------------------------------------------------------------

export function buildReceiving(ink: Ink): THREE.Group {
  const p = new Part(ink)
  holdingShed(p, PENS.x0, PENS.y0, PENS.x1, PENS.y1)
  // crates of birds resting in rows under the shed
  for (let x = PENS.x0 + 3; x < PENS.x1 - 2; x += 2.2) for (const y of [22, 30, 38, 46]) if ((x * 7 + y) % 5 > 1) crateStack(p, x, y, 2 + (Math.round(x + y) % 3))
  // the weighbridge and its house
  p.box(BRIDGE.x - 2.2, BRIDGE.y0, 0, 4.4, BRIDGE.y1 - BRIDGE.y0, 0.18)
  for (let v = 2; v < BRIDGE.y1 - BRIDGE.y0; v += 2) p.draw(TOP(BRIDGE.x - 2.2, BRIDGE.y0, 0.18), [0, v, 4.4, v])
  p.box(BRIDGE.x + 4, BRIDGE.y0 + 8, 0, 4, 4.6, 2.8).box(BRIDGE.x + 3.8, BRIDGE.y0 + 7.8, 2.8, 4.4, 5, 0.2)
  p.text(SIDE(BRIDGE.x + 8, BRIDGE.y0 + 12.6, 2.8), 'TIMBANG', 2.3, 0.8, 0.5, 'ink', 'middle', 0.05)
  // the QC and DOA check table by the shed; the line scale at the hall's west door
  steelTable(p, 90, 62, 8, 2.4)
  p.text(TOP(90, 62, 0.95), 'QC · DOA', 4, 1.7, 0.7, 'paint', 'middle', 0.04)
  scale(p, 126, RAIL_Y)
  p.text(TOP(0, 0, 0), 'TIMBANG MASUK LINI', 118, RAIL_Y + 4.4, 0.9, 'paint')
  // crates on their way from the pens to the line
  for (const x of [114, 117, 120]) crateStack(p, x, RAIL_Y, 2)
  return p.build('receiving')
}

export function buildVetBooth(ink: Ink): THREE.Group {
  const p = new Part(ink)
  const { x0, x1, y0, y1 } = VET
  p.box(x0, y0, 0, x1 - x0, y1 - y0, 3.6)
  p.box(x0 - 0.3, y0 - 0.3, 3.6, x1 - x0 + 0.6, y1 - y0 + 0.6, 0.3)
  const F = FRONT(x0, y1, 3.6)
  p.fill2(F, 1, 0.8, 7, 1.3, 'window').rect2(F, 1, 0.8, 7, 1.3, 'line').rect2(F, 11, 1.2, 3, 2.4, 'line')
  p.text(SIDE(x1, y1, 3.6), 'POS VETERINER', (y1 - y0) / 2, 0.9, 0.7, 'ink', 'middle', 0.05)
  p.text(FRONT(x0, y1, 0.9), 'ANTEMORTEM', 1, 0.5, 0.45, 'ink', 'start', 0.05)
  return p.build('vetBooth')
}

// ---- the processing hall ------------------------------------------------------------------------

export function buildHall(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const b = closedBuilding(ink, 'hall', HALL, {
    west: [[RAIL_Y - 3, RAIL_Y + 3, 3]],
    south: [[160, 165, 3.2], [CHUTE_X - 3, CHUTE_X + 3, 3]],
    east: [[40, 46, 3.2]],
    sign: 'KGR · RPA RAWA TERATAI',
    roofPlant: [[214, 26], [226, 26], [250, 60]],
  })
  // the hall's floor: a dirty and a clean zone, split by the evisceration line
  const G = TOP(0, 0, 0)
  b.base.rect2(G, SECTIONS.potong.x0, HALL.y0 + 2, 32, HALL.y1 - HALL.y0 - 4, 'detail', 0.04).text(G, 'AREA KOTOR', SECTIONS.potong.x0 + 1, HALL.y1 - 3, 1.2, 'paint')
  b.base.rect2(G, SECTIONS.potong.x0 + 34, HALL.y0 + 2, HALL.x1 - SECTIONS.potong.x0 - 36, HALL.y1 - HALL.y0 - 4, 'detail', 0.04).text(G, 'AREA BERSIH', SECTIONS.potong.x0 + 35, HALL.y1 - 3, 1.2, 'paint')
  for (const [k, label] of [['potong', 'LINI POTONG'], ['chill', 'CHILLING · SPLIT-OFF'], ['lanjut', 'DISPOSISI · CUT-UP · MDM']] as const) b.base.text(G, label, SECTIONS[k].x0 + 1, HALL.y0 + 4.5, 1.3, 'paint')
  return b.finish()
}

/** each section's equipment as its own group, so each is clickable */
export function buildSection(ink: Ink, id: keyof typeof SECTIONS | 'postmortem'): THREE.Group {
  const p = new Part(ink)
  if (id === 'potong') {
    const s = SECTIONS.potong
    // halal slaughter at the shackles, bleeding over the trough, scalding, plucking, evisceration
    shackleLine(p, HALL.x0 + 0.6, SECTIONS.chill.x0 + 4, RAIL_Y, 3.4, 1.4, HALL.x0 + 2, s.x1 - 2)
    p.box(s.x0 + 4, RAIL_Y + 2.2, 0, 2.4, 1.6, 1.0).text(TOP(s.x0 + 4, RAIL_Y + 2.2, 1.0), 'SEMBELIH', 1.2, 1.1, 0.45, 'paint', 'middle', 0.04)
    tankOpen(p, s.x0 + 8, RAIL_Y - 1.4, 12, 2.8, 0.7, 'BLEEDING', 'deck')
    tankOpen(p, s.x0 + 22, RAIL_Y - 1.6, 8, 3.2, 1.3, 'SCALDER')
    plucker(p, s.x0 + 32, RAIL_Y)
    steelTable(p, s.x0 + 40, RAIL_Y + 2.2, 14, 2.2)
    p.text(TOP(s.x0 + 40, RAIL_Y + 2.2, 0.95), 'EVISCERASI', 7, 1.6, 0.6, 'paint', 'middle', 0.04)
    // the penyelia halal's verification desk at the slaughter point
    p.box(s.x0 + 4, RAIL_Y - 5.6, 0, 3, 1.4, 1.1).box(s.x0 + 4.2, RAIL_Y - 5.5, 1.1, 1.4, 0.3, 0.5, 'g')
    p.text(TOP(0, 0, 0), 'VERIFIKASI KEMATIAN · PENYELIA HALAL', s.x0 + 1, RAIL_Y - 7.6, 0.75, 'paint')
  } else if (id === 'postmortem') {
    // the veterinary officer's post-mortem station on the line, its condemnation bin beside it
    const x = SECTIONS.potong.x1 - 2
    steelTable(p, x - 3, RAIL_Y + 5, 6, 2.4)
    p.text(TOP(x - 3, RAIL_Y + 5, 0.95), 'POST-MORTEM', 3, 1.7, 0.55, 'paint', 'middle', 0.04)
    splitBin(p, x - 2, RAIL_Y + 9, 'WADAH KONDEMNASI', 0.25, 'k', true)
  } else if (id === 'chill') {
    const s = SECTIONS.chill
    chiller(p, s.x0 + 2, RAIL_Y, 18)
    steelTable(p, s.x0 + 22, RAIL_Y - 1.2, 20, 2.4)
    p.text(TOP(s.x0 + 22, RAIL_Y - 1.2, 0.95), 'GRADING · TIMBANG PER KATEGORI', 10, 1.6, 0.5, 'paint', 'middle', 0.04)
    // the split-off: eight labelled bins, Kondemnasi on its own, never merged with Waste
    const bins: [string, number][] = [['DAGING', 0.8], ['CEKER', 0.5], ['HATI & AMPELA', 0.4], ['USUS', 0.4], ['KEPALA', 0.3], ['OUTPUT MDM', 0.35], ['WASTE PROSES', 0.3]]
    bins.forEach(([label, fill], i) => splitBin(p, s.x0 + 2 + (i % 4) * 5.2, i < 4 ? 44 : 50, label, fill))
    splitBin(p, s.x0 + 25, 50, 'KONDEMNASI', 0.15, 'k', true)
  } else {
    const s = SECTIONS.lanjut
    // disposition by the day's orders: whole carcass to FG, carcass to cut-up (WIP), frame to MDM
    p.box(s.x0 + 2, RAIL_Y - 1.4, 0, 6, 2.8, 1.0)
    p.text(TOP(s.x0 + 2, RAIL_Y - 1.4, 1.0), 'DISPOSISI', 3, 1.8, 0.6, 'paint', 'middle', 0.04)
    p.text(TOP(0, 0, 0), '→ KARKAS UTUH (FG)', s.x0 + 10, RAIL_Y - 3, 0.75, 'paint')
    p.text(TOP(0, 0, 0), '→ CUT-UP (WIP)', s.x0 + 10, RAIL_Y + 3.6, 0.75, 'paint')
    for (const y of [44, 50]) steelTable(p, s.x0 + 3, y, 18, 2.4)
    p.text(TOP(0, 0, 0), 'SKU CUT-UP (BELUM DITETAPKAN)', s.x0 + 3, 57.2, 0.8, 'paint')
    mdm(p, s.x0 + 28, 46)
    p.text(TOP(0, 0, 0), '→ KERANGKA KE MDM', s.x0 + 24, 41, 0.75, 'paint')
    // the chute to the Fresh store through the south wall
    p.box(CHUTE_X - 1, 62, 0.9, 2, HALL.y1 - 62, 0.25)
    for (let y = 63; y < HALL.y1 - 1; y += 2.5) crateStack(p, CHUTE_X, y, 1, 'n')
  }
  return p.build(`section-${id}`)
}

// ---- the Fresh store, the cold building, the Kantor ------------------------------------------

export function buildFresh(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const b = closedBuilding(ink, 'fresh', FRESH, {
    north: [[CHUTE_X - 3, CHUTE_X + 3, 3]],
    south: [[DOCK_FRESH - 3, DOCK_FRESH + 3, 4.2]],
    east: [[118, 124, 3.2]],
    sign: 'GUDANG FRESH · ±4 °C',
    roofPlant: [[226, 118], [238, 118]],
  })
  const G = TOP(0, 0, 0)
  b.base.text(G, 'FIFO PER BATCH PRODUKSI', FRESH.x0 + 2, FRESH.y1 - 2.2, 1.0, 'paint')
  return b.finish()
}

export function buildBeku(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const b = closedBuilding(ink, 'beku', BEKU, {
    west: [[118, 124, 3.2]],
    south: [[DOCK_BEKU - 3, DOCK_BEKU + 3, 4.2]],
    sign: 'BLAST FREEZER · COLD STORAGE',
    roofPlant: [[284, 104], [296, 104], [312, 112], [324, 112]],
  })
  // the blast freezer room against the west wall, the rented cold rooms behind their partition
  b.base.box(300, BEKU.y0 + 0.5, 0, 0.4, BEKU.y1 - BEKU.y0 - 1, BEKU.h)
  const G = TOP(0, 0, 0)
  b.base.text(G, 'BLAST FREEZER', 282, BEKU.y1 - 2.4, 1.1, 'paint').text(G, 'COLD STORAGE · SEWA', 302, BEKU.y1 - 2.4, 1.1, 'paint')
  b.base.text(G, 'FIFO PER TANGGAL BEKU', 302, BEKU.y0 + 4, 0.9, 'paint')
  return b.finish()
}

/** the cold rooms' fit-out: crates of fresh product, trolleys in the blast freezer, frozen stock */
export function buildColdStock(ink: Ink): { fresh: THREE.Group; beku: THREE.Group } {
  const f = new Part(ink)
  for (const y of [106, 112, 118, 124, 130, 136]) coldRack(f, FRESH.x0 + 3, y, 26, 3, 0.75)
  for (const [x, y] of [[248, 138], [252, 138], [256, 141]] as const) crateStack(f, x, y, 3, 'n')
  const b = new Part(ink)
  for (const [x, y] of [[284, 108], [290, 108], [284, 116], [290, 116], [296, 112]] as const) coldRack(b, x, y, 3.4, 4, 0.8, 'n')
  for (const y of [108, 116, 124, 132, 140]) coldRack(b, 304, y, 28, 3, 0.6, 'k')
  return { fresh: f.build('freshStock'), beku: b.build('bekuStock') }
}

export function buildKantor(ink: Ink): { group: THREE.Group; peek: PeekDef } {
  const b = closedBuilding(ink, 'kantor', KANTOR, { south: [[96, 101, 3]], sign: 'KANTOR KGR' })
  const G = TOP(0, 0, 0)
  // one division per internal lane, signed with its lane name
  for (const [x, y, w, d, label] of [[KANTOR.x0 + 2, KANTOR.y0 + 2, 24, 15, 'PURCHASING'], [KANTOR.x0 + 28, KANTOR.y0 + 2, 22, 15, 'OPERASIONAL'], [KANTOR.x0 + 2, KANTOR.y0 + 19, 15, 15, 'SALES'], [KANTOR.x0 + 19, KANTOR.y0 + 19, 31, 15, 'ACCOUNTING']] as const)
    b.base.rect2(G, x, y, w, d, 'detail', 0.03).text(G, label, x + 0.8, y + d - 0.8, 1.0, 'paint')
  return b.finish()
}
