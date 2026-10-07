// SimScreen2 (brief 2 §7): the "Gudang B2B + B2C" world — same layout as world 1 plus the
// intra-day clock (06.00–22.00 with the 12.00/16.00 cut-off marks), two follow modes and
// the world-2 metrics/panels. Lazy-loaded by SimHost.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeAll2, DEFAULT_TOGGLES, PLATFORMS, TOGGLE_DEFS } from '../engine/index.ts'
import type { Toggles2 } from '../engine/index.ts'
import type { Trace } from '../../../core/trace.ts'
import { Timeline } from '../../../core/Timeline.tsx'
import { Waterfall } from '../../../core/Waterfall.tsx'
import { TogglesDrawer } from '../../../core/TogglesDrawer.tsx'
import { formatPct } from '../../../core/format.ts'
import { DetailPanel2 } from './DetailPanel2.tsx'
import { MetricsBar2 } from './MetricsBar2.tsx'
import { WorldCanvas2 } from './WorldCanvas2.tsx'
import type { PrincipalId } from '../../../core/colors.ts'

export default function SimScreen2() {
  const [toggles, setToggles] = useState<Toggles2>(DEFAULT_TOGGLES)
  const [day, setDay] = useState(1)
  const [hour, setHour] = useState(6)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [follow, setFollow] = useState<PrincipalId | null>(null)
  const [followPlatform, setFollowPlatform] = useState<string | null>(null)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dayProgress, setDayProgress] = useState(0)

  // Reactive so a runtime OS-settings change is honoured, not just the value at mount.
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const data = useMemo(() => computeAll2(toggles), [toggles])
  const daysRef = useRef(data.world.days)
  useEffect(() => {
    daysRef.current = data.world.days
  }, [data.world.days])
  const hourRef = useRef(hour)
  useEffect(() => {
    hourRef.current = hour
  }, [hour])

  // Playback: one day takes 2.2 s ÷ speed, mapped over the 06.00–22.00 window.
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const progressRef = useRef(0)
  useEffect(() => {
    if (!playing) {
      progressRef.current = 0
      lastRef.current = 0
      return
    }
    if (reducedMotion) {
      // Decide the day roll-over from the current hour here, not inside a state updater:
      // updaters must be pure (StrictMode runs them twice, which skipped a day in dev).
      const iv = window.setInterval(() => {
        if (hourRef.current >= 22) {
          setDay((d) => (d >= daysRef.current ? 1 : d + 1))
          setHour(6)
        } else {
          setHour((h) => h + 1)
        }
      }, 320 / speed)
      return () => window.clearInterval(iv)
    }
    const msPerDay = 2200 / speed
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = now - lastRef.current
      lastRef.current = now
      progressRef.current += dt / msPerDay
      if (progressRef.current >= 1) {
        progressRef.current = 0
        setDay((d) => (d >= daysRef.current ? 1 : d + 1))
        setHour(6)
        setDayProgress(0)
      } else {
        setHour(6 + progressRef.current * 16)
        setDayProgress(progressRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
    }
  }, [playing, speed, reducedMotion])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowRight') setDay((d) => Math.min(daysRef.current, d + 1))
      else if (e.key === 'ArrowLeft') setDay((d) => Math.max(1, d - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSelect = useCallback((id: string | null) => {
    setSelected(id)
    setTrace(null)
  }, [])

  const sections = useMemo(
    () =>
      TOGGLE_DEFS.map((def) => ({
        label: def.label,
        options: def.options,
        current: String(toggles[def.key]),
        onSelect: (v: string) => setToggles({ ...toggles, [def.key]: v === 'on' ? true : v === 'off' ? false : v }),
      })),
    [toggles],
  )

  return (
    <div className="sim-screen" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Gudang B2B + B2C</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Bulan ilustrasi, Hari 1–30 — satu pool stok, dua pintu keluar</span>
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)}>
          Aturan alokasi
        </button>
      </div>

      <MetricsBar2 data={data} day={day} follow={follow} followPlatform={followPlatform} onTrace={setTrace} />

      <div className="sim-body">
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          <WorldCanvas2 data={data} day={day} hour={hour} follow={follow} followPlatform={followPlatform} selected={selected} onSelect={onSelect} playing={playing} speed={speed} reducedMotion={reducedMotion} dayProgress={dayProgress} />
          <TogglesDrawer
            open={drawerOpen}
            sections={sections}
            slider={{
              label: 'Biaya modal', min: 0, max: 0.2, step: 0.005, value: toggles.costOfCapital,
              format: (v) => formatPct(v, 0), onChange: (v) => setToggles({ ...toggles, costOfCapital: v }),
            }}
            onReset={() => setToggles(DEFAULT_TOGGLES)}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
        <div style={{ minHeight: 0, overflowY: 'auto' }} className="sim-panel">
          <DetailPanel2
            data={data}
            day={day}
            toggles={toggles}
            selected={selected}
            follow={follow}
            followPlatform={followPlatform}
            onSelect={onSelect}
            onFollow={setFollow}
            onFollowPlatform={setFollowPlatform}
            trace={trace}
            onTrace={setTrace}
            onCloseTrace={() => setTrace(null)}
          />
          {follow && !selected && (
            <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14 }}>
              <ChannelWaterfall data={data} principal={follow} />
            </div>
          )}
        </div>
      </div>

      <Timeline
        day={day}
        days={data.world.days}
        playing={playing}
        speed={speed}
        cycle={[
          { step: 1, day: 1, label: 'Order masuk', ref: 'oms' },
          { step: 2, day: 1, label: 'Kelola order', ref: 'oms' },
          { step: 3, day: 1, label: 'Picking', ref: 'pick' },
          { step: 4, day: 1, label: 'Packing', ref: 'pack' },
          { step: 5, day: 1, label: 'Dispatch', ref: 'dispatch' },
          { step: 6, day: 1, label: 'Serah kurir', ref: 'bay' },
          { step: 7, day: 2, label: 'Pesanan selesai', ref: 'done' },
          { step: 8, day: 3, label: 'Dana cair', ref: 'settle' },
        ]}
        onDay={(d) => {
          setDay(d)
          setHour(6)
        }}
        onPlay={setPlaying}
        onSpeed={setSpeed}
        intraDay={{ hour, from: 6, to: 22, cutoffs: [...new Set(PLATFORMS.map((p) => p.cutoffHour))], onHour: setHour }}
        stepShort={{ 1: 'Order', 2: 'Kelola', 3: 'Picking', 4: 'Packing', 5: 'Dispatch', 6: 'Kurir', 7: 'Selesai', 8: 'Dana cair' }}
      />
    </div>
  )
}

/** Followed principal: gross profit per channel down to contribution (§7.6 follow mode). */
function ChannelWaterfall({ data, principal }: { data: ReturnType<typeof computeAll2>; principal: PrincipalId }) {
  const r = data.alloc.principalChannel[principal]
  const shared = data.alloc.pools.filter((x) => x.byPrincipal).reduce((s, x) => s + x.total, 0)
  void shared
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Waterfall
        title={`Prinsipal ${principal} — B2B`}
        color="var(--accent)"
        steps={[
          { label: 'Laba kotor B2B', value: data.alloc.b2bAlloc.principal[principal].grossProfit, kind: 'start' },
          { label: 'Armada (truk)', value: -data.alloc.b2bAlloc.principal[principal].tripCost, kind: 'cost' },
          { label: 'Modal kas (TOP)', value: -data.alloc.b2bAlloc.principal[principal].capitalCash, kind: 'cost' },
          { label: 'Kontribusi B2B', value: r.b2b },
        ]}
      />
      <Waterfall
        title={`Prinsipal ${principal} — B2C`}
        color="var(--s-done)"
        steps={[
          { label: 'Pendapatan net B2C', value: r.revenueB2c, kind: 'start' },
          { label: 'Harga pokok (HPP)', value: -r.cogsB2c, kind: 'cost' },
          { label: 'Biaya channel + gudang', value: -(r.revenueB2c - r.cogsB2c - r.b2c), kind: 'cost' },
          { label: 'Kontribusi B2C', value: r.b2c },
        ]}
      />
    </div>
  )
}
