// Sim3D (Brief 3 §1, §4): the 3D view of world 2 "Gudang B2B + B2C" — the default for that
// world when WebGL is available and motion is welcome (SimHost decides; the 2D canvas stays
// as fallback). It owns the engine state (toggles, clock, selection, follow) and binds every
// overlay card to the engine through bindings2.ts. All labels are plain projected DOM — no
// drei <Html>, which breaks under React 19.3 (root-unmount race).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './sim3d.css'
import { Scene3D } from './Scene3D.tsx'
import { CAMERA_DEFAULT, makeProjector, panByPixels, rotateStep, zoomBy } from './camera3d.ts'
import type { CameraState } from './camera3d.ts'
import { LABELS2 } from './anchors2.ts'
import type { ProjectedLabel } from './anchors2.ts'
import { OverlaySim3D } from './overlay.tsx'
import type { ClockView, OverlayMode, OverlayProps, WorldId } from './overlay.tsx'
import { useDarkTheme } from './theme3d.ts'
import { useReducedMotion } from './support.ts'
import { DAY_END, DAY_START, kpis2, lists2, search2, selection2, summary2, track2 } from './bindings2.ts'
import type { Target } from './bindings2.ts'
import { RulesBody } from './panels3d.tsx'
import { objectOfVehicle, vehicles2, vehicleSelection2, vehicleWhen } from './motion2.ts'
import { computeAll2, DEFAULT_TOGGLES, PLATFORMS } from '../worlds/b2b-b2c/engine/index.ts'
import type { Toggles2 } from '../worlds/b2b-b2c/engine/index.ts'
import { metricItems2 } from '../worlds/b2b-b2c/ui/metrics2.ts'
import { DetailPanel2, OrderWaterfall } from '../worlds/b2b-b2c/ui/DetailPanel2.tsx'
import { TraceView } from '../core/TraceView.tsx'
import type { Trace } from '../core/trace.ts'
import type { PrincipalId } from '../core/colors.ts'

/** Layout mode from the measured container width (not the viewport): the KPI row and the
 *  search group share one top row only when both fit beside the right column. */
function modeFor(width: number): OverlayMode {
  if (width >= 1720) return 'wide'
  if (width >= 900) return 'medium'
  return 'phone'
}

const CUTOFFS = [...new Set(PLATFORMS.map((p) => p.cutoffHour))].sort((a, b) => a - b).map((h) => ({ h, who: PLATFORMS.filter((p) => p.cutoffHour === h).map((p) => p.label) }))

/** Playback pace: one simulated hour per second at 1× (a day in 16 s, a month in 30 s at 16×).
 *  Slower than the 2D world's 2,2 s per day so vehicles can be followed by eye. */
const HOURS_PER_SECOND = 1
const isVehicle = (id: string | null): id is string => !!id && id.includes(':')

interface Clock {
  day: number
  hour: number
  speed: number
  playing: boolean
}

type DrawerState = { kind: 'rules' } | { kind: 'trace'; trace: Trace } | { kind: 'detail' } | { kind: 'order'; id: string } | null

export interface Sim3DProps {
  world?: WorldId
  onWorld?: (w: WorldId) => void
  /** Offer the "Tampilan 2D" switch. */
  on2D?: () => void
  /** Open the app's side menu (phones). */
  onMenu?: () => void
  initialDay?: number
  initialHour?: number
}

export default function Sim3D({ world = 'b2b-b2c', onWorld = () => {}, on2D, onMenu, initialDay = 1, initialHour = 9 }: Sim3DProps) {
  const dark = useDarkTheme()
  const reducedMotion = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cam, setCam] = useState<CameraState>(CAMERA_DEFAULT)
  const [interior, setInterior] = useState(false)
  const [focus, setFocus] = useState({ x: 0, y: 0 })
  const onFocus = useCallback((f: { x: number; y: number }) => setFocus((p) => (p.x === f.x && p.y === f.y ? p : f)), [])

  // Engine state.
  const [toggles, setToggles] = useState<Toggles2>(DEFAULT_TOGGLES)
  const data = useMemo(() => computeAll2(toggles), [toggles])
  const days = data.world.days
  const [clock, setClock] = useState<Clock>({ day: Math.min(days, Math.max(1, initialDay)), hour: initialHour, speed: 1, playing: false })
  /** A map object id (objects2.ts) or a vehicle id (`trip:…`, `mf:…`, `po:…`, `fl:…`). */
  const [selected, setSelected] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [trackedOrder, setTrackedOrder] = useState<string | null>(null)
  const [follow, setFollow] = useState<PrincipalId | null>(null)
  const [followPlatform, setFollowPlatform] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [detailTrace, setDetailTrace] = useState<Trace | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Playback. Reduced motion steps an hour at a time instead of sweeping.
  const advance = useCallback(
    (hours: number) =>
      setClock((c) => {
        const hour = c.hour + hours
        if (hour <= DAY_END) return { ...c, hour }
        return { ...c, hour: DAY_START, day: c.day >= days ? 1 : c.day + 1 }
      }),
    [days],
  )
  useEffect(() => {
    if (!clock.playing) return
    if (reducedMotion) {
      const iv = window.setInterval(() => advance(1), 1000 / (HOURS_PER_SECOND * clock.speed))
      return () => window.clearInterval(iv)
    }
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (last) advance(((now - last) / 1000) * HOURS_PER_SECOND * clock.speed)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clock.playing, clock.speed, reducedMotion, advance])

  // Keyboard: space plays/pauses, ← → change the day (as in the 2D worlds).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLButtonElement || t instanceof HTMLSelectElement) return
      if (e.key === ' ') {
        e.preventDefault()
        setClock((c) => ({ ...c, playing: !c.playing }))
      } else if (e.key === 'ArrowRight') setClock((c) => ({ ...c, day: Math.min(days, c.day + 1) }))
      else if (e.key === 'ArrowLeft') setClock((c) => ({ ...c, day: Math.max(1, c.day - 1) }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [days])

  // Views. Day-level figures are memoised per day; hour-level lists are cheap.
  const { day, hour } = clock
  const kpis = useMemo(() => kpis2(data, day), [data, day])
  const metrics = useMemo(() => metricItems2(data, day, follow, followPlatform).items, [data, day, follow, followPlatform])
  const lists = useMemo(() => lists2(data, day, hour), [data, day, hour])
  const track = useMemo(() => track2(data, day, hour, trackedOrder), [data, day, hour, trackedOrder])
  const vehicles = useMemo(() => vehicles2(data, day, hour), [data, day, hour])
  const onMap = isVehicle(selected) ? vehicles.find((v) => v.id === selected) : undefined
  const selection = useMemo(() => (isVehicle(selected) ? vehicleSelection2(data, day, hour, selected, onMap) : selected ? selection2(data, day, hour, selected, metrics) : null), [data, day, hour, selected, metrics, onMap])
  const summary = useMemo(() => summary2(data, day, hour, metrics), [data, day, hour, metrics])
  const onSearch = useCallback((q: string) => search2(data, q), [data])

  const select = useCallback((id: string | null) => {
    setSelected(id)
    setFollowing(false)
  }, [])
  const onTarget = useCallback(
    (t: Target) => {
      if (t.kind === 'object') {
        select(t.id)
        return
      }
      if (t.kind === 'vehicle') {
        select(t.id)
        const when = vehicleWhen(data, t.id)
        if (when && when.day !== day) setClock((c) => ({ ...c, ...when }))
        return
      }
      setTrackedOrder(t.id)
      const o = data.world.orders.find((x) => x.id === t.id)
      if (o && o.day !== day) setClock((c) => ({ ...c, day: o.day, hour: o.hour }))
    },
    [data, day, select],
  )
  const closeDrawer = useCallback(() => {
    setDrawer(null)
    setDetailTrace(null)
  }, [])

  const drawerView: OverlayProps['drawer'] =
    drawer?.kind === 'rules'
      ? { title: 'Aturan alokasi', body: <RulesBody toggles={toggles} onChange={setToggles} /> }
      : drawer?.kind === 'trace'
        ? { title: 'Jejak angka', body: <TraceView root={drawer.trace} onClose={closeDrawer} /> }
        : drawer?.kind === 'order'
          ? { title: `Order ${drawer.id}`, body: <OrderWaterfall data={data} orderId={drawer.id} /> }
          : drawer?.kind === 'detail'
            ? {
                title: selected ? 'Detail objek' : 'Ikuti prinsipal / platform',
                body: (
                  <DetailPanel2
                    data={data}
                    day={day}
                    toggles={toggles}
                    selected={isVehicle(selected) ? objectOfVehicle(selected) : selected}
                    follow={follow}
                    followPlatform={followPlatform}
                    onSelect={select}
                    onFollow={setFollow}
                    onFollowPlatform={setFollowPlatform}
                    trace={detailTrace}
                    onTrace={setDetailTrace}
                    onCloseTrace={() => setDetailTrace(null)}
                  />
                ),
              }
            : null

  const clockView: ClockView = { day, days, hour, from: DAY_START, to: DAY_END, speed: clock.speed, playing: clock.playing, cutoffs: CUTOFFS }

  // "Ikuti": while the followed vehicle is on the map the camera centres on it (derived, no
  // effect); when it leaves, the view returns to the user's camera. A drag ends following
  // from wherever the camera is.
  const followed = following ? onMap : undefined
  const userCam = useMemo(() => (followed ? { ...cam, panX: followed.x, panZ: followed.z } : cam), [cam, followed])
  // The rendered view shifts the camera so its target lands on the free area's centre; zoom
  // and rotation then pivot there too.
  const view = useMemo(() => (size.w ? panByPixels(userCam, focus.x, focus.y, size.w, size.h) : userCam), [userCam, focus, size])

  const labels = useMemo<ProjectedLabel[]>(() => {
    if (!size.w) return []
    const project = makeProjector(view, size.w, size.h)
    const tags: ProjectedLabel[] = onMap ? [{ id: 'tag-selected', at: [onMap.x, 2.6, onMap.z], text: onMap.label, kind: 'tag', ...project([onMap.x, 2.6, onMap.z]) }] : []
    return [...LABELS2.map((a) => ({ ...a, ...project(a.at) })), ...tags]
  }, [view, size, onMap])

  const mode = modeFor(size.w)

  return (
    <div ref={wrapRef} className={`s3-root s3-root--${mode}`}>
      <Scene3D
        dark={dark}
        view={view}
        cam={userCam}
        setCam={setCam}
        interior={interior}
        vehicles={vehicles}
        selected={selected}
        onPick={select}
        onDragStart={() => {
          if (!following) return
          setCam(userCam)
          setFollowing(false)
        }}
      />
      <LabelLayer labels={labels} selected={selected} onPin={select} />
      {size.w > 0 && (
        <OverlaySim3D
          mode={mode}
          height={size.h}
          onFocus={onFocus}
          world={world}
          onWorld={onWorld}
          on2D={on2D}
          onMenu={onMenu}
          kpis={kpis}
          clock={clockView}
          onPlay={() => setClock((c) => ({ ...c, playing: !c.playing }))}
          onSpeed={(s) => setClock((c) => ({ ...c, speed: s }))}
          onDay={(d) => setClock((c) => ({ ...c, day: d, hour: DAY_START }))}
          onHour={(h) => setClock((c) => ({ ...c, hour: h }))}
          selection={selection}
          summary={summary}
          onClearSelection={() => select(null)}
          following={!!followed}
          onFollow={() => {
            if (followed) setCam(userCam)
            setFollowing(!followed)
          }}
          onDetail={() => setDrawer({ kind: 'detail' })}
          track={track}
          onTrackOrder={() => track && setDrawer({ kind: 'order', id: track.orderId })}
          lists={lists}
          onTarget={onTarget}
          onSearch={onSearch}
          onTrace={(t) => setDrawer({ kind: 'trace', trace: t })}
          onRules={() => setDrawer({ kind: 'rules' })}
          drawer={drawerView}
          onCloseDrawer={closeDrawer}
          interior={interior}
          setInterior={setInterior}
          onZoom={(f) => setCam((c) => zoomBy(c, f))}
          onRotate={() => setCam(rotateStep)}
          onReset={() => setCam(CAMERA_DEFAULT)}
        />
      )}
    </div>
  )
}

/** Projected DOM labels: teardrop pins (buttons that open their object), signpost plates, the
 *  cut-off clock chip. */
function LabelLayer({ labels, selected, onPin }: { labels: ProjectedLabel[]; selected: string | null; onPin: (id: string) => void }) {
  return (
    <div className="s3-labels">
      {labels.map((l) => {
        const target = l.target
        if (l.kind === 'tag') {
          return (
            <div key={l.id} aria-hidden className="s3-pin is-tag" style={{ left: l.left, top: l.top }}>
              <span>{l.text}</span>
              <svg width="14" height="12" viewBox="0 0 14 12">
                <path d="M7 12 L1 2 Q7 -3 13 2 Z" />
              </svg>
            </div>
          )
        }
        if (l.kind === 'pin' && target) {
          return (
            <button key={l.id} type="button" className={`s3-pin${selected === target ? ' is-on' : ''}`} style={{ left: l.left, top: l.top }} onClick={() => onPin(target)} aria-label={`Buka ${l.text}`}>
              <span>{l.text}</span>
              <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
                <path d="M7 12 L1 2 Q7 -3 13 2 Z" />
              </svg>
            </button>
          )
        }
        return (
          <div key={l.id} aria-hidden className={`s3-sign${l.kind === 'clock' ? ' is-clock' : ''}`} style={{ left: l.left, top: l.top }}>
            {l.text}
          </div>
        )
      })}
    </div>
  )
}
