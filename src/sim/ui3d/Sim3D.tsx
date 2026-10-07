// Sim3D (Brief 3 §1, §4): the 3D shell that replaces the flat world as the default view
// (the 2D canvas stays as fallback). V1 = style frame: the scene with placeholder overlay
// cards; V2 passes engine bindings through this same shape. All labels are plain projected
// DOM — no drei <Html>, which breaks under React 19.3 (root-unmount race).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './sim3d.css'
import { Scene3D } from './Scene3D.tsx'
import { CAMERA_DEFAULT, makeProjector, panByPixels, rotateStep, zoomBy } from './camera3d.ts'
import type { CameraState } from './camera3d.ts'
import { LABELS2 } from './anchors2.ts'
import type { ProjectedLabel } from './anchors2.ts'
import { OverlaySim3D } from './overlay.tsx'
import type { OverlayMode, WorldId } from './overlay.tsx'
import { useDarkTheme } from './theme3d.ts'

/** Layout mode from the measured container width (not the viewport): the KPI row and the
 *  search group share one top row only when both fit beside the right column. */
function modeFor(width: number): OverlayMode {
  if (width >= 1720) return 'wide'
  if (width >= 900) return 'medium'
  return 'phone'
}

export default function Sim3D({ world = 'b2b-b2c', onWorld = () => {} }: { world?: WorldId; onWorld?: (w: WorldId) => void }) {
  const dark = useDarkTheme()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cam, setCam] = useState<CameraState>(CAMERA_DEFAULT)
  const [interior, setInterior] = useState(false)
  const [focus, setFocus] = useState({ x: 0, y: 0 })
  const onFocus = useCallback((f: { x: number; y: number }) => setFocus((p) => (p.x === f.x && p.y === f.y ? p : f)), [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The rendered view shifts the user's camera so its target lands on the free area's centre;
  // zoom and rotation then pivot there too. Drag edits `cam`, the view follows.
  const view = useMemo(() => (size.w ? panByPixels(cam, focus.x, focus.y, size.w, size.h) : cam), [cam, focus, size])

  const labels = useMemo<ProjectedLabel[]>(() => {
    if (!size.w) return []
    const project = makeProjector(view, size.w, size.h)
    return LABELS2.map((a) => ({ ...a, ...project(a.at) }))
  }, [view, size])

  const mode = modeFor(size.w)

  return (
    <div ref={wrapRef} className={`s3-root s3-root--${mode}`}>
      <Scene3D dark={dark} view={view} cam={cam} setCam={setCam} interior={interior} />
      <LabelLayer labels={labels} />
      {size.w > 0 && (
        <OverlaySim3D
          mode={mode}
          height={size.h}
          world={world}
          onWorld={onWorld}
          interior={interior}
          setInterior={setInterior}
          onZoom={(f) => setCam((c) => zoomBy(c, f))}
          onRotate={() => setCam(rotateStep)}
          onReset={() => setCam(CAMERA_DEFAULT)}
          onFocus={onFocus}
        />
      )}
    </div>
  )
}

/** Projected DOM labels: teardrop pins, signpost plates, the cut-off clock chip. */
function LabelLayer({ labels }: { labels: ProjectedLabel[] }) {
  return (
    <div className="s3-labels" aria-hidden>
      {labels.map((l) =>
        l.kind === 'pin' ? (
          <div key={l.id} className="s3-pin" style={{ left: l.left, top: l.top }}>
            <span>{l.text}</span>
            <svg width="14" height="12" viewBox="0 0 14 12">
              <path d="M7 12 L1 2 Q7 -3 13 2 Z" />
            </svg>
          </div>
        ) : (
          <div key={l.id} className={`s3-sign${l.kind === 'clock' ? ' is-clock' : ''}`} style={{ left: l.left, top: l.top }}>
            {l.text}
          </div>
        ),
      )}
    </div>
  )
}
