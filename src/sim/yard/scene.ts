// The yard scene: an imperative three.js world in its own canvas, mounted by YardShell.tsx and
// shared by every world (Brief B5 §2). Camera, controls, picking, tags, the dashed route of a
// selected vehicle, the section drawings and the frame loop are Factory Yard's
// (vendor/factory-yard/index.html, "camera & controls", "selection, tags, card", "loop"); what
// stands on the plate is the world's (src/sim/worlds/<world>/yard/).
// The simulation runs on Factory Yard's fixed 1/60 s step, so a given seed plays out the same way.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { Ink, Path, W, clamp, ring, v3 } from './kernel.ts'
import type { P2, PrincipalFill, V3 } from './kernel.ts'
import type { Card, PeekDef, PlaceDef, PlaceLabel } from './types.ts'

export interface RouteInfo {
  path: Path
  s: number
  closed: boolean
  next?: P2
  stop?: string
}

/** Anything you can click: a name, a card, and optionally a route. */
export interface Entity {
  id: string
  kind: string
  groups: THREE.Object3D[]
  /** a local point on groups[0] for tags and screenOf */
  pick?: V3
  /** buildings and other things that never move cannot be followed */
  still?: boolean
  card(): Card
  route?(): RouteInfo | null
}

export interface SceneOptions {
  seed: number
  debug: boolean
  reduced: boolean
  /** called whenever selection, follow, view or open buildings change */
  onChange: () => void
  /** the world's plate: anything outside it is cut */
  plate: { x0: number; x1: number; y0: number; y1: number }
  places: readonly PlaceDef[]
  ariaLabel: string
  /** the six accent fills (distribution: the principals' colours) */
  fills: Record<PrincipalFill, string>
}

/** The Tampilan switch: the network, or the id of a view that holds buildings open. */
export type ViewMode = string

const STEP = 1 / 60
const noop = (): void => {}

export class YardScene {
  readonly root: HTMLElement
  readonly stage: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000)
  readonly controls: OrbitControls
  readonly ink: Ink
  readonly entities: Entity[] = []
  readonly peeks: { id: string; peek: PeekDef }[] = []
  readonly opts: SceneOptions
  /** fixed-step update hooks (the actors register theirs) */
  readonly tickers: ((dt: number, t: number) => void)[] = []
  /** per-frame hooks on real time, run while the world is paused too (a scenario's director) */
  readonly frameHooks = new Set<(dt: number) => void>()
  t = 0
  paused = false
  speed = 1
  selected: Entity | null = null
  hovered: Entity | null = null
  follow = false
  view: ViewMode = 'jaringan'
  /** the lens that is on, if any (it shows the drivers under the place names) */
  lens: string | null = null
  /** buildings held open by the view or the caller, whatever is selected */
  forceOpen = new Set<string>()
  /** 0 by day, 1 by night */
  night = 0
  readonly plate: SceneOptions['plate']
  readonly places: readonly PlaceDef[]
  private readonly ISO = v3(1, 1, 1).normalize()
  private readonly CENTER: THREE.Vector3
  private fitZoom = 1
  private HOME: THREE.Vector3
  private goal: { zoom: number; target?: THREE.Vector3 } | null = null
  private sized = false
  private raf = 0
  private last = performance.now()
  private acc = 0
  private cardT = 0
  private routeNext: { p: THREE.Vector3; stop?: string } | null = null
  private readonly retLine: LineSegments2
  private readonly routeLine: LineSegments2
  private readonly tagSel: HTMLElement
  private readonly tagHover: HTMLElement
  private readonly tagStop: HTMLElement
  private readonly ro: ResizeObserver
  private readonly themeWatch: MutationObserver
  private readonly scheme: MediaQueryList
  private readonly ray = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly box = new THREE.Box3()
  private down: { x: number; y: number; t: number } | null = null
  private pointer: [number, number] | null = null
  private hoverDirty = false
  private disposed = false
  private readonly listeners: [EventTarget, string, EventListener][] = []
  private labels: { def: PlaceLabel; el: HTMLElement }[] = []
  /** objects a director has faded, and the entities it drew live */
  private faded: THREE.Mesh[] = []
  private lit: Entity[] = []

  constructor(root: HTMLElement, stage: HTMLElement, opts: SceneOptions) {
    this.root = root
    this.stage = stage
    this.opts = opts
    this.plate = opts.plate
    this.places = opts.places
    const PLATE = opts.plate
    this.CENTER = W((PLATE.x0 + PLATE.x1) / 2, (PLATE.y0 + PLATE.y1) / 2, 0)
    this.HOME = this.CENTER.clone()
    this.canvas = document.createElement('canvas')
    this.canvas.tabIndex = 0
    this.canvas.className = 'y-canvas'
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute('aria-label', opts.ariaLabel)
    stage.prepend(this.canvas)
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    // anything outside the plate is cut, so traffic slides in and out of its edge
    this.renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -PLATE.x0 + 0.05), new THREE.Plane(new THREE.Vector3(-1, 0, 0), PLATE.x1 + 0.05),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLATE.y0 + 0.05), new THREE.Plane(new THREE.Vector3(0, 0, -1), PLATE.y1 + 0.05),
    ]
    this.ink = new Ink(root, this.renderer.capabilities.getMaxAnisotropy(), opts.fills)

    this.camera.position.copy(this.CENTER).addScaledVector(this.ISO, 1500)
    this.camera.lookAt(this.CENTER)
    this.controls = new OrbitControls(this.camera, this.canvas)
    Object.assign(this.controls, { enableRotate: false, screenSpacePanning: true, zoomToCursor: true, enableDamping: !opts.reduced, dampingFactor: 0.12 })
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls.target.copy(this.CENTER)

    const overlay = (): LineSegments2 => {
      const l = new LineSegments2(new LineSegmentsGeometry(), this.ink.line.live)
      l.raycast = noop
      l.frustumCulled = false
      l.visible = false
      this.scene.add(l)
      return l
    }
    this.retLine = overlay()
    this.routeLine = overlay()
    const tag = (cls: string): HTMLElement => {
      const el = document.createElement('div')
      el.className = `y-tag ${cls}`
      el.hidden = true
      stage.append(el)
      return el
    }
    this.tagHover = tag('hover')
    this.tagSel = tag('sel')
    this.tagStop = tag('stop')

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(stage)
    this.scheme = matchMedia('(prefers-color-scheme: light)')
    const reTheme = (): void => this.ink.applyTheme()
    this.listen(this.scheme, 'change', reTheme)
    // the board switches its own theme on <html data-theme>; follow it
    this.themeWatch = new MutationObserver(reTheme)
    this.themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    this.listen(this.canvas, 'wheel', () => {
      this.goal = null
    })
    this.listen(this.canvas, 'pointerdown', (e) => {
      const p = e as PointerEvent
      this.down = { x: p.clientX, y: p.clientY, t: performance.now() }
    })
    this.listen(this.canvas, 'pointerup', (e) => {
      const p = e as PointerEvent
      if (this.down && Math.hypot(p.clientX - this.down.x, p.clientY - this.down.y) < 6 && performance.now() - this.down.t < 700) this.select(this.hit(p.clientX, p.clientY))
      this.down = null
    })
    this.listen(this.canvas, 'pointermove', (e) => {
      const p = e as PointerEvent
      if (this.down && Math.hypot(p.clientX - this.down.x, p.clientY - this.down.y) >= 6) {
        this.goal = null
        this.setFollow(false)
      }
      if (p.pointerType === 'mouse' && !p.buttons) {
        this.pointer = [p.clientX, p.clientY]
        this.hoverDirty = true
      }
    })
    this.listen(this.canvas, 'pointerleave', () => {
      this.pointer = null
      this.hovered = null
      this.canvas.classList.remove('over')
    })
    this.controls.listenToKeyEvents(this.canvas)
  }

  private listen(t: EventTarget, type: string, fn: EventListener): void {
    t.addEventListener(type, fn, type === 'wheel' ? { passive: true } : undefined)
    this.listeners.push([t, type, fn])
  }

  add(e: Entity): Entity {
    for (const g of e.groups) {
      g.userData.entity = e
      if (!g.parent) this.scene.add(g)
    }
    this.entities.push(e)
    return e
  }

  addPeek(id: string, peek: PeekDef): void {
    this.peeks.push({ id, peek })
  }

  setLabels(defs: PlaceLabel[]): void {
    for (const l of this.labels) l.el.remove()
    this.labels = defs.map((def) => {
      const el = document.createElement('div')
      el.className = `y-place${def.lens ? ' y-only' : ''}`
      if (def.lens) el.dataset.lens = def.lens
      // the key and the name apart, so a narrow map can show the key alone
      const name = document.createElement('b')
      const key = document.createElement('i')
      key.textContent = def.key
      const nm = document.createElement('em')
      nm.textContent = def.key ? ` · ${def.label}` : def.label
      if (def.key) name.append(key)
      name.append(nm)
      const drv = document.createElement('span')
      drv.textContent = def.driver
      el.append(name, drv)
      if (def.ready) {
        // the readiness bar: ADA, SEBAGIAN, BELUM in proportion, with their counts
        const bar = document.createElement('i')
        bar.className = 'y-ready'
        bar.title = `ADA ${def.ready[0]} · SEBAGIAN ${def.ready[1]} · BELUM ${def.ready[2]}`
        ;(['r-ada', 'r-seb', 'r-bel'] as const).forEach((tone, k) => {
          const n = def.ready?.[k] ?? 0
          if (!n) return
          const seg = document.createElement('em')
          seg.className = tone
          seg.style.flexGrow = String(n)
          seg.textContent = String(n)
          bar.append(seg)
        })
        el.append(bar)
      }
      this.stage.append(el)
      return { def, el }
    })
  }
  setLens(id: string | null): void {
    this.lens = id
    this.stage.classList.toggle('lens', !!id)
    if (id) this.stage.dataset.lens = id
    else delete this.stage.dataset.lens
  }
  /** Pins each place name over its spot; where two would overlap, the later one (by key order)
   *  steps back until there is room, so zoomed out or on a phone the names stay legible. */
  private placeLabels(): void {
    const w = this.stage.clientWidth
    const h = this.stage.clientHeight
    this.stage.classList.toggle('narrow', w < 560)
    const taken: [number, number, number, number][] = []
    for (const { def, el } of this.labels) {
      const at = this.screenAt(W(...def.at))
      const y = at[1]
      let x = at[0]
      let hide = x < -40 || x > w + 40 || y < -20 || y > h + 40 || (!!def.lens && def.lens !== this.lens)
      if (!hide) {
        el.hidden = false
        const bw = el.offsetWidth
        const bh = el.offsetHeight
        // kept inside the map; over its spot if there is room, else nudged above or below it, else stepped back
        x = Math.max(bw / 2 + 4, Math.min(w - bw / 2 - 4, x))
        const dy = [0, -(bh + 2), bh + 2, -2 * (bh + 2), 2 * (bh + 2)].find((d) => {
          const r = [x - bw / 2, y + d - bh, x + bw / 2, y + d]
          return !taken.some(([a, b, c, e]) => (r[0] ?? 0) < c && (r[2] ?? 0) > a && (r[1] ?? 0) < e && (r[3] ?? 0) > b)
        })
        hide = dy === undefined
        if (dy !== undefined) {
          taken.push([x - bw / 2, y + dy - bh, x + bw / 2, y + dy])
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + dy)}px) translate(-50%, -100%)`
        }
      }
      el.hidden = hide
    }
  }

  find(id: string): Entity | undefined {
    return this.entities.find((e) => e.id === id)
  }

  // ---- camera ----------------------------------------------------------------------------------

  /** the zoom and ground target that frame a box of the world (z0..z1 high) in a w × h view */
  private frame(w: number, h: number, [x0, x1, y0, y1]: readonly number[], [z0, z1] = [0, 12]): { zoom: number; target: THREE.Vector3 } {
    this.camera.updateMatrixWorld()
    const inv = this.camera.matrixWorldInverse
    const b = new THREE.Box3()
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) b.expandByPoint(W(x as number, y as number, z).applyMatrix4(inv))
    const c = b.getCenter(v3(0, 0, 0)).applyMatrix4(this.camera.matrixWorld)
    return { zoom: Math.min(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y)) * 0.94, target: c.addScaledVector(this.ISO, -c.y / this.ISO.y) }
  }

  resize(): void {
    const w = this.stage.clientWidth
    const h = this.stage.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 })
    const PLATE = this.plate
    const f = this.frame(w, h, [PLATE.x0, PLATE.x1, PLATE.y0, PLATE.y1], [-4, 16])
    this.fitZoom = f.zoom
    this.HOME = f.target
    this.controls.minZoom = this.fitZoom * 0.6
    this.controls.maxZoom = this.fitZoom * 30
    if (!this.sized) {
      this.sized = true
      this.camera.zoom = f.zoom
      this.moveTarget(f.target)
    }
    this.camera.zoom = clamp(this.camera.zoom, this.controls.minZoom, this.controls.maxZoom)
    this.camera.updateProjectionMatrix()
    this.ink.setResolution(w, h)
  }

  private moveTarget(to: THREE.Vector3): void {
    const d = to.clone().sub(this.controls.target)
    this.controls.target.add(d)
    this.camera.position.add(d)
  }

  zoomBy(k: number): void {
    this.goal = { zoom: clamp((this.goal?.zoom ?? this.camera.zoom) * k, this.controls.minZoom, this.controls.maxZoom), target: this.goal?.target }
  }
  resetView(): void {
    this.setFollow(false)
    this.goal = { zoom: this.fitZoom, target: this.HOME.clone() }
    this.emit()
  }
  goPlace(id: string): void {
    const p = this.places.find((x) => x.id === id)
    if (!p) return
    this.setFollow(false)
    this.goal = this.frame(this.stage.clientWidth, this.stage.clientHeight, p.box)
    this.emit()
  }
  /** jump without easing (debug hook, style frames) */
  snapPlace(id: string): void {
    const p = this.places.find((x) => x.id === id)
    const f = p ? this.frame(this.stage.clientWidth, this.stage.clientHeight, p.box) : { zoom: this.fitZoom, target: this.HOME }
    this.goal = null
    this.moveTarget(f.target)
    this.camera.zoom = f.zoom
    this.camera.updateProjectionMatrix()
  }
  /** frame a box of the plate [x0, x1, y0, y1], eased, or at once */
  goBox(box: readonly [number, number, number, number], snap = false): void {
    this.setFollow(false)
    const f = this.frame(this.stage.clientWidth, this.stage.clientHeight, box)
    if (!snap) {
      this.goal = f
      return
    }
    this.goal = null
    this.moveTarget(f.target)
    this.camera.zoom = clamp(f.zoom, this.controls.minZoom, this.controls.maxZoom)
    this.camera.updateProjectionMatrix()
  }
  /** the box a place frames */
  placeBox(id: string): readonly [number, number, number, number] | null {
    return this.places.find((x) => x.id === id)?.box ?? null
  }
  /** which place the camera is over, when zoomed in */
  currentPlace(): string | null {
    const t = this.controls.target
    if (this.camera.zoom < this.fitZoom * 1.3) return null
    const p = this.places.find(({ box: [x0, x1, y0, y1] }) => t.x >= x0 && t.x <= x1 && t.z >= y0 && t.z <= y1)
    return p?.id ?? null
  }

  /** a view holds its buildings open and frames its place, or the whole plate */
  setView(v: ViewMode, open: string[] = [], place?: string): void {
    this.view = v
    this.forceOpen.clear()
    for (const id of open) this.forceOpen.add(id)
    if (place) this.goPlace(place)
    else this.resetView()
    this.emit()
  }

  // ---- selection ---------------------------------------------------------------------------------

  private hit(cx: number, cy: number): Entity | null {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, (-(cy - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const shown = (o: THREE.Object3D | null): boolean => {
      for (; o; o = o.parent) if (!o.visible) return false
      return true
    }
    for (const h of this.ray.intersectObjects(this.scene.children, true)) {
      if (!(h.object instanceof THREE.Mesh) || !shown(h.object)) continue
      const PLATE = this.plate
      if (h.point.x < PLATE.x0 || h.point.x > PLATE.x1 || h.point.z < PLATE.y0 || h.point.z > PLATE.y1) continue
      let o: THREE.Object3D | null = h.object
      while (o && !o.userData.entity) o = o.parent
      return o ? (o.userData.entity as Entity) : null
    }
    return null
  }

  private eachOwn(ent: Entity, fn: (o: THREE.Object3D) => void): void {
    const walk = (o: THREE.Object3D): void => {
      if (o.userData.entity && o.userData.entity !== ent) return
      fn(o)
      o.children.forEach(walk)
    }
    for (const g of ent.groups) {
      fn(g)
      g.children.forEach(walk)
    }
  }
  private setLive(ent: Entity | null, on: boolean): void {
    if (!ent) return
    this.eachOwn(ent, (o) => {
      if (o instanceof LineSegments2 && o.userData.line === 'line') o.material = on ? this.ink.line.live : this.ink.line.line
    })
  }
  /** Director mode (Brief B6 §3): everything outside the kept entities fades toward the ground,
   *  and the acting entities draw in the live colour. null restores the plate. Objects added
   *  afterwards (a scenario's moving documents) are never faded. */
  focus(f: { keep: string[]; live: string[] } | null): void {
    for (const o of this.faded) {
      const m = o.userData.undim as THREE.Material | undefined
      if (m) o.material = m
      delete o.userData.undim
    }
    this.faded = []
    for (const e of this.lit) this.setLive(e, false)
    this.lit = []
    if (!f) return
    const keep = new Set(f.keep)
    const kept = (o: THREE.Object3D): boolean => {
      for (let x: THREE.Object3D | null = o; x; x = x.parent) {
        const e = x.userData.entity as Entity | undefined
        if (e && keep.has(e.id)) return true
      }
      return false
    }
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || o === this.retLine || o === this.routeLine || kept(o)) return
      const mat = mesh.material
      if (Array.isArray(mat)) return
      mesh.userData.undim = mat
      mesh.material = this.ink.dimOf(mat)
      this.faded.push(mesh)
    })
    for (const id of f.live) {
      const e = this.find(id)
      if (!e) continue
      this.setLive(e, true)
      this.lit.push(e)
    }
  }
  /** fade the place names outside these keys (null: all bright) */
  focusLabels(keys: string[] | null): void {
    for (const l of this.labels) l.el.classList.toggle('dim', !!keys && !keys.includes(l.def.key))
  }
  bounds(ent: Entity): THREE.Box3 {
    this.box.makeEmpty()
    for (const g of ent.groups) this.box.expandByObject(g)
    return this.box
  }
  select(ent: Entity | null): void {
    if (ent === this.selected) return
    this.setLive(this.selected, false)
    this.selected = ent
    this.setLive(ent, true)
    this.setFollow(false)
    this.drawRoute()
    this.emit()
  }
  selectId(id: string | null): void {
    this.select(id ? (this.find(id) ?? null) : null)
  }
  followable(): boolean {
    return !!this.selected && !this.selected.still
  }
  setFollow(on: boolean): void {
    const f = on && this.followable()
    if (f !== this.follow) {
      this.follow = f
      this.emit()
    }
  }
  /** vehicles in id order, for [ and ] */
  cycle(d: number): void {
    const v = this.entities.filter((e) => !e.still).sort((a, b) => a.id.localeCompare(b.id))
    if (!v.length) return
    const i = this.selected ? v.indexOf(this.selected) : -1
    this.select(v[i < 0 ? (d > 0 ? 0 : v.length - 1) : (i + d + v.length) % v.length] ?? null)
  }

  emit(): void {
    this.opts.onChange()
  }
  setPaused(on: boolean): void {
    this.paused = on
    this.emit()
  }
  setSpeed(s: number): void {
    this.speed = s
    this.emit()
  }

  // ---- tags, reticle, route, peek ------------------------------------------------------------------

  private screenAt(v: THREE.Vector3): [number, number] {
    const t = v.clone().project(this.camera)
    return [((t.x + 1) / 2) * this.stage.clientWidth, ((1 - t.y) / 2) * this.stage.clientHeight]
  }
  private anchorOf(ent: Entity): [number, number] {
    const b = this.bounds(ent)
    return this.screenAt(v3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2))
  }
  private placeAt(el: HTMLElement, [x, y]: [number, number], text: string): void {
    el.hidden = false
    if (el.textContent !== text) el.textContent = text
    const hw = el.offsetWidth / 2 + 6
    el.style.left = `${clamp(x, hw, this.stage.clientWidth - hw)}px`
    el.style.top = `${clamp(y, el.offsetHeight + 16, this.stage.clientHeight)}px`
  }
  private placeTag(el: HTMLElement, ent: Entity | null, text: string): void {
    if (!ent) el.hidden = true
    else this.placeAt(el, this.anchorOf(ent), text)
  }
  private updateReticle(): void {
    if (!this.selected) {
      this.retLine.visible = false
      return
    }
    const b = this.bounds(this.selected)
    const x0 = b.min.x - 0.8
    const x1 = b.max.x + 0.8
    const z0 = b.min.z - 0.8
    const z1 = b.max.z + 0.8
    const y = Math.max(0, b.min.y) + 0.06
    const L = Math.min(3, (x1 - x0) / 3, (z1 - z0) / 3)
    const s: number[] = []
    for (const [x, dx] of [[x0, 1], [x1, -1]] as const) for (const [z, dz] of [[z0, 1], [z1, -1]] as const) s.push(x, y, z, x + dx * L, y, z, x, y, z, x, y, z + dz * L)
    this.retLine.geometry.dispose()
    this.retLine.geometry = new LineSegmentsGeometry().setPositions(s)
    this.retLine.visible = true
  }
  /** the selection's route: dashes ahead of it and a ring at its next stop */
  drawRoute(): void {
    const r = this.selected?.route?.() ?? null
    if (!r || !r.path.length) {
      this.routeLine.visible = false
      this.routeNext = null
      return
    }
    const z = 0.24
    const s: number[] = []
    const s0 = r.s
    const s1 = r.closed ? s0 + r.path.length : r.path.length
    for (let d = s0; d < s1; d += 1.6) {
      const a = r.path.at(d)
      const b = r.path.at(Math.min(d + 0.8, s1))
      s.push(a.x, z, a.y, b.x, z, b.y)
    }
    this.routeNext = r.next ? { p: W(r.next[0], r.next[1], z), stop: r.stop } : null
    if (r.next) for (const v of ring(r.next[0], r.next[1], 3.2, z, 32)) s.push(v.x, v.y, v.z)
    this.routeLine.geometry.dispose()
    this.routeLine.geometry = new LineSegmentsGeometry().setPositions(s)
    this.routeLine.visible = true
  }
  /** a closed building opens while it, or something inside it, is selected, or while its view is on */
  openNow(id: string): boolean {
    return this.peeks.find((p) => p.id === id)?.peek.cut.visible ?? false
  }
  private updatePeek(): void {
    let c: [number, number] | null = null
    if (this.selected) {
      const b = this.bounds(this.selected)
      c = [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]
    }
    let changed = false
    const here = this.currentPlace()
    const placeOpen = this.places.find((p) => p.id === here)?.open ?? []
    for (const { id, peek } of this.peeks) {
      const [x0, x1, y0, y1] = peek.box
      const inside = (p: [number, number] | null): boolean => !!p && p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1
      const sel = this.selected?.id === id
      const on = this.forceOpen.has(id) || placeOpen.includes(id) || sel || inside(c) || (!!this.routeNext && inside([this.routeNext.p.x, this.routeNext.p.z]))
      if (peek.cut.visible !== on) {
        peek.cut.visible = on
        peek.shell.visible = !on
        peek.inside.visible = on
        changed = true
      }
    }
    if (changed) this.emit()
  }

  // ---- clock and loop --------------------------------------------------------------------------------

  setNight(n: number): void {
    this.night = n
    this.emit()
  }

  start(): void {
    this.resize()
    this.last = performance.now()
    const loop = (now: number): void => {
      if (this.disposed) return
      this.frameLoop(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** run the simulation forward by s seconds of sim time, in fixed steps */
  step(s: number): void {
    for (let t = 0; t < s - 1e-9; t += STEP) this.tick(STEP)
  }
  private tick(dt: number): void {
    this.t += dt
    for (const f of this.tickers) f(dt, this.t)
  }

  private frameLoop(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    if (!this.paused) {
      this.acc += dt * this.speed
      let n = 0
      while (this.acc >= STEP && n < 2000) {
        this.tick(STEP)
        this.acc -= STEP
        n++
      }
    }
    this.ink.shade(this.night)
    for (const f of this.frameHooks) f(dt)
    const k = this.opts.reduced ? 1 : 1 - Math.exp(-dt * 6)
    if (this.follow && this.selected) {
      const b = this.bounds(this.selected)
      this.moveTarget(this.controls.target.clone().lerp(v3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2), k))
    }
    if (this.goal) {
      if (this.goal.target) this.moveTarget(this.controls.target.clone().lerp(this.goal.target, k))
      this.camera.zoom += (this.goal.zoom - this.camera.zoom) * k
      this.camera.updateProjectionMatrix()
      if (Math.abs(this.goal.zoom - this.camera.zoom) < 1e-3 * this.goal.zoom && (!this.goal.target || this.controls.target.distanceTo(this.goal.target) < 0.05)) {
        this.goal = null
        this.emit()
      }
    }
    this.controls.update(dt)
    // slide the target along the view ray onto the ground (an invisible move), then keep it over the plate
    const t = this.controls.target
    this.moveTarget(t.clone().addScaledVector(this.ISO, -t.y / this.ISO.y))
    this.moveTarget(v3(clamp(t.x, this.plate.x0, this.plate.x1), 0, clamp(t.z, this.plate.y0, this.plate.y1)))
    this.camera.updateMatrixWorld()
    this.updatePeek()
    if (this.hoverDirty && this.pointer) {
      this.hoverDirty = false
      this.hovered = this.hit(...this.pointer)
      this.canvas.classList.toggle('over', !!this.hovered)
    }
    this.placeTag(this.tagSel, this.selected, this.selected ? `${this.selected.id}` : '')
    this.placeTag(this.tagHover, this.hovered !== this.selected ? this.hovered : null, this.hovered?.id ?? '')
    this.updateReticle()
    this.placeLabels()
    if ((this.cardT -= dt) <= 0) {
      this.cardT = 0.25
      this.drawRoute()
    }
    const sp = this.routeNext?.stop ? this.screenAt(this.routeNext.p) : null
    const sa = sp && this.selected ? this.anchorOf(this.selected) : null
    if (sp && sa && sp[0] > 0 && sp[0] < this.stage.clientWidth && sp[1] > 30 && sp[1] < this.stage.clientHeight && Math.hypot(sp[0] - sa[0], sp[1] - sa[1]) > 70)
      this.placeAt(this.tagStop, sp, `berikutnya · ${this.routeNext?.stop ?? ''}`)
    else this.tagStop.hidden = true
    this.renderer.render(this.scene, this.camera)
  }

  /** screen position (client px) of an entity's pick point, for tests */
  screenOf(id: string): [number, number] | null {
    const e = this.find(id)
    const g = e?.groups[0]
    if (!e || !g) return null
    this.scene.updateMatrixWorld()
    this.camera.updateMatrixWorld()
    const p = g.localToWorld(W(...(e.pick ?? [0, 0, 1]))).project(this.camera)
    const r = this.canvas.getBoundingClientRect()
    return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.frameHooks.clear()
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn)
    this.themeWatch.disconnect()
    this.ro.disconnect()
    this.controls.stopListenToKeyEvents()
    this.controls.dispose()
    const seen = new Set<unknown>()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry && !seen.has(m.geometry)) {
        seen.add(m.geometry)
        m.geometry.dispose()
      }
    })
    this.ink.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.remove()
    for (const el of [this.tagSel, this.tagHover, this.tagStop]) el.remove()
    for (const l of this.labels) l.el.remove()
  }
}
