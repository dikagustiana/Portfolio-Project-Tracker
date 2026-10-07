// DEV-ONLY preview entry for the sim screens (screenshots, layout iteration and the e2e-sim3d
// suite, all without the Supabase shell). Not part of the app build (only index.html is an app
// build input); vite.sim3d.config.ts builds it separately to test under the production CSP.
//   ?world=b2b-b2c      2D world 2        ?host=1        SimHost with the world selector
//   ?v=3d               3D world 2        ?theme=dark    dark tokens (3D follows data-theme)
//   ?v=town             Brief B4 V0: Factory Yard's town as ported (?debug=1 → window.sim)
//   ?v=yard             Brief B4: the SAMB command centre (&select=L-03&open=gudang, ?debug=1 → window.sim)
//   ?shell=1            pad the main area like the app shell next to its 240 px sidebar
//   ?day=8&hour=10.75   3D clock start (defaults: day 1, 09.00)
// Screens load lazily and render under StrictMode, as in the app (src/main.tsx), so dev-only
// double-invocation bugs show here too; the three.js chunk only loads for ?v=3d.
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../../index.css'
import { SimHost } from '../../../SimHost.tsx'
import { checkOverlayLayout } from '../../../ui3d/layoutCheck.ts'

const screens = {
  SimScreen: lazy(() => import('./SimScreen.tsx')),
  SimScreen2: lazy(() => import('../../b2b-b2c/ui/SimScreen2.tsx')),
  Sim3D: lazy(() => import('../../../ui3d/Sim3D.tsx')),
  TownV0: lazy(() => import('../../../yard/town/TownV0.tsx')),
  YardScreen: lazy(() => import('../../../yard/YardScreen.tsx')),
}

// Hook for scripts/sim3d-frames.ts and e2e-sim3d: `page.evaluate('window.__s3Check()')`.
Object.assign(window, { __s3Check: () => checkOverlayLayout(document) })

const q = new URLSearchParams(location.search)
if (q.get('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
const shell = q.get('shell') === '1'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <div style={{ height: '100vh', display: 'flex' }}>
        {shell && <aside aria-hidden style={{ width: 240, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--line)' }} />}
        <main className="main" style={{ flex: 1, padding: shell ? '28px clamp(16px, 3vw, 40px) 48px' : 12, minWidth: 0 }}>
          <Suspense fallback={null}>
            {q.get('host') ? (
              <SimHost />
            ) : q.get('v') === 'yard' ? (
              <screens.YardScreen initialSelect={q.get('select') ?? undefined} openGudang={q.get('open') === 'gudang'} />
            ) : q.get('v') === 'town' ? (
              <screens.TownV0 />
            ) : q.get('v') === '3d' ? (
              <screens.Sim3D initialDay={Number(q.get('day') ?? 1)} initialHour={Number(q.get('hour') ?? 9)} on2D={() => {}} />
            ) : q.get('world') === 'b2b-b2c' ? (
              <screens.SimScreen2 />
            ) : (
              <screens.SimScreen />
            )}
          </Suspense>
        </main>
      </div>
    </StrictMode>,
  )
}
