// Per-browser UI state (prototype `UI`, saved in localStorage 'gpm-ui'). The current screen, the
// open record and the side peek live in the URL hash (docs/ARCHITECTURE.md §G), so links can be
// copied, refresh keeps the record and the back button works.
//
//   #/                     Beranda            #/p/MB             project (Milestone tab)
//   #/minggu               Minggu ini         #/p/MB/<tab>       project tab
//   #/keputusan            Keputusan          #/p/MB/t/MB12      task, full page
//   #/portofolio           Portofolio         #/p/MB/g/G3        gate, full page
//   #/tinjauan             Tinjauan mingguan  #/p/MB/k/K01       Keputusan, full page
//   #/orang                Orang              …?peek=MB/t/MB12   any screen with a record in the side peek
//   #/admin/<tab>  #/simulasi[/<world>]
import { useSyncExternalStore } from 'react'

export type View = 'home' | 'week' | 'decisions' | 'portfolio' | 'review' | 'team' | 'project' | 'record' | 'admin' | 'sim'
export type Tab = 'milestone' | 'list' | 'pipeline' | 'gantt' | 'vc' | 'keputusan' | 'aktivitas' | 'anggota'
export type RecKind = 'task' | 'gate' | 'ask'
/** A record address: project code (or id) + kind + short id (or id). */
export interface Addr {
  code: string
  kind: RecKind
  ref: string
}

export type SimWorld = 'distribusi' | 'b2b-b2c'
/** World 2 view: the 3D scene (default when the browser supports it) or the 2D canvas. */
export type SimView = '3d' | '2d'
export type PortfolioFilterKey = 'all' | 'mine' | 'attention' | 'blocked' | 'done'

export interface UIState {
  view: View
  /** Project code (or id) of the open project or record. */
  pid: string | null
  tab: Tab
  /** The task view (Checklist, Pipeline, Gantt, Value chain) the Task tab returns to. */
  taskView: Tab
  /** Record on the full page (view 'record'). */
  rec: Addr | null
  /** Record in the side peek, over any view. */
  peek: Addr | null
  adminTab: string
  zoom: 'day' | 'week'
  who: string
  q: string
  wkOff: number
  asWho: string
  ent: string
  vcStep: string
  /** Portofolio filter, search and selected (previewed) project code. */
  pf: PortfolioFilterKey
  pq: string
  sel: string
  /** Tinjauan mingguan: days back from today, and the project in scope ('' = all). */
  rvDays: number
  rvSel: string
  simWorld: SimWorld
  simView: SimView
}

const DEFAULTS: UIState = {
  view: 'home',
  pid: null,
  tab: 'milestone',
  taskView: 'list',
  rec: null,
  peek: null,
  adminTab: 'orang',
  zoom: 'day',
  who: 'all',
  q: '',
  wkOff: 0,
  asWho: '',
  ent: '',
  vcStep: '',
  pf: 'all',
  pq: '',
  sel: '',
  rvDays: 7,
  rvSel: '',
  simWorld: 'distribusi',
  simView: '3d',
}

const KEY = 'gpm-ui'
export const TABS: Tab[] = ['milestone', 'list', 'pipeline', 'gantt', 'vc', 'keputusan', 'aktivitas', 'anggota']
const KIND: Record<string, RecKind> = { t: 'task', g: 'gate', k: 'ask' }
const SEG: Record<RecKind, string> = { task: 't', gate: 'g', ask: 'k' }
const dec = (s: string | undefined): string => {
  try {
    return decodeURIComponent(s ?? '')
  } catch {
    return s ?? ''
  }
}
const enc = encodeURIComponent

/** Parse "MB/t/MB12" (a peek value or the tail of a record route). */
export function parseAddr(s: string): Addr | null {
  const [code, k, ref] = s.split('/')
  const kind = KIND[k ?? '']
  return code && kind && ref ? { code: dec(code), kind, ref: dec(ref) } : null
}
export const addrPath = (a: Addr): string => `${enc(a.code)}/${SEG[a.kind]}/${enc(a.ref)}`

function load(): UIState {
  let saved: Partial<UIState> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UIState>
  } catch {
    /* storage unavailable: defaults */
  }
  // The URL decides what is open; storage only remembers preferences.
  return { ...DEFAULTS, ...saved, rec: null, peek: null, ...fromHash(location.hash) }
}

export function fromHash(hash: string): Partial<UIState> {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const peekRaw = new URLSearchParams(query).get('peek')
  const peek = peekRaw ? parseAddr(peekRaw) : null
  const [a, b, c, e] = path.split('/')
  const base = { peek, rec: null }
  if (a === 'minggu') return { ...base, view: 'week' }
  if (a === 'keputusan') return { ...base, view: 'decisions' }
  if (a === 'portofolio') return { ...base, view: 'portfolio' }
  if (a === 'tinjauan') return { ...base, view: 'review' }
  if (a === 'orang' || a === 'tim') return { ...base, view: 'team' }
  if (a === 'simulasi') return { ...base, view: 'sim', simWorld: b === 'b2b-b2c' ? 'b2b-b2c' : 'distribusi' }
  if (a === 'admin') return { ...base, view: 'admin', adminTab: b || 'orang' }
  if (a === 'p' && b) {
    const kind = KIND[c ?? '']
    if (kind && e) return { ...base, view: 'record', pid: dec(b), rec: { code: dec(b), kind, ref: dec(e) } }
    return { ...base, view: 'project', pid: dec(b), tab: TABS.includes(c as Tab) ? (c as Tab) : 'milestone' }
  }
  return { ...base, view: 'home' }
}

export function toHash(s: UIState): string {
  const peek = s.peek ? `?peek=${addrPath(s.peek)}` : ''
  const path = (() => {
    switch (s.view) {
      case 'week':
        return '#/minggu'
      case 'decisions':
        return '#/keputusan'
      case 'portfolio':
        return '#/portofolio'
      case 'review':
        return '#/tinjauan'
      case 'team':
        return '#/orang'
      case 'sim':
        return s.simWorld === 'b2b-b2c' ? '#/simulasi/b2b-b2c' : '#/simulasi/distribusi'
      case 'admin':
        return `#/admin/${s.adminTab}`
      case 'record':
        return s.rec ? `#/p/${addrPath(s.rec)}` : '#/'
      case 'project':
        return s.pid ? `#/p/${enc(s.pid)}${s.tab === 'milestone' ? '' : `/${s.tab}`}` : '#/'
      default:
        return '#/'
    }
  })()
  return path + peek
}

let state: UIState = typeof window === 'undefined' ? DEFAULTS : load()
const listeners = new Set<() => void>()

export function setUI(patch: Partial<UIState>): void {
  state = { ...state, ...patch }
  try {
    // The open record and peek belong to the URL, not to stored preferences.
    localStorage.setItem(KEY, JSON.stringify({ ...state, rec: null, peek: null }))
  } catch {
    /* ignore */
  }
  const h = toHash(state)
  if (location.hash !== h) history.pushState(null, '', h)
  listeners.forEach((l) => l())
}

/** Navigate to a screen, closing any peek (a peek belongs to the screen it was opened on). */
export function go(patch: Partial<UIState>): void {
  setUI({ peek: null, ...patch })
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
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
