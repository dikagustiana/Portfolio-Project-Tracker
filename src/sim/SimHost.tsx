// SimHost (brief 2 §7.1, §8): one nav button, one shell; the header offers the world
// selector and each world lazy-loads separately. #/simulasi and #/simulasi/distribusi
// open world 1; #/simulasi/b2b-b2c opens world 2.

import { lazy, Suspense } from 'react'
import { setUI, useUI } from '../app/ui.ts'
import type { SimWorld } from '../app/ui.ts'

const Distribusi = lazy(() => import('./worlds/distribusi/ui/SimScreen.tsx').then((m) => ({ default: m.default })))
const B2bB2c = lazy(() => import('./worlds/b2b-b2c/ui/SimScreen2.tsx').then((m) => ({ default: m.default })))

const WORLDS: { id: SimWorld; label: string }[] = [
  { id: 'distribusi', label: 'Distribusi' },
  { id: 'b2b-b2c', label: 'Gudang B2B + B2C' },
]

export function SimHost() {
  const ui = useUI()
  const world = ui.simWorld
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
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
      <div style={{ flex: 1, minHeight: 0 }}>
        {world === 'b2b-b2c' ? (
          <Suspense fallback={<div className="skel" />}>
            <B2bB2c />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="skel" />}>
            <Distribusi />
          </Suspense>
        )}
      </div>
    </div>
  )
}
