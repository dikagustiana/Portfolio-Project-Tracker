// DEV-ONLY preview entry for the sim screen (screenshots and layout iteration without the
// Supabase shell). Not part of the app build; delete before shipping.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import SimScreen from './SimScreen.tsx'

if (new URLSearchParams(location.search).get('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <div style={{ height: '100vh', display: 'flex' }}>
        <main className="main" style={{ flex: 1, padding: 12, minWidth: 0 }}>
          <SimScreen />
        </main>
      </div>
    </StrictMode>,
  )
}
