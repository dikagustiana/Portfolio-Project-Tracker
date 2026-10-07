// Brief B4: the "Simulasi proses" world rebuilt on Factory Yard, as a distribution command
// centre. The canvas is an imperative three.js scene (samb/scene.ts) mounted in its own element;
// around it, the command-centre structure the owner's spec asks for: the live metrics bar (or
// the cost lens), the context switcher, the right contextual panel and the stage tracker.
// Factory Yard's click-for-a-card lives on inside it: the panel is the card.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { computeAll2 } from '../worlds/b2b-b2c/engine/index.ts'
import { formatClock } from '../core/format.ts'
import { useReducedMotion } from '../ui3d/support.ts'
import { STAGES, costLens, pulse } from './samb/bind.ts'
import type { Card, Pulse } from './samb/bind.ts'
import { PLACES, PLACE_LABELS } from './samb/layout.ts'
import type { PlaceId } from './samb/layout.ts'
import { YardScene } from './samb/scene.ts'
import type { ViewMode } from './samb/scene.ts'
import { buildWorld } from './samb/world.ts'
import type { World } from './samb/world.ts'
import './yard.css'

type Focus = 'b2b' | 'b2c' | 'all'

interface Live {
  scene: YardScene
  world: World
}

/** The mounted scene as an external store: the effect attaches it, the scene's own changes
 *  (selection, follow, view, open buildings) bump the version, and render reads the snapshot. */
class Controller {
  live: Live | null = null
  private version = 0
  private readonly subs = new Set<() => void>()
  readonly subscribe = (f: () => void): (() => void) => {
    this.subs.add(f)
    return () => this.subs.delete(f)
  }
  readonly snapshot = (): number => this.version
  readonly emit = (): void => {
    this.version++
    for (const f of this.subs) f()
  }
  attach(live: Live | null): void {
    this.live = live
    this.emit()
  }
}

const SPEEDS = [1, 4, 16] as const

export interface YardScreenProps {
  /** start of the visible run (style frames and tests) */
  initialDay?: number
  initialHour?: number
  /** select this entity once the world is built */
  initialSelect?: string
  /** hold these buildings open from the start */
  openGudang?: boolean
  /** the board's menu, for widths where it hides its sidebar */
  onMenu?: () => void
}

export default function YardScreen({ initialDay = 8, initialHour = 10.75, initialSelect, openGudang, onMenu }: YardScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [ctl] = useState(() => new Controller())
  useSyncExternalStore(ctl.subscribe, ctl.snapshot)
  const reduced = useReducedMotion()
  const [card, setCard] = useState<Card | null>(null)
  const [lens, setLens] = useState(false)
  const [focus, setFocus] = useState<Focus>('all')
  const bump = ctl.emit
  const data = computeAll2()
  const day = initialDay
  const hour = initialHour

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const q = new URLSearchParams(location.search)
    let scene: YardScene
    try {
      scene = new YardScene(root, stage, { seed: Number(q.get('seed')) || 20261007, debug: q.has('debug'), reduced, onChange: bump })
    } catch {
      stage.dataset.nowebgl = 'true'
      return
    }
    const world = buildWorld(scene, data, day, hour)
    scene.setLabels(PLACE_LABELS)
    ctl.attach({ scene, world })
    if (openGudang) scene.forceOpen.add('gudang')
    if (initialSelect) scene.selectId(initialSelect)
    scene.start()
    const timer = window.setInterval(() => setCard(scene.selected?.card() ?? null), 250)
    if (q.has('debug')) {
      Object.assign(window, {
        sim: {
          scene, world, step: (s: number) => scene.step(s), select: (id: string | null) => scene.selectId(id), selected: () => scene.selected?.id ?? null,
          screenOf: (id: string) => scene.screenOf(id), all: () => scene.entities.map((e) => ({ id: e.id, kind: e.kind, status: e.card().status })),
          place: (id: PlaceId | 'all') => scene.snapPlace(id), open: (id: 'gudang' | 'kantor', on = true) => (on ? scene.forceOpen.add(id) : scene.forceOpen.delete(id)),
        },
      })
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tgt = e.target as HTMLElement | null
      if (tgt?.closest('input, textarea, select, [contenteditable]')) return
      if ((e.key === ' ' || e.key === 'Enter') && tgt?.closest('button')) return
      if (!root.contains(tgt) && tgt !== document.body) return
      const place = PLACES.find((p) => p.key === e.key)
      const act: Record<string, () => void> = {
        Escape: () => scene.select(null), f: () => scene.setFollow(!scene.follow), F: () => scene.setFollow(!scene.follow),
        ']': () => scene.cycle(1), '[': () => scene.cycle(-1), ' ': () => scene.setPaused(!scene.paused),
        '+': () => scene.zoomBy(1.4), '=': () => scene.zoomBy(1.4), '-': () => scene.zoomBy(1 / 1.4), '0': () => scene.resetView(),
      }
      const fn = place ? () => scene.goPlace(place.id) : act[e.key]
      if (fn) {
        fn()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', onKey)
      const w = window as unknown as { sim?: { scene?: YardScene } }
      if (w.sim?.scene === scene) delete w.sim
      scene.dispose()
      ctl.attach(null)
    }
    // the world is built once per mount; day, hour and data are fixed for the screen's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scene = ctl.live?.scene
  const world = ctl.live?.world
  const metrics: Pulse[] = lens ? costLens(data, day) : world ? pulse(data, day, hour, world.fleet(), world.pending().b2b, world.pending().b2c) : []
  const view: ViewMode = scene?.view ?? 'jaringan'
  const place = scene?.currentPlace() ?? null

  return (
    <div className="yd" ref={rootRef}>
      <header className="yd-top" aria-label="Denyut operasi">
        <div className="yd-brand">
          {onMenu && (
            <button type="button" className="yd-icon yd-menu" aria-label="Menu" onClick={onMenu}>
              ☰
            </button>
          )}
          <span className="yd-kicker">Simulasi proses · jaringan distribusi</span>
          <span className="yd-clock">
            Hari {day} · {formatClock(hour)}
          </span>
        </div>
        <ul className={`yd-metrics${lens ? ' lens' : ''}`} aria-live="polite">
          {metrics.map((m) => (
            <li key={m.label} className={`yd-metric${m.tone ? ` ${m.tone}` : ''}${m.missing ? ' missing' : ''}`} title={m.missing ? `Belum ada di engine: ${m.missing}` : undefined}>
              <span className="yd-mlabel">{m.label}</span>
              <b>{m.value}</b>
              <span className="yd-msub">{m.sub}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="yd-lens" aria-pressed={lens} onClick={() => { setLens(!lens); scene?.setLens(!lens) }} title="Ganti metrik operasi dengan metrik biaya engine">
          Lensa biaya
        </button>
      </header>

      <nav className="yd-switch" aria-label="Konteks">
        <Seg label="Tampilan" value={view} options={[['jaringan', 'Jaringan'], ['gudang', 'Gudang'], ['kantor', 'Kantor']]} onChange={(v) => scene?.setView(v)} />
        <Seg label="Fokus" value={focus} options={[['b2b', 'B2B'], ['b2c', 'B2C'], ['all', 'Gabungan']]} onChange={setFocus} />
        <div className="yd-places" role="group" aria-label="Tempat">
          {PLACES.map((p) => (
            <button key={p.id} type="button" aria-current={place === p.id} onClick={() => scene?.goPlace(p.id)} title={`${p.label} (${p.key})`}>
              <kbd>{p.key}</kbd>
              {p.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="yd-body">
        <div className="yd-stage" ref={stageRef}>
          <div className="yd-tools">
            <button type="button" className="yd-icon" aria-label="Perbesar" title="Perbesar (+)" onClick={() => scene?.zoomBy(1.4)}>+</button>
            <button type="button" className="yd-icon" aria-label="Perkecil" title="Perkecil (−)" onClick={() => scene?.zoomBy(1 / 1.4)}>−</button>
            <button type="button" className="yd-icon" aria-label="Seluruh peta" title="Seluruh peta (0)" onClick={() => scene?.resetView()}>⌂</button>
          </div>
          <p className="yd-watermark">Ilustrasi: angka dummy, bukan data SAMB</p>
          <p className="yd-note">Peta ini butuh WebGL, yang dimatikan di browser ini.</p>
        </div>
        <aside className={`yd-panel${card ? ' open' : ''}`} aria-label="Detail pilihan">
          {card ? <CardView card={card} follow={scene?.follow ?? false} onFollow={() => scene?.setFollow(!scene.follow)} onClose={() => scene?.select(null)} /> : <Idle />}
        </aside>
      </div>

      <footer className="yd-bottom">
        <div className="yd-trackwrap" aria-label="Pelacak tahap" role="region">
          <Tracker card={card} />
        </div>
        <div className="yd-time" role="group" aria-label="Waktu">
          <button type="button" className="yd-icon" aria-label="Siang atau malam" title="Siang / malam">
            ☀
          </button>
          <button type="button" className="yd-icon" aria-pressed={scene?.paused ?? false} aria-label={scene?.paused ? 'Lanjutkan' : 'Jeda'} onClick={() => scene?.setPaused(!scene.paused)} title="Jeda (Spasi)">
            {scene?.paused ? '▶' : '❚❚'}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="yd-speed" aria-pressed={(scene?.speed ?? 1) === s} onClick={() => scene?.setSpeed(s)}>
              {s}×
            </button>
          ))}
          <span className="yd-day">Hari {day}/30</span>
        </div>
      </footer>
    </div>
  )
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="yd-seg" role="radiogroup" aria-label={label}>
      <span className="yd-seglabel">{label}</span>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Idle() {
  return (
    <div className="yd-idle">
      <p className="yd-kicker">Panel konteks</p>
      <p>Klik apa saja di peta — truk, dok, rak, meja, toko, dokumen — untuk status, driver biaya, angka engine dan langkah berikutnya.</p>
      <p className="yd-hint">
        <kbd>1</kbd>–<kbd>6</kbd> tempat · <kbd>[</kbd> <kbd>]</kbd> kendaraan · <kbd>F</kbd> ikuti · <kbd>Esc</kbd> tutup
      </p>
    </div>
  )
}

function CardView({ card, follow, onFollow, onClose }: { card: Card; follow: boolean; onFollow: () => void; onClose: () => void }) {
  return (
    <div className="yd-card">
      <div className="yd-head">
        <span className="yd-kicker">
          {card.channel && <i className={`yd-chan ${card.channel.toLowerCase()}`}>{card.channel}</i>}
          {card.kind}
        </span>
        <button type="button" className="yd-icon" aria-label="Tutup detail" title="Tutup (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <h2 className="yd-title">{card.title}</h2>
      <span className={`yd-status${card.tone ? ` ${card.tone}` : ''}`}>{card.status}</span>
      {card.progress && (
        <div className="yd-bar">
          <span>{card.progress.label}</span>
          <div>
            <i style={{ width: `${Math.max(0, Math.min(1, card.progress.v / card.progress.max)) * 100}%` }} />
          </div>
        </div>
      )}
      {card.shares && (
        <div className="yd-shares">
          <span>{card.shares.label}</span>
          <div className="yd-sharebar">
            {card.shares.items.map((s) => (
              <i key={s.p} style={{ flexGrow: s.value, background: s.color }} title={s.label} />
            ))}
          </div>
          <ul>
            {card.shares.items.map((s) => (
              <li key={s.p}>
                <i style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="yd-rows">
        {card.rows.map(([k, v]) => (
          <Row key={k} k={k}>
            {v}
          </Row>
        ))}
      </dl>
      {card.driver && (
        <p className="yd-driver">
          <span className="yd-kicker">Driver biaya</span>
          {card.driver}
        </p>
      )}
      <div className="yd-engine">
        <span className="yd-kicker">Angka engine</span>
        <dl className="yd-rows">
          {card.engine.map((f) =>
            'missing' in f ? (
              <Row key={f.label} k={f.label} missing>
                {f.missing}
              </Row>
            ) : (
              <Row key={f.label} k={f.label}>
                {f.value}
              </Row>
            ),
          )}
        </dl>
      </div>
      {card.next && (
        <p className="yd-next">
          <span className="yd-kicker">Langkah berikutnya</span>
          {card.next}
        </p>
      )}
      {card.notes?.map((n) => (
        <p key={n} className="yd-notes">
          {n}
        </p>
      ))}
      {card.followable && (
        <div className="yd-foot">
          <button type="button" aria-pressed={follow} onClick={onFollow} title="Ikuti (F)">
            Ikuti
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ k, children, missing }: { k: string; children: ReactNode; missing?: boolean }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={missing ? 'missing' : undefined}>{children}</dd>
    </>
  )
}

function Tracker({ card }: { card: Card | null }) {
  const st = card?.stage
  if (!st) return <p className="yd-tracker-idle">Pilih order, trip, truk atau dokumen untuk melihat tahapnya.</p>
  const names = STAGES[st.channel]
  return (
    <ol className="yd-tracker" aria-label={`Tahap ${st.channel}`}>
      <li className="yd-tchan">
        <i className={`yd-chan ${st.channel.toLowerCase()}`}>{st.channel}</i>
        {card.title}
      </li>
      {names.map((n, i) => (
        <li key={n} className={i < st.at ? 'done' : i === st.at ? 'now' : ''} aria-current={i === st.at ? 'step' : undefined}>
          <span>{i + 1}</span>
          {n}
        </li>
      ))}
    </ol>
  )
}
