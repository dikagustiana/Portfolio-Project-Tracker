// Sim3D (Brief 3 §1, §4): the 3D shell that replaces the flat world as the default view
// (the 2D canvas stays as fallback). V1 = style frame: the scene with placeholder overlay
// cards; V2 passes engine bindings through this same shape. All labels are plain projected
// DOM — no drei <Html>, which breaks under React 19.3 (root-unmount race).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Scene3D } from './Scene3D.tsx'
import type { CameraState, ProjectedLabel } from './Scene3D.tsx'
import { CAMERA_DEFAULT, LABELS2, makeProjector } from './Scene3D.tsx'
import { OverlaySim3D } from './overlay.tsx'

export default function Sim3D({ dark = false }: { dark?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1280, h: 720 })
  const [cam, setCam] = useState<CameraState>(CAMERA_DEFAULT)
  const [interior, setInterior] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const labels = useMemo<ProjectedLabel[]>(() => {
    const project = makeProjector(cam, size.w, size.h)
    return LABELS2.map((a) => ({ ...a, ...project(a.at) }))
  }, [cam, size])

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
      <Scene3D dark={dark} cam={cam} setCam={setCam} interior={interior} size={size} />
      <LabelLayer labels={labels} />
      <OverlaySim3D
        dark={dark}
        cam={cam}
        setCam={setCam}
        interior={interior}
        setInterior={setInterior}
        onZoom={(f) => setCam((c) => ({ ...c, zoom: Math.max(0.5, Math.min(3.5, c.zoom * f)) }))}
        onRotate={() => setCam((c) => ({ ...c, rot: (c.rot + 1) % 4 }))}
        onReset={() => setCam(CAMERA_DEFAULT)}
      />
    </div>
  )
}

/** Projected DOM labels: teardrop pins, signpost chips, the cut-off clock text. */
function LabelLayer({ labels }: { labels: ProjectedLabel[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {labels.map((l) => {
        if (l.kind === 'pin') {
          return (
            <div key={l.id} style={{ position: 'absolute', left: l.left, top: l.top, transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--f-ui)',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(30,42,90,0.25)',
                }}
              >
                {l.text}
              </span>
              <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
                <path d="M7 12 L1 2 Q7 -3 13 2 Z" fill="var(--accent)" />
              </svg>
            </div>
          )
        }
        if (l.kind === 'sign') {
          return (
            <div
              key={l.id}
              style={{
                position: 'absolute',
                left: l.left,
                top: l.top,
                transform: 'translate(-50%, -50%)',
                background: '#ffffff',
                border: '1px solid #dfe4f2',
                borderRadius: 8,
                padding: '3px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#2b3548',
                fontFamily: 'var(--f-ui)',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(30,42,90,0.14)',
              }}
            >
              {l.text}
            </div>
          )
        }
        return (
          <div
            key={l.id}
            style={{
              position: 'absolute',
              left: l.left,
              top: l.top,
              transform: 'translate(-50%, -50%)',
              fontSize: 12,
              fontWeight: 800,
              color: '#2b3548',
              fontFamily: 'var(--f-ui)',
            }}
          >
            {l.text}
          </div>
        )
      })}
    </div>
  )
}
