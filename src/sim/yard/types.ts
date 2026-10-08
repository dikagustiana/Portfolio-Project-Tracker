// The contract between the shared yard shell (YardShell.tsx, scene.ts) and a world (Brief B5 §2).
// The shell owns the metrics bar, the lenses, the place buttons and their number keys, the
// context switcher, the right panel, the stage tracker, day and night, speed, the fixed-step
// seeded clock and the window.sim debug hook. A world supplies its places and layout, its engine
// and data, its metrics, its stage tracker and its click cards, all through WorldDef below.
import type { PrincipalFill, V3 } from './kernel.ts'
import type { Trace } from '../core/trace.ts'
import type { YardScene } from './scene.ts'
import type { AnyScenario } from '../scenario/types.ts'

/** The three worlds of the simulation (Brief B5 §1). */
export type WorldId = 'distribusi' | 'pabrik-singkong' | 'rpa'

/** One figure on a card: a value (with its trace when the engine has one) or a named gap. */
export type Fig = { label: string; value: string; trace?: Trace } | { label: string; missing: string }

/** A slice of a split bar on a card (m³ per principal on a mixed truck, …). */
export interface Share {
  key: string
  color: string
  value: number
  label: string
}

/** Status of a data need in the KGR swimlane (Brief B5 §4). */
export type NeedStatus = 'ADA' | 'SEBAGIAN' | 'BELUM'

/** Extra sections a card can carry below its rows, in the order given. */
export type Block =
  | { kind: 'rows'; title: string; rows: [string, string][] }
  | { kind: 'text'; title: string; text: string }
  | { kind: 'list'; title: string; items: string[] }
  | { kind: 'needs'; title: string; items: { label: string; status: NeedStatus; owner: string }[] }
  /** horizontal bars that share one scale: cost per element, yield per category, … */
  | { kind: 'bars'; title: string; items: { label: string; value: number; display: string; tone?: 'ok' | 'warn' | 'bad' | 'live' }[]; note?: string }
  /** a bridge from a start value to an end value, every step labelled (Brief B5 §3 waterfall) */
  | { kind: 'waterfall'; title: string; start: { label: string; value: number }; steps: { label: string; value: number }[]; end: { label: string; value: number }; format: (x: number) => string; note?: string }
  /** several items behind tabs, one shown at a time (the swimlane steps an object carries) */
  | { kind: 'steps'; title: string; items: { key: string; label: string; blocks: Block[] }[] }

export interface Card {
  /** small caps line above the title */
  kind: string
  title: string
  status: string
  tone?: 'ok' | 'warn' | 'bad' | 'live'
  /** a tag shown before the kind and in the stage tracker (B2B, B2C, RPA, TRADING, …) */
  channel?: string
  progress?: { v: number; max: number; label: string }
  /** a bar split into shares (m³ per principal on a mixed truck, …) */
  shares?: { label: string; items: Share[] }
  /** blocks shown first, right under the status (a card's main picture, such as a waterfall) */
  lead?: Block[]
  rows: [string, string][]
  /** the cost driver this object moves */
  driver?: string
  /** the figures the world's engine or data gives for this object */
  engine: Fig[]
  /** heading of the figures section (default "Angka engine") */
  engineTitle?: string
  blocks?: Block[]
  next?: string
  /** open points and rules, shown as notes */
  notes?: string[]
  /** where the figures come from, printed small at the foot of the card */
  source?: string
  followable?: boolean
  /** stage tracker: which channel's stages, and the index of the current one */
  stage?: { channel: string; at: number; done?: boolean }
}

/** One tile of the metrics bar. `missing` names what the world's engine or data lacks. */
export interface Pulse {
  label: string
  value: string
  sub: string
  tone?: 'ok' | 'warn' | 'bad'
  missing?: string
}

/** A place: a number key, a button, and the box of the world the camera frames for it. */
export interface PlaceDef {
  key: string
  id: string
  label: string
  /** a shorter name for the button, when the full one would crowd the row (the full name stays its accessible name) */
  short?: string
  /** [x0, x1, y0, y1] in the world's plate coordinates */
  box: readonly [number, number, number, number]
  /** buildings (peek ids) that open as section drawings while the camera is on this place */
  open?: readonly string[]
}

/** A place name pinned to the map; under a lens it also names what drives cost there. */
export interface PlaceLabel {
  key: string
  label: string
  at: V3
  driver: string
  /** ADA / SEBAGIAN / BELUM counts of the data needs here, drawn as a bar under a readiness lens */
  ready?: [number, number, number]
  /** shown only while this lens is on (pins for divisions inside a building, …) */
  lens?: string
}

/** A closed building that opens as a section drawing: a shell that hides the inside, and a cut. */
export interface PeekDef {
  shell: import('three').Group
  cut: import('three').Group
  inside: import('three').Group
  box: [number, number, number, number]
}

/** "Tampilan": the network view, or a building held open as a section drawing. */
export interface ViewDef {
  id: string
  label: string
  /** buildings (peek ids) held open while this view is on */
  open: string[]
  /** the place the camera frames; none frames the whole plate */
  place?: string
}

export interface LensDef {
  id: string
  label: string
  title: string
}

export interface SegDef {
  label: string
  options: [string, string][]
  initial: string
}

export interface Clock {
  day: number
  hour: number
  /** working days in the month the world runs */
  days: number
}

/** What a world's build returns: the live side the shell reads every render. */
export interface WorldRuntime {
  clock(): Clock
  /** the metrics bar for the lens that is on (null: the operation's pulse) */
  metrics(lens: string | null, focus: string): Pulse[]
  onLens?(lens: string | null): void
  onFocus?(focus: string): void
  /** extra handles for window.sim (tests and style frames) */
  debug?: Record<string, unknown>
}

export interface BuildOptions {
  /** start of the visible run (style frames and tests) */
  day?: number
  hour?: number
  seed: number
  reduced: boolean
}

export interface WorldDef {
  id: WorldId
  /** the kicker over the clock: "Simulasi proses · …" */
  kicker: string
  /** the canvas's accessible description */
  ariaLabel: string
  /** the line pinned on the map saying what the figures are (dummy, real, or both) */
  watermark: string[]
  /** how a gap is named on this world's cards and tiles */
  gap: string
  plate: { x0: number; x1: number; y0: number; y1: number }
  places: readonly PlaceDef[]
  labels: PlaceLabel[]
  views: ViewDef[]
  /** a second switch beside Tampilan: Fokus (B2B · B2C · Gabungan), Jalur (RPA · Trading · Keduanya) */
  focus?: SegDef
  lenses: LensDef[]
  /** the stage tracker's stages per channel */
  stages: Record<string, readonly string[]>
  /** what the idle panel invites the viewer to click */
  idle: string
  /** what the stage tracker says while nothing with stages is selected */
  trackerIdle: string
  /** the six accent fills the kernel offers (distribution: the principals' colours) */
  fills: Record<PrincipalFill, string>
  build(scene: YardScene, opts: BuildOptions): WorldRuntime
  /** Mode skenario (Brief B6): the world's scenario, when it has one wired */
  scenario?: AnyScenario
  /** when it has none yet, which step of the brief brings it */
  scenarioLater?: string
}
