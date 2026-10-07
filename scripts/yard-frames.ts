// yard-frames: style frames and checks for the yard shell's three worlds (Brief B5 W1, W4).
// Run: node scripts/yard-frames.ts [--out=docs/sim/frames] [--only=<name prefix>] [--no-build]
// Builds the dev preview page for production and serves it with the production
// Content-Security-Policy from vercel.json (vite.sim3d.config.ts), opens each frame in headless
// Chromium, records CSP violations, page errors and console errors, and fails (exit 1) on any.
// PW_CHROMIUM points at a Chromium binary; /opt/pw-browsers/chromium is used when present.
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { build, preview } from 'vite'

export interface Frame {
  name: string
  world: 'distribusi' | 'pabrik-singkong' | 'rpa'
  w: number
  h: number
  phone?: boolean
  dark?: boolean
  /** query: select, open (comma list), lens, day, hour */
  q?: Record<string, string>
  /** run in the page once window.sim exists (camera, view, selection) */
  act?: string
  /** a full-page capture (phones: the map, then the panel, then the tracker) */
  full?: boolean
}

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const OUT = arg('out') ?? '.sim-local'
const ONLY = arg('only')
const CONFIG = 'vite.sim3d.config.ts'
const PREVIEW = '/src/sim/worlds/distribusi/ui/preview.html'

const FRAMES: Frame[] = [
  // W0: the distribution world after the refactor, staged as B4's V1 frame
  { name: 'w0-distribusi-1366x768-light', world: 'distribusi', w: 1366, h: 768, q: { select: 'L-03', open: 'gudang' } },
  // W1: one still of each new world, network view, places labelled, one place open as a section
  { name: 'w1-pabrik-singkong-1366x768-light', world: 'pabrik-singkong', w: 1366, h: 768, q: { open: 'hall', select: 'Penggorengan' } },
  { name: 'w1-pabrik-singkong-1366x768-dark', world: 'pabrik-singkong', w: 1366, h: 768, dark: true, q: { open: 'hall', select: 'Penggorengan' } },
  { name: 'w1-pabrik-singkong-390x844-light', world: 'pabrik-singkong', w: 390, h: 844, phone: true, full: true, q: { open: 'hall', select: 'Penggorengan' } },
  { name: 'w1-pabrik-singkong-kantor-1366x768-light', world: 'pabrik-singkong', w: 1366, h: 768, q: { open: 'kantor', select: 'Kantor pabrik' } },
  { name: 'w1-pabrik-singkong-lensa-biaya-1366x768-light', world: 'pabrik-singkong', w: 1366, h: 768, q: { lens: 'biaya', open: 'hall' } },
  { name: 'w1-rpa-1366x768-light', world: 'rpa', w: 1366, h: 768, q: { open: 'hall', select: 'Chilling dan split-off' } },
  { name: 'w1-rpa-1366x768-dark', world: 'rpa', w: 1366, h: 768, dark: true, q: { open: 'hall', select: 'Chilling dan split-off' } },
  { name: 'w1-rpa-390x844-light', world: 'rpa', w: 390, h: 844, phone: true, full: true, q: { open: 'hall', select: 'Chilling dan split-off' } },
  { name: 'w1-rpa-lensa-data-1366x768-light', world: 'rpa', w: 1366, h: 768, q: { lens: 'data', open: 'hall,kantor', select: 'TBC-03' } },
  { name: 'w1-rpa-kantor-1366x768-light', world: 'rpa', w: 1366, h: 768, q: { open: 'kantor', select: 'Kantor' } },
]

async function launch(): Promise<Browser> {
  const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  return chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
}

async function open(browser: Browser, base: string, f: Frame): Promise<{ page: Page; problems: () => Promise<string[]>; close: () => Promise<void> }> {
  const ctx = await browser.newContext({
    viewport: { width: f.w, height: f.h },
    deviceScaleFactor: f.phone ? 2 : 1,
    isMobile: !!f.phone,
    hasTouch: !!f.phone,
    colorScheme: f.dark ? 'dark' : 'light',
  })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  // (strings, not functions: this script is typed without the DOM library)
  await page.addInitScript(`window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push('csp: ' + e.violatedDirective + ' ' + e.blockedURI))`)
  const q = new URLSearchParams({ v: 'yard', world: f.world, debug: '1', ...(f.dark ? { theme: 'dark' } : {}), ...f.q })
  await page.goto(`${base}${PREVIEW}?${q.toString()}`)
  await page.waitForFunction(`'sim' in window`, null, { timeout: 90_000 })
  await page.evaluate('document.fonts.ready')
  if (f.act) await page.evaluate(f.act)
  await page.waitForTimeout(1500)
  return { page, problems: async () => [...errors, ...(await page.evaluate<string[]>('window.__csp'))], close: () => ctx.close() }
}

if (!process.argv.includes('--no-build')) await build({ configFile: CONFIG, logLevel: 'warn' })
const server = await preview({ configFile: CONFIG, logLevel: 'warn' })
const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '')
if (!base) throw new Error('vite preview did not report a local URL')
const browser = await launch()
mkdirSync(OUT, { recursive: true })
let failed = 0
try {
  for (const f of FRAMES.filter((x) => !ONLY || x.name.startsWith(ONLY))) {
    const { page, problems, close } = await open(browser, base, f)
    await page.screenshot({ path: `${OUT}/${f.name}.png`, fullPage: !!f.full })
    const p = await problems()
    await close()
    if (p.length) failed++
    console.log(`  ${p.length ? 'FAIL' : 'ok  '} ${f.name}.png${p.length ? `\n    ${p.join('\n    ')}` : ''}`)
  }
} finally {
  await browser.close()
  await new Promise<void>((r) => server.httpServer.close(() => r()))
}
if (failed) {
  console.log(`${failed} frame(s) logged CSP violations or errors`)
  process.exit(1)
}
console.log('Every frame: zero CSP violations, zero page errors')
