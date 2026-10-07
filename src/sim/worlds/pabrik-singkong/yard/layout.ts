// BMG's cassava chip plant on one plate, in the skill's coordinates (+x east, +y south, +z up;
// the camera looks from the south-east). Built from Factory Yard's plant yard (Brief B5 §3): its
// incoming trucks and bins become cassava receiving at the west end, its Plant 01 with the
// sawtooth roof becomes the line hall whose stations are peeling, washing and slicing, frying,
// sorting and packing, its Line A carries packed cartons out of the hall, and its Warehouse 01
// becomes the finished-goods store with the loading docks on its east wall.
//
// thing              | x          | y          | notes
// plate              | 0–310      | 0–200      | slab z −4–0
// Jl. Raya           | 0–310      | 172–186    | westbound lane y 175.5, eastbound 182.5; east to Semarang and Cikokol
// receiving          | 4–58       | 12–170     | canopy 8–54 × 18–64 over five bins; weighbridge at x 31, y 80–104
// line hall          | 64–264     | 16–76      | walls 14, sawtooth roof to 19; stations below, west → east
// Kantor pabrik      | 66–104     | 84–112     | office south of the hall's west end
// CNG skids          | 146–188    | 86–102     | tube skids by the fryers' south wall
// conveyor           | x 250      | 76 → 100   | packed cartons south to the finished-goods store
// gudang barang jadi | 200–270    | 100–150    | gabled, racks along x, docks on the east wall
// loading yard       | 270–310    | 90–172     | trucks back in heading west

import type { PlaceDef, PlaceLabel } from '../../../yard/types.ts'

export const PLATE = { x0: 0, x1: 310, y0: 0, y1: 200 }

export const ROAD = { y0: 172, y1: 186, west: 175.5, east: 182.5 }
export const HALL = { x0: 64, x1: 264, y0: 16, y1: 76, h: 14 }
export const KANTOR = { x0: 66, x1: 104, y0: 84, y1: 112, h: 7 }
export const GUDANG = { x0: 200, x1: 270, y0: 100, y1: 150, h: 10 }
export const CANOPY = { x0: 8, x1: 54, y0: 18, y1: 64 }
export const BRIDGE = { x: 31, y0: 80, y1: 104 }
export const SKIDS = { x0: 146, x1: 188, y0: 86, y1: 102 }
/** where the conveyor leaves the hall's south wall and enters the store's north wall */
export const CONVEYOR_X = 250

/** The line's stations inside the hall, west to east (Brief B5 §3 places 2–6). */
export const STATIONS = {
  kupas: { x0: 66, x1: 102 },
  cuci: { x0: 104, x1: 140 },
  goreng: { x0: 142, x1: 190 },
  sortir: { x0: 192, x1: 226 },
  kemas: { x0: 228, x1: 262 },
} as const

/** Five bins under the receiving canopy (cassava in its skin; the last for bought-peeled). */
export const BINS = [12, 20.5, 29, 37.5, 46].map((x, i) => ({ i, x, y: 30 }))
/** Loading docks on the store's east wall: door centre y; trucks back in heading west. */
export const DOCKS = [112, 126, 140].map((y, i) => ({ id: i + 1, y }))

/** Views the place buttons and number keys frame: [x0, x1, y0, y1]. Places inside a building open it. */
export const PLACES = [
  { key: '1', id: 'penerimaan', label: 'Penerimaan', box: [0, 62, 8, 172] },
  { key: '2', id: 'kupas', label: 'Pengupasan', box: [60, 108, 12, 80], open: ['hall'] },
  { key: '3', id: 'cuci', label: 'Cuci dan potong', short: 'Cuci-potong', box: [100, 146, 12, 80], open: ['hall'] },
  { key: '4', id: 'goreng', label: 'Penggorengan', box: [138, 194, 12, 106], open: ['hall'] },
  { key: '5', id: 'sortir', label: 'Sortir dan QC', short: 'Sortir-QC', box: [188, 230, 12, 80], open: ['hall'] },
  { key: '6', id: 'kemas', label: 'Pengemasan', box: [224, 268, 12, 80], open: ['hall'] },
  { key: '7', id: 'gudang', label: 'Gudang barang jadi dan muat', short: 'Gudang & muat', box: [194, 310, 82, 172], open: ['gudang'] },
  { key: '8', id: 'kantor', label: 'Kantor pabrik', box: [58, 112, 80, 124], open: ['kantor'] },
] as const satisfies readonly PlaceDef[]
export type PlaceId = (typeof PLACES)[number]['id']

/** where each place's name sits on the map, and what drives its cost (named under Lensa biaya) */
export const PLACE_LABELS: PlaceLabel[] = [
  { key: '1', label: 'Penerimaan', at: [31, 18, 9], driver: 'kg singkong per kg produksi' },
  { key: '2', label: 'Pengupasan', at: [84, 16, 21], driver: 'kg kupas · upah borongan' },
  { key: '3', label: 'Cuci dan potong', at: [122, 16, 21], driver: 'kg amonium bikarbonat' },
  { key: '4', label: 'Penggorengan', at: [166, 16, 21], driver: 'kg minyak · MMBTU CNG' },
  { key: '5', label: 'Sortir dan QC', at: [209, 16, 21], driver: 'komposisi grade' },
  { key: '6', label: 'Pengemasan', at: [245, 16, 21], driver: 'kg kantong · karton' },
  { key: '7', label: 'Gudang barang jadi', at: [235, 100, 15], driver: 'trip · kg terkirim' },
  { key: '8', label: 'Kantor pabrik', at: [85, 84, 9], driver: 'kartu biaya harian' },
]
