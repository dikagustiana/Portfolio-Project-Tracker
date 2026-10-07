// DEV-ONLY preview entry for the sim screens (screenshots and layout iteration without the
// Supabase shell). Not part of the app build (only index.html is a build input).
//   ?world=b2b-b2c      2D world 2        ?host=1        SimHost with the world selector
//   ?v=3d               3D style frame    ?theme=dark    dark tokens (3D follows data-theme)
//   ?shell=1            pad the main area like the app shell next to its 240 px sidebar
//   ?day=8&hour=10.75   3D clock start (defaults: day 1, 09.00)
import { createRoot } from 'react-dom/client'
import '../../../../index.css'
import SimScreen from './SimScreen.tsx'
import SimScreen2 from '../../b2b-b2c/ui/SimScreen2.tsx'
import { SimHost } from '../../../SimHost.tsx'
import Sim3D from '../../../ui3d/Sim3D.tsx'
import { checkOverlayLayout } from '../../../ui3d/layoutCheck.ts'

// Hook for scripts/sim3d-frames.ts (layout sweep): `page.evaluate('window.__s3Check()')`.
Object.assign(window, { __s3Check: () => checkOverlayLayout(document) })

if (new URLSearchParams(location.search).get('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}
const world = new URLSearchParams(location.search).get('world')
const host = new URLSearchParams(location.search).get('host')
const v3d = new URLSearchParams(location.search).get('v') === '3d'
const shell = new URLSearchParams(location.search).get('shell') === '1'
const day = Number(new URLSearchParams(location.search).get('day') ?? 1)
const hour = Number(new URLSearchParams(location.search).get('hour') ?? 9)

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <div style={{ height: '100vh', display: 'flex' }}>
      {shell && <aside aria-hidden style={{ width: 240, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--line)' }} />}
      <main className="main" style={{ flex: 1, padding: shell ? '28px clamp(16px, 3vw, 40px) 48px' : 12, minWidth: 0 }}>
        {host ? <SimHost /> : v3d ? <Sim3D initialDay={day} initialHour={hour} on2D={() => {}} /> : world === 'b2b-b2c' ? <SimScreen2 /> : <SimScreen />}
      </main>
    </div>,
  )
}
