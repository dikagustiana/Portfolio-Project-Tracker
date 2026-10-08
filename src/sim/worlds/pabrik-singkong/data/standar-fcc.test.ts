// Brief B5 W2: the BMG standard-cost data adds up the way the deck says it does.
import { describe, expect, it } from 'vitest'
import {
  AGUSTUS_AKTUAL_PER_KG, AGUSTUS_DRIVER_TOTAL, AGUSTUS_LANGKAH, AGUSTUS_SELISIH_LAIN, BIAYA_PREMIUM_DIHITUNG, KG_PER_TRIP, MARGIN_DIHITUNG,
  PER_TAHAP, PORSI_DAGING_STANDAR, POOL_BERSAMA, PRODUKSI_HARIAN, RENDEMEN_KUPAS, SUM_ELEMEN,
} from './derive.ts'
import { AGUSTUS_2026, ELEMEN, GRADE, JEMBATAN_PREMIUM, PORSI_SINGKONG_GORENG, PRODUKSI_NORMAL_KG, TOTAL_DECK } from './standar-fcc.ts'

describe('BMG standard cost of FCC per kg of production', () => {
  it('has the fourteen elements of slides 1–2', () => {
    expect(ELEMEN).toHaveLength(14)
    expect(ELEMEN.filter((e) => e.tahap === 'bersama').map((e) => e.label)).toEqual(['Grup A operator', 'Grup B support dan staf', 'Grup C energi', 'Grup D mesin', 'Grup E pabrik umum'])
  })

  it('adds up to the deck total Rp 22.707,7 within 0,5 (the rounded lines sum to 22.707,5)', () => {
    expect(Math.abs(SUM_ELEMEN - TOTAL_DECK)).toBeLessThanOrEqual(0.5)
    expect(SUM_ELEMEN).toBeCloseTo(22707.5, 6)
  })

  it('stages add back to the same sum, and cassava with frying is 74,0% of standard cost', () => {
    const stages = Object.values(PER_TAHAP).reduce((s, x) => s + x, 0)
    expect(stages).toBeCloseTo(SUM_ELEMEN, 6)
    expect((PER_TAHAP.penerimaan + PER_TAHAP.goreng) / TOTAL_DECK).toBeCloseTo(PORSI_SINGKONG_GORENG, 3)
    expect(POOL_BERSAMA).toBeCloseTo(4499.6, 6)
  })

  it('derives the drivers the deck states: rendemen 69,7%, 5,3% bought peeled', () => {
    expect(RENDEMEN_KUPAS).toBeCloseTo(0.697, 3)
    expect(PORSI_DAGING_STANDAR).toBeCloseTo(0.053, 3)
    expect(GRADE.premium + GRADE.kw2 + GRADE.waste).toBeCloseTo(1, 9)
  })

  it('a standard day is the normal month over 27 working days, and a trip carries 3.150 kg', () => {
    expect(PRODUKSI_HARIAN).toBeCloseTo(PRODUKSI_NORMAL_KG / 27, 9)
    expect(KG_PER_TRIP).toBe(3150)
  })
})

describe('from production kg to premium kg', () => {
  it('the premium bridge adds up to Rp 23.913,4', () => {
    expect(BIAYA_PREMIUM_DIHITUNG).toBeCloseTo(JEMBATAN_PREMIUM.biayaPerKgPremium, 6)
    expect(JEMBATAN_PREMIUM.biayaPerKgPremium).toBe(23913.4)
  })

  it('the full margin is the IFM price less the premium cost, 16,3%; the KW 2 credit is 3,5% at NRV', () => {
    expect(MARGIN_DIHITUNG).toBeCloseTo(JEMBATAN_PREMIUM.marginPenuh, 6)
    expect(JEMBATAN_PREMIUM.marginPenuh / JEMBATAN_PREMIUM.hargaIfmAgustus2026).toBeCloseTo(JEMBATAN_PREMIUM.marginPenuhPct, 3)
    expect(JEMBATAN_PREMIUM.kontribusi / JEMBATAN_PREMIUM.hargaIfmAgustus2026).toBeCloseTo(JEMBATAN_PREMIUM.kontribusiPct, 3)
    expect(-JEMBATAN_PREMIUM.kreditKw2 / JEMBATAN_PREMIUM.nrvKw2).toBeCloseTo(GRADE.kw2, 3)
  })
})

describe('August 2026, standard to actual', () => {
  it('the named drivers add up to −1.058,3, and the residual bar is −18,8', () => {
    expect(AGUSTUS_DRIVER_TOTAL).toBeCloseTo(-1058.3, 6)
    expect(AGUSTUS_SELISIH_LAIN).toBeCloseTo(-18.8, 6)
    expect(AGUSTUS_LANGKAH.at(-1)?.label).toBe('Selisih lain (tidak dirinci di deck)')
  })

  it('the waterfall closes at −1.077,1 from standard to actual', () => {
    const total = AGUSTUS_LANGKAH.reduce((s, x) => s + x.value, 0)
    expect(total).toBeCloseTo(AGUSTUS_2026.selisihPerKg, 6)
    expect(TOTAL_DECK + total).toBeCloseTo(AGUSTUS_AKTUAL_PER_KG, 6)
    expect(AGUSTUS_AKTUAL_PER_KG).toBeCloseTo(21630.6, 6)
  })

  it('the pool-volume effect is the pools A–E spread over 338.754 kg instead of 295.087', () => {
    const atActual = (POOL_BERSAMA * AGUSTUS_2026.produksiNormalKg) / AGUSTUS_2026.produksiKg
    expect(atActual - POOL_BERSAMA).toBeCloseTo(-580.0, 0)
  })
})
