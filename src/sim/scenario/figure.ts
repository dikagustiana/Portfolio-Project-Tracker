// Figures of the scenario layer: every number carries its unit and its source badge, and a
// Hitungan carries the formula and inputs it was computed from (Brief B6 §2.4). Formatting
// uses the simulation's house formatters (period for thousands, comma for decimals).
import { formatNumber } from '../core/format.ts'
import type { Badge, Fig, Line } from './types.ts'

export const fig = (label: string, value: number, unit: string, badge: Badge, extra: Partial<Fig> = {}): Fig => ({ label, value, unit, badge, ...extra })

/** a figure read from the world's engine */
export const eng = (label: string, value: number, unit: string, src: string, dp?: number): Fig => fig(label, value, unit, 'engine', { src, dp })

/** a value typed into the drawer */
export const inp = (label: string, value: number, unit: string, dp?: number): Fig => fig(label, value, unit, 'input', { dp })

/** computed in the scenario layer from badged inputs; `formula` names them {0} {1} … */
export function calc(label: string, unit: string, formula: string, inputs: Fig[], compute: (...xs: number[]) => number, dp?: number): Fig {
  return fig(label, compute(...inputs.map((x) => x.value)), unit, 'hitungan', { formula, inputs, dp })
}

/** the sum of figures, as one Hitungan (an empty sum is a counted zero) */
export function sum(label: string, unit: string, parts: Fig[], dp?: number): Fig {
  if (parts.length === 0) return fig(label, 0, unit, 'hitungan', { formula: 'tidak ada bagian', inputs: [], dp })
  return calc(label, unit, parts.map((_, i) => `{${i}}`).join(' + '), parts, (...xs) => xs.reduce((s, x) => s + x, 0), dp)
}

/** `Rp 3.000.000`, `Rp 3.000.000 per PO`, `800 karton`, `12,5%` */
export function fmt(f: Pick<Fig, 'value' | 'unit' | 'dp'>, signed = false): string {
  const dp = f.dp ?? 0
  const sign = signed ? (f.value > 0 ? '+' : f.value < 0 ? '−' : '±') : f.value < 0 ? '−' : ''
  const n = formatNumber(Math.abs(f.value), dp)
  if (f.unit === 'Rp') return `${sign}Rp ${n}`
  if (f.unit.startsWith('Rp/')) return `${sign}Rp ${n} per ${f.unit.slice(3)}`
  if (f.unit === '%') return `${sign}${formatNumber(Math.abs(f.value) * 100, dp || 1)}%`
  return f.unit ? `${sign}${n} ${f.unit}` : `${sign}${n}`
}

/** the hover text of a figure: its source, or for a Hitungan the formula with names, then values */
export function explain(f: Fig): string {
  if (f.badge === 'hitungan' && f.formula !== undefined) {
    const ins = f.inputs ?? []
    const names = f.formula.replace(/\{(\d+)\}/g, (_, i) => ins[Number(i)]?.label ?? '?')
    const values = f.formula.replace(/\{(\d+)\}/g, (_, i) => {
      const x = ins[Number(i)]
      return x ? fmt(x) : '?'
    })
    return `${f.label} = ${names}\n= ${values}\n= ${fmt(f)}`
  }
  if (f.badge === 'asumsi') return `${f.label}: asumsi skenario, diisi pengguna`
  if (f.badge === 'input') return `${f.label}: input skenario`
  return `${f.label}${f.src ? ` · ${f.src}` : ''}`
}

/** every figure reachable from a figure, itself first */
export function walk(f: Fig, out: Fig[] = []): Fig[] {
  out.push(f)
  for (const x of f.inputs ?? []) walk(x, out)
  return out
}

/** a line's text with its figures filled in (for plain-text uses: titles, CSV, tests) */
export function plain(l: Line): string {
  return l.t.replace(/\{(\d+)\}/g, (_, i) => {
    const x = l.f?.[Number(i)]
    return x ? fmt(x) : '?'
  })
}

/** Split a whole number over weights by largest remainder: the parts sum exactly to the total,
 *  ties go to the earlier item, so the split is deterministic. */
export function splitWhole(total: number, weights: number[]): number[] {
  const w = weights.map((x) => Math.max(0, x))
  const sw = w.reduce((s, x) => s + x, 0)
  if (sw <= 0 || total <= 0) return w.map(() => 0)
  const exact = w.map((x) => (total * x) / sw)
  const base = exact.map((x) => Math.floor(x))
  let left = total - base.reduce((s, x) => s + x, 0)
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    base[i] = (base[i] ?? 0) + 1
    left--
  }
  return base
}
