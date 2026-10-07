// SimScreen (brief §7): the "Simulasi proses" screen. Owns the timeline state, the rAF
// playback clock, selection/follow, toggles and the trace drill-down. Lazy-loaded from the
// shell so the board's main bundle does not grow.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './sim.css'
import type { PrincipalId, Toggles } from '../engine/index.ts'
import { computeAll, DEFAULT_TOGGLES } from '../engine/index.ts'
import { must } from '../engine/trace.ts'
import { DetailPanel } from './DetailPanel.tsx'
import { Waterfall } from './Waterfall.tsx'
import { MetricsBar } from './MetricsBar.tsx'
import { Timeline } from './Timeline.tsx'
import { TogglesDrawer } from './TogglesDrawer.tsx'
import type { Trace } from '../engine/trace.ts'
import { WorldCanvas } from './WorldCanvas.tsx'

export default function SimScreen() {
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES)
  const [day, setDay] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [follow, setFollow] = useState<PrincipalId | null>(null)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dayProgress, setDayProgress] = useState(0)

  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const data = useMemo(() => computeAll(toggles), [toggles])
  const point = must(data.alloc.metrics[day - 1] ?? data.alloc.metrics[data.alloc.metrics.length - 1], 'metric point')
  const daysRef = useRef(data.world.days)
  useEffect(() => {
    daysRef.current = data.world.days
  }, [data.world.days])

  // Playback clock: one animation frame per tick; a day takes 2.2 s ÷ speed.
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const progressRef = useRef(0)
  useEffect(() => {
    if (!playing) {
      // Paused: sprites draw their day-end state; the clock simply stops.
      progressRef.current = 0
      lastRef.current = 0
      return
    }
    // Reduced motion jumps day to day instead of animating (§7.10).
    if (reducedMotion) {
      const iv = window.setInterval(() => setDay((d) => (d >= daysRef.current ? 1 : d + 1)), 420 / speed)
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
        setDayProgress(0)
      } else {
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

  // Keyboard: space toggles playback, arrows scrub (§7.10).
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

  return (
    <div className="sim-screen" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Simulasi proses</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Bulan ilustrasi, Hari 1–30 — satu siklus distribusi SAMB, dari forecast sampai kas masuk</span>
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)}>
          Aturan alokasi
        </button>
      </div>

      <MetricsBar point={point} alloc={data.alloc} selectedPrincipal={follow} onTrace={setTrace} />

      <div className="sim-body">
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          <WorldCanvas data={data} day={day} follow={follow} selected={selected} onSelect={onSelect} playing={playing} speed={speed} reducedMotion={reducedMotion} dayProgress={dayProgress} />
          <TogglesDrawer open={drawerOpen} toggles={toggles} onChange={setToggles} onClose={() => setDrawerOpen(false)} />
        </div>
        <div style={{ minHeight: 0, overflowY: 'auto' }} className="sim-panel">
          <DetailPanel
            data={data}
            day={day}
            toggles={toggles}
            selected={selected}
            follow={follow}
            onSelect={onSelect}
            onFollow={setFollow}
            trace={trace}
            onTrace={setTrace}
            onCloseTrace={() => setTrace(null)}
          />
          {follow && !selected && (
            <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14 }}>
              <Waterfall data={data} principal={follow} />
            </div>
          )}
        </div>
      </div>

      <Timeline
        day={day}
        days={data.world.days}
        playing={playing}
        speed={speed}
        cycle={data.events.cycle}
        onDay={setDay}
        onPlay={setPlaying}
        onSpeed={setSpeed}
      />
    </div>
  )
}
