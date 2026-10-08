// Mode skenario (Brief B6): the shared types of the scenario layer. A scenario is a parameterised
// run of a world's own engine: its steps read engine figures, the drawer's inputs and the
// assumptions entered at a pause, and compute only what the engine does not (the order need, a
// cost per scenario unit, …) in the scenario layer. Nothing here runs three.js, so the layer and
// its tests stay pure; the director (director.ts) and the panels (ui/) draw it.
import type { WorldId } from '../yard/types.ts'

/** Where a figure comes from (Brief B6 §2.4). `input` is a value typed into the drawer. */
export type Badge = 'engine' | 'fcc' | 'swimlane' | 'dummy' | 'asumsi' | 'hitungan' | 'input'

export const BADGES: Badge[] = ['engine', 'fcc', 'swimlane', 'dummy', 'asumsi', 'hitungan', 'input']

export const BADGE_LABEL: Record<Badge, string> = {
  engine: 'Engine',
  fcc: 'FCC BMG',
  swimlane: 'Swimlane KGR',
  dummy: 'Dummy',
  asumsi: 'Asumsi',
  hitungan: 'Hitungan',
  input: 'Input',
}

/** One number with its unit and its source. A Hitungan carries its formula and inputs. */
export interface Fig {
  /** what the number is, used in formulas and hovers */
  label: string
  value: number
  /** display unit: 'karton', 'palet', 'PO', 'hari'; 'Rp' for money, 'Rp/PO' for a rate, '%' for a fraction */
  unit: string
  badge: Badge
  /** decimals shown (default 0) */
  dp?: number
  /** where an engine or data figure is read from */
  src?: string
  /** a Hitungan: the formula over its inputs' labels, {0} {1} … */
  formula?: string
  inputs?: Fig[]
  /** an Asumsi: the id of the gap it answers */
  asm?: string
}

/** Text with figures: `t` holds {0} {1} … where the figures go, each drawn with its badge. */
export interface Line {
  t: string
  f?: Fig[]
}

/** A value the engine lacks, asked for at the step that needs it (Brief B6 §2.3). */
export interface GapDef {
  /** stable id, saved in the URL */
  id: string
  label: string
  unit: string
  /** the role that would normally own the value */
  owner: string
  why: string
  /** KGR: the gate id and its owner in the swimlane */
  gate?: string
  gateOwner?: string
  /** a value a source in this repository already documents (the only pre-fill allowed) */
  source?: { value: number; text: string }
  min?: number
  max?: number
  integer?: boolean
}

export interface CashEvent {
  day: number
  kind: 'out' | 'in'
  label: string
  value: Fig
}

/** What a step that ran gives the ledger. */
export interface StepOut {
  /** the driver quantity and unit (none for a step that adds no cost) */
  driver: Fig | null
  rate: Fig | null
  cost: Fig
  /** the scenario day the step finishes on */
  day: number
  /** the step's working, shown on its card */
  detail: { label: string; value: Fig | string }[]
  notes?: string[]
  cash?: CashEvent[]
}

/** Where the director points while a step plays: the world's places and entities by id. */
export interface Stage {
  /** the place the camera frames, or a box [x0, x1, y0, y1] of the plate */
  place?: string
  box?: readonly [number, number, number, number]
  /** buildings held open */
  open?: string[]
  /** entities kept at full strength; the rest of the plate dims */
  keep: string[]
  /** entities drawn in the live colour: the acting roles */
  live: string[]
  /** place keys whose names stay bright */
  labels?: string[]
  /** objects that move during the step: a document from one point to another, … */
  flights?: { kind: 'doc' | 'pallet' | 'coin'; label: string; from: readonly [number, number]; to: readonly [number, number]; fill?: string }[]
}

export interface StepCtx<I, S> {
  inputs: I
  state: S
  /** an entered assumption, as a figure (only for gaps the step declared) */
  asm(id: string): Fig
  has(id: string): boolean
}

export interface StepDef<I, S> {
  /** "1", "4a" */
  n: string
  /** the caption's action with its role: "Sales admin membuat PO ke prinsipal" */
  title(inputs: I): string
  role(inputs: I): string
  team: string
  /** values this step needs that the engine lacks, given the inputs and the state so far */
  gaps?(ctx: StepCtx<I, S>): GapDef[]
  /** absent: the step is listed but not wired yet */
  run?(ctx: StepCtx<I, S>): { out: StepOut; state: S }
  stage(inputs: I, state: S): Stage
}

/** A drawer field. The world's inputs are a flat record; `id` is its key. */
export type Field<I> = {
  id: keyof I & string
  label: string
  help?: string
  show?: (i: I) => boolean
} & (
  | { kind: 'seg'; options: (i: I) => [string, string][] }
  | { kind: 'number'; unit: (i: I) => string; min: number; step: number }
  | { kind: 'checks'; groups: (i: I) => { label: string; options: [string, string][] }[] }
)

export interface Preset<I> {
  id: string
  label: string
  inputs: I
  /** the source of the preset's numbers (distribution: dummy, as its engine) */
  badge: Badge
  note?: string
}

export interface ScenarioDef<I, S> {
  world: WorldId
  title: string
  /** numbered steps the caption counts ("Langkah 3 dari 11") */
  count: number
  steps: StepDef<I, S>[]
  /** a hash of the engine data a run reads */
  dataHash(): string
  /** the engine and data a run reads, for Ringkasan */
  dataLabel: string
  fields: Field<I>[]
  defaults(): I
  presets: Preset<I>[]
  /** inputs from a URL, made safe (unknown keys dropped, bad values replaced by defaults) */
  normalize(raw: unknown): I
  /** keep dependent inputs in step after a change (a newly chosen principal brings its SKUs, …) */
  adjust?(next: I, prev: I): I
  /** errors by field id; none means the run can start */
  validate(i: I): Partial<Record<keyof I & string, string>>
  /** the live conversion preview under the inputs */
  preview(i: I): Line[]
  /** the scenario unit the ledger divides by (100 palet, 800 karton, …) */
  units(i: I): Fig
  /** the inputs as rows for Ringkasan */
  summary(i: I): Line[]
  init(i: I): S
  /** the teams in the order the result card lists them */
  teams: string[]
}

export type Assumptions = Record<string, number>

export type RowState = 'done' | 'paused' | 'pending' | 'unwired'

export interface Row {
  index: number
  n: string
  title: string
  role: string
  team: string
  state: RowState
  out?: StepOut
  /** cumulative cost after this row */
  cum?: Fig
  /** this row's cost per scenario unit */
  perUnit?: Fig
  /** assumptions this row ran on */
  used: string[]
  stage: Stage
}

export interface Run {
  world: WorldId
  rows: Row[]
  /** done: every step ran; paused: waiting for a value; partial: steps after the last one ran are not wired */
  status: 'done' | 'paused' | 'partial'
  pause?: { index: number; gaps: GapDef[] }
  units: Fig
  total: Fig
  perUnit: Fig
  /** every gap a step declared, with where it was needed and the value entered */
  assumptions: { gap: GapDef; step: string; index: number; value: number }[]
  hash: string
}
