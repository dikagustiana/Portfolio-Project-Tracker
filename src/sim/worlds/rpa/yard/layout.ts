// KGR's poultry slaughterhouse (RPA Rawa Teratai) on one plate, in the skill's coordinates (+x
// east, +y south, +z up; the camera looks from the south-east). The same approach as the cassava
// plant (Brief B5 §3–4): Factory Yard's incoming trucks become the live-bird receiving and holding,
// its plant hall becomes the processing line (slaughter → chilling and split-off → disposition,
// cut-up and MDM), and its warehouse becomes the Fresh store, with the blast freezer and the rented
// cold rooms beside it. The suppliers (external) sit behind a fence at the west.
//
// thing                | x          | y          | notes
// plate                | 0–340      | 0–220      | slab z −4–0
// Jl. Raya             | 0–340      | 196–210    | westbound lane y 199.5, eastbound 206.5
// pemasok (eksternal)  | 2–54       | 8–190      | two broiler houses; a finished-goods supplier's store (Trading)
// site fence           | x 58       |            | the KGR site starts east of it
// receiving & holding  | 62–132     | 8–96       | holding pens 66–110 × 14–56; weighbridge x 74, y 66–92; QC table
// pos veteriner        | 114–132    | 62–80      | antemortem booth by the pens; post-mortem station on the line
// processing hall      | 136–288    | 16–84      | slaughter line, chilling and split-off, disposition/cut-up/MDM
// Kantor               | 64–116     | 106–142    | Purchasing, Operasional, Sales, Accounting by lane
// Gudang Fresh         | 216–274    | 100–148    | chilled store, FIFO by production batch
// blast freezer & CS   | 280–336    | 100–150    | blast freezer room; rented cold rooms
// pengiriman           | 210–340    | 150–194    | chilled and frozen trucks at the south docks

import type { PlaceDef, PlaceLabel } from '../../../yard/types.ts'

export const PLATE = { x0: 0, x1: 340, y0: 0, y1: 220 }

export const ROAD = { y0: 196, y1: 210, west: 199.5, east: 206.5 }
export const FENCE_X = 58
export const HALL = { x0: 136, x1: 288, y0: 16, y1: 84, h: 11 }
export const FRESH = { x0: 216, x1: 274, y0: 100, y1: 148, h: 8 }
export const BEKU = { x0: 280, x1: 336, y0: 100, y1: 150, h: 8 }
export const KANTOR = { x0: 64, x1: 116, y0: 106, y1: 142, h: 5 }
export const PENS = { x0: 66, x1: 110, y0: 14, y1: 56 }
export const VET = { x0: 114, x1: 132, y0: 62, y1: 80 }
export const BRIDGE = { x: 76, y0: 66, y1: 92 }
/** where whole carcasses and cut-up leave the hall's south wall for the Fresh store */
export const CHUTE_X = 252
/** the shackle line runs along this y from the hall's west door to the chiller */
export const RAIL_Y = 32

/** The hall's sections, west to east (Brief B5 §4 places 4–6). */
export const SECTIONS = {
  potong: { x0: 138, x1: 194 },
  chill: { x0: 196, x1: 242 },
  lanjut: { x0: 244, x1: 286 },
} as const

/** Dock doors on the south walls of the Fresh store and the cold building: centre x. */
export const DOCK_FRESH = 245
export const DOCK_BEKU = 318

/** Places, keys 1–9 and 0 for the tenth (Kantor). The whole map is the ⌂ button and Home. */
export const PLACES = [
  { key: '1', id: 'pemasok', label: 'Pemasok', box: [0, 58, 4, 196] },
  { key: '2', id: 'terima', label: 'Penerimaan, holding dan timbang', short: 'Terima-holding', box: [60, 136, 4, 98] },
  { key: '3', id: 'vet', label: 'Pos veteriner', short: 'Veteriner', box: [110, 206, 14, 90], open: ['hall'] },
  { key: '4', id: 'potong', label: 'Lini potong', box: [134, 200, 10, 90], open: ['hall'] },
  { key: '5', id: 'chill', label: 'Chilling dan split-off', short: 'Split-off', box: [194, 246, 10, 90], open: ['hall'] },
  { key: '6', id: 'lanjut', label: 'Disposisi, cut-up dan MDM', short: 'Disposisi', box: [240, 292, 10, 96], open: ['hall'] },
  { key: '7', id: 'fresh', label: 'Gudang Fresh', box: [212, 278, 94, 152], open: ['fresh'] },
  { key: '8', id: 'beku', label: 'Blast freezer dan cold storage', short: 'Blast & CS', box: [276, 340, 94, 156], open: ['beku'] },
  { key: '9', id: 'kirim', label: 'Pengiriman', box: [206, 340, 146, 198] },
  { key: '0', id: 'kantor', label: 'Kantor', box: [58, 122, 100, 150], open: ['kantor'] },
] as const satisfies readonly PlaceDef[]
export type PlaceId = (typeof PLACES)[number]['id']

/** The swimlane steps each place shows (Brief B5 §4, places table). Step 13 is decided in the
 *  Kantor (Operasional) and carried out at the disposition, so both list it. */
export const PLACE_STEPS: Record<PlaceId, string[]> = {
  pemasok: ['3', 'T4'],
  terima: ['4', '5', '7', '9', 'T5', 'T6'],
  vet: ['8', '11', 'T7'],
  potong: ['10'],
  chill: ['12'],
  lanjut: ['13', '14', '15'],
  fresh: ['17', '18', '26', '29', 'T10'],
  beku: ['30', '31'],
  kirim: ['27'],
  kantor: ['1', '2', '6', '13', '16', '19', '20', '21', '22', '23', '24', '25', '28', '32', '33', '34', '35', '36', '37', '38', 'T1', 'T2', 'T3', 'T8', 'T9'],
}

/** where each place's name sits on the map, and what drives its cost (named under Lensa biaya) */
export const PLACE_LABELS: PlaceLabel[] = [
  { key: '1', label: 'Pemasok · eksternal', at: [28, 8, 8], driver: 'ekor · kg kiriman' },
  { key: '2', label: 'Terima, holding, timbang', at: [92, 10, 7], driver: 'kg berat hidup masuk lini' },
  { key: '3', label: 'Pos veteriner · eksternal', at: [123, 62, 6], driver: 'ekor layak potong · kg kondemnasi' },
  { key: '4', label: 'Lini potong', at: [166, 16, 14], driver: 'jam kerja langsung per shift' },
  { key: '5', label: 'Chilling dan split-off', at: [219, 16, 14], driver: 'kg aktual per kategori yield' },
  { key: '6', label: 'Disposisi, cut-up, MDM', at: [265, 16, 14], driver: 'kg ke FG · WIP · MDM' },
  { key: '7', label: 'Gudang Fresh', at: [245, 100, 11], driver: 'kg per SKU masuk pool fresh' },
  { key: '8', label: 'Blast freezer · cold storage', at: [308, 100, 11], driver: 'kg dibekukan → Pool B' },
  { key: '9', label: 'Pengiriman', at: [275, 186, 4], driver: 'kg terkirim per stream' },
  { key: '0', label: 'Kantor', at: [90, 106, 7], driver: 'Batch Costing Sheet · invoice' },
]
