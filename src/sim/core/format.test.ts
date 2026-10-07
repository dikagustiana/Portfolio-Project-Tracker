// Control 10 (brief §6): the house-rule formatters — period thousands, comma decimals.
import { describe, expect, it } from 'vitest'
import { formatClock, formatDays, formatM3, formatNumber, formatPct, formatRp, formatRpCard, formatRpShort } from './format.ts'

describe('house-rule number format', () => {
  it('formats the exact case from the brief', () => {
    expect(formatNumber(1234567.8, 1)).toBe('1.234.567,8')
  })

  it('groups thousands with periods and rounds', () => {
    expect(formatNumber(9410600)).toBe('9.410.600')
    expect(formatNumber(1011389)).toBe('1.011.389')
    expect(formatNumber(1234.56, 1)).toBe('1.234,6')
    expect(formatNumber(0.5, 2)).toBe('0,5')
    expect(formatNumber(-4200500)).toBe('-4.200.500')
  })

  it('drops trailing zero decimals', () => {
    expect(formatNumber(6, 2)).toBe('6')
    expect(formatNumber(6.5, 2)).toBe('6,5')
  })

  it('formats rupiah, percent, cubic metres and days', () => {
    expect(formatRp(1011389)).toBe('Rp 1.011.389')
    expect(formatPct(0.725)).toBe('72,5%')
    expect(formatPct(0.12, 0)).toBe('12%')
    expect(formatM3(6.52)).toBe('6,52 m³')
    expect(formatDays(14)).toBe('14 hari')
    expect(formatDays(14.5)).toBe('14,5 hari')
  })

  it('compacts large rupiah amounts', () => {
    expect(formatRpShort(1_180_000)).toBe('Rp 1,2 jt')
    expect(formatRpShort(340_000_000)).toBe('Rp 340 jt')
    expect(formatRpShort(6_500_000_000)).toBe('Rp 6,5 M')
  })

  it('formats card money with a fixed decimal per tier (Brief 3 §4)', () => {
    expect(formatRpCard(2_000_000_000)).toBe('Rp 2,0 M')
    expect(formatRpCard(230_000_000)).toBe('Rp 230,0 jt')
    expect(formatRpCard(230_400_000)).toBe('Rp 230,4 jt')
    expect(formatRpCard(101_063)).toBe('Rp 101.063')
    expect(formatRpCard(-4_250_000)).toBe('Rp -4,3 jt')
    // One tier for a whole card so rows compare at a glance.
    expect(formatRpCard(84_000_000, 'm')).toBe('Rp 0,1 M')
    expect(formatRpCard(1_234_567_890, 'jt')).toBe('Rp 1.234,6 jt')
    expect(formatRpCard(2_500_000, 'full')).toBe('Rp 2.500.000')
  })

  it('formats the intra-day clock', () => {
    expect(formatClock(10.75)).toBe('10.45')
    expect(formatClock(6)).toBe('06.00')
    expect(formatClock(10.999)).toBe('11.00')
    expect(formatClock(22)).toBe('22.00')
  })
})
