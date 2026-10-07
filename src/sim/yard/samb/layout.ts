// SAMB's distribution network on one plate, in the skill's coordinates (+x east, +y south, +z up;
// the camera looks from the south-east, so +x runs down-right on screen and +y down-left).
// Read on screen: the Kantor at the top, the principals on the left, the gudang in the middle,
// the truck pool and the stores to the right, the housing (konsumen) at the bottom.
//
// thing            | x          | y          | notes
// plate            | 0–440      | 0–280      | slab z −4–0
// Jl. Raya (R1)    | 0–440      | 104–118    | eastbound lane y 107.5, westbound 114.5 (traffic keeps left)
// Jl. Perumahan R2 | 118–440    | 222–236    | eastbound y 225.5, westbound 232.5
// Jl. Prinsipal A1 | 118–132    | 0–280      | southbound x 128.5, northbound 121.5
// Jl. Niaga A2     | 300–314    | 0–280      | southbound x 310.5, northbound 303.5
// Kantor           | 0–118      | 0–104      | office 24–84 × 26–64, one open floor
// Prinsipal        | 0–118      | 118–280    | six plants A–F on a paved estate
// Pool truk        | 132–300    | 0–104      | nine bays, workshop
// Gudang           | 132–300    | 118–222    | building 140–258 × 126–192; B2B docks on the east wall, receiving on the south wall
// Bay kurir        | 210–258    | 194–220    | canopy south of the gudang, courier slots
// Toko             | 314–440    | 0–104      | ten modern-trade stores (zona 1), service lane y 46–54
// Konsumen         | 132–440    | 118–280    | housing east of Jl. Niaga and south of Jl. Perumahan

import type { P2 } from '../kernel.ts'

export const PLATE = { x0: 0, x1: 440, y0: 0, y1: 280 }

export const R1 = { y0: 104, y1: 118, east: 107.5, west: 114.5 }
export const R2 = { x0: 118, y0: 222, y1: 236, east: 225.5, west: 232.5 }
export const A1 = { x0: 118, x1: 132, south: 128.5, north: 121.5 }
export const A2 = { x0: 300, x1: 314, south: 310.5, north: 303.5 }

export const KANTOR = { x0: 24, x1: 84, y0: 26, y1: 64, h: 6 }
export const GUDANG = { x0: 140, x1: 258, y0: 126, y1: 192, h: 10 }
export const BAY = { x0: 210, x1: 258, y0: 195, y1: 219 }

/** B2B loading docks on the gudang's east wall: door centre y; trucks back in heading west. */
export const LOAD_DOCKS = [136, 152, 168, 184].map((y, i) => ({ id: i + 1, y }))
/** Receiving docks on the south wall: door centre x; inbound trucks back in heading north. */
export const RECV_DOCKS = [152, 172, 192].map((x, i) => ({ id: i + 1, x }))
/** Courier slots under the bay canopy: van/motorbike stands, noses south. */
export const COURIER_SLOTS = [218, 230, 242, 252].map((x, i) => ({ id: i + 1, x }))

/** Racks inside the gudang: rows along x, two levels; bay pitch 6. */
export const RACK_ROWS = [138, 150, 162, 174]
export const RACK_X0 = 160
export const RACK_BAYS = 12
export const RACK_PITCH = 6

/** Six principal plants, two columns by three rows, each with a dispatch bay on its east side. */
export const PLANTS = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((id, i) => {
  const col = i % 2
  const row = Math.floor(i / 2)
  const x0 = col ? 62 : 10
  const y0 = 128 + row * 50
  return { id, x0, y0, x1: x0 + 34, y1: y0 + 24, bay: [x0 + 44, y0 + 30] as P2 }
})

/** Ten stores (zona 1) in two rows, fronts to the south; each row has a service lane in front,
 *  where the truck stops at `stop`. */
export const STORES = Array.from({ length: 10 }, (_, i) => {
  const row = i < 5 ? 0 : 1
  const k = i % 5
  const x0 = 318 + k * 23
  const y0 = row ? 58 : 14
  return { idx: i, code: `Toko ${String(i + 1).padStart(2, '0')}`, x0, y0, x1: x0 + 18, y1: y0 + 20, stop: [x0 + 9, row ? 88.5 : 43.5] as P2, row }
})
export const STORE_LANES = [{ y0: 37, y1: 50, lane: 43.5 }, { y0: 81, y1: 96, lane: 88.5 }]
/** the short service road at the east end that joins the two store lanes */
export const STORE_LINK = { x0: 431, x1: 439, lane: 435 }

/** Truck pool: nine bays in a row, trucks parked nose south (toward Jl. Raya) with the front at y 70. */
export const POOL_BAYS = Array.from({ length: 9 }, (_, i) => ({ i, x: 146 + i * 17, y: 70 }))

/** Vehicles, people and documents are drawn larger than life so they read at the network view,
 *  as Factory Yard does with its pallets and trucks. */
export const SCALE = { vehicle: 1.35, person: 1.5, desk: 1.6, doc: 3 }

/** Housing: rows of houses, fronts to the south onto a lane or Jl. Perumahan; `door` is where a
 *  courier stops. */
export const HOUSE_LANES = [{ x0: 314, x1: 440, y0: 150, y1: 158, lane: 154 }, { x0: 132, x1: 440, y0: 262, y1: 272, lane: 267 }]
export const HOUSES = [
  ...[318, 342, 366, 390, 414].map((x) => ({ x, y: 128, w: 16, d: 12, door: [x + 8, 154] as P2 })),
  ...[318, 342, 366, 390, 414].map((x) => ({ x, y: 174, w: 16, d: 12, door: [x + 8, R2.east] as P2 })),
  ...[140, 164, 188, 212, 236, 260, 284, 318, 342, 366, 390, 414].map((x) => ({ x, y: 242, w: 16, d: 11, door: [x + 8, 267] as P2 })),
]

/** Views the place buttons and number keys frame: [x0, x1, y0, y1]. */
export const PLACES = [
  { key: '1', id: 'kantor', label: 'Kantor', box: [0, 118, 0, 104] },
  { key: '2', id: 'prinsipal', label: 'Prinsipal', box: [0, 118, 118, 280] },
  { key: '3', id: 'gudang', label: 'Gudang', box: [132, 300, 118, 222] },
  { key: '4', id: 'bay', label: 'Bay kurir', box: [196, 300, 186, 250] },
  { key: '5', id: 'toko', label: 'Toko', box: [306, 440, 0, 104] },
  { key: '6', id: 'konsumen', label: 'Konsumen', box: [306, 440, 118, 280] },
] as const
export type PlaceId = (typeof PLACES)[number]['id']

/** where each place's name sits on the map, and the cost driver it names under Lensa biaya
 *  (brief §5's driver column) */
export const PLACE_LABELS: { key: string; label: string; at: [number, number, number]; driver: string }[] = [
  { key: '1', label: 'Kantor', at: [54, 26, 12], driver: 'PO · invoice dibuat · invoice dikirim' },
  { key: '2', label: 'Prinsipal', at: [6, 222, 12], driver: 'jumlah PO' },
  { key: '3', label: 'Gudang', at: [199, 126, 15], driver: 'palet masuk · palet-hari · palet keluar' },
  { key: '4', label: 'Bay kurir', at: [234, 219, 7], driver: 'menit dispatch per paket' },
  { key: '5', label: 'Toko · zona 1', at: [372, 14, 8], driver: 'trip → DO → SKU menurut m³' },
  { key: '6', label: 'Konsumen', at: [376, 128, 8], driver: 'hari dana tertahan (settlement)' },
  { key: '', label: 'Pool truk', at: [214, 48, 6], driver: 'hari-aset · km · per trip' },
]

// ---- roads as paths (lanes keep left) --------------------------------------------------------

/** The off-plate exit east toward zona 2 and 3. */
export const EXIT_EAST: P2 = [452, R1.east]
