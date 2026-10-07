// Per-browser UI state (prototype `UI`, saved in localStorage 'gpm-ui'). The current screen
// (view, project, tab) also lives in the URL hash so links and the back button work.
import { useSyncExternalStore } from 'react'

export type View = 'dash' | 'week' | 'team' | 'project' | 'admin' | 'sim'
export type Tab = 'milestone' | 'vc' | 'list' | 'pipeline' | 'gantt'

export type SimWorld = 'distribusi' | 'b2b-b2c'

export interface UIState {
  view: View
  pid: string | null
  tab: Tab
  adminTab: string
  zoom: 'day' | 'week'
  who: string
  q: string
  wkOff: number
  asWho: string
  ent: string
  vcStep: string
  simWorld: SimWorld
}

const DEFAULTS: UIState = {
  view: 'dash',
  pid: null,
  tab: 'milestone',
  adminTab: 'orang',
  zoom: 'day',
  who: 'all',
  q: '',
  wkOff: 0,
  asWho: '',
  ent: '',
  vcStep: '',
  simWorld: 'distribusi',
}

const KEY = 'gpm-ui'
const TABS: Tab[] = ['milestone', 'vc', 'list', 'pipeline', 'gantt']

function load(): UIState {
  let saved: Partial<UIState> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UIState>
  } catch {
    /* storage unavailable: defaults */
  }
  return { ...DEFAULTS, ...saved, ...fromHash(location.hash) }
}

/** #/  #/minggu  #/tim  #/simulasi[/<world>]  #/admin/<tab>  #/p/<id>/<tab> */
export function fromHash(hash: string): Partial<UIState> {
  const [a, b, c] = hash.replace(/^#\/?/, '').split('/')
  if (a === 'minggu') return { view: 'week' }
  if (a === 'tim') return { view: 'team' }
  if (a === 'simulasi') return { view: 'sim', simWorld: b === 'b2b-b2c' ? 'b2b-b2c' : 'distribusi' }
  if (a === 'admin') return { view: 'admin', adminTab: b || 'orang' }
  if (a === 'p' && b) return { view: 'project', pid: decodeURIComponent(b), tab: TABS.includes(c as Tab) ? (c as Tab) : 'milestone' }
  return { view: 'dash' }
}

export function toHash(s: UIState): string {
  if (s.view === 'week') return '#/minggu'
  if (s.view === 'team') return '#/tim'
  if (s.view === 'sim') return s.simWorld === 'b2b-b2c' ? '#/simulasi/b2b-b2c' : '#/simulasi/distribusi'
  if (s.view === 'admin') return `#/admin/${s.adminTab}`
  if (s.view === 'project' && s.pid) return `#/p/${encodeURIComponent(s.pid)}/${s.tab}`
  return '#/'
}

let state: UIState = typeof window === 'undefined' ? DEFAULTS : load()
const listeners = new Set<() => void>()

export function setUI(patch: Partial<UIState>): void {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  const h = toHash(state)
  if (location.hash !== h) history.pushState(null, '', h)
  listeners.forEach((l) => l())
}

export function getUI(): UIState {
  return state
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    state = { ...state, ...fromHash(location.hash) }
    listeners.forEach((l) => l())
  })
}

export function useUI(): UIState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// Theme: otomatis (ikut perangkat), terang, gelap — per browser (prototype applyTheme).
export type Theme = 'auto' | 'light' | 'dark'
const THEME_KEY = 'gpm-theme'
let theme: Theme = 'auto'
try {
  theme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'auto'
} catch {
  /* ignore */
}
const themeListeners = new Set<() => void>()

export function applyTheme(t: Theme): void {
  theme = t
  const r = document.documentElement
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t)
  else r.removeAttribute('data-theme')
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignore */
  }
  themeListeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      themeListeners.add(l)
      return () => themeListeners.delete(l)
    },
    () => theme,
  )
}

if (typeof document !== 'undefined') applyTheme(theme)
