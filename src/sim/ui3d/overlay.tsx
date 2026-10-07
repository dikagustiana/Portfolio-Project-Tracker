// The overlay card system (Brief 3 §4): white rounded cards floating over the 3D scene —
// KPI row, search + world selector + clock chip, selected-object card, "Pelacakan alur",
// tabs list, slim timeline, map controls, drawers, watermark. Placeholder content for the
// V1 style frame, shaped exactly like the V2 bindings.

import { useState } from 'react'
import type { CameraState } from './Scene3D.tsx'
import { formatRpCard } from '../core/format.ts'

// --- Primitives -----------------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="sim3d-card"
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--line)',
        boxShadow: '0 12px 40px rgba(30, 42, 90, 0.14)',
        padding: '12px 14px',
        pointerEvents: 'auto',
        fontFamily: 'var(--f-ui)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function IconTile({ children, tint }: { children: React.ReactNode; tint: string }) {
  return (
    <span
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: tint,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        lineHeight: 1,
        flex: 'none',
      }}
      aria-hidden
    >
      {children}
    </span>
  )
}

function Delta({ value, dir }: { value: string; dir: 'up' | 'down' }) {
  const good = dir === 'down'
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        borderRadius: 999,
        padding: '1px 7px',
        background: good ? '#dcf3ee' : '#fcefe1',
        color: good ? '#0d7d69' : '#a8430b',
        marginLeft: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {dir === 'down' ? '▼' : '▲'} {value}
    </span>
  )
}

function KpiCard({ icon, tint, label, value, delta, dir }: { icon: React.ReactNode; tint: string; label: string; value: string; delta: string; dir: 'up' | 'down' }) {
  return (
    <Card style={{ width: 232, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconTile tint={tint}>{icon}</IconTile>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{value}</div>
        </div>
        <Delta value={delta} dir={dir} />
      </div>
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0', borderBottom: '1px dashed var(--line)' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v}</b>
    </div>
  )
}

function Chip({ text, tone = 'grey' }: { text: string; tone?: 'grey' | 'green' | 'amber' | 'blue' }) {
  const map = {
    grey: { bg: '#eef1f6', fg: '#5c6residual' },
    green: { bg: '#dcf3ee', fg: '#0d7d69' },
    amber: { bg: '#fcefe1', fg: '#a8430b' },
    blue: { bg: '#e7ebfc', fg: '#2f44b8' },
  } as const
  const m = tone === 'grey' ? { bg: '#eef1f6', fg: '#5c6a85' } : map[tone]
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: m.bg, color: m.fg, whiteSpace: 'nowrap' }}>{text}</span>
  )
}

// --- Zone cards (§4 table) ------------------------------------------------------------------

export function OverlaySim3D({ dark, cam, setCam, interior, setInterior, onZoom, onRotate, onReset }: { dark: boolean; cam: CameraState; setCam: (f: (c: CameraState) => CameraState) => void; interior: boolean; setInterior: (v: boolean) => void; onZoom: (f: number) => void; onRotate: () => void; onReset: () => void }) {
  const [tab, setTab] = useState<'dock' | 'truk' | 'order'>('truk')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  void dark
  void cam
  void setCam

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Top bar: KPI cards + search/world/clock, wrapping under 1500px (§4). */}
      <div style={{ position: 'absolute', left: 16, top: 16, right: 320, display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <KpiCard icon="📦" tint="#e7ebfc" label="Biaya per order B2C" value={formatRpCard(101_063)} delta="4,2%" dir="down" />
        <KpiCard icon="🚚" tint="#dcf3ee" label="Biaya per DO B2B" value={formatRpCard(195_308)} delta="1,8%" dir="up" />
        <KpiCard icon="🏭" tint="#fcefe1" label="Biaya gudang bersama" value={formatRpCard(230_400_000, 'jt')} delta="60/40" dir="down" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
        <Card style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, width: 250 }}>
          <span aria-hidden style={{ color: 'var(--muted)', fontSize: 13 }}>
            ⌕
          </span>
          <input placeholder="Cari truk, order, prinsipal…" aria-label="Cari objek" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, width: '100%', fontFamily: 'var(--f-ui)', color: 'var(--ink)' }} />
        </Card>
        <Card style={{ padding: '5px 6px', display: 'flex', gap: 4 }}>
          {(['Distribusi', 'Gudang B2B + B2C'] as const).map((w, i) => (
            <button
              key={w}
              type="button"
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: i === 1 ? 800 : 600,
                cursor: 'pointer',
                background: i === 1 ? 'var(--accent-soft)' : 'transparent',
                color: i === 1 ? 'var(--accent)' : 'var(--muted)',
                fontFamily: 'var(--f-ui)',
              }}
            >
              {w}
            </button>
          ))}
        </Card>
        <Card style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            aria-label={playing ? 'Jeda' : 'Putar'}
            onClick={() => setPlaying(!playing)}
            style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 8, width: 24, height: 24, cursor: 'pointer', fontSize: 10, lineHeight: 1 }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>Hari 8 · 10.44</span>
          <Chip text="Live" tone="green" />
        </Card>
        </div>
      </div>

      {/* Top right: Aturan alokasi button + selected-object card (§4). */}
      <div style={{ position: 'absolute', right: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="sim3d-card"
          style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'var(--surface)', fontFamily: 'var(--f-ui)', color: 'var(--ink)', pointerEvents: 'auto' }}
        >
          ⚙ Aturan alokasi
        </button>
        <Card style={{ width: 268 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <IconTile tint="#fcefe1">🛻</IconTile>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Forklift FL-01</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Tim inbound · S2</div>
            </div>
            <span style={{ marginLeft: 'auto' }}>
              <Chip text="Aktif" tone="green" />
            </span>
          </div>
          <div style={{ margin: '9px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
              <span>Utilisasi shift</span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>72%</b>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: '72%', height: '100%', background: 'var(--s-done)', borderRadius: 4 }} />
            </div>
          </div>
          <Row k="Palet ditangani" v="41" />
          <Row k="Zona kerja" v="Inbound → Rak 1–2" />
          <Row k="Operator" v="A-3" />
          <Row k="Bahan bakar" v="64%" />
          <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
            <button type="button" className="sim3d-card" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '5px 0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--f-ui)' }}>
              Ikuti
            </button>
            <button type="button" onClick={() => setTraceOpen(true)} className="sim3d-card" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '5px 0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--f-ui)' }}>
              Jejak angka
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom left: "Pelacakan alur" (§4). */}
      <Card style={{ position: 'absolute', left: 16, bottom: 16, width: 330 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: 0.3, marginBottom: 8 }}>PELACAKAN ALUR — ORDER O-00412</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {['Order', 'Pick', 'Packing', 'Kurir', 'Dana'].map((s, i, arr) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    background: i === 2 ? 'var(--accent)' : i < 2 ? 'var(--s-done)' : 'var(--surface-2)',
                    color: i <= 2 ? '#fff' : 'var(--muted)',
                    border: i === 2 ? '3px solid var(--accent-soft)' : '1px solid var(--line)',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: i === 2 ? 800 : 500, color: i === 2 ? 'var(--accent)' : 'var(--muted)' }}>{s}</span>
              </div>
              {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: i < 2 ? 'var(--s-done)' : 'var(--line)', margin: '0 2px 16px' }} />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, background: 'var(--surface-2)', borderRadius: 10, padding: '7px 9px' }}>
          <IconTile tint="#e7ebfc">📦</IconTile>
          <div style={{ fontSize: 11.5 }}>
            <b>2 item · Polymailer</b>
            <div style={{ color: 'var(--muted)' }}>MP-A · chargeable 1,8 kg</div>
          </div>
          <b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{formatRpCard(84_000)}</b>
        </div>
      </Card>

      {/* Bottom right: tabs Dock / Truk / Order (§4). */}
      <Card style={{ position: 'absolute', right: 16, bottom: 16, width: 300, padding: '10px 12px 8px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
          {(['dock', 'truk', 'order'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '4px 11px',
                fontSize: 11.5,
                fontWeight: tab === t ? 800 : 600,
                cursor: 'pointer',
                background: tab === t ? 'var(--accent-soft)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                fontFamily: 'var(--f-ui)',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {[
          { icon: '🚚', tint: '#e7ebfc', name: 'Truk B-02 · B2B', sub: 'Dock 2 · muat', status: 'Muat', tone: 'amber' as const },
          { icon: '🚚', tint: '#e7ebfc', name: 'Truk B-05 · B2B', sub: 'menuju Toko', status: 'Jalan', tone: 'green' as const },
          { icon: '🛵', tint: '#dcf3ee', name: 'Van K-11 · Kurir 1', sub: 'pickup 11.00', status: 'Antre', tone: 'grey' as const },
          { icon: '🛻', tint: '#fcefe1', name: 'Forklift FL-01', sub: 'rack 1 → dock', status: 'Aktif', tone: 'green' as const },
        ].map((r) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px dashed var(--line)' }}>
            <IconTile tint={r.tint}>{r.icon}</IconTile>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.sub}</div>
            </div>
            <span style={{ marginLeft: 'auto' }}>
              <Chip text={r.status} tone={r.tone} />
            </span>
          </div>
        ))}
      </Card>

      {/* Bottom centre: slim timeline (§4). */}
      <Card style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', width: 430 }}>
        <button type="button" aria-label={playing ? 'Jeda' : 'Putar'} onClick={() => setPlaying(!playing)} style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 10 }}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div role="group" aria-label="Kecepatan" style={{ display: 'flex', gap: 2 }}>
          {[1, 4, 16].map((s) => (
            <button
              key={s}
              type="button"
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '3px 7px',
                fontSize: 11,
                fontWeight: s === 4 ? 800 : 600,
                cursor: 'pointer',
                background: s === 4 ? 'var(--accent-soft)' : 'transparent',
                color: s === 4 ? 'var(--accent)' : 'var(--muted)',
                fontFamily: 'var(--f-ui)',
              }}
            >
              {s}×
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          <input type="range" min={1} max={30} value={8} aria-label="Geser hari" style={{ width: '100%', accentColor: 'var(--accent)', margin: 0 }} readOnly />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', whiteSpace: 'nowrap' }}>Hari 8</span>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input type="range" min={6} max={22} step={0.25} value={10.75} aria-label="Geser jam" style={{ width: 90, accentColor: 'var(--accent)', margin: 0 }} readOnly />
          <span aria-hidden style={{ position: 'absolute', left: '43%', top: -3, width: 2, height: 12, background: 'var(--warn)' }} />
          <span aria-hidden style={{ position: 'absolute', left: '71%', top: -3, width: 2, height: 12, background: 'var(--warn)' }} />
        </span>
      </Card>

      {/* Right edge: map controls + "Lihat dalam gudang" (§3.1, §4). */}
      <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Perbesar', icon: '+', fn: () => onZoom(1.25) },
          { label: 'Perkecil', icon: '−', fn: () => onZoom(0.8) },
          { label: 'Putar 90°', icon: '⟳', fn: () => onRotate() },
          { label: 'Reset tampilan', icon: '⤢', fn: () => onReset() },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.label}
            title={b.label}
            onClick={b.fn}
            className="sim3d-card"
            style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 15, cursor: 'pointer', color: 'var(--ink)', fontFamily: 'var(--f-ui)', padding: 0 }}
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={interior}
          onClick={() => setInterior(!interior)}
          className="sim3d-card"
          style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line)', background: interior ? 'var(--accent-soft)' : 'var(--surface)', fontSize: 14, cursor: 'pointer', color: interior ? 'var(--accent)' : 'var(--ink)', fontFamily: 'var(--f-ui)', padding: 0 }}
          title="Lihat dalam gudang"
        >
          🏠
        </button>
      </div>

      {/* Watermark (§1.5). */}
      <div style={{ position: 'absolute', left: 16, bottom: 158, pointerEvents: 'none' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', background: 'color-mix(in srgb, var(--surface) 82%, transparent)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px' }}>Ilustrasi — angka dummy, bukan data SAMB</span>
      </div>

      {/* Drawer: Aturan alokasi (placeholder shapes for V1; real toggles wire in V2). */}
      {rulesOpen && (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 360, background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-16px 0 44px rgba(30,42,90,0.16)', pointerEvents: 'auto', padding: 18, fontFamily: 'var(--f-ui)', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: 15 }}>Aturan alokasi</b>
            <button type="button" aria-label="Tutup" onClick={() => setRulesOpen(false)} style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: 15, cursor: 'pointer', color: 'var(--muted)' }}>
              ✕
            </button>
          </div>
          {['Biaya gudang bersama ke channel', 'Tim outbound dipakai bersama', 'Ongkir ditanggung'].map((label, i) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(i === 0 ? ['Porsi volume keluar', 'Tidak dibagi'] : i === 1 ? ['Bersama', 'Terpisah'] : ['Konsumen', 'Platform', 'Penjual']).map((opt, j) => (
                  <span key={opt} style={{ fontSize: 11.5, fontWeight: j === 0 ? 800 : 600, borderRadius: 999, padding: '4px 11px', background: j === 0 ? 'var(--accent-soft)' : 'var(--surface-2)', color: j === 0 ? 'var(--accent)' : 'var(--muted)' }}>
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Biaya modal: 12% (asumsi)</div>
            <input type="range" min={0} max={20} value={12} readOnly style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Nilai di frame ini adalah placeholder bentuk kartu; toggle sungguhan tersambung di V2 dan angka terhitung ulang dari engine.
          </div>
        </div>
      )}

      {/* Drawer: Jejak angka (placeholder shape). */}
      {traceOpen && (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 360, background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-16px 0 44px rgba(30,42,90,0.16)', pointerEvents: 'auto', padding: 18, fontFamily: 'var(--f-ui)', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: 15 }}>Jejak angka</b>
            <button type="button" aria-label="Tutup" onClick={() => setTraceOpen(false)} style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: 15, cursor: 'pointer', color: 'var(--muted)' }}>
              ✕
            </button>
          </div>
          <Card style={{ boxShadow: 'none' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Biaya per order B2C</div>
            <div style={{ fontSize: 12, background: 'var(--surface-2)', borderRadius: 8, padding: '7px 9px', fontVariantNumeric: 'tabular-nums' }}>
              biaya B2C ÷ order = <b>{formatRpCard(101_063)}</b>
            </div>
            <Row k="biaya B2C" v={formatRpCard(789_500_000, 'jt')} />
            <Row k="order" v="7.804" />
          </Card>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Formula, input yang bisa diklik, dan tanda "recompute sama" tersambung dari engine di V2.
          </div>
        </div>
      )}
    </div>
  )
}
