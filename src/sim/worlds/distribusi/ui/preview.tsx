// DEV-ONLY preview entry for the sim screen (screenshots and layout iteration without the
// Supabase shell). Not part of the app build; delete before shipping.
import { createRoot } from 'react-dom/client'
import '../../../../index.css'
import SimScreen from './SimScreen.tsx'
import SimScreen2 from '../../b2b-b2c/ui/SimScreen2.tsx'
import { SimHost } from '../../../SimHost.tsx'
import Sim3D from '../../../ui3d/Sim3D.tsx'

if (new URLSearchParams(location.search).get('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}
const world = new URLSearchParams(location.search).get('world')
const host = new URLSearchParams(location.search).get('host')
const v3d = new URLSearchParams(location.search).get('v') === '3d'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <div style={{ height: '100vh', display: 'flex' }}>
      <main className="main" style={{ flex: 1, padding: 12, minWidth: 0 }}>
        {host ? <SimHost /> : v3d ? <Sim3D dark={new URLSearchParams(location.search).get('theme') === 'dark'} /> : world === 'b2b-b2c' ? <SimScreen2 /> : <SimScreen />}
      </main>
    </div>,
  )
}
