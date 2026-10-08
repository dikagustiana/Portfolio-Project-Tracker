// SimHost (brief 2 §7.1, §8; Brief B4; Brief B5 §1): one nav button, one shell. With WebGL the
// simulation is the shared yard shell around one of three worlds — #/simulasi and
// #/simulasi/distribusi (and the earlier #/simulasi/b2b-b2c) open the distribution network,
// #/simulasi/pabrik-singkong the cassava chip plant (BMG), #/simulasi/rpa the poultry
// slaughterhouse (KGR); #/simulasi/<world>/skenario?s=… opens a saved scenario (Brief B6). The
// shell carries its own world switcher. Without WebGL the distribution
// worlds fall back to the 2D canvases, and the plant worlds show the shell with its WebGL note.

import { lazy, Suspense } from 'react'
import { setUI, useUI } from '../app/ui.ts'
import type { SimWorld } from '../app/ui.ts'
import { useShell } from '../app/shell-context.ts'
import { hasWebGL } from './ui3d/support.ts'
import { Boundary3D } from './ui3d/Boundary3D.tsx'
import type { WorldId } from './yard/types.ts'

const Distribusi = lazy(() => import('./worlds/distribusi/ui/SimScreen.tsx').then((m) => ({ default: m.default })))
const B2bB2c = lazy(() => import('./worlds/b2b-b2c/ui/SimScreen2.tsx').then((m) => ({ default: m.default })))
const YardScreen = lazy(() => import('./yard/YardScreen.tsx'))

const TABS_2D: { id: SimWorld; label: string }[] = [
  { id: 'distribusi', label: 'Distribusi' },
  { id: 'b2b-b2c', label: 'Gudang B2B + B2C' },
  { id: 'pabrik-singkong', label: 'Pabrik singkong' },
  { id: 'rpa', label: 'Rumah potong ayam' },
]

/** the yard world a route opens: b2b-b2c is the distribution world's earlier route */
const yardWorld = (w: SimWorld): WorldId => (w === 'b2b-b2c' ? 'distribusi' : w)

export function SimHost() {
  const ui = useUI()
  const { toggleDrawer } = useShell()
  const world = ui.simWorld
  const world2d = (
    <Suspense fallback={<div className="skel" />}>
      <B2bB2c />
    </Suspense>
  )

  if (hasWebGL()) {
    return (
      <div className="yd-host" style={{ minHeight: 520 }}>
        <Boundary3D fallback={world2d}>
          <Suspense fallback={<div className="skel" style={{ height: '100%' }} />}>
            <YardScreen
              world={yardWorld(world)}
              onWorld={(w) => setUI({ simWorld: w, simScenario: null })}
              onMenu={toggleDrawer}
              scenario={ui.simScenario}
              onScenario={(s) => setUI({ simScenario: s })}
            />
          </Suspense>
        </Boundary3D>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div role="tablist" aria-label="Pilih dunia simulasi" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS_2D.map((w) => (
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
      <div style={{ flex: 1, minHeight: 0 }}>
        {world === 'b2b-b2c' ? (
          world2d
        ) : world === 'distribusi' ? (
          <Suspense fallback={<div className="skel" />}>
            <Distribusi />
          </Suspense>
        ) : (
          <div className="yd-host" style={{ minHeight: 520 }}>
            <Suspense fallback={<div className="skel" />}>
              <YardScreen world={world} onWorld={(w) => setUI({ simWorld: w, simScenario: null })} onMenu={toggleDrawer} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
