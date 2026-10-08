// Figures the cassava world shows that the brief does not print, each derived from standar-fcc.ts
// with its arithmetic in the code (Brief B5 §3: "derive anything else from them, never invent it").
import { AGUSTUS_2026, ELEMEN, GRADE, JEMBATAN_PREMIUM, KALENDER, PENGIRIMAN, PRODUKSI_NORMAL_KG, TOTAL_DECK } from './standar-fcc.ts'
import type { Elemen, Tahap } from './standar-fcc.ts'

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
const el = (id: string): Elemen => {
  const e = ELEMEN.find((x) => x.id === id)
  if (!e) throw new Error(`no element ${id}`)
  return e
}

/** the deck's lines added up: 22.707,5 against its printed total 22.707,7 (rounding) */
export const SUM_ELEMEN = sum(ELEMEN.map((e) => e.rp))
export const SELISIH_PEMBULATAN = TOTAL_DECK - SUM_ELEMEN

/** Rp per kg of production by stage (the shared pools A–E as their own band) */
export const PER_TAHAP: Record<Tahap, number> = {
  penerimaan: sum(ELEMEN.filter((e) => e.tahap === 'penerimaan').map((e) => e.rp)),
  kupas: sum(ELEMEN.filter((e) => e.tahap === 'kupas').map((e) => e.rp)),
  cuci: sum(ELEMEN.filter((e) => e.tahap === 'cuci').map((e) => e.rp)),
  goreng: sum(ELEMEN.filter((e) => e.tahap === 'goreng').map((e) => e.rp)),
  kemas: sum(ELEMEN.filter((e) => e.tahap === 'kemas').map((e) => e.rp)),
  bersama: sum(ELEMEN.filter((e) => e.tahap === 'bersama').map((e) => e.rp)),
}
/** the five shared pools A–E, Rp per kg at 295.087 kg normal production */
export const POOL_BERSAMA = PER_TAHAP.bersama
/** the pools' monthly total that the deck divides by the normal production */
export const POOL_BERSAMA_BULANAN = POOL_BERSAMA * PRODUKSI_NORMAL_KG

/** kg of cassava in its skin and bought peeled per kg of production */
export const KG_SINGKONG_KULIT = el('singkong-kulit').qty ?? 0
export const KG_SINGKONG_DAGING = el('singkong-daging').qty ?? 0
/** share of cassava kg bought peeled, standard: 0,1700 ÷ (3,0093 + 0,1700) ≈ 5,3% */
export const PORSI_DAGING_STANDAR = KG_SINGKONG_DAGING / (KG_SINGKONG_KULIT + KG_SINGKONG_DAGING)
/** peeling yield: 2,0961 kg peeled ÷ 3,0093 kg in the skin ≈ 69,7% */
export const RENDEMEN_KUPAS = (el('upah-kupas').qty ?? 0) / KG_SINGKONG_KULIT

/** a standard working day: normal monthly production ÷ 27 working days */
export const PRODUKSI_HARIAN = PRODUKSI_NORMAL_KG / KALENDER.hariKerjaSebulan
export const PREMIUM_HARIAN = PRODUKSI_HARIAN * GRADE.premium
export const KW2_HARIAN = PRODUKSI_HARIAN * GRADE.kw2
export const WASTE_HARIAN = PRODUKSI_HARIAN * GRADE.waste
/** cassava that has to arrive that day (it cannot wait more than a day) */
export const SINGKONG_KULIT_HARIAN = PRODUKSI_HARIAN * KG_SINGKONG_KULIT
export const SINGKONG_DAGING_HARIAN = PRODUKSI_HARIAN * KG_SINGKONG_DAGING
/** kg the line fries per hour at normal volume: 295.087 kg ÷ 680 jam */
export const KG_PER_JAM_GORENG = PRODUKSI_NORMAL_KG / KALENDER.jamSebulan.goreng

/** a delivery trip carries 3.500 kg × 90% */
export const KG_PER_TRIP = PENGIRIMAN.kapasitasTripKg * PENGIRIMAN.isiRataRata
/** Cikokol: borongan, plus the toll on half the trips (its expected cost per trip) */
export const BIAYA_TRIP_CIKOKOL = PENGIRIMAN.cikokol.borongan + PENGIRIMAN.cikokol.tol * PENGIRIMAN.cikokol.porsiTripBertol
export const BIAYA_TRIP_SEMARANG = PENGIRIMAN.semarang.borongan
export const BIAYA_KIRIM_PER_KG = { cikokol: BIAYA_TRIP_CIKOKOL / KG_PER_TRIP, semarang: BIAYA_TRIP_SEMARANG / KG_PER_TRIP }
/** premium kg a standard day ships, in full trips of 3.150 kg */
export const TRIP_HARIAN = PREMIUM_HARIAN / KG_PER_TRIP

/** the premium bridge, added up: 22.707,7 − 341,5 + 1.547,2 */
export const BIAYA_PREMIUM_DIHITUNG = JEMBATAN_PREMIUM.biayaPerKgProduksi + JEMBATAN_PREMIUM.kreditKw2 + JEMBATAN_PREMIUM.normalLoss
/** the IFM price less the premium cost */
export const MARGIN_DIHITUNG = JEMBATAN_PREMIUM.hargaIfmAgustus2026 - JEMBATAN_PREMIUM.biayaPerKgPremium

/** August: the named drivers, the residual the deck does not break down, and the actual */
export const AGUSTUS_DRIVER_TOTAL = sum(AGUSTUS_2026.driver.map((d) => d.rp))
export const AGUSTUS_SELISIH_LAIN = AGUSTUS_2026.selisihPerKg - AGUSTUS_DRIVER_TOTAL
export const AGUSTUS_AKTUAL_PER_KG = TOTAL_DECK + AGUSTUS_2026.selisihPerKg
/** the waterfall's steps, standard → actual: every named driver, then the residual as its own bar */
export const AGUSTUS_LANGKAH = [...AGUSTUS_2026.driver.map((d) => ({ label: d.label, value: d.rp })), { label: AGUSTUS_2026.labelSelisihLain, value: AGUSTUS_SELISIH_LAIN }]
