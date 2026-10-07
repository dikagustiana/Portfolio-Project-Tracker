// World 2 "Gudang B2B + B2C" configuration — every parameter DUMMY (brief 2 §5, §10).
// One warehouse, one shared stock pool, two exits: B2B (cartons/pallets by truck) and
// B2C (pieces to marketplace/website consumers by courier). Generic labels only: MP-A…E,
// Website, Kurir 1–3, OMS/WMS/Agregator.

/** DUMMY — world 2 seed. */
export const SEED = 20261107
export const DAYS = 30

// --- B2B exit: world 1 generator at a smaller scale (brief 2 §5) ----------------------------

/** DUMMY — the B2B exit reuses the Brief 1 generator with its demand scaled down. */
export const B2B = {
  demandScale: 0.4,
  seed: 20261108,
}

// --- Platforms (§3.3 C1, §5) ----------------------------------------------------------------

export type PlatformId = 'MP-A' | 'MP-B' | 'MP-C' | 'MP-D' | 'MP-E' | 'WEB'

export interface Platform {
  id: PlatformId
  /** DUMMY — commission on GMV. No fixed fee per order (assumption 2). */
  feePct: number
  /** DUMMY — days from order complete to funds released (assumption 5). */
  settlementDays: number
  /** Share of the B2C order volume. */
  orderShare: number
  /** P1 same-day cut-off hour; later orders become P2 (§3.3). */
  cutoffHour: number
  label: string
}

export const PLATFORMS: Platform[] = [
  { id: 'MP-A', label: 'MP-A', feePct: 0.065, settlementDays: 7, orderShare: 0.24, cutoffHour: 12 },
  { id: 'MP-B', label: 'MP-B', feePct: 0.07, settlementDays: 9, orderShare: 0.2, cutoffHour: 16 },
  { id: 'MP-C', label: 'MP-C', feePct: 0.055, settlementDays: 5, orderShare: 0.18, cutoffHour: 16 },
  { id: 'MP-D', label: 'MP-D', feePct: 0.08, settlementDays: 12, orderShare: 0.12, cutoffHour: 16 },
  { id: 'MP-E', label: 'MP-E', feePct: 0.06, settlementDays: 8, orderShare: 0.14, cutoffHour: 16 },
  { id: 'WEB', label: 'Website', feePct: 0.025, settlementDays: 3, orderShare: 0.12, cutoffHour: 16 },
]

/** DUMMY — B2C order volume per day before platform shares. */
export const ORDERS_PER_DAY = 260

/** Priority mix: P0 instant, P1 same day (before cut-off), P2 next day (§3.3). */
export const PRIORITY = {
  p0Share: 0.06,
  p1Share: 0.26,
  /** Hours 06–21, busy around lunch and evening (weights per hour). */
  hourWeights: [2, 3, 4, 5, 6, 7, 8, 9, 9, 8, 7, 6, 6, 7, 8, 9],
}

// --- Principal B2C profiles (§5 table) ------------------------------------------------------

/** DUMMY — share of B2C order value per principal; D is B2B only. */
export const B2C_VALUE_SHARE: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = { A: 0.1, B: 0.1, C: 0.45, D: 0, E: 0.2, F: 0.15 }

/** DUMMY — seller-funded voucher as a share of GMV (F leaks revenue on one platform). */
export const VOUCHER_SHARE: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = { A: 0.01, B: 0.005, C: 0.02, D: 0, E: 0.01, F: 0.06 }

/** DUMMY — returned delivered orders (E runs high; §5). */
export const RETURN_RATE: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = { A: 0.03, B: 0.02, C: 0.02, D: 0, E: 0.12, F: 0.03 }

/** DUMMY — share of returned units restocked (the rest is quarantined, assumption 4). */
export const RESTOCK_SHARE = 0.6

// --- Boxes and couriers (§5) ----------------------------------------------------------------

export interface BoxType {
  id: 'polymailer' | 'S' | 'M' | 'L'
  label: string
  wCm: number
  hCm: number
  dCm: number
  cost: number
  /** Chosen when the order's item volume fits under this many cm³ (§5: by volume). */
  maxVolumeCm3: number
}

export const BOXES: BoxType[] = [
  { id: 'polymailer', label: 'Polymailer', wCm: 35, hCm: 3, dCm: 25, cost: 1_200, maxVolumeCm3: 3_600 },
  { id: 'S', label: 'Kotak S', wCm: 20, hCm: 20, dCm: 15, cost: 1_800, maxVolumeCm3: 6_000 },
  { id: 'M', label: 'Kotak M', wCm: 30, hCm: 20, dCm: 25, cost: 2_800, maxVolumeCm3: 15_000 },
  { id: 'L', label: 'Kotak L', wCm: 40, hCm: 25, dCm: 35, cost: 4_500, maxVolumeCm3: 60_000 },
]

export interface Courier {
  id: 'K1' | 'K2' | 'K3'
  label: string
  basePerPackage: number
  perKg: number
  pickupsPerDay: 1 | 2
  share: number
}

export const COURIERS: Courier[] = [
  { id: 'K1', label: 'Kurir 1', basePerPackage: 6_000, perKg: 3_200, pickupsPerDay: 2, share: 0.4 },
  { id: 'K2', label: 'Kurir 2', basePerPackage: 5_500, perKg: 2_900, pickupsPerDay: 1, share: 0.35 },
  { id: 'K3', label: 'Kurir 3', basePerPackage: 6_500, perKg: 3_500, pickupsPerDay: 2, share: 0.25 },
]

/** DUMMY — chargeable weight rule (§4.3): max(actual kg, cm³ / 6.000). */
export const CHARGEABLE_VOLUME_DIVISOR_CM3_PER_KG = 6_000

// --- Teams (§4.1, §4.2) ----------------------------------------------------------------------

export type PoolId2 =
  | 'asnAdmin'
  | 'inbound'
  | 'putaway'
  | 'storage'
  | 'stockMgmt'
  | 'pickers'
  | 'packers'
  | 'dispatchers'
  | 'isd'
  | 'replenishment'
  | 'cs'
  | 'shopMgmt'
  | 'returnsDesk'

export interface PoolDef2 {
  id: PoolId2
  team: string
  headcount: number
  costPerPerson: number
  /** Which allocation stage: shared S1–S5 → principal → channel; outbound by minutes;
   *  ISD to P0/P1; the rest by their named driver. */
  stage: 'shared' | 'outbound' | 'isd' | 'replenishment' | 'cs' | 'shop' | 'returns'
  driver: string
}

export const POOLS: PoolDef2[] = [
  { id: 'asnAdmin', team: 'Admin ASN', headcount: 2, costPerPerson: 9_000_000, stage: 'shared', driver: 'jumlah ASN' },
  { id: 'inbound', team: 'Inbound dan terima barang', headcount: 6, costPerPerson: 10_000_000, stage: 'shared', driver: 'karton diterima' },
  { id: 'putaway', team: 'Putaway dan WMS', headcount: 4, costPerPerson: 9_500_000, stage: 'shared', driver: 'palet dipindahkan' },
  { id: 'storage', team: 'Simpan (bulk + pick face)', headcount: 10, costPerPerson: 9_000_000, stage: 'shared', driver: 'palet-hari + lokasi-hari' },
  { id: 'stockMgmt', team: 'Kelola stok', headcount: 3, costPerPerson: 8_000_000, stage: 'shared', driver: 'lokasi dihitung + unit karantina' },
  { id: 'pickers', team: 'Picker reguler', headcount: 6, costPerPerson: 9_000_000, stage: 'outbound', driver: 'menit standar picking' },
  { id: 'packers', team: 'Packer reguler', headcount: 5, costPerPerson: 9_000_000, stage: 'outbound', driver: 'menit standar packing' },
  { id: 'dispatchers', team: 'Dispatch dan manifest', headcount: 3, costPerPerson: 8_500_000, stage: 'outbound', driver: 'menit standar dispatch' },
  { id: 'isd', team: 'Tim ISD (instan & same day)', headcount: 4, costPerPerson: 10_000_000, stage: 'isd', driver: 'order P0 + P1' },
  { id: 'replenishment', team: 'Replenishment', headcount: 3, costPerPerson: 8_500_000, stage: 'replenishment', driver: 'unit picked dari pick face' },
  { id: 'cs', team: 'Customer service', headcount: 2, costPerPerson: 8_000_000, stage: 'cs', driver: 'tiket' },
  { id: 'shopMgmt', team: 'Shop management', headcount: 2, costPerPerson: 9_000_000, stage: 'shop', driver: 'order per platform' },
  { id: 'returnsDesk', team: 'Meja retur', headcount: 2, costPerPerson: 8_000_000, stage: 'returns', driver: 'retur diterima' },
]

/** DUMMY — standard minutes per pick line (assumption 1). B2B picks whole cartons,
 *  B2C picks single scanned pieces. */
export const STANDARD_MINUTES = {
  b2bLine: 1.2,
  b2cLine: 2.5,
  /** Dispatch minutes per package/manifest handled. */
  b2cPackage: 1.8,
  b2bCarton: 0.4,
}

/** DUMMY — running separate channel teams costs more than one shared team (peak sizing). */
export const SEPARATE_TEAM_OVERHEAD = 0.15

/** DUMMY — CS tickets per order plus one ticket per return handled. */
export const TICKETS_PER_ORDER = 0.08

// --- Toggles (§4.1, §4.2, §4.3) --------------------------------------------------------------

export interface Toggles2 {
  /** Biaya gudang bersama ke channel. */
  sharedSplit: 'volume' | 'none'
  /** Tim outbound dipakai bersama. */
  sharedTeams: boolean
  /** Ongkir ditanggung. */
  shippingBearer: 'konsumen' | 'platform' | 'penjual'
  /** Shared with world 1 (§4.4). */
  stockCapital: boolean
  costOfCapital: number
}

export const DEFAULT_TOGGLES: Toggles2 = {
  sharedSplit: 'volume',
  sharedTeams: true,
  shippingBearer: 'konsumen',
  stockCapital: false,
  costOfCapital: 0.12,
}

export interface ToggleSection2 {
  label: string
  options: { value: string; label: string; note: string }[]
  key: keyof Omit<Toggles2, 'costOfCapital'>
}

export const TOGGLE_DEFS: ToggleSection2[] = [
  {
    key: 'sharedSplit', label: 'Biaya gudang bersama ke channel',
    options: [
      { value: 'volume', label: 'Porsi volume keluar', note: 'Bagian prinsipal dibagi ke B2B/B2C sebanding m³ yang keluar.' },
      { value: 'none', label: 'Tidak dibagi', note: 'Tampil sebagai baris "Biaya gudang bersama", tidak dibebankan ke channel.' },
    ],
  },
  {
    key: 'sharedTeams', label: 'Tim outbound dipakai bersama',
    options: [
      { value: 'on', label: 'Bersama', note: 'Picker/packer/dispatcher reguler melayani dua channel; biaya dibagi per menit standar.' },
      { value: 'off', label: 'Terpisah', note: 'Tiap channel punya tim sendiri; total naik karena tiap tim diukur untuk puncaknya.' },
    ],
  },
  {
    key: 'shippingBearer', label: 'Ongkir ditanggung',
    options: [
      { value: 'konsumen', label: 'Konsumen', note: 'Tarif kurir dibayar pembeli; bukan biaya penjual.' },
      { value: 'platform', label: 'Subsidi platform', note: 'Platform menanggung ongkir; bukan biaya penjual.' },
      { value: 'penjual', label: 'Penjual', note: 'Tarif kurir masuk biaya order penjual.' },
    ],
  },
]
