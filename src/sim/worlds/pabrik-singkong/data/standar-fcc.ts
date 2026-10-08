// BMG's standard cost of fried cassava chips (FCC), as given in Brief B5 §3. These are real BMG
// figures, not dummy ones: every number below is copied from the brief, which takes it from
//   [deck] the BMG deck "FCC biaya standar per kg" (slides 1–3), basis actual January–August 2026;
//   [bp]   the BMG business plan, sheet Input Operasional (rows named per figure).
// Nothing here is invented. Anything the simulation shows beyond these lines is derived from them
// in derive.ts, with the arithmetic written out.

export const SUMBER = {
  deck: 'Deck BMG FCC biaya standar per kg',
  bp: 'Business plan BMG, Input Operasional',
} as const

/** the line the brief asks the screen to carry */
export const KETERANGAN_DATA = 'Data BMG: biaya standar FCC, basis aktual Januari–Agustus 2026. Sumber: deck BMG FCC biaya standar per kg dan business plan BMG.'

export type Tahap = 'penerimaan' | 'kupas' | 'cuci' | 'goreng' | 'kemas' | 'bersama'

export interface Elemen {
  id: string
  tahap: Tahap
  label: string
  /** driver per kg of production, as the deck writes it */
  driver: string
  /** the driver's quantity per kg of production, where the deck gives one */
  qty?: number
  unit?: string
  /** standard price per unit of the driver, where the deck gives one */
  price?: number
  /** Rp per kg of production, as printed in the deck */
  rp: number
  sumber: string
}

/** Standard cost of FCC per kg of production (deck, slides 1–2). */
export const ELEMEN: Elemen[] = [
  { id: 'singkong-kulit', tahap: 'penerimaan', label: 'Singkong kulit', driver: '3,0093 kg', qty: 3.0093, unit: 'kg', price: 2673.5, rp: 8045.6, sumber: 'deck slide 1–2' },
  { id: 'singkong-daging', tahap: 'penerimaan', label: 'Singkong daging (beli kupas)', driver: '0,1700 kg', qty: 0.17, unit: 'kg', price: 4526.8, rp: 769.6, sumber: 'deck slide 1–2' },
  { id: 'upah-kupas', tahap: 'kupas', label: 'Upah borongan kupas', driver: '2,0961 kg kupas (rendemen 69,7%)', qty: 2.0961, unit: 'kg kupas', price: 268.8, rp: 563.5, sumber: 'deck slide 1–2' },
  { id: 'amonium', tahap: 'cuci', label: 'Amonium bikarbonat', driver: '0,0073 kg', qty: 0.0073, unit: 'kg', price: 4638.6, rp: 33.6, sumber: 'deck slide 1–2' },
  { id: 'minyak', tahap: 'goreng', label: 'Minyak olein', driver: '0,2611 kg', qty: 0.2611, unit: 'kg', price: 17258.0, rp: 4506.3, sumber: 'deck slide 1–2' },
  { id: 'cng', tahap: 'goreng', label: 'CNG', driver: '0,0153 MMBTU', qty: 0.0153, unit: 'MMBTU', price: 226832.5, rp: 3472.3, sumber: 'deck slide 1–2' },
  { id: 'hdpe', tahap: 'kemas', label: 'Kantong HDPE', driver: '0,0161 kg', qty: 0.0161, unit: 'kg', price: 34320.6, rp: 553.4, sumber: 'deck slide 1–2' },
  { id: 'karton', tahap: 'kemas', label: 'Karton', driver: '0,0226 karton', qty: 0.0226, unit: 'karton', price: 9647.7, rp: 217.9, sumber: 'deck slide 1–2' },
  { id: 'plakban', tahap: 'kemas', label: 'Plakban, tali dan label', driver: '—', rp: 45.7, sumber: 'deck slide 1–2' },
  { id: 'pool-a', tahap: 'bersama', label: 'Grup A operator', driver: 'man-hour', rp: 1591.5, sumber: 'deck slide 1–2' },
  { id: 'pool-b', tahap: 'bersama', label: 'Grup B support dan staf', driver: 'man-hour', rp: 1294.1, sumber: 'deck slide 1–2' },
  { id: 'pool-c', tahap: 'bersama', label: 'Grup C energi', driver: 'kWh', rp: 174.5, sumber: 'deck slide 1–2' },
  { id: 'pool-d', tahap: 'bersama', label: 'Grup D mesin', driver: 'kWh', rp: 932.1, sumber: 'deck slide 1–2' },
  { id: 'pool-e', tahap: 'bersama', label: 'Grup E pabrik umum', driver: 'material value', rp: 507.4, sumber: 'deck slide 1–2' },
]

/** The deck's total. Its lines are rounded and add up to 22.707,5 (Brief B5 W2). */
export const TOTAL_DECK = 22707.7

/** Pools A–E are each pool ÷ this normal production (deck slide 1–2). */
export const PRODUKSI_NORMAL_KG = 295087

/** From production kg to premium kg (deck slide 2). */
export const JEMBATAN_PREMIUM = {
  biayaPerKgProduksi: 22707.7,
  kreditKw2: -341.5,
  /** the KW 2 credit is valued at NRV, Rp per kg of KW 2 */
  nrvKw2: 9777.3,
  normalLoss: 1547.2,
  biayaPerKgPremium: 23913.4,
  hargaIfmAgustus2026: 28558.4,
  marginPenuh: 4645.0,
  marginPenuhPct: 0.163,
  kontribusi: 9251.8,
  kontribusiPct: 0.324,
} as const

/** Grade split (deck slide 2). */
export const GRADE = { premium: 0.935, kw2: 0.035, waste: 0.03 } as const

/** Cassava and frying absorb this share of standard cost (deck slide 2). */
export const PORSI_SINGKONG_GORENG = 0.74

/** August 2026, standard to actual (deck slide 3). */
export const AGUSTUS_2026 = {
  selisihPerKg: -1077.1,
  produksiKg: 338754,
  produksiNormalKg: 295087,
  minyakAktualKgPerKg: 0.233,
  minyakStandarKgPerKg: 0.2611,
  porsiDagingAktual: 0.336,
  porsiDagingStandar: 0.053,
  /** the drivers slide 3 names, in its order; material price is 0 (standard set in August) */
  driver: [
    { label: 'Volume pool (A–E tersebar ke lebih banyak kg)', rp: -580.0 },
    { label: 'Minyak olein: 0,2330 lawan 0,2611 kg per kg', rp: -485.3 },
    { label: 'Singkong daging: 33,6% kg singkong dibeli kupas lawan 5,3%', rp: 528.1 },
    { label: 'Upah kupas lebih rendah', rp: -238.7 },
    { label: 'Rendemen lebih baik', rp: -180.3 },
    { label: 'Belanja pool, neto', rp: -102.1 },
    { label: 'Harga material (standar ditetapkan Agustus)', rp: 0 },
  ],
  /** the named drivers add up to −1.058,3; the gap of −18,8 is its own bar (Brief B5 §3) */
  labelSelisihLain: 'Selisih lain (tidak dirinci di deck)',
} as const

/** Delivery (bp, Input Operasional, rows 140–145). */
export const PENGIRIMAN = {
  kapasitasTripKg: 3500,
  isiRataRata: 0.9,
  cikokol: { borongan: 2599000, tol: 1100000, porsiTripBertol: 0.5 },
  semarang: { borongan: 560000 },
  sumber: 'bp, Input Operasional baris 140–145',
} as const

/** Working calendar (bp, Input Operasional, rows 7 and 102–104). */
export const KALENDER = {
  hariKerjaSebulan: 27,
  jamSebulan: { cuci: 680, potong: 680, goreng: 680 },
  sumber: 'bp, Input Operasional baris 7 dan 102–104',
} as const

/** Facts the world respects (Brief B5 §3). */
export const FAKTA = {
  singkongMaksHari: 1,
  porsiPendapatanIfm: [0.97, 0.98],
  tujuanIfm: ['Semarang', 'Cikokol'],
} as const
