// Numeric traces (brief §7.7 "Jejak angka"). Every figure the panels show carries its
// formula, its inputs, and a `compute` closure that recomputes the value from those inputs;
// the controls verify the recomputation (§6 control 9). Inputs may reference another trace,
// which is what makes a trace clickable in the UI.

export type Unit = 'rp' | 'm3' | 'kg' | 'km' | 'day' | 'pallet' | 'palletDay' | 'carton' | 'count' | 'pct' | 'po' | 'invoice' | 'trip'

export interface TraceInput {
  label: string
  value: number
  unit: Unit
  /** Clickable input: another trace node. */
  ref?: Trace
}

export interface Trace {
  id: string
  label: string
  unit: Unit
  value: number
  /** Formula template; `{0}`, `{1}`, … are replaced by the input values when displayed. */
  formula: string
  inputs: TraceInput[]
  /** Recomputes the value from the input values, in input order. */
  compute: (...inputs: number[]) => number
}

let seq = 0

/** Build a trace node. `compute` must close over nothing but its numeric inputs. */
export function trace(label: string, unit: Unit, formula: string, inputs: TraceInput[], compute: (...inputs: number[]) => number): Trace {
  seq += 1
  return { id: `T${seq}`, label, unit, value: compute(...inputs.map((i) => i.value)), formula, inputs, compute }
}

export const num = (label: string, value: number, unit: Unit): TraceInput => ({ label, value, unit })
export const ref = (input: TraceInput, t: Trace): TraceInput => ({ ...input, ref: t })

/** Control 9: the trace's own value equals what its formula recomputes from its inputs. */
export function verifyTrace(t: Trace): boolean {
  const recomputed = t.compute(...t.inputs.map((i) => i.value))
  const eps = Math.max(1e-9, Math.abs(t.value) * 1e-9)
  return Math.abs(recomputed - t.value) <= eps
}

/** Formula text with the input values substituted in, e.g. for report output. */
export function traceText(t: Trace): string {
  return t.formula.replace(/\{(\d+)\}/g, (_, i) => String(t.inputs[Number(i)]?.value ?? '?'))
}

/** Engine lookup helper: throws instead of smuggling `undefined` through the numbers. */
export function must<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) throw new Error(`missing ${what}`)
  return v
}
