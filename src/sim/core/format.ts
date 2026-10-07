// House-rule number formatting (brief §1.8): period for thousands, comma for decimals —
// `Rp 1.011.389`, `72,5%`, `6,52 m³`. Hand-built, never `toLocaleString()`, so the output
// cannot drift with the browser locale. Unit tests pin the exact shapes.

/** `1234567.8` → `1.234.567,8`; decimals default 0 (`9410600` → `9.410.600`). */
export function formatNumber(x: number, decimals = 0): string {
  if (!Number.isFinite(x)) return '—'
  const neg = x < 0
  const pow = 10 ** decimals
  const scaled = Math.round(Math.abs(x) * pow) / pow
  const [intPart, fracPart] = splitFixed(scaled, decimals)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '-' : ''}${grouped}${fracPart}`
}

function splitFixed(x: number, decimals: number): [string, string] {
  let s = x.toFixed(decimals)
  if (decimals === 0) return [s, '']
  s = s.replace(/0+$/, '').replace(/\.$/, '')
  const i = s.indexOf('.')
  if (i < 0) return [s, '']
  return [s.slice(0, i), s.slice(i).replace('.', ',')]
}

/** `1011389` → `Rp 1.011.389`. */
export function formatRp(x: number, decimals = 0): string {
  return `Rp ${formatNumber(x, decimals)}`
}

/** `0.725` → `72,5%` (share of one); `72.5` → `7.250%` — always pass a fraction. */
export function formatPct(share: number, decimals = 1): string {
  return `${formatNumber(share * 100, decimals)}%`
}

/** `6.52` → `6,52 m³`. */
export function formatM3(x: number, decimals = 2): string {
  return `${formatNumber(x, decimals)} m³`
}

/** `14.0` → `14 hari`; `14.5` → `14,5 hari`. */
export function formatDays(x: number, decimals = 1): string {
  return `${formatNumber(x, decimals)} hari`
}

/** Compact rupiah for chips and pop-ups: `Rp 1,2 jt`, `Rp 340 jt`. */
export function formatRpShort(x: number): string {
  const a = Math.abs(x)
  if (a >= 1_000_000_000) return `Rp ${formatNumber(x / 1_000_000_000, 1)} M`
  if (a >= 1_000_000) return `Rp ${formatNumber(x / 1_000_000, 1)} jt`
  if (a >= 1_000) return `Rp ${formatNumber(x / 1_000, 0)} rb`
  return formatRp(x)
}

/** Card money format (Brief 3 §4): ≥ Rp 1 miliar → `Rp 2,0 M`; ≥ Rp 1 juta → `Rp 230,0 jt`;
 *  smaller in full. Within one card, pass the same `tier` so rows compare at a glance. */
export function formatRpCard(x: number, tier?: 'm' | 'jt' | 'full'): string {
  const a = Math.abs(x)
  const t = tier ?? (a >= 1e9 ? 'm' : a >= 1e6 ? 'jt' : 'full')
  if (t === 'm') return `Rp ${formatNumber(x / 1e9, 1)} M`
  if (t === 'jt') return `Rp ${formatNumber(x / 1e6, 1)} jt`
  return formatRp(x)
}
