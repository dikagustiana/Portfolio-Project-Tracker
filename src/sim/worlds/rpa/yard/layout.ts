// KGR's poultry slaughterhouse (RPA Rawa Teratai) on one plate, in the skill's coordinates (+x
// east, +y south, +z up; the camera looks from the south-east). The same approach as the cassava
// plant (Brief B5 §3–4): Factory Yard's incoming trucks become the live-bird receiving and holding,
// its plant hall becomes the processing line (slaughter → chilling and split-off → disposition,
// cut-up and MDM), and its warehouse becomes the Fresh store, with the blast freezer and the rented
// cold rooms beside it. Supplier farms (external) sit off the road at the west, customers off
// the plate at the east.
//
// thing               | x          | y          | notes
// plate               | 0–420      | 0–170      | slab z −4–0
// Jl. Raya            | 0–420      | 140–154    | eastbound lane y 150.5, westbound 143.5
// pemasok (eksternal) | 4–58       | 8–132      | broiler houses, a finished-goods supplier's store (Trading)
// receiving & holding | 66–132     | 8–88       | weighbridge, holding pens, line scale at the hall's west door
// pos veteriner       | 116–132    | 64–80      | antemortem booth by the pens; post-mortem station on the line
// processing hall     | 136–288    | 16–84      | slaughter line, chilling and split-off, disposition/cut-up/MDM
// Kantor              | 66–134     | 96–134     | Purchasing, Operasional, Sales, Accounting by lane
// Gudang Fresh        | 296–348    | 12–58      | chilled store, FIFO by production batch
// blast freezer & CS  | 296–360    | 64–106     | blast freezer room; rented cold rooms
// pengiriman          | 356–420    | 10–138     | chilled and frozen trucks at the dock apron

import type { PlaceDef, PlaceLabel } from '../../../yard/types.ts'

export const PLATE = { x0: 0, x1: 420, y0: 0, y1: 170 }

export const ROAD = { y0: 140, y1: 154, east: 150.5, west: 143.5 }
export const HALL = { x0: 136, x1: 288, y0: 16, y1: 84, h: 12 }
export const FRESH = { x0: 296, x1: 348, y0: 12, y1: 58, h: 9 }
export const FREEZE = { x0: 296, x1: 360, y0: 64, y1: 106, h: 8 }
export const KANTOR = { x0: 66, x1: 134, y0: 96, y1: 134, h: 6 }
export const PENS = { x0: 70, x1: 112, y0: 14, y1: 58 }
export const VET = { x0: 116, x1: 132, y0: 64, y1: 80 }

/** The hall's sections, west to east (Brief B5 §4 places 4–6). */
export const SECTIONS = {
  potong: { x0: 138, x1: 196 },
  chill: { x0: 198, x1: 242 },
  lanjut: { x0: 244, x1: 286 },
} as const

/** Places, keys 1–9 and 0 for the tenth (Kantor). The whole map is the ⌂ button and Home. */
export const PLACES = [
  { key: '1', id: 'pemasok', label: 'Pemasok', box: [0, 64, 0, 140] },
  { key: '2', id: 'terima', label: 'Penerimaan, holding dan timbang', box: [62, 140, 4, 92] },
  { key: '3', id: 'vet', label: 'Pos veteriner', box: [108, 206, 14, 88], open: ['hall'] },
  { key: '4', id: 'potong', label: 'Lini potong', box: [134, 200, 10, 90], open: ['hall'] },
  { key: '5', id: 'chill', label: 'Chilling dan split-off', box: [196, 246, 10, 90], open: ['hall'] },
  { key: '6', id: 'lanjut', label: 'Disposisi, cut-up dan MDM', box: [240, 292, 10, 90], open: ['hall'] },
  { key: '7', id: 'fresh', label: 'Gudang Fresh', box: [290, 352, 4, 62], open: ['fresh'] },
  { key: '8', id: 'beku', label: 'Blast freezer dan cold storage', box: [290, 364, 58, 112], open: ['beku'] },
  { key: '9', id: 'kirim', label: 'Pengiriman', box: [350, 420, 4, 140] },
  { key: '0', id: 'kantor', label: 'Kantor', box: [60, 140, 90, 140], open: ['kantor'] },
] as const satisfies readonly PlaceDef[]
export type PlaceId = (typeof PLACES)[number]['id']

/** where each place's name sits on the map, and what drives its cost (named under Lensa biaya) */
export const PLACE_LABELS: PlaceLabel[] = [
  { key: '1', label: 'Pemasok · eksternal', at: [31, 8, 9], driver: 'ekor · kg kiriman' },
  { key: '2', label: 'Terima, holding, timbang', at: [91, 8, 8], driver: 'kg berat hidup masuk lini' },
  { key: '3', label: 'Pos veteriner · eksternal', at: [124, 64, 7], driver: 'ekor layak potong · kg kondemnasi' },
  { key: '4', label: 'Lini potong', at: [167, 16, 18], driver: 'jam kerja langsung per shift' },
  { key: '5', label: 'Chilling dan split-off', at: [220, 16, 18], driver: 'kg aktual per kategori yield' },
  { key: '6', label: 'Disposisi, cut-up, MDM', at: [265, 16, 18], driver: 'kg ke FG · WIP · MDM' },
  { key: '7', label: 'Gudang Fresh', at: [322, 12, 13], driver: 'kg per SKU masuk pool fresh' },
  { key: '8', label: 'Blast freezer · cold storage', at: [328, 64, 12], driver: 'kg dibekukan → Pool B' },
  { key: '9', label: 'Pengiriman', at: [388, 10, 6], driver: 'kg terkirim per stream' },
  { key: '0', label: 'Kantor', at: [100, 96, 10], driver: 'Batch Costing Sheet · invoice' },
]
