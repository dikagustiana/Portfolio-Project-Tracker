// The shared shell of the "Simulasi proses" screen (Brief B5 §2), from Brief B4's command centre.
// The canvas is an imperative three.js scene (scene.ts) mounted in its own element; around it the
// shell draws what every world shares: the world switcher, the live metrics bar (or a lens), the
// context switcher with the place buttons and their number keys, the right contextual panel, the
// stage tracker, day and night, pause and speed, and the ?debug=1 hook window.sim. What stands on
// the plate, what the tiles say, what the cards hold and which stages the tracker walks come from
// the world (types.ts WorldDef). Factory Yard's click-for-a-card lives on: the panel is the card.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { formatClock } from '../core/format.ts'
import { useReducedMotion } from '../ui3d/support.ts'
import { YardScene } from './scene.ts'
import type { Block, Card, Pulse, WorldDef, WorldId, WorldRuntime } from './types.ts'
import { WORLDS } from './worlds.ts'
import './yard.css'

interface Live {
  scene: YardScene
  runtime: WorldRuntime
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

export interface YardShellProps {
  def: WorldDef
  /** start of the visible run (style frames and tests) */
  initialDay?: number
  initialHour?: number
  /** select this entity once the world is built */
  initialSelect?: string
  /** hold these buildings open from the start */
  open?: string[]
  /** start with this lens on */
  initialLens?: string
  /** the board's menu, for widths where it hides its sidebar */
  onMenu?: () => void
  /** the world switcher; without it the switcher still shows, inert */
  onWorld?: (id: WorldId) => void
}

export default function YardShell({ def, initialDay, initialHour, initialSelect, open, initialLens, onMenu, onWorld }: YardShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [ctl] = useState(() => new Controller())
  useSyncExternalStore(ctl.subscribe, ctl.snapshot)
  const reduced = useReducedMotion()
  const [card, setCard] = useState<Card | null>(null)
  const [lens, setLensState] = useState<string | null>(initialLens ?? null)
  const [focus, setFocusState] = useState<string>(def.focus?.initial ?? '')

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    const q = new URLSearchParams(location.search)
    const seed = Number(q.get('seed')) || 20261007
    let scene: YardScene
    try {
      scene = new YardScene(root, stage, { seed, debug: q.has('debug'), reduced, onChange: ctl.emit, plate: def.plate, places: def.places, ariaLabel: def.ariaLabel, fills: def.fills })
    } catch {
      stage.dataset.nowebgl = 'true'
      return
    }
    // the world's labels go up first, so its build can replace them (with live counts, …)
    scene.setLabels(def.labels)
    const runtime = def.build(scene, { day: initialDay, hour: initialHour, seed, reduced })
    ctl.attach({ scene, runtime })
    for (const id of open ?? []) scene.forceOpen.add(id)
    if (initialLens) {
      scene.setLens(initialLens)
      runtime.onLens?.(initialLens)
    }
    if (initialSelect) scene.selectId(initialSelect)
    scene.start()
    const timer = window.setInterval(() => setCard(scene.selected?.card() ?? null), 250)
    if (q.has('debug')) {
      Object.assign(window, {
        sim: {
          world: def.id, scene, runtime, ...runtime.debug,
          step: (s: number) => scene.step(s), select: (id: string | null) => scene.selectId(id), selected: () => scene.selected?.id ?? null,
          screenOf: (id: string) => scene.screenOf(id), all: () => scene.entities.map((e) => ({ id: e.id, kind: e.kind, status: e.card().status })),
          place: (id: string) => scene.snapPlace(id), open: (id: string, on = true) => (on ? scene.forceOpen.add(id) : scene.forceOpen.delete(id)),
          night: (n: number) => scene.setNight(n),
        },
      })
    }
    // A world may give a place the key 0 (the RPA's tenth place); the whole map then stays on Home.
    const zeroIsPlace = def.places.some((p) => p.key === '0')
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tgt = e.target as HTMLElement | null
      if (tgt?.closest('input, textarea, select, [contenteditable]')) return
      if ((e.key === ' ' || e.key === 'Enter') && tgt?.closest('button')) return
      if (!root.contains(tgt) && tgt !== document.body) return
      const place = def.places.find((p) => p.key === e.key)
      const act: Record<string, () => void> = {
        Escape: () => scene.select(null), f: () => scene.setFollow(!scene.follow), F: () => scene.setFollow(!scene.follow),
        ']': () => scene.cycle(1), '[': () => scene.cycle(-1), ' ': () => scene.setPaused(!scene.paused),
        '+': () => scene.zoomBy(1.4), '=': () => scene.zoomBy(1.4), '-': () => scene.zoomBy(1 / 1.4), Home: () => scene.resetView(),
        ...(zeroIsPlace ? {} : { '0': () => scene.resetView() }),
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
    // the world is built once per mount; its definition and start are fixed for the screen's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scene = ctl.live?.scene
  const runtime = ctl.live?.runtime
  const clock = runtime?.clock() ?? { day: initialDay ?? 1, hour: initialHour ?? 9, days: 30 }
  const metrics: Pulse[] = runtime?.metrics(lens, focus) ?? []
  const view = scene?.view ?? def.views[0]?.id ?? 'jaringan'
  const place = scene?.currentPlace() ?? null
  const night = (scene?.night ?? 0) > 0.5
  const lastKey = def.places[def.places.length - 1]?.key ?? ''
  const setLens = (id: string | null): void => {
    setLensState(id)
    scene?.setLens(id)
    runtime?.onLens?.(id)
  }
  const setFocus = (id: string): void => {
    setFocusState(id)
    runtime?.onFocus?.(id)
  }

  return (
    <div className="yd" ref={rootRef} data-world={def.id}>
      <nav className="yd-worlds" aria-label="Dunia">
        <div className="yd-seg" role="radiogroup" aria-label="Dunia">
          <span className="yd-seglabel">Dunia</span>
          {WORLDS.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={def.id === w.id} onClick={() => def.id !== w.id && onWorld?.(w.id)}>
              {w.label}
            </button>
          ))}
        </div>
        <span className="yd-kicker yd-worldnote">{def.kicker}</span>
      </nav>

      <header className="yd-top" aria-label="Denyut operasi">
        <div className="yd-brand">
          {onMenu && (
            <button type="button" className="yd-icon yd-menu" aria-label="Menu" onClick={onMenu}>
              ☰
            </button>
          )}
          <span className="yd-kicker">{lens ? (def.lenses.find((l) => l.id === lens)?.label ?? 'Lensa') : 'Denyut operasi'}</span>
          <span className="yd-clock">
            Hari {clock.day} · {formatClock(clock.hour)}
          </span>
        </div>
        <ul className={`yd-metrics${lens ? ' lens' : ''}`} aria-live="polite" style={{ ['--n' as string]: Math.max(1, metrics.length) }}>
          {metrics.map((m) => (
            <li key={m.label} className={`yd-metric${m.tone ? ` ${m.tone}` : ''}${m.missing ? ' missing' : ''}`} title={m.missing ? `${def.gap}: ${m.missing}` : undefined}>
              <span className="yd-mlabel">{m.label}</span>
              <b>{m.value}</b>
              <span className="yd-msub">{m.sub}</span>
            </li>
          ))}
        </ul>
        <div className={`yd-lenses${def.lenses.length > 1 ? ' many' : ''}`}>
          {def.lenses.map((l) => (
            <button key={l.id} type="button" className="yd-lens" aria-pressed={lens === l.id} onClick={() => setLens(lens === l.id ? null : l.id)} title={l.title}>
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <nav className="yd-switch" aria-label="Konteks">
        <Seg label="Tampilan" value={view} options={def.views.map((v) => [v.id, v.label] as [string, string])} onChange={(id) => {
          const v = def.views.find((x) => x.id === id)
          if (v) scene?.setView(v.id, v.open, v.place)
        }} />
        {def.focus && <Seg label={def.focus.label} value={focus} options={def.focus.options} onChange={setFocus} />}
        <div className="yd-places" role="group" aria-label="Tempat">
          {def.places.map((p) => (
            <button key={p.id} type="button" aria-current={place === p.id} onClick={() => scene?.goPlace(p.id)} title={`${p.label} (${p.key})`} aria-label={p.short ? p.label : undefined}>
              <kbd>{p.key}</kbd>
              {p.short ?? p.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="yd-body">
        <div className="yd-stage" ref={stageRef}>
          <div className="yd-tools">
            <button type="button" className="yd-icon" aria-label="Perbesar" title="Perbesar (+)" onClick={() => scene?.zoomBy(1.4)}>+</button>
            <button type="button" className="yd-icon" aria-label="Perkecil" title="Perkecil (−)" onClick={() => scene?.zoomBy(1 / 1.4)}>−</button>
            <button type="button" className="yd-icon" aria-label="Seluruh peta" title={`Seluruh peta (${def.places.some((p) => p.key === '0') ? 'Home' : '0'})`} onClick={() => scene?.resetView()}>⌂</button>
          </div>
          <div className="yd-watermark">
            {def.watermark.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
          <p className="yd-note">Peta ini butuh WebGL, yang dimatikan di browser ini.</p>
        </div>
        <aside className={`yd-panel${card ? ' open' : ''}`} aria-label="Detail pilihan">
          {card ? (
            <CardView card={card} gap={def.gap} follow={scene?.follow ?? false} onFollow={() => scene?.setFollow(!scene.follow)} onClose={() => scene?.select(null)} />
          ) : (
            <div className="yd-idle">
              <p className="yd-kicker">Panel konteks</p>
              <p>{def.idle}</p>
              <p className="yd-hint">
                <kbd>1</kbd>–<kbd>{lastKey}</kbd> tempat · <kbd>[</kbd> <kbd>]</kbd> kendaraan · <kbd>F</kbd> ikuti · <kbd>Esc</kbd> tutup
              </p>
            </div>
          )}
        </aside>
      </div>

      <footer className="yd-bottom">
        <div className="yd-trackwrap" aria-label="Pelacak tahap" role="region">
          <Tracker card={card} stages={def.stages} idle={def.trackerIdle} />
        </div>
        <div className="yd-time" role="group" aria-label="Waktu">
          <button type="button" className="yd-icon" aria-pressed={night} aria-label={night ? 'Siang' : 'Malam'} title="Siang / malam" onClick={() => scene?.setNight(night ? 0 : 1)}>
            {night ? '☾' : '☀'}
          </button>
          <button type="button" className="yd-icon" aria-pressed={scene?.paused ?? false} aria-label={scene?.paused ? 'Lanjutkan' : 'Jeda'} onClick={() => scene?.setPaused(!scene.paused)} title="Jeda (Spasi)">
            {scene?.paused ? '▶' : '❚❚'}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="yd-speed" aria-pressed={(scene?.speed ?? 1) === s} onClick={() => scene?.setSpeed(s)}>
              {s}×
            </button>
          ))}
          <span className="yd-day">
            Hari {clock.day}/{clock.days}
          </span>
        </div>
      </footer>
    </div>
  )
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
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

function CardView({ card, gap, follow, onFollow, onClose }: { card: Card; gap: string; follow: boolean; onFollow: () => void; onClose: () => void }) {
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
              <i key={s.key} style={{ flexGrow: s.value, background: s.color }} title={s.label} />
            ))}
          </div>
          <ul>
            {card.shares.items.map((s) => (
              <li key={s.key}>
                <i style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {card.lead?.map((b, i) => <BlockView key={`lead-${b.kind}-${b.title}-${i}`} block={b} />)}
      {card.rows.length > 0 && (
        <dl className="yd-rows">
          {card.rows.map(([k, v]) => (
            <Row key={k} k={k}>
              {v}
            </Row>
          ))}
        </dl>
      )}
      {card.driver && (
        <p className="yd-driver">
          <span className="yd-kicker">Driver biaya</span>
          {card.driver}
        </p>
      )}
      {card.engine.length > 0 && (
        <div className="yd-engine">
          <span className="yd-kicker">{card.engineTitle ?? 'Angka engine'}</span>
          <dl className="yd-rows">
            {card.engine.map((f) =>
              'missing' in f ? (
                <Row key={f.label} k={f.label} missing title={gap}>
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
      )}
      {card.blocks?.map((b, i) => <BlockView key={`${b.kind}-${b.title}-${i}`} block={b} />)}
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
      {card.source && <p className="yd-source">{card.source}</p>}
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

function Row({ k, children, missing, title }: { k: string; children: ReactNode; missing?: boolean; title?: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={missing ? 'missing' : undefined} title={title}>
        {children}
      </dd>
    </>
  )
}

const STATUS_CLASS = { ADA: 'ok', SEBAGIAN: 'warn', BELUM: 'bad' } as const

function BlockView({ block: b }: { block: Block }) {
  switch (b.kind) {
    case 'rows':
      return (
        <section className="yd-block">
          <span className="yd-kicker">{b.title}</span>
          <dl className="yd-rows">
            {b.rows.map(([k, v]) => (
              <Row key={k} k={k}>
                {v}
              </Row>
            ))}
          </dl>
        </section>
      )
    case 'text':
      return (
        <section className="yd-block">
          <span className="yd-kicker">{b.title}</span>
          <p>{b.text}</p>
        </section>
      )
    case 'list':
      return (
        <section className="yd-block">
          <span className="yd-kicker">{b.title}</span>
          <ul className="yd-list">
            {b.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )
    case 'needs':
      return (
        <section className="yd-block">
          <span className="yd-kicker">{b.title}</span>
          <ul className="yd-needs">
            {b.items.map((n) => (
              <li key={n.label}>
                <i className={`yd-need ${STATUS_CLASS[n.status]}`}>{n.status}</i>
                <span>{n.label}</span>
                <small>{n.owner}</small>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'bars': {
      const max = Math.max(...b.items.map((x) => Math.abs(x.value)), 1e-9)
      return (
        <section className="yd-block">
          <span className="yd-kicker">{b.title}</span>
          <ul className="yd-hbars">
            {b.items.map((x) => (
              <li key={x.label}>
                <span>{x.label}</span>
                <b>{x.display}</b>
                <i className={x.tone} style={{ width: `${(Math.abs(x.value) / max) * 100}%` }} />
              </li>
            ))}
          </ul>
          {b.note && <p className="yd-source">{b.note}</p>}
        </section>
      )
    }
    case 'waterfall':
      return <WaterfallView block={b} />
    case 'steps':
      return <StepsView block={b} />
  }
}

/** items behind tabs: the first is open; a tab shows another (the card re-renders keep the choice) */
function StepsView({ block: b }: { block: Extract<Block, { kind: 'steps' }> }) {
  const [open, setOpen] = useState(b.items[0]?.key ?? '')
  const item = b.items.find((x) => x.key === open) ?? b.items[0]
  return (
    <section className="yd-block">
      <span className="yd-kicker">{b.title}</span>
      {b.items.length > 1 && (
        <div className="yd-tabs" role="tablist" aria-label={b.title}>
          {b.items.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === item?.key} aria-pressed={x.key === item?.key} onClick={() => setOpen(x.key)}>
              {x.key}
            </button>
          ))}
        </div>
      )}
      {item && (
        <div className="yd-stepbody" role="tabpanel" aria-label={item.label}>
          <h3 className="yd-steptitle">{item.label}</h3>
          {item.blocks.map((x, i) => (
            <BlockView key={`${x.kind}-${x.title}-${i}`} block={x} />
          ))}
        </div>
      )}
    </section>
  )
}

/** A bridge drawn as floating bars on one scale: the start, each step from where the last ended,
 *  and the end; the value printed on every bar. */
function WaterfallView({ block: b }: { block: Extract<Block, { kind: 'waterfall' }> }) {
  const levels: { label: string; from: number; to: number; kind: 'total' | 'up' | 'down' }[] = [{ label: b.start.label, from: 0, to: b.start.value, kind: 'total' }]
  let at = b.start.value
  for (const s of b.steps) {
    levels.push({ label: s.label, from: at, to: at + s.value, kind: s.value >= 0 ? 'up' : 'down' })
    at += s.value
  }
  levels.push({ label: b.end.label, from: 0, to: b.end.value, kind: 'total' })
  const lo = Math.min(...levels.map((l) => Math.min(l.from, l.to)))
  const hi = Math.max(...levels.map((l) => Math.max(l.from, l.to)))
  // totals start at zero; zoom the axis onto the band where the steps happen so small steps still read
  const floor = Math.max(0, Math.min(...levels.filter((l) => l.kind !== 'total').map((l) => Math.min(l.from, l.to)), hi) - (hi - lo) * 0.02)
  const base = lo < 0 ? lo : Math.min(floor, b.end.value * 0.94, b.start.value * 0.94)
  const span = Math.max(hi - base, 1e-9)
  const pct = (x: number): number => ((Math.max(x, base) - base) / span) * 100
  return (
    <section className="yd-block">
      <span className="yd-kicker">{b.title}</span>
      <ol className="yd-wf" aria-label={b.title}>
        {levels.map((l, i) => {
          const a = Math.min(l.from, l.to)
          const z = Math.max(l.from, l.to)
          const v = l.kind === 'total' ? l.to : l.to - l.from
          return (
            <li key={`${l.label}-${i}`} className={l.kind}>
              <span>{l.label}</span>
              <div>
                <i style={{ left: `${pct(a)}%`, width: `${Math.max(0.6, pct(z) - pct(a))}%` }} />
              </div>
              <b>{l.kind === 'total' ? b.format(v) : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${b.format(Math.abs(v))}`}</b>
            </li>
          )
        })}
      </ol>
      {b.note && <p className="yd-source">{b.note}</p>}
    </section>
  )
}

function Tracker({ card, stages, idle }: { card: Card | null; stages: Record<string, readonly string[]>; idle: string }) {
  const st = card?.stage
  const names = st ? stages[st.channel] : undefined
  if (!st || !names) return <p className="yd-tracker-idle">{idle}</p>
  return (
    <ol className="yd-tracker" aria-label={`Tahap ${st.channel}`}>
      <li className="yd-tchan">
        <i className={`yd-chan ${st.channel.toLowerCase()}`}>{st.channel}</i>
        {card.title}
      </li>
      {names.map((n, i) => (
        <li key={n} className={i < st.at || st.done ? 'done' : i === st.at ? 'now' : ''} aria-current={i === st.at ? 'step' : undefined}>
          <span>{i + 1}</span>
          {n}
        </li>
      ))}
    </ol>
  )
}
