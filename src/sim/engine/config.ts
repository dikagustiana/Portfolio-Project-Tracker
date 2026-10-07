// Every parameter of the dummy world, tagged DUMMY (brief §1.5, §4.2). Round, plausible
// numbers chosen for the illustration — never real SAMB data. The seed lives here too,
// so one config reproduces one world (control 1).

/** DUMMY — master seed. Same seed, same dataset hash. */
export const SEED = 20261007

export const DAYS = 30

// --- Trucks (§4.2) -------------------------------------------------------------------------

export type TruckClassId = 'L' | 'M' | 'H'

export interface TruckClass {
  id: TruckClassId
  /** Truck codes shown in the world, e.g. Truk L-01. */
  fleet: number
  capacityM3: number
  payloadKg: number
  bookValue: number
  wheels: number
  tyrePrice: number
  tyreLifeKm: number
  maintenancePerMonth: number
  kmPerMonth: number
  operatingDays: number
  utilisation: number
  driverWagePerDay: number
  litresPerKmLoaded: number
  litresPerKmEmpty: number
}

/** DUMMY — three classes; one truck makes one trip per day (locked convention). */
export const TRUCKS: Record<TruckClassId, TruckClass> = {
  L: {
    id: 'L', fleet: 3, capacityM3: 12, payloadKg: 2500, bookValue: 420_000_000, wheels: 6,
    tyrePrice: 4_500_000, tyreLifeKm: 60_000, maintenancePerMonth: 3_000_000, kmPerMonth: 6_000,
    operatingDays: 24, utilisation: 0.85, driverWagePerDay: 250_000, litresPerKmLoaded: 0.22, litresPerKmEmpty: 0.16,
  },
  M: {
    id: 'M', fleet: 3, capacityM3: 24, payloadKg: 6000, bookValue: 780_000_000, wheels: 10,
    tyrePrice: 5_500_000, tyreLifeKm: 70_000, maintenancePerMonth: 5_000_000, kmPerMonth: 8_000,
    operatingDays: 24, utilisation: 0.85, driverWagePerDay: 285_000, litresPerKmLoaded: 0.3, litresPerKmEmpty: 0.22,
  },
  H: {
    id: 'H', fleet: 3, capacityM3: 42, payloadKg: 14_000, bookValue: 1_350_000_000, wheels: 14,
    tyrePrice: 6_000_000, tyreLifeKm: 80_000, maintenancePerMonth: 7_500_000, kmPerMonth: 9_000,
    operatingDays: 24, utilisation: 0.85, driverWagePerDay: 320_000, litresPerKmLoaded: 0.38, litresPerKmEmpty: 0.28,
  },
}

/** DUMMY — cost-of-ownership parameters shared by all classes. */
export const TRUCK_COMMON = {
  usefulLifeYears: 8,
  insuranceRatePerYear: 0.015,
  vehicleTaxRatePerYear: 0.0125,
  /** Average net book value as a share of purchase value. */
  nbvFactor: 0.65,
  dieselPricePerLitre: 15_000,
  managementOverheadPerTrip: 75_000,
  unloadingPerTrip: 50_000,
}

export interface Zone {
  id: 1 | 2 | 3
  oneWayKm: number
  /** Asset-days charged per trip (the one-trip-per-day convention keeps this at 1). */
  assetDaysPerTrip: number
  tollPerTrip: number
  storeCount: number
  /** Demand level of the zone's stores, shaping which truck class serves it. */
  demandFactor: number
}

/** DUMMY — zones 1–3; the trip runs loaded out and empty back. Zona 1 is the close city
 *  circuit the Light truck serves; Zona 3 fills a Heavy. */
export const ZONES: Zone[] = [
  { id: 1, oneWayKm: 25, assetDaysPerTrip: 1, tollPerTrip: 0, storeCount: 10, demandFactor: 0.28 },
  { id: 2, oneWayKm: 80, assetDaysPerTrip: 1, tollPerTrip: 60_000, storeCount: 8, demandFactor: 0.75 },
  { id: 3, oneWayKm: 180, assetDaysPerTrip: 1, tollPerTrip: 150_000, storeCount: 6, demandFactor: 1.35 },
]

// --- Team pools (§4.1) ---------------------------------------------------------------------

export interface PoolDef {
  id: 'komersial' | 'salesAdminShared' | 'salesAdminDedicated' | 'inbound' | 'wms' | 'gudang' | 'packing' | 'arFinance' | 'tax'
  team: string
  headcount: number
  costPerPerson: number
  driver: string | null
  /** Driver unit shown in panels; null for pools without a driver (their cost stays unallocated). */
  unit: string | null
}

/** DUMMY — monthly pools, headcount × cost per person. */
export const POOLS: PoolDef[] = [
  { id: 'komersial', team: 'Komersial', headcount: 3, costPerPerson: 18_000_000, driver: null, unit: null },
  { id: 'salesAdminShared', team: 'Sales admin (bersama)', headcount: 3, costPerPerson: 12_000_000, driver: 'jumlah PO', unit: 'PO' },
  { id: 'salesAdminDedicated', team: 'Sales admin (khusus Prinsipal D)', headcount: 1, costPerPerson: 12_000_000, driver: null, unit: null },
  { id: 'inbound', team: 'Tim inbound', headcount: 6, costPerPerson: 11_000_000, driver: 'palet masuk', unit: 'palet' },
  { id: 'wms', team: 'Admin WMS', headcount: 2, costPerPerson: 10_000_000, driver: 'PO diterima', unit: 'PO' },
  { id: 'gudang', team: 'Gudang', headcount: 8, costPerPerson: 9_500_000, driver: 'palet-hari', unit: 'palet-hari' },
  { id: 'packing', team: 'Tim packing dan outbound', headcount: 10, costPerPerson: 9_000_000, driver: 'palet keluar', unit: 'palet' },
  { id: 'arFinance', team: 'Finance AR', headcount: 3, costPerPerson: 13_000_000, driver: 'invoice dibuat', unit: 'invoice' },
  { id: 'tax', team: 'Pajak dan pengiriman invoice', headcount: 2, costPerPerson: 14_000_000, driver: 'invoice dikirim', unit: 'invoice' },
]

// --- Commercial terms (§3 steps 10–11) ------------------------------------------------------

/** DUMMY — cash-clock terms per store group. */
export const CASH_TERMS = {
  regular: { tukarFakturDelayDays: 2, topDays: 14, name: 'Toko reguler' },
  mtBesar: { tukarFakturDelayDays: 14, topDays: 30, name: 'MT besar' },
  invoiceLagDays: [0, 1] as const,
  paymentSlipDays: [0, 3] as const,
  /** Consolidation weeks: DOs of a week are invoiced together at its end. */
  weekEnds: [7, 14, 21, 28, 30] as number[],
}

// --- Principals and SKUs (§5) ---------------------------------------------------------------

export type PrincipalId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface SkuTemplate {
  count: number
  /** Carton dimensions in cm and weight per carton, rolled per SKU within these ranges. */
  w: [number, number]
  h: [number, number]
  d: [number, number]
  kg: [number, number]
  stackFactor: [number, number]
  pricePerCarton: number
  margin: number
  /** Cartons per SKU per store per day, before the zone factor. */
  demandPerStoreDay: [number, number]
  /** Chance a store orders this SKU on a given day. */
  demandPresence: number
  /** Share of demand that lands in the "MT besar" stores (Prinsipal E). */
  mtBias: number
}

export interface PrincipalTemplate {
  id: PrincipalId
  profile: string
  notice: string
  minInventoryDays: number
  leadTimeDays: number
  color: string
  colorSoft: string
  skus: SkuTemplate
}

/** DUMMY — six principals with deliberately different profiles (§5 table). */
export const PRINCIPALS: PrincipalTemplate[] = [
  {
    id: 'A', profile: 'Ringan tapi besar, nilai rendah', notice: 'Memakan palet-hari dan m³ truk',
    minInventoryDays: 7, leadTimeDays: 7, color: '#3e7bd6', colorSoft: '#dbe7fa',
    skus: { count: 5, w: [55, 60], h: [38, 42], d: [38, 42], kg: [7, 9], stackFactor: [2, 3], pricePerCarton: 760_000, margin: 0.08, demandPerStoreDay: [3, 5], demandPresence: 0.95, mtBias: 0 },
  },
  {
    id: 'B', profile: 'Padat dan bernilai tinggi', notice: 'Pendapatan setara A, jauh lebih sedikit tempat',
    minInventoryDays: 7, leadTimeDays: 10, color: '#8a5fd0', colorSoft: '#ece5fa',
    skus: { count: 5, w: [28, 32], h: [24, 26], d: [24, 26], kg: [13, 15], stackFactor: [4, 5], pricePerCarton: 950_000, margin: 0.12, demandPerStoreDay: [2, 4], demandPresence: 0.9, mtBias: 0 },
  },
  {
    id: 'C', profile: 'Banyak pesanan kecil 1–2 karton', notice: 'Beban picking, banyak DO dan invoice',
    minInventoryDays: 7, leadTimeDays: 5, color: '#d08a3e', colorSoft: '#faeada',
    skus: { count: 6, w: [38, 42], h: [28, 32], d: [28, 32], kg: [5, 7], stackFactor: [3, 4], pricePerCarton: 420_000, margin: 0.1, demandPerStoreDay: [1, 2], demandPresence: 1, mtBias: 0 },
  },
  {
    id: 'D', profile: 'Punya sales admin khusus', notice: 'Biaya langsung, bukan bagian PO',
    minInventoryDays: 7, leadTimeDays: 8, color: '#3ea88a', colorSoft: '#daf2ea',
    skus: { count: 4, w: [43, 47], h: [28, 32], d: [33, 37], kg: [8, 10], stackFactor: [3, 4], pricePerCarton: 550_000, margin: 0.1, demandPerStoreDay: [3, 6], demandPresence: 0.9, mtBias: 0 },
  },
  {
    id: 'E', profile: 'Menjual terutama ke MT besar', notice: 'Jam kas panjang',
    minInventoryDays: 10, leadTimeDays: 12, color: '#d05f8a', colorSoft: '#fae0ea',
    skus: { count: 5, w: [48, 52], h: [28, 32], d: [28, 32], kg: [9, 11], stackFactor: [3, 4], pricePerCarton: 300_000, margin: 0.09, demandPerStoreDay: [3, 6], demandPresence: 0.85, mtBias: 0.8 },
  },
  {
    id: 'F', profile: 'Hari persediaan minimum tinggi', notice: 'Stok duduk paling lama',
    minInventoryDays: 21, leadTimeDays: 14, color: '#5f6fd0', colorSoft: '#e3e6fa',
    skus: { count: 4, w: [33, 37], h: [23, 27], d: [23, 27], kg: [6, 8], stackFactor: [4, 5], pricePerCarton: 700_000, margin: 0.11, demandPerStoreDay: [1, 2], demandPresence: 0.9, mtBias: 0 },
  },
]

// --- Pallets (§4.4) -------------------------------------------------------------------------

export interface PalletRule {
  id: 'std' | 'tall'
  label: string
  widthM: number
  depthM: number
  /** Load height of the goods, excluding the wooden pallet (brief §11.3). */
  heightM: number
  /** Wooden pallet thickness, for the total display height. */
  woodHeightM: number
}

/** DUMMY — two pallet rules; cartons stack in the load height above the wood. */
export const PALLET_RULES: Record<'std' | 'tall', PalletRule> = {
  std: { id: 'std', label: '1,1 × 1,2 m, muatan 1,0 m', widthM: 1.1, depthM: 1.2, heightM: 1.0, woodHeightM: 0.15 },
  tall: { id: 'tall', label: '1,0 × 1,2 m, muatan 1,8 m', widthM: 1.0, depthM: 1.2, heightM: 1.8, woodHeightM: 0.15 },
}

// --- Volume and allocation parameters (§4.3, §4.5) ------------------------------------------

/** DUMMY — chargeable volume: max(m³, kg / densityFactor). */
export const DENSITY_FACTOR_KG_PER_M3 = 250
/** DUMMY — normal load factor for the capacity basis. */
export const NORMAL_LOAD_FACTOR = 0.85
/** DUMMY — days payable outstanding, used only by the inventory-capital toggle. */
export const DPO_DAYS = 30

// --- Toggles (§4, §7.9) ---------------------------------------------------------------------

export interface Toggles {
  /** Ukuran volume: CBM murni vs chargeable. */
  volumeMeasure: 'cbm' | 'chargeable'
  /** Dasar bagi truk: m³ termuat vs kapasitas normal. */
  truckBasis: 'loaded' | 'capacity'
  /** Aturan palet. */
  palletRule: 'std' | 'tall'
  /** Driver outbound: palet keluar vs karton picked. */
  outboundDriver: 'pallets' | 'cartons'
  /** Pajak: dialokasikan per invoice dikirim vs G&A (tidak dialokasikan). */
  taxAllocation: 'allocated' | 'ga'
  /** Termasuk modal di persediaan. */
  stockCapital: boolean
  /** Cost of capital, slider 0–20% (§4.5), labelled as an assumption. */
  costOfCapital: number
}

export const DEFAULT_TOGGLES: Toggles = {
  volumeMeasure: 'cbm',
  truckBasis: 'loaded',
  palletRule: 'std',
  outboundDriver: 'pallets',
  taxAllocation: 'allocated',
  stockCapital: false,
  costOfCapital: 0.12,
}

export interface ToggleDef {
  key: keyof Toggles
  label: string
  /** One line per option: what changing it does (drawer, §7.9). */
  options: { value: string; label: string; note: string }[]
}

export const TOGGLE_DEFS: ToggleDef[] = [
  {
    key: 'volumeMeasure', label: 'Ukuran volume',
    options: [
      { value: 'cbm', label: 'CBM murni', note: 'Bagi biaya truk murni atas m³ fisik barang.' },
      { value: 'chargeable', label: 'Chargeable', note: 'Pakai max(m³, kg / faktor densitas) — barang padat menanggung lebih besar.' },
    ],
  },
  {
    key: 'truckBasis', label: 'Dasar bagi truk',
    options: [
      { value: 'loaded', label: 'm³ termuat', note: 'Seluruh biaya trip dibagi ke barang yang termuat.' },
      { value: 'capacity', label: 'Kapasitas normal', note: 'Pembagi kapasitas normal; ruang kosong jadi "Kapasitas truk tak terpakai".' },
    ],
  },
  {
    key: 'palletRule', label: 'Aturan palet',
    options: [
      { value: 'std', label: '1,1 × 1,2 m, tinggi 1,0 m', note: 'Palet pendek: lebih banyak posisi palet dan palet-hari.' },
      { value: 'tall', label: '1,0 × 1,2 m, tinggi 1,8 m', note: 'Palet tinggi: karton per palet naik, palet-hari turun.' },
    ],
  },
  {
    key: 'outboundDriver', label: 'Driver outbound',
    options: [
      { value: 'pallets', label: 'Palet keluar', note: 'Tim packing dibebankan per posisi palet yang diambil.' },
      { value: 'cartons', label: 'Karton picked', note: 'Tim packing dibebankan per karton yang diambil — pesanan kecil kelihatan.' },
    ],
  },
  {
    key: 'taxAllocation', label: 'Pajak',
    options: [
      { value: 'allocated', label: 'Dialokasikan', note: 'Pool pajak dibagi per invoice dikirim ke prinsipal.' },
      { value: 'ga', label: 'G&A', note: 'Pajak jadi biaya umum, tidak dialokasikan ke prinsipal.' },
    ],
  },
  {
    key: 'stockCapital', label: 'Termasuk modal di persediaan',
    options: [
      { value: 'off', label: 'Tidak', note: 'Jam kas hanya dari pengiriman sampai pembayaran.' },
      { value: 'on', label: 'Ya', note: 'Tambah nilai persediaan × (hari simpan − DPO) pada biaya modal.' },
    ],
  },
]
