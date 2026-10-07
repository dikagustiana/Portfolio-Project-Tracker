// SimHost (brief 2 §7.1, §8; Brief 3 §1): one nav button, one shell; each world lazy-loads
// separately. #/simulasi and #/simulasi/distribusi open world 1; #/simulasi/b2b-b2c opens
// world 2 — as the 3D scene when WebGL is available and reduced motion is off, otherwise (or
// after "Tampilan 2D", remembered per browser) as the 2D canvas. The 3D view carries its own
// world selector, so the header tabs show only with the 2D worlds.

import { lazy, Suspense } from 'react'
import { setUI, useUI } from '../app/ui.ts'
import type { SimWorld } from '../app/ui.ts'
import { useShell } from '../app/shell-context.ts'
import { hasWebGL, useReducedMotion } from './ui3d/support.ts'
import { Boundary3D } from './ui3d/Boundary3D.tsx'

const Distribusi = lazy(() => import('./worlds/distribusi/ui/SimScreen.tsx').then((m) => ({ default: m.default })))
const B2bB2c = lazy(() => import('./worlds/b2b-b2c/ui/SimScreen2.tsx').then((m) => ({ default: m.default })))
const Sim3D = lazy(() => import('./ui3d/Sim3D.tsx').then((m) => ({ default: m.default })))

const WORLDS: { id: SimWorld; label: string }[] = [
  { id: 'distribusi', label: 'Distribusi' },
  { id: 'b2b-b2c', label: 'Gudang B2B + B2C' },
]

export function SimHost() {
  const ui = useUI()
  const { toggleDrawer } = useShell()
  const reducedMotion = useReducedMotion()
  const world = ui.simWorld
  const can3d = hasWebGL() && !reducedMotion
  const world2d = (
    <Suspense fallback={<div className="skel" />}>
      <B2bB2c />
    </Suspense>
  )

  if (world === 'b2b-b2c' && can3d && ui.simView === '3d') {
    // The scene is all absolutely positioned, so it needs a definite height: the viewport less
    // .main's vertical padding (28 + 48 px, board.css).
    return (
      <div style={{ height: 'calc(100dvh - 76px)', minHeight: 420 }}>
        <Boundary3D fallback={world2d}>
          <Suspense fallback={<div className="skel" style={{ height: '100%' }} />}>
            <Sim3D world={world} onWorld={(w) => setUI({ simWorld: w })} on2D={() => setUI({ simView: '2d' })} onMenu={toggleDrawer} />
          </Suspense>
        </Boundary3D>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div role="tablist" aria-label="Pilih dunia simulasi" style={{ display: 'flex', gap: 6 }}>
          {WORLDS.map((w) => (
            <button
              key={w.id}
              role="tab"
              type="button"
              aria-selected={world === w.id}
              className={`btn ghost${world === w.id ? ' on' : ''}`}
              onClick={() => setUI({ simWorld: w.id })}
              style={{ fontWeight: world === w.id ? 800 : 500 }}
            >
              {w.label}
            </button>
          ))}
        </div>
        {world === 'b2b-b2c' && can3d && (
          <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setUI({ simView: '3d' })}>
            Tampilan 3D
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {world === 'b2b-b2c' ? (
          world2d
        ) : (
          <Suspense fallback={<div className="skel" />}>
            <Distribusi />
          </Suspense>
        )}
      </div>
    </div>
  )
}
