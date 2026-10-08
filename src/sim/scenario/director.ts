// Director mode (Brief B6 §3): plays a scenario run on the yard, one step at a time. The camera
// frames the step's place, the plate fades except the places and people involved, the acting
// roles draw in the live colour, and the documents the step moves fly between their places.
// The live world pauses while a scenario plays; the director keeps its own clock (days from the
// scenario start) and its own speed. It only draws what the run computed; it computes nothing.
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { pose } from '../yard/kernel.ts'
import type { PrincipalFill, Tone } from '../yard/kernel.ts'
import { buildCoin, buildEnvelope, buildPallet } from '../yard/models.ts'
import type { YardScene } from '../yard/scene.ts'
import { playable } from './run.ts'
import type { Row, Run, Stage } from './types.ts'

/** 1×, 4×, 16× and Instan (0): no animation, straight to the end or the next pause */
export type Speed = 1 | 4 | 16 | 0
export const SPEEDS: Speed[] = [1, 4, 16, 0]

/** seconds a step plays at 1× */
const STEP_SECONDS = 4.5

interface Token {
  obj: THREE.Group
  from: readonly [number, number]
  to: readonly [number, number]
}

const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export class Director {
  run: Run
  /** index into the playable rows (those that ran, and the one waiting for a value) */
  idx = 0
  /** progress through the current step, 0–1 */
  t = 0
  playing = false
  speed: Speed = 1
  /** the run played to its last step */
  finished = false
  /** counts the finishes, so a closed result card opens again on the next one */
  finishCount = 0
  private tokens: Token[] = []
  private readonly scene: YardScene
  private readonly onChange: () => void
  private readonly reduced: boolean
  private readonly before: { open: Set<string>; paused: boolean }
  private lastDay = -1
  private disposed = false
  private readonly hook = (dt: number): void => this.update(dt)

  constructor(scene: YardScene, run: Run, onChange: () => void, reduced: boolean) {
    this.scene = scene
    this.run = run
    this.onChange = onChange
    this.reduced = reduced
    this.before = { open: new Set(scene.forceOpen), paused: scene.paused }
    scene.select(null)
    scene.setPaused(true)
    scene.frameHooks.add(this.hook)
  }

  get rows(): Row[] {
    return playable(this.run)
  }
  get row(): Row | undefined {
    return this.rows[this.idx]
  }
  /** waiting at a gap for the value to be entered */
  get awaiting(): boolean {
    return this.row?.state === 'paused'
  }
  /** days since the scenario start, as the clock shows them */
  get day(): number {
    const rows = this.rows
    const prev = this.idx > 0 ? (rows[this.idx - 1]?.out?.day ?? 0) : 0
    const here = this.row?.out?.day ?? prev
    return prev + (here - prev) * ease(this.t)
  }

  /** start from the first step (or straight to the end at Instan) */
  start(): void {
    this.finished = false
    if (this.speed === 0) {
      this.toEnd()
      return
    }
    this.enter(0)
    this.playing = !this.awaiting
    this.emit()
  }

  /** a new run of the same scenario (an assumption entered): resume where the director stands */
  setRun(run: Run): void {
    if (run === this.run) return
    this.run = run
    if (this.speed === 0) {
      this.toEnd()
      return
    }
    this.enter(Math.min(this.idx, this.rows.length - 1))
    this.playing = !this.awaiting
    this.emit()
  }

  play(): void {
    if (this.finished) {
      this.start()
      return
    }
    if (this.awaiting) return
    this.playing = true
    this.emit()
  }
  pause(): void {
    this.playing = false
    this.emit()
  }
  next(): void {
    if (this.awaiting) return
    if (this.idx < this.rows.length - 1) this.enter(this.idx + 1)
    else this.finish()
    this.emit()
  }
  prev(): void {
    this.finished = false
    this.enter(Math.max(0, this.idx - 1))
    this.emit()
  }
  /** jump to a step (the result card's links, style frames); t sets how far into it */
  goto(idx: number, t = 0): void {
    this.finished = false
    this.enter(Math.max(0, Math.min(idx, this.rows.length - 1)))
    this.t = this.awaiting ? 0 : t
    this.place()
    this.emit()
  }
  setSpeed(s: Speed): void {
    this.speed = s
    if (s === 0 && !this.finished) this.toEnd()
    this.emit()
  }

  /** back to the live world: the plate, the open buildings and the clock as they were */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.clearTokens()
    this.scene.focus(null)
    this.scene.focusLabels(null)
    this.scene.frameHooks.delete(this.hook)
    this.scene.forceOpen.clear()
    for (const id of this.before.open) this.scene.forceOpen.add(id)
    this.scene.setPaused(this.before.paused)
    this.scene.resetView()
  }

  private emit(): void {
    this.onChange()
  }

  /** straight to the last step that ran (or the pause), without animation */
  toEnd(): void {
    const last = this.rows.length - 1
    this.enter(last, true)
    this.t = 1
    this.place()
    this.playing = false
    if (!this.awaiting) {
      this.finished = true
      this.finishCount++
    }
    this.emit()
  }

  private finish(): void {
    this.t = 1
    this.playing = false
    this.finished = true
    this.finishCount++
    this.place()
  }

  private enter(idx: number, snap = false): void {
    this.idx = idx
    this.t = 0
    this.finished = false
    const row = this.row
    if (!row) return
    this.stage(row.stage, snap || this.reduced)
    if (this.awaiting) this.playing = false
  }

  private stage(st: Stage, snap: boolean): void {
    const s = this.scene
    this.clearTokens()
    s.forceOpen.clear()
    for (const id of st.open ?? []) s.forceOpen.add(id)
    s.focus({ keep: st.keep, live: st.live })
    s.focusLabels(st.labels ?? null)
    const box = st.box ?? (st.place ? s.placeBox(st.place) : null)
    if (box) s.goBox(box, snap)
    for (const f of st.flights ?? []) {
      const obj = f.kind === 'coin' ? buildCoin(s.ink) : f.kind === 'pallet' ? buildPallet(s.ink, (f.fill ?? 'k') as Tone | PrincipalFill, 2, 0.95) : buildEnvelope(s.ink, f.label, 'paper')
      obj.scale.setScalar(f.kind === 'pallet' ? 1.35 : 4)
      obj.name = `skenario-${f.label}`
      // a moving object draws in the live colour, like the acting roles
      obj.traverse((o) => {
        if (o instanceof LineSegments2 && o.userData.line === 'line') o.material = s.ink.line.live
      })
      s.scene.add(obj)
      this.tokens.push({ obj, from: f.from, to: f.to })
    }
    this.place()
  }

  private clearTokens(): void {
    for (const tk of this.tokens) tk.obj.removeFromParent()
    this.tokens = []
  }

  /** put the moving objects where the step's progress says (reduced motion: at their destination) */
  private place(): void {
    const k = this.reduced ? 1 : ease((this.t - 0.15) / 0.7)
    for (const tk of this.tokens) {
      const x = tk.from[0] + (tk.to[0] - tk.from[0]) * k
      const y = tk.from[1] + (tk.to[1] - tk.from[1]) * k
      const h = Math.atan2(tk.to[1] - tk.from[1], tk.to[0] - tk.from[0])
      pose(tk.obj, x, y, h, 6 + Math.sin(k * Math.PI) * 14)
    }
  }

  private update(dt: number): void {
    if (!this.playing || this.awaiting || this.speed === 0) return
    this.t += (dt * this.speed) / STEP_SECONDS
    if (this.t >= 1) {
      if (this.idx < this.rows.length - 1) {
        this.enter(this.idx + 1)
        if (this.awaiting) this.playing = false
        this.emit()
      } else {
        this.finish()
        this.emit()
      }
      return
    }
    this.place()
    const d = Math.floor(this.day)
    if (d !== this.lastDay) {
      this.lastDay = d
      this.emit()
    }
  }
}
