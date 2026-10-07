// The overlay card system (Brief 3 §4): white rounded cards floating over the 3D scene —
// KPI row, search + world selector + clock chip, selected-object card, "Pelacakan alur", list
// tabs, slim timeline, map controls, drawers, watermark. Layout lives in sim3d.css (one grid,
// fixed areas); on a phone the three panels share one bottom sheet. Presentational: Sim3D
// passes the engine-bound views (bindings2.ts) and the handlers. Every top-level card carries
// a `data-zone` so the style-frame script can prove that no two cards overlap.

import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../core/format.ts'
import type { Trace } from '../core/trace.ts'
import type { KpiView, ListItemView, ListTab, RowView, SelectionView, SummaryView, Target, Tone, TrackView } from './bindings2.ts'

export type OverlayMode = 'wide' | 'medium' | 'phone'
export type WorldId = 'distribusi' | 'b2b-b2c'

const WORLDS: { id: WorldId; label: string }[] = [
  { id: 'distribusi', label: 'Distribusi' },
  { id: 'b2b-b2c', label: 'Gudang B2B + B2C' },
]

export interface ClockView {
  day: number
  days: number
  hour: number
  from: number
  to: number
  speed: number
  playing: boolean
  cutoffs: { h: number; who: string[] }[]
}

export interface SearchResult {
  label: string
  sub: string
  target: Target
}

// --- Primitives -------------------------------------------------------------------------------

function Chip({ text, tone = 'grey', title }: { text: string; tone?: Tone; title?: string }) {
  return (
    <span className={`s3-chip s3-tone-${tone}`} title={title}>
      {text}
    </span>
  )
}

function IconTile({ icon, tone }: { icon: string; tone: Tone }) {
  return (
    <span className={`s3-icon s3-tone-${tone}`} aria-hidden>
      {icon}
    </span>
  )
}

function Row({ row, onTrace }: { row: RowView; onTrace: (t: Trace) => void }) {
  const tr = row.trace
  return (
    <div className="s3-row">
      <span>{row.k}</span>
      {tr ? (
        <button type="button" className="s3-tracebtn" title="Lihat jejak angka" onClick={() => onTrace(tr)}>
          {row.v} <span aria-hidden>↗</span>
        </button>
      ) : (
        <b>{row.v}</b>
      )}
    </div>
  )
}

function KpiCard({ kpi, onTrace }: { kpi: KpiView; onTrace: (t: Trace) => void }) {
  return (
    <button type="button" className="s3-card s3-kpi" data-zone={`kpi-${kpi.id}`} onClick={() => onTrace(kpi.trace)} title="Lihat jejak angka">
      <IconTile icon={kpi.icon} tone={kpi.tone} />
      <span className="s3-kpi-text">
        <span className="s3-kpi-label">{kpi.label}</span>
        <span className="s3-kpi-value">
          <b>{kpi.value}</b>
          {kpi.delta && (
            // Cost going down is good (teal), going up needs attention (amber).
            <span className={`s3-delta s3-tone-${kpi.delta.dir === 'down' ? 'green' : 'amber'}`} title={kpi.delta.hint} aria-label={kpi.delta.hint}>
              {kpi.delta.dir === 'down' ? '▼' : '▲'} {kpi.delta.text}
            </span>
          )}
          {kpi.note && <Chip text={kpi.note.text} title={kpi.note.hint} />}
        </span>
      </span>
    </button>
  )
}

// --- Panels (shared by the desktop cards and the phone bottom sheet) --------------------------

function SelectedObject({ selection, summary, onTrace, onDetail, onClear }: { selection: SelectionView | null; summary: SummaryView; onTrace: (t: Trace) => void; onDetail: () => void; onClear: () => void }) {
  if (!selection) {
    return (
      <>
        <div className="s3-head">
          <IconTile icon="🗺" tone="blue" />
          <div>
            <div className="s3-title">{summary.title}</div>
            <div className="s3-sub">Klik pin atau baris daftar untuk membuka objek</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {summary.rows.map((r) => (
            <Row key={r.k} row={r} onTrace={onTrace} />
          ))}
        </div>
        <div className="s3-actions">
          <button type="button" className="s3-action is-primary" onClick={onDetail}>
            Ikuti prinsipal / platform
          </button>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="s3-head">
        <IconTile icon={selection.icon} tone={selection.tone} />
        <div style={{ minWidth: 0 }}>
          <div className="s3-title">{selection.title}</div>
          <div className="s3-sub">{selection.sub}</div>
        </div>
        <button type="button" className="s3-close" aria-label="Tutup objek" onClick={onClear}>
          ✕
        </button>
      </div>
      <div className="s3-what">{selection.what}</div>
      {selection.rows.map((r) => (
        <Row key={r.k} row={r} onTrace={onTrace} />
      ))}
      <div className="s3-actions">
        <button type="button" className="s3-action is-primary" onClick={onDetail}>
          Detail dan jejak angka
        </button>
      </div>
    </>
  )
}

function FlowTrace({ track, onOrder }: { track: TrackView | null; onOrder: () => void }) {
  if (!track) return <div className="s3-sub">Belum ada order hari ini.</div>
  return (
    <>
      <div className="s3-kicker">Pelacakan alur — order {track.orderId}</div>
      <ol className="s3-steps">
        {track.steps.map((s, i) => (
          <li key={s} className={`s3-step ${i < track.current ? 'is-done' : i === track.current ? 'is-current' : 'is-todo'}`} aria-current={i === track.current ? 'step' : undefined}>
            <span className="s3-dot">{i < track.current ? '✓' : i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="s3-flow-item" onClick={onOrder} title="Waterfall GMV → kontribusi">
        <IconTile icon="📦" tone="blue" />
        <span>
          <b>{track.itemLine}</b>
          <span className="s3-sub" style={{ display: 'block' }}>
            {track.subLine}
          </span>
        </span>
        <b title={track.valueHint}>{track.value}</b>
      </button>
    </>
  )
}

function ObjectList({ lists, onTarget }: { lists: Record<ListTab, ListItemView[]>; onTarget: (t: Target) => void }) {
  const [tab, setTab] = useState<ListTab>('truk')
  const rows = lists[tab]
  return (
    <>
      <div className="s3-tabs" role="tablist" aria-label="Daftar objek">
        {(['dock', 'truk', 'order'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="s3-seg" onClick={() => setTab(t)}>
            {t === 'dock' ? 'Dock' : t === 'truk' ? 'Truk' : 'Order'}
            <span className="s3-count">{lists[t].length}</span>
          </button>
        ))}
      </div>
      <div className="s3-list-body" role="tabpanel">
        {rows.length === 0 && <div className="s3-sub" style={{ padding: '6px 0' }}>Belum ada untuk jam ini.</div>}
        {rows.map((r) => (
          <button key={r.key} type="button" className="s3-item" onClick={() => onTarget(r.target)}>
            <IconTile icon={r.icon} tone={r.tone} />
            <span style={{ minWidth: 0 }}>
              <span className="s3-item-name">{r.name}</span>
              <span className="s3-sub" style={{ display: 'block' }}>
                {r.sub}
              </span>
            </span>
            <Chip text={r.status} tone={r.statusTone} />
          </button>
        ))}
      </div>
    </>
  )
}

function MapControls({ interior, onZoom, onRotate, onReset, onInterior }: { interior: boolean; onZoom: (f: number) => void; onRotate: () => void; onReset: () => void; onInterior: () => void }) {
  const buttons = [
    { label: 'Perbesar', icon: '+', fn: () => onZoom(1.25) },
    { label: 'Perkecil', icon: '−', fn: () => onZoom(0.8) },
    { label: 'Putar 90°', icon: '⟳', fn: onRotate },
    { label: 'Reset tampilan', icon: '⤢', fn: onReset },
  ]
  return (
    <div className="s3-controls" role="toolbar" aria-label="Kontrol peta" data-zone="controls">
      {buttons.map((b) => (
        <button key={b.label} type="button" className="s3-card s3-ctl" aria-label={b.label} title={b.label} onClick={b.fn}>
          {b.icon}
        </button>
      ))}
      <button type="button" className="s3-card s3-ctl" aria-label="Lihat dalam gudang" title="Lihat dalam gudang" aria-pressed={interior} onClick={onInterior}>
        🏠
      </button>
    </div>
  )
}

function Watermark() {
  return (
    <div className="s3-watermark" data-zone="watermark">
      Ilustrasi — angka dummy, bukan data SAMB
    </div>
  )
}

function Timeline({ mode, clock, onPlay, onSpeed, onDay, onHour }: { mode: OverlayMode; clock: ClockView; onPlay: () => void; onSpeed: (s: number) => void; onDay: (d: number) => void; onHour: (h: number) => void }) {
  return (
    <div className="s3-card s3-timeline" data-zone="timeline">
      <button type="button" className="s3-play" aria-label={clock.playing ? 'Jeda' : 'Putar'} onClick={onPlay}>
        {clock.playing ? '❚❚' : '▶'}
      </button>
      <div className="s3-speeds" role="group" aria-label="Kecepatan">
        {[1, 4, 16].map((s) => (
          <button key={s} type="button" className="s3-seg" aria-pressed={clock.speed === s} onClick={() => onSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <div className="s3-day">
        <input type="range" className="s3-range" min={1} max={clock.days} value={clock.day} aria-label="Geser hari" aria-valuetext={`Hari ${clock.day}`} onChange={(e) => onDay(Number(e.target.value))} />
      </div>
      <span className="s3-time">{mode === 'phone' ? `Hari ${clock.day} · ${formatClock(clock.hour)}` : `Hari ${clock.day}`}</span>
      <span className="s3-hour">
        <input type="range" className="s3-range" min={clock.from} max={clock.to} step={0.25} value={clock.hour} aria-label="Geser jam" aria-valuetext={formatClock(clock.hour)} onChange={(e) => onHour(Number(e.target.value))} />
        {clock.cutoffs.map((c) => (
          <span key={c.h} className="s3-mark" style={{ '--f': (c.h - clock.from) / (clock.to - clock.from) } as React.CSSProperties} title={`Batas order ${formatClock(c.h)} · ${c.who.join(', ')}`} />
        ))}
      </span>
    </div>
  )
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="s3-drawer" role="dialog" aria-label={title}>
      <div className="s3-drawer-head">
        <b>{title}</b>
        {/* Focus moves into the opened drawer; Escape closes it. */}
        <button type="button" className="s3-close" aria-label="Tutup" onClick={onClose} autoFocus>
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

function Search({ onSearch, onTarget }: { onSearch: (q: string) => SearchResult[]; onTarget: (t: Target) => void }) {
  const [q, setQ] = useState('')
  const results = q ? onSearch(q) : []
  const pick = (r: SearchResult | undefined) => {
    if (!r) return
    onTarget(r.target)
    setQ('')
  }
  return (
    <div className="s3-card s3-search" data-zone="search">
      <span aria-hidden>⌕</span>
      <input
        placeholder="Cari objek, order, truk…"
        aria-label="Cari objek, order, atau truk"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') pick(results[0])
          if (e.key === 'Escape') setQ('')
        }}
      />
      {results.length > 0 && (
        <div className="s3-results" role="listbox" aria-label="Hasil pencarian">
          {results.map((r) => (
            <button key={`${r.target.kind}-${r.target.id}-${r.label}`} type="button" role="option" aria-selected={false} className="s3-result" onClick={() => pick(r)}>
              <b>{r.label}</b>
              <span className="s3-sub">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Composition ------------------------------------------------------------------------------

export interface OverlayProps {
  mode: OverlayMode
  /** Container height; a short phone screen starts with the bottom sheet folded. */
  height: number
  /** Reports where the free scene area's centre sits relative to the container centre (px),
   *  so the camera can frame the scene between the cards instead of behind them. */
  onFocus: (offset: { x: number; y: number }) => void
  world: WorldId
  onWorld: (w: WorldId) => void
  /** Switch to the 2D view (absent when 2D is not offered). */
  on2D?: () => void
  /** Open the app's side menu (phones, where the sidebar is hidden). */
  onMenu?: () => void
  kpis: KpiView[]
  clock: ClockView
  onPlay: () => void
  onSpeed: (s: number) => void
  onDay: (d: number) => void
  onHour: (h: number) => void
  selection: SelectionView | null
  summary: SummaryView
  onClearSelection: () => void
  onDetail: () => void
  track: TrackView | null
  onTrackOrder: () => void
  lists: Record<ListTab, ListItemView[]>
  onTarget: (t: Target) => void
  onSearch: (q: string) => SearchResult[]
  onTrace: (t: Trace) => void
  onRules: () => void
  drawer: { title: string; body: React.ReactNode } | null
  onCloseDrawer: () => void
  interior: boolean
  setInterior: (v: boolean) => void
  onZoom: (f: number) => void
  onRotate: () => void
  onReset: () => void
}

type SheetTab = 'objek' | 'alur' | 'daftar'

export function OverlaySim3D(p: OverlayProps) {
  const { mode, onFocus, clock } = p
  const [sheet, setSheet] = useState<SheetTab>('objek')
  const [sheetOpen, setSheetOpen] = useState(() => p.height >= 640)
  const phone = mode === 'phone'
  const rootRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)

  // The grid's middle area is exactly the scene left uncovered by cards.
  useEffect(() => {
    const root = rootRef.current
    const mid = midRef.current
    if (!root || !mid) return
    const measure = () => {
      const r = root.getBoundingClientRect()
      const m = mid.getBoundingClientRect()
      onFocus({ x: Math.round(m.left + m.width / 2 - (r.left + r.width / 2)), y: Math.round(m.top + m.height / 2 - (r.top + r.height / 2)) })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    ro.observe(mid)
    return () => ro.disconnect()
  }, [onFocus])

  // On a phone, opening something brings its panel up in the sheet.
  const onTarget = (t: Target) => {
    p.onTarget(t)
    if (phone) {
      setSheet(t.kind === 'order' ? 'alur' : 'objek')
      setSheetOpen(true)
    }
  }

  const selected = <SelectedObject selection={p.selection} summary={p.summary} onTrace={p.onTrace} onDetail={p.onDetail} onClear={p.onClearSelection} />
  const flow = <FlowTrace track={p.track} onOrder={p.onTrackOrder} />
  const list = <ObjectList lists={p.lists} onTarget={onTarget} />

  return (
    <div className="s3-overlay" ref={rootRef}>
      <div className="s3-top">
        <div className="s3-searchbar">
          {phone && p.onMenu && (
            // `.menu-btn` (board.css) only shows where the app hides its sidebar (≤ 860 px).
            <button type="button" className="s3-card s3-iconbtn menu-btn" aria-label="Buka menu" onClick={p.onMenu} data-zone="menu">
              ☰
            </button>
          )}
          <Search onSearch={p.onSearch} onTarget={onTarget} />
          {phone && (
            <button type="button" className="s3-card s3-iconbtn" aria-label="Aturan alokasi" title="Aturan alokasi" onClick={p.onRules} data-zone="rules">
              ⚙
            </button>
          )}
          {phone && p.on2D && (
            <button type="button" className="s3-card s3-iconbtn" aria-label="Tampilan 2D" title="Tampilan 2D" onClick={p.on2D} data-zone="view2d">
              2D
            </button>
          )}
          <div className="s3-card s3-worlds" role="group" aria-label="Pilih dunia simulasi" data-zone="worlds">
            {WORLDS.map((w) => (
              <button key={w.id} type="button" className="s3-seg" aria-pressed={p.world === w.id} onClick={() => p.onWorld(w.id)}>
                {w.label}
              </button>
            ))}
          </div>
          {!phone && (
            <div className="s3-card s3-clock" data-zone="clock">
              <span>
                Hari {clock.day} · {formatClock(clock.hour)}
              </span>
              <Chip text={clock.playing ? 'Berjalan' : 'Jeda'} tone={clock.playing ? 'green' : 'grey'} />
            </div>
          )}
        </div>
        <div className="s3-kpis" role="group" aria-label="Ringkasan biaya">
          {p.kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} onTrace={p.onTrace} />
          ))}
        </div>
      </div>

      {!phone && (
        <aside className="s3-side">
          <div className="s3-side-top">
            {p.on2D && (
              <button type="button" className="s3-card s3-rules" onClick={p.on2D} data-zone="view2d">
                Tampilan 2D
              </button>
            )}
            <button type="button" className="s3-card s3-rules" onClick={p.onRules} data-zone="rules">
              ⚙ Aturan alokasi
            </button>
          </div>
          <section className="s3-card s3-selected" aria-label={p.selection ? 'Objek terpilih' : 'Ringkasan hari'} data-zone="selected">
            {selected}
          </section>
          <div className="s3-spacer" />
          <section className="s3-card s3-list" aria-label="Daftar objek" data-zone="list">
            {list}
          </section>
        </aside>
      )}

      <div className="s3-mid" ref={midRef}>
        {phone && <Watermark />}
        <MapControls interior={p.interior} onZoom={p.onZoom} onRotate={p.onRotate} onReset={p.onReset} onInterior={() => p.setInterior(!p.interior)} />
      </div>

      <div className="s3-bottom">
        {!phone && (
          <div className="s3-bottom-left">
            <Watermark />
            <section className="s3-card s3-flow" aria-label="Pelacakan alur" data-zone="flow">
              {flow}
            </section>
          </div>
        )}
        <Timeline mode={mode} clock={clock} onPlay={p.onPlay} onSpeed={p.onSpeed} onDay={p.onDay} onHour={p.onHour} />
        {phone && (
          <section className="s3-card s3-sheet" data-zone="sheet">
            <div className="s3-sheet-head" role="tablist" aria-label="Panel">
              {(
                [
                  ['objek', 'Objek'],
                  ['alur', 'Alur'],
                  ['daftar', 'Daftar'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={sheet === id}
                  className="s3-seg"
                  onClick={() => {
                    setSheet(id)
                    setSheetOpen(true)
                  }}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="s3-sheet-toggle" aria-expanded={sheetOpen} aria-label={sheetOpen ? 'Ciutkan panel' : 'Buka panel'} onClick={() => setSheetOpen(!sheetOpen)}>
                {sheetOpen ? '▾' : '▴'}
              </button>
            </div>
            {sheetOpen && (
              <div className="s3-sheet-body" role="tabpanel">
                {sheet === 'objek' ? selected : sheet === 'alur' ? flow : list}
              </div>
            )}
          </section>
        )}
      </div>

      {p.drawer && (
        <Drawer title={p.drawer.title} onClose={p.onCloseDrawer}>
          {p.drawer.body}
        </Drawer>
      )}
    </div>
  )
}
