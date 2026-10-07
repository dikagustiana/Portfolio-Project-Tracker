// The overlay card system (Brief 3 §4): white rounded cards floating over the 3D scene —
// KPI row, search + world selector + clock chip, selected-object card, "Pelacakan alur", list
// tabs, slim timeline, map controls, drawers, watermark. Layout lives in sim3d.css (one grid,
// fixed areas); on a phone the three panels share one bottom sheet. Placeholder content for
// the V1 style frame, shaped like the V2 engine bindings. Every top-level card carries a
// `data-zone` so the style-frame script can prove that no two cards overlap.

import { useEffect, useRef, useState } from 'react'
import { formatClock, formatRpCard } from '../core/format.ts'
import { PLATFORMS } from '../worlds/b2b-b2c/engine/config.ts'

export type OverlayMode = 'wide' | 'medium' | 'phone'
export type WorldId = 'distribusi' | 'b2b-b2c'
type Tone = 'grey' | 'green' | 'amber' | 'blue'

const WORLDS: { id: WorldId; label: string }[] = [
  { id: 'distribusi', label: 'Distribusi' },
  { id: 'b2b-b2c', label: 'Gudang B2B + B2C' },
]

// Intra-day clock window (world 2) and the platform cut-offs drawn on the hour slider.
const HOUR_FROM = 6
const HOUR_TO = 22
const DAYS = 30
const CUTOFFS = [...new Set(PLATFORMS.map((p) => p.cutoffHour))].sort((a, b) => a - b).map((h) => ({ h, who: PLATFORMS.filter((p) => p.cutoffHour === h).map((p) => p.label) }))

// --- Placeholder content (V2 replaces these with engine bindings of the same shape) ----------

interface Kpi {
  id: string
  icon: string
  tone: Tone
  label: string
  value: string
  delta?: { text: string; dir: 'up' | 'down'; hint: string }
  note?: { text: string; hint: string }
}

const KPIS: Kpi[] = [
  { id: 'b2c', icon: '📦', tone: 'blue', label: 'Biaya per order B2C', value: formatRpCard(101_063), delta: { text: '4,2%', dir: 'down', hint: 'turun 4,2% dari hari sebelumnya' } },
  { id: 'b2b', icon: '🚚', tone: 'green', label: 'Biaya per DO B2B', value: formatRpCard(195_308), delta: { text: '1,8%', dir: 'up', hint: 'naik 1,8% dari hari sebelumnya' } },
  { id: 'shared', icon: '🏭', tone: 'amber', label: 'Biaya gudang bersama', value: formatRpCard(230_400_000), note: { text: '60/40', hint: 'Porsi B2B / B2C menurut volume keluar' } },
]

interface ListItem {
  icon: string
  tone: Tone
  name: string
  sub: string
  status: string
  statusTone: Tone
}

type ListTab = 'dock' | 'truk' | 'order'

const LISTS: Record<ListTab, ListItem[]> = {
  dock: [
    { icon: '📥', tone: 'amber', name: 'Dock 1 · Inbound', sub: 'kontainer C-07 · bongkar', status: 'Bongkar', statusTone: 'amber' },
    { icon: '🚚', tone: 'blue', name: 'Dock 2 · B2B', sub: 'Truk B-02 · 14 palet', status: 'Muat', statusTone: 'amber' },
    { icon: '🚚', tone: 'blue', name: 'Dock 3 · B2B', sub: 'jadwal 13.00', status: 'Kosong', statusTone: 'grey' },
    { icon: '🛵', tone: 'green', name: 'Bay kurir', sub: '3 kurir · jemput 11.00', status: 'Antre', statusTone: 'grey' },
  ],
  truk: [
    { icon: '🚚', tone: 'blue', name: 'Truk B-02 · B2B', sub: 'Dock 2 · muat', status: 'Muat', statusTone: 'amber' },
    { icon: '🚚', tone: 'blue', name: 'Truk B-05 · B2B', sub: 'menuju Toko', status: 'Jalan', statusTone: 'green' },
    { icon: '🛵', tone: 'green', name: 'Van K-11 · Kurir 1', sub: 'jemput 11.00', status: 'Antre', statusTone: 'grey' },
    { icon: '🚛', tone: 'amber', name: 'Truk C-01 · Inbound', sub: 'Dock 1 · bongkar', status: 'Bongkar', statusTone: 'amber' },
  ],
  order: [
    { icon: '📦', tone: 'blue', name: 'O-00412 · MP-A', sub: 'P1 · packing', status: 'Packing', statusTone: 'blue' },
    { icon: '⚡', tone: 'amber', name: 'O-00415 · Website', sub: 'P0 · pick', status: 'Pick', statusTone: 'amber' },
    { icon: '📦', tone: 'blue', name: 'O-00398 · MP-C', sub: 'P2 · besok', status: 'Antre', statusTone: 'grey' },
    { icon: '🧾', tone: 'green', name: 'DO-0231 · Toko 14', sub: 'B2B · 6 karton', status: 'Muat', statusTone: 'amber' },
  ],
}

const FLOW_STEPS = ['Order', 'Pick', 'Packing', 'Kurir', 'Dana']
const FLOW_CURRENT = 2

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="s3-row">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  )
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="s3-card s3-kpi" data-zone={`kpi-${kpi.id}`}>
      <IconTile icon={kpi.icon} tone={kpi.tone} />
      <div className="s3-kpi-text">
        <div className="s3-kpi-label" title={kpi.label}>
          {kpi.label}
        </div>
        <div className="s3-kpi-value">
          <b>{kpi.value}</b>
          {kpi.delta && (
            // Cost going down is good (teal), going up needs attention (amber).
            <span className={`s3-delta s3-tone-${kpi.delta.dir === 'down' ? 'green' : 'amber'}`} title={kpi.delta.hint} aria-label={kpi.delta.hint}>
              {kpi.delta.dir === 'down' ? '▼' : '▲'} {kpi.delta.text}
            </span>
          )}
          {kpi.note && <Chip text={kpi.note.text} title={kpi.note.hint} />}
        </div>
      </div>
    </div>
  )
}

// --- Panels (shared by the desktop cards and the phone bottom sheet) --------------------------

function SelectedObject({ onTrace }: { onTrace: () => void }) {
  return (
    <>
      <div className="s3-head">
        <IconTile icon="🛻" tone="amber" />
        <div>
          <div className="s3-title">Forklift FL-01</div>
          <div className="s3-sub">Tim inbound · S2</div>
        </div>
        <span style={{ marginLeft: 'auto' }}>
          <Chip text="Aktif" tone="green" />
        </span>
      </div>
      <div style={{ margin: '9px 0 4px' }}>
        <div className="s3-sub" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span>Utilisasi shift</span>
          <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>72%</b>
        </div>
        <div className="s3-bar" role="img" aria-label="Utilisasi shift 72%">
          <i style={{ width: '72%' }} />
        </div>
      </div>
      <Row k="Palet ditangani" v="41" />
      <Row k="Zona kerja" v="Inbound → Rak 1–2" />
      <Row k="Operator" v="A-3" />
      <Row k="Bahan bakar" v="64%" />
      <div className="s3-actions">
        <button type="button" className="s3-action is-primary">
          Ikuti
        </button>
        <button type="button" className="s3-action" onClick={onTrace}>
          Jejak angka
        </button>
      </div>
    </>
  )
}

function FlowTrace() {
  return (
    <>
      <div className="s3-kicker">Pelacakan alur — order O-00412</div>
      <ol className="s3-steps">
        {FLOW_STEPS.map((s, i) => (
          <li key={s} className={`s3-step ${i < FLOW_CURRENT ? 'is-done' : i === FLOW_CURRENT ? 'is-current' : 'is-todo'}`} aria-current={i === FLOW_CURRENT ? 'step' : undefined}>
            <span className="s3-dot">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="s3-flow-item">
        <IconTile icon="📦" tone="blue" />
        <div>
          <b>2 item · Polymailer</b>
          <div className="s3-sub">MP-A · berat tagih 1,8 kg</div>
        </div>
        <b>{formatRpCard(84_000)}</b>
      </div>
    </>
  )
}

function ObjectList() {
  const [tab, setTab] = useState<ListTab>('truk')
  return (
    <>
      <div className="s3-tabs" role="tablist" aria-label="Daftar objek">
        {(['dock', 'truk', 'order'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="s3-seg" onClick={() => setTab(t)}>
            {t === 'dock' ? 'Dock' : t === 'truk' ? 'Truk' : 'Order'}
          </button>
        ))}
      </div>
      <div className="s3-list-body" role="tabpanel">
        {LISTS[tab].map((r) => (
          <div key={r.name} className="s3-item">
            <IconTile icon={r.icon} tone={r.tone} />
            <div style={{ minWidth: 0 }}>
              <div className="s3-item-name">{r.name}</div>
              <div className="s3-sub">{r.sub}</div>
            </div>
            <Chip text={r.status} tone={r.statusTone} />
          </div>
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

interface ClockState {
  day: number
  hour: number
  speed: number
  playing: boolean
}

function Timeline({ mode, clock, setClock }: { mode: OverlayMode; clock: ClockState; setClock: (f: (c: ClockState) => ClockState) => void }) {
  return (
    <div className="s3-card s3-timeline" data-zone="timeline">
      <button type="button" className="s3-play" aria-label={clock.playing ? 'Jeda' : 'Putar'} onClick={() => setClock((c) => ({ ...c, playing: !c.playing }))}>
        {clock.playing ? '❚❚' : '▶'}
      </button>
      <div className="s3-speeds" role="group" aria-label="Kecepatan">
        {[1, 4, 16].map((s) => (
          <button key={s} type="button" className="s3-seg" aria-pressed={clock.speed === s} onClick={() => setClock((c) => ({ ...c, speed: s }))}>
            {s}×
          </button>
        ))}
      </div>
      <div className="s3-day">
        <input type="range" className="s3-range" min={1} max={DAYS} value={clock.day} aria-label="Geser hari" onChange={(e) => setClock((c) => ({ ...c, day: Number(e.target.value) }))} />
      </div>
      <span className="s3-time">{mode === 'phone' ? `Hari ${clock.day} · ${formatClock(clock.hour)}` : `Hari ${clock.day}`}</span>
      <span className="s3-hour">
        <input type="range" className="s3-range" min={HOUR_FROM} max={HOUR_TO} step={0.25} value={clock.hour} aria-label="Geser jam" aria-valuetext={formatClock(clock.hour)} onChange={(e) => setClock((c) => ({ ...c, hour: Number(e.target.value) }))} />
        {CUTOFFS.map((c) => (
          <span key={c.h} className="s3-mark" style={{ '--f': (c.h - HOUR_FROM) / (HOUR_TO - HOUR_FROM) } as React.CSSProperties} title={`Batas order ${formatClock(c.h)} · ${c.who.join(', ')}`} />
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

function RulesDrawer({ onClose }: { onClose: () => void }) {
  const groups = [
    { label: 'Biaya gudang bersama ke channel', options: ['Porsi volume keluar', 'Tidak dibagi'] },
    { label: 'Tim outbound dipakai bersama', options: ['Bersama', 'Terpisah'] },
    { label: 'Ongkir ditanggung', options: ['Konsumen', 'Platform', 'Penjual'] },
  ]
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [g.label, g.options[0] ?? ''])))
  const [capital, setCapital] = useState(12)
  return (
    <Drawer title="Aturan alokasi" onClose={onClose}>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="s3-field-label">{g.label}</div>
          <div className="s3-options" role="group" aria-label={g.label}>
            {g.options.map((opt) => (
              <button key={opt} type="button" className="s3-seg" aria-pressed={picked[g.label] === opt} onClick={() => setPicked((p) => ({ ...p, [g.label]: opt }))}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <div className="s3-field-label">Biaya modal: {capital}% per tahun (asumsi)</div>
        <input type="range" className="s3-range" min={0} max={20} value={capital} aria-label="Biaya modal" onChange={(e) => setCapital(Number(e.target.value))} />
      </div>
      <div className="s3-note">Pilihan di sini masih contoh bentuk. Di V2 tersambung ke mesin simulasi dan semua angka dihitung ulang.</div>
    </Drawer>
  )
}

function TraceDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="Jejak angka" onClose={onClose}>
      <div className="s3-card" style={{ boxShadow: 'none' }}>
        <div className="s3-field-label">Biaya per order B2C</div>
        <div className="s3-formula">
          biaya B2C ÷ order = <b>{formatRpCard(101_063)}</b>
        </div>
        <Row k="biaya B2C" v={formatRpCard(788_700_000, 'jt')} />
        <Row k="order" v="7.804" />
      </div>
      <div className="s3-note">Rumus, input yang bisa diklik, dan tanda &ldquo;hitung ulang sama&rdquo; tersambung di V2.</div>
    </Drawer>
  )
}

// --- Composition ------------------------------------------------------------------------------

export interface OverlayProps {
  mode: OverlayMode
  /** Container height; a short phone screen starts with the bottom sheet folded. */
  height: number
  world: WorldId
  onWorld: (w: WorldId) => void
  interior: boolean
  setInterior: (v: boolean) => void
  onZoom: (f: number) => void
  onRotate: () => void
  onReset: () => void
  /** Reports where the free scene area's centre sits relative to the container centre (px),
   *  so the camera can frame the scene between the cards instead of behind them. */
  onFocus: (offset: { x: number; y: number }) => void
}

export function OverlaySim3D({ mode, height, world, onWorld, interior, setInterior, onZoom, onRotate, onReset, onFocus }: OverlayProps) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const [clock, setClock] = useState<ClockState>({ day: 8, hour: 10.75, speed: 4, playing: false })
  const [sheet, setSheet] = useState<'objek' | 'alur' | 'daftar'>('objek')
  const [sheetOpen, setSheetOpen] = useState(() => height >= 640)
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

  // Preview clock: 15 simulated minutes per tick until V2 drives it from the engine. Discrete
  // steps, nothing tweens, so reduced motion needs no special case.
  useEffect(() => {
    if (!clock.playing) return
    const iv = window.setInterval(() => {
      setClock((c) => (c.hour + 0.25 > HOUR_TO ? { ...c, hour: HOUR_FROM, day: c.day >= DAYS ? 1 : c.day + 1 } : { ...c, hour: c.hour + 0.25 }))
    }, 1000 / clock.speed)
    return () => window.clearInterval(iv)
  }, [clock.playing, clock.speed])

  const controls = <MapControls interior={interior} onZoom={onZoom} onRotate={onRotate} onReset={onReset} onInterior={() => setInterior(!interior)} />

  return (
    <div className="s3-overlay" ref={rootRef}>
      <div className="s3-top">
        <div className="s3-searchbar">
          <label className="s3-card s3-search" data-zone="search">
            <span aria-hidden>⌕</span>
            <input placeholder="Cari truk, order, prinsipal…" aria-label="Cari objek" />
          </label>
          {phone && (
            <button type="button" className="s3-card s3-iconbtn" aria-label="Aturan alokasi" title="Aturan alokasi" onClick={() => setRulesOpen(true)} data-zone="rules">
              ⚙
            </button>
          )}
          <div className="s3-card s3-worlds" role="group" aria-label="Pilih dunia simulasi" data-zone="worlds">
            {WORLDS.map((w) => (
              <button key={w.id} type="button" className="s3-seg" aria-pressed={world === w.id} onClick={() => onWorld(w.id)}>
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
          {KPIS.map((k) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </div>
      </div>

      {!phone && (
        <aside className="s3-side">
          <button type="button" className="s3-card s3-rules" onClick={() => setRulesOpen(true)} data-zone="rules">
            ⚙ Aturan alokasi
          </button>
          <section className="s3-card s3-selected" aria-label="Objek terpilih" data-zone="selected">
            <SelectedObject onTrace={() => setTraceOpen(true)} />
          </section>
          <div className="s3-spacer" />
          <section className="s3-card s3-list" aria-label="Daftar objek" data-zone="list">
            <ObjectList />
          </section>
        </aside>
      )}

      <div className="s3-mid" ref={midRef}>
        {phone && <Watermark />}
        {controls}
      </div>

      <div className="s3-bottom">
        {!phone && (
          <div className="s3-bottom-left">
            <Watermark />
            <section className="s3-card s3-flow" aria-label="Pelacakan alur" data-zone="flow">
              <FlowTrace />
            </section>
          </div>
        )}
        <Timeline mode={mode} clock={clock} setClock={setClock} />
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
                {sheet === 'objek' ? <SelectedObject onTrace={() => setTraceOpen(true)} /> : sheet === 'alur' ? <FlowTrace /> : <ObjectList />}
              </div>
            )}
          </section>
        )}
      </div>

      {rulesOpen && <RulesDrawer onClose={() => setRulesOpen(false)} />}
      {traceOpen && <TraceDrawer onClose={() => setTraceOpen(false)} />}
    </div>
  )
}
