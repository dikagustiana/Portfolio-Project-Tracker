// The iso kernel and drawing parts, ported from Factory Yard (vendor/factory-yard/index.html,
// "iso kernel", "tokens → materials", "parts", "small maths"), which adapts ai-iso-skill
// (MIT, © Tolga Cohce; see NOTICE.md). Scene coordinates are the skill's: +x runs down-right,
// +y down-left, +z up. Three.js is y-up, so W swaps y and z; an orthographic camera looking down
// (-1,-1,-1) then draws exactly the skill's P(x,y,z).
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

export type V3 = [number, number, number]
export type P2 = [number, number]

export const W = (x: number, y: number, z = 0): THREE.Vector3 => new THREE.Vector3(x, z, y)
export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)

/** origin O + in-plane axes U, V: anything drawn in (u, v) through this matrix lies flat on that plane. */
export function plane(O: V3, U: V3, V: V3): THREE.Matrix4 {
  const u = W(...U)
  const v = W(...V)
  const n = new THREE.Vector3().crossVectors(u, v).normalize()
  return new THREE.Matrix4().makeBasis(u, v, n).setPosition(W(...O))
}
/** z = const */
export const TOP = (x: number, y: number, z: number): THREE.Matrix4 => plane([x, y, z], [1, 0, 0], [0, 1, 0])
/** y = const, faces lower-left; pass its top-left corner */
export const FRONT = (x: number, y: number, z: number): THREE.Matrix4 => plane([x, y, z], [1, 0, 0], [0, 0, -1])
/** x = const, faces lower-right; pass its top-left corner */
export const SIDE = (x: number, y: number, z: number): THREE.Matrix4 => plane([x, y, z], [0, -1, 0], [0, 0, -1])

// ---- tokens → materials --------------------------------------------------------------------

/** Face fills. Every one is a CSS custom property on the scene root, except the principal fills,
 *  which come from the engine's principal colours (core/colors.ts). */
export const FILL_TOK = {
  ground: '--y-ground', road: '--y-road', body: '--y-body', deck: '--y-deck', kob: '--y-ko', kod: '--y-ko-deck',
  glass: '--y-glass', livef: '--y-live', window: '--y-glass', lamp: '--y-deck', grass: '--y-grass', water: '--y-water',
  paper: '--y-paper', ok: '--y-ok', warn: '--y-warn', bad: '--y-bad',
} as const
export const LINE_TOK = { line: '--y-line', detail: '--y-detail', koline: '--y-ko-line', live: '--y-live', okl: '--y-ok', warnl: '--y-warn', badl: '--y-bad' } as const
export const TEXT_TOK = { ink: '--y-ink', paint: '--y-line', hi: '--y-ink-hi' } as const
export type FillKey = keyof typeof FILL_TOK | PrincipalFill
export type LineKey = keyof typeof LINE_TOK
export type TextKey = keyof typeof TEXT_TOK
export type PrincipalFill = 'pA' | 'pB' | 'pC' | 'pD' | 'pE' | 'pF'

/** Night is one palette for both themes: the day colours slide toward it after dusk. */
const NIGHT = {
  fill: {
    ground: '#0f151c', road: '#0b1016', body: '#121921', deck: '#151d26', kob: '#7d8fa1', kod: '#8b9cad', glass: '#0a0f14', livef: '#7fd3e6',
    window: '#e6eef4', lamp: '#f2f6f9', grass: '#0e1519', water: '#0b1218', paper: '#c9d3dc', ok: '#4f9a7c', warn: '#c08a36', bad: '#b65645',
  } as Record<keyof typeof FILL_TOK, string>,
  line: { line: '#35424f', detail: '#202a34', koline: '#3c4a58', live: '#7fd3e6', okl: '#4f9a7c', warnl: '#c08a36', badl: '#b65645' } as Record<LineKey, string>,
  text: { ink: '#6d7c8b', paint: '#35424f', hi: '#c9d4de' } as Record<TextKey, string>,
}

const TEX_PX = 64
export const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace'

/** The materials of one mounted scene: flat unlit fills, 1 px hairlines, tinted text. */
export class Ink {
  readonly fill = {} as Record<FillKey, THREE.MeshBasicMaterial>
  readonly line = {} as Record<LineKey, LineMaterial>
  readonly text: Record<TextKey, THREE.MeshBasicMaterial[]> = { ink: [], paint: [], hi: [] }
  private day = { fill: {} as Record<string, THREE.Color>, line: {} as Record<string, THREE.Color>, text: {} as Record<string, THREE.Color> }
  private night = { fill: {} as Record<string, THREE.Color>, line: {} as Record<string, THREE.Color>, text: {} as Record<string, THREE.Color> }
  private glyphs = new Map<string, THREE.CanvasTexture>()
  /** faded copies of materials, for whatever a scenario's director dims (Brief B6 §3) */
  private dims = new Map<THREE.Material, THREE.Material>()
  dusk = 0
  readonly root: HTMLElement
  readonly anisotropy: number
  private readonly principal: Record<PrincipalFill, string>

  constructor(root: HTMLElement, anisotropy: number, principal: Record<PrincipalFill, string>) {
    this.root = root
    this.anisotropy = anisotropy
    this.principal = principal
    // Faces are flat and unlit, pushed back a hair so the hairlines drawn on them always win the depth test.
    const keys = [...Object.keys(FILL_TOK), ...Object.keys(principal)] as FillKey[]
    for (const k of keys) this.fill[k] = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    // 1 css px at any zoom: the WebGL stand-in for vector-effect:non-scaling-stroke.
    for (const k of Object.keys(LINE_TOK) as LineKey[]) this.line[k] = new LineMaterial({ linewidth: 1, worldUnits: false })
    for (const g of ['fill', 'line', 'text'] as const) for (const [k, c] of Object.entries(NIGHT[g])) this.night[g][k] = new THREE.Color(c)
    // principal colours dim toward the night ground rather than to one shared hue
    for (const [k, c] of Object.entries(principal)) this.night.fill[k] = new THREE.Color(c).lerp(new THREE.Color('#0f151c'), 0.35)
    this.applyTheme()
  }

  private css(n: string): string {
    return getComputedStyle(this.root).getPropertyValue(n).trim() || '#888888'
  }

  applyTheme(): void {
    for (const [k, t] of Object.entries(FILL_TOK)) this.day.fill[k] = new THREE.Color(this.css(t))
    for (const [k, c] of Object.entries(this.principal)) this.day.fill[k] = new THREE.Color(c)
    for (const [k, t] of Object.entries(LINE_TOK)) this.day.line[k] = new THREE.Color(this.css(t))
    for (const [k, t] of Object.entries(TEXT_TOK)) this.day.text[k] = new THREE.Color(this.css(t))
    this.shade(this.dusk, true)
  }

  /** 0 is full day, 1 full night; windows and lamps come on early in the dusk and go off late in the dawn. */
  shade(n: number, force = false): void {
    if (!force && Math.abs(n - this.dusk) < 0.002) return
    this.dusk = n
    const lit = Math.min(1, n * 1.8)
    for (const [k, m] of Object.entries(this.fill)) {
      const d = this.day.fill[k]
      const nc = this.night.fill[k]
      if (d && nc) m.color.copy(d).lerp(nc, k === 'window' || k === 'lamp' ? lit : n)
    }
    for (const [k, m] of Object.entries(this.line)) {
      const d = this.day.line[k]
      const nc = this.night.line[k]
      if (d && nc) m.color.copy(d).lerp(nc, n)
    }
    for (const [k, ms] of Object.entries(this.text)) {
      const d = this.day.text[k]
      const nc = this.night.text[k]
      if (!d || !nc) continue
      const c = d.clone().lerp(nc, n)
      for (const m of ms) m.color.copy(c)
    }
    this.refreshDims()
  }

  /** a faded copy of a material that follows it through theme and dusk changes */
  dimOf(m: THREE.Material): THREE.Material {
    const hit = this.dims.get(m)
    if (hit) return hit
    const d = m.clone()
    this.dims.set(m, d)
    this.refreshDims()
    return d
  }

  private refreshDims(): void {
    const bg = this.fill.ground?.color
    if (!bg) return
    for (const [m, d] of this.dims) {
      const src = m as THREE.Material & { color?: THREE.Color }
      const dst = d as THREE.Material & { color?: THREE.Color }
      if (src.color && dst.color) dst.color.copy(src.color).lerp(bg, m instanceof LineMaterial ? 0.68 : 0.72)
      if (m instanceof LineMaterial && d instanceof LineMaterial) d.resolution.copy(m.resolution)
    }
  }

  setResolution(w: number, h: number): void {
    for (const m of Object.values(this.line)) m.resolution.set(w, h)
    this.refreshDims()
  }

  /** a white glyph texture for a string, shared by every text that says the same thing */
  glyph(str: string): THREE.CanvasTexture {
    const hit = this.glyphs.get(str)
    if (hit) return hit
    const font = `500 ${TEX_PX}px ${MONO}`
    const c = document.createElement('canvas')
    const g = c.getContext('2d')
    if (!g) throw new Error('2D canvas unavailable')
    g.font = font
    c.width = Math.ceil(g.measureText(str).width) + 8
    c.height = Math.round(TEX_PX * 1.25)
    g.font = font
    g.fillStyle = '#fff'
    g.fillText(str, 4, TEX_PX * 0.95)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.anisotropy
    this.glyphs.set(str, tex)
    return tex
  }

  textMaterial(k: TextKey, tex: THREE.Texture): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const d = this.day.text[k]
    const nc = this.night.text[k]
    if (d && nc) m.color.copy(d).lerp(nc, this.dusk)
    this.text[k].push(m)
    return m
  }

  dispose(): void {
    for (const m of Object.values(this.fill)) m.dispose()
    for (const m of Object.values(this.line)) m.dispose()
    for (const ms of Object.values(this.text)) for (const m of ms) m.dispose()
    for (const t of this.glyphs.values()) t.dispose()
    this.glyphs.clear()
    for (const d of this.dims.values()) d.dispose()
    this.dims.clear()
  }
}

// ---- parts: boxes and flat detail, collected into a few draw calls --------------------------

const noop = (): void => {}
type Tone = 'n' | 'k' | 'g' | 'gr' | 'gs' | 'l' | 'w' | PrincipalFill | 'paper' | 'ok' | 'warn' | 'bad' | 'live'
const TONE: Record<Tone, [FillKey, FillKey, LineKey]> = {
  n: ['body', 'deck', 'line'], k: ['kob', 'kod', 'koline'], g: ['glass', 'glass', 'line'], gr: ['body', 'ground', 'line'], gs: ['body', 'grass', 'line'],
  l: ['lamp', 'lamp', 'line'], w: ['window', 'window', 'line'], paper: ['paper', 'paper', 'line'],
  ok: ['ok', 'ok', 'line'], warn: ['warn', 'warn', 'line'], bad: ['bad', 'bad', 'line'], live: ['livef', 'livef', 'line'],
  pA: ['pA', 'pA', 'koline'], pB: ['pB', 'pB', 'koline'], pC: ['pC', 'pC', 'koline'], pD: ['pD', 'pD', 'koline'], pE: ['pE', 'pE', 'koline'], pF: ['pF', 'pF', 'koline'],
}
export type { Tone }

interface TextSpec {
  M: THREE.Matrix4
  str: string
  x: number
  y: number
  size: number
  k: TextKey
  anchor: 'start' | 'middle' | 'end'
  lift: number
}

/** Accumulates faces, hairlines and flat text, then builds them into a handful of meshes. */
export class Part {
  private readonly ink: Ink
  private readonly fills: Partial<Record<FillKey, number[]>> = {}
  private readonly lines: Partial<Record<LineKey, number[]>> = {}
  private readonly texts: TextSpec[] = []

  constructor(ink: Ink) {
    this.ink = ink
  }

  tri(k: FillKey, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): this {
    ;(this.fills[k] ??= []).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    return this
  }
  poly(k: FillKey, p: THREE.Vector3[]): this {
    const o = p[0]
    if (!o) return this
    for (let i = 1; i < p.length - 1; i++) this.tri(k, o, p[i] as THREE.Vector3, p[i + 1] as THREE.Vector3)
    return this
  }
  seg(k: LineKey, a: THREE.Vector3, b: THREE.Vector3): this {
    ;(this.lines[k] ??= []).push(a.x, a.y, a.z, b.x, b.y, b.z)
    return this
  }
  /** A flat polygon swept along e. Faces are turned to point away from the solid's middle; up-facing ones take the
   *  deck fill, and only those steeper than 35° downward are left out, since the camera never sees them. */
  extrude(pts: V3[], e: V3, tone: Tone = 'n', { seams = true, lines = true } = {}): this {
    const [bodyK, deckK, lineK] = TONE[tone]
    const A = pts.map((p) => W(...p))
    const E = W(...e)
    const B = A.map((p) => p.clone().add(E))
    const mid = [...A, ...B].reduce((s, p) => s.add(p), v3(0, 0, 0)).multiplyScalar(1 / (A.length * 2))
    const face = (q: THREE.Vector3[]): void => {
      const [q0, q1, q2] = q as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
      const n = v3(0, 0, 0).crossVectors(q1.clone().sub(q0), q2.clone().sub(q0)).normalize()
      if (n.dot(q.reduce((s, p) => s.add(p), v3(0, 0, 0)).multiplyScalar(1 / q.length).sub(mid)) < 0) n.negate()
      if (n.y < -0.82) return
      this.poly(n.y > 0.6 ? deckK : bodyK, q)
    }
    face(A)
    face(B)
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length
      face([A[i], A[j], B[j], B[i]] as THREE.Vector3[])
    }
    if (lines)
      for (let i = 0; i < A.length; i++) {
        const j = (i + 1) % A.length
        this.seg(lineK, A[i] as THREE.Vector3, A[j] as THREE.Vector3)
        this.seg(lineK, B[i] as THREE.Vector3, B[j] as THREE.Vector3)
        if (seams) this.seg(lineK, A[i] as THREE.Vector3, B[i] as THREE.Vector3)
      }
    return this
  }
  /** box at (x,y,z), size w along x, d along y, h along z — same signature as the skill's box() */
  box(x: number, y: number, z: number, w: number, d: number, h: number, tone: Tone = 'n', o?: { seams?: boolean; lines?: boolean }): this {
    return this.extrude([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], [0, 0, h], tone, o)
  }
  cylZ(cx: number, cy: number, z: number, r: number, h: number, n = 12, tone: Tone = 'n'): this {
    const p: V3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z])
    }
    return this.extrude(p, [0, 0, h], tone, { seams: false })
  }
  cylY(cx: number, y: number, cz: number, r: number, len: number, n = 10, tone: Tone = 'n'): this {
    const p: V3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      p.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)])
    }
    return this.extrude(p, [0, len, 0], tone, { seams: false })
  }
  /** 2D linework in a face's local units, like drawing inside the skill's <g transform="${FRONT(…)}">.
   *  lift nudges it off the face along the outward normal (negative for faces whose normal points out). */
  draw(M: THREE.Matrix4, segs: number[], k: LineKey = 'detail', lift = 0.04): this {
    const off = v3(0, 0, 0).setFromMatrixColumn(M, 2).normalize().multiplyScalar(-lift)
    const at = (u: number, v: number): THREE.Vector3 => v3(u, v, 0).applyMatrix4(M).add(off)
    for (let i = 0; i + 3 < segs.length; i += 4) this.seg(k, at(segs[i] as number, segs[i + 1] as number), at(segs[i + 2] as number, segs[i + 3] as number))
    return this
  }
  rect2(M: THREE.Matrix4, x: number, y: number, w: number, h: number, k: LineKey = 'detail', lift?: number): this {
    return this.draw(M, [x, y, x + w, y, x + w, y, x + w, y + h, x + w, y + h, x, y + h, x, y + h, x, y], k, lift)
  }
  fill2(M: THREE.Matrix4, x: number, y: number, w: number, h: number, k: FillKey = 'glass', lift = 0.03): this {
    const off = v3(0, 0, 0).setFromMatrixColumn(M, 2).normalize().multiplyScalar(-lift)
    const at = (u: number, v: number): THREE.Vector3 => v3(u, v, 0).applyMatrix4(M).add(off)
    return this.poly(k, [at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)])
  }
  text(M: THREE.Matrix4, str: string, x: number, y: number, size: number, k: TextKey = 'ink', anchor: TextSpec['anchor'] = 'start', lift = 0.035): this {
    this.texts.push({ M, str, x, y, size, k, anchor, lift })
    return this
  }
  /** any three.js geometry, flat-filled by facet direction, every facet edge a hairline */
  geo(g0: THREE.BufferGeometry, m: THREE.Matrix4, tone: Tone = 'n'): this {
    const [bodyK, deckK, lineK] = TONE[tone]
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(m)
    const p = g.getAttribute('position')
    const a = v3(0, 0, 0)
    const b = v3(0, 0, 0)
    const c = v3(0, 0, 0)
    const n = v3(0, 0, 0)
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i)
      b.fromBufferAttribute(p, i + 1)
      c.fromBufferAttribute(p, i + 2)
      n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
      if (n.y > -0.82) this.tri(n.y > 0.45 ? deckK : bodyK, a, b, c)
    }
    const eg = new THREE.EdgesGeometry(g)
    const e = eg.getAttribute('position')
    for (let i = 0; i < e.count; i += 2) this.seg(lineK, a.fromBufferAttribute(e, i).clone(), b.fromBufferAttribute(e, i + 1).clone())
    eg.dispose()
    g.dispose()
    return this
  }
  build(name?: string): THREE.Group {
    const g = new THREE.Group()
    if (name) g.name = name
    for (const [k, arr] of Object.entries(this.fills) as [FillKey, number[]][]) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      const m = new THREE.Mesh(geo, this.ink.fill[k])
      m.userData.fill = k
      g.add(m)
    }
    for (const [k, arr] of Object.entries(this.lines) as [LineKey, number[]][]) {
      const l = new LineSegments2(new LineSegmentsGeometry().setPositions(arr), this.ink.line[k])
      l.userData.line = k
      l.raycast = noop
      g.add(l)
    }
    for (const t of this.texts) g.add(this.textMesh(t))
    return g
  }
  /** Text drawn flat on a plane: a canvas glyph texture (white) tinted by its token colour. */
  private textMesh({ M, str, x, y, size, k, anchor, lift }: TextSpec): THREE.Mesh {
    const tex = this.ink.glyph(str)
    const img = tex.image
    const s = size / TEX_PX
    const w = img.width * s
    const h = img.height * s
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x - 4 * s
    const top = y - TEX_PX * 0.95 * s
    const geo = new THREE.PlaneGeometry(w, h).scale(1, -1, 1).translate(x0 + w / 2, top + h / 2, 0).applyMatrix4(M)
    const off = v3(0, 0, 0).setFromMatrixColumn(M, 2).normalize().multiplyScalar(-lift)
    geo.translate(off.x, off.y, off.z)
    const mesh = new THREE.Mesh(geo, this.ink.textMaterial(k, tex))
    mesh.raycast = noop
    return mesh
  }
}

/** place a group at (x, y) heading h, raised z */
export function pose(o: THREE.Object3D, x: number, y: number, h = 0, z = 0): void {
  o.position.set(x, z, y)
  o.rotation.y = -h
}

/** light a part up: its faces take the live colour (LineSegments2 is also a Mesh, so go by the fill key) */
export function glow(g: THREE.Object3D, ink: Ink, on: boolean): void {
  for (const m of g.children) {
    const k = m.userData.fill as FillKey | undefined
    if (k && m instanceof THREE.Mesh) m.material = on ? ink.fill.livef : ink.fill[k]
  }
}

/** hairline ring at height z */
export function ring(cx: number, cy: number, r: number, z: number, n = 40): THREE.Vector3[] {
  const s: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const b = ((i + 1) / n) * Math.PI * 2
    s.push(W(cx + r * Math.cos(a), cy + r * Math.sin(a), z), W(cx + r * Math.cos(b), cy + r * Math.sin(b), z))
  }
  return s
}

// ---- small maths ----------------------------------------------------------------------------

/** Factory Yard's seeded generator: a given seed always plays out the same way. */
export function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
export const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))
export const ease = (t: number): number => t * t * (3 - 2 * t)

interface LineSeg {
  t: 'L'
  s: number
  len: number
  ax: number
  ay: number
  h: number
}
interface ArcSeg {
  t: 'A'
  s: number
  len: number
  cx: number
  cy: number
  r: number
  a0: number
  da: number
}
export interface PathPoint {
  x: number
  y: number
  h: number
}

/** A polyline with filleted corners, walked by arc length. at(s) extrapolates past both ends, or wraps
 *  round when the path is a closed loop (start it in the middle of a straight). */
export class Path {
  readonly closed: boolean
  readonly segs: (LineSeg | ArcSeg)[] = []
  readonly length: number
  readonly pts: P2[]

  constructor(pts: P2[], r = 6, closed = false) {
    this.closed = closed
    this.pts = pts
    let cur = pts[0] as P2
    let s = 0
    const line = (a: P2, b: P2): void => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 1e-6) return
      this.segs.push({ t: 'L', s, len, ax: a[0], ay: a[1], h: Math.atan2(b[1] - a[1], b[0] - a[0]) })
      s += len
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as P2
      const b = pts[i] as P2
      const c = pts[i + 1]
      if (!c) {
        line(cur, b)
        break
      }
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1])
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1])
      const d1x = (b[0] - a[0]) / l1
      const d1y = (b[1] - a[1]) / l1
      const d2x = (c[0] - b[0]) / l2
      const d2y = (c[1] - b[1]) / l2
      const turn = Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y)
      if (Math.abs(turn) < 1e-4) continue
      const tanH = Math.tan(Math.abs(turn) / 2)
      const t = Math.min(r * tanH, Math.hypot(b[0] - cur[0], b[1] - cur[1]), l2 / 2)
      const rr = t / tanH
      const p1: P2 = [b[0] - d1x * t, b[1] - d1y * t]
      const sg = Math.sign(turn)
      line(cur, p1)
      const cx = p1[0] - d1y * rr * sg
      const cy = p1[1] + d1x * rr * sg
      this.segs.push({ t: 'A', s, len: rr * Math.abs(turn), cx, cy, r: rr, a0: Math.atan2(p1[1] - cy, p1[0] - cx), da: turn })
      s += rr * Math.abs(turn)
      cur = [b[0] + d2x * t, b[1] + d2y * t]
    }
    this.length = s
  }
  private on(g: LineSeg | ArcSeg, d: number): PathPoint {
    if (g.t === 'L') return { x: g.ax + Math.cos(g.h) * d, y: g.ay + Math.sin(g.h) * d, h: g.h }
    const a = g.a0 + g.da * (d / g.len)
    return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a), h: a + (Math.sign(g.da) * Math.PI) / 2 }
  }
  at(s0: number): PathPoint {
    const S = this.segs
    const first = S[0]
    const last = S[S.length - 1]
    if (!first || !last) {
      const p = this.pts[0] ?? [0, 0]
      return { x: p[0], y: p[1], h: 0 }
    }
    let s = s0
    if (this.closed) s = ((s % this.length) + this.length) % this.length
    if (s <= 0) {
      const p = this.on(first, 0)
      return { x: p.x + Math.cos(p.h) * s, y: p.y + Math.sin(p.h) * s, h: p.h }
    }
    if (s >= this.length) {
      const p = this.on(last, last.len)
      const e = s - this.length
      return { x: p.x + Math.cos(p.h) * e, y: p.y + Math.sin(p.h) * e, h: p.h }
    }
    for (const g of S) if (s <= g.s + g.len) return this.on(g, s - g.s)
    return this.on(last, last.len)
  }
  /** the arc length nearest to (x, y) */
  project(x: number, y: number): number {
    const d = (s: number): number => {
      const p = this.at(s)
      return Math.hypot(p.x - x, p.y - y)
    }
    let best = 0
    for (let s = 0; s <= this.length; s += 0.5) if (d(s) < d(best)) best = s
    for (let s = best - 0.5; s <= best + 0.5; s += 0.02) if (s >= 0 && s <= this.length && d(s) < d(best)) best = s
    return best
  }
}
