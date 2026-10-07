// Brief 3 V1 gate: layout sweep + style frames for the 3D sim, in a real browser.
// Run: node scripts/sim3d-frames.ts [--sweep-only]
// Starts its own Vite dev server, opens the dev preview (?v=3d) at every size in SWEEP and
// fails (exit 1) if any overlay cards overlap, spill sideways, leave the sim area or make the
// page scroll sideways (src/sim/ui3d/layoutCheck.ts). Then writes the style frames into the
// git-ignored .sim-local/. Uses the installed Edge or Chrome, else Playwright's Chromium.

import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { createServer } from 'vite'

interface Shot {
  w: number
  h: number
  phone?: boolean
  /** Pad the preview like the app shell next to its 240 px sidebar. */
  shell?: boolean
  dark?: boolean
  /** aria-label of a button to press before the shot. */
  press?: string
}

interface LayoutReport {
  mode: string
  zones: number
  problems: string[]
}

const OUT = '.sim-local'
const PREVIEW = 'src/sim/worlds/distribusi/ui/preview.html'

const SWEEP: Shot[] = [
  ...Array.from({ length: 18 }, (_, i) => ({ w: 900 + i * 60, h: 768 })),
  { w: 1366, h: 657 }, // 1366×768 laptop minus the browser's own chrome
  ...[1280, 1366, 1440, 1600, 1920].map((w) => ({ w, h: 900, shell: true })),
  { w: 1024, h: 768 },
  { w: 768, h: 1024, phone: true },
  ...[
    [360, 740],
    [375, 667],
    [390, 844],
    [414, 896],
    [430, 932],
    [844, 390],
  ].map(([w = 0, h = 0]) => ({ w, h, phone: true })),
]

const FRAMES: (Shot & { name: string })[] = [
  { name: 'v1-1366x768-light', w: 1366, h: 768 },
  { name: 'v1-390x844-light', w: 390, h: 844, phone: true },
  { name: 'v1-1366x768-dark', w: 1366, h: 768, dark: true },
  { name: 'v1-390x844-dark', w: 390, h: 844, phone: true, dark: true },
  { name: 'v1-1920x1080-light', w: 1920, h: 1080 },
  { name: 'v1-1366x768-shell', w: 1366, h: 768, shell: true },
  { name: 'v1-1366x768-interior', w: 1366, h: 768, press: 'Lihat dalam gudang' },
]

async function launch(): Promise<Browser> {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      // Not installed; try the next one.
    }
  }
  return chromium.launch()
}

async function open(browser: Browser, base: string, s: Shot): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: s.phone ? 2 : 1,
    isMobile: !!s.phone,
    hasTouch: !!s.phone,
    colorScheme: s.dark ? 'dark' : 'light',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 300)}`))
  const q = new URLSearchParams({ v: '3d' })
  if (s.shell) q.set('shell', '1')
  if (s.dark) q.set('theme', 'dark')
  await page.goto(`${base}${PREVIEW}?${q.toString()}`)
  await page.waitForSelector('.s3-root canvas', { timeout: 90_000 })
  await page.waitForSelector('.s3-overlay', { timeout: 30_000 })
  await page.evaluate('document.fonts.ready')
  await page.waitForTimeout(400)
  return { page, close: () => ctx.close() }
}

const label = (s: Shot): string => `${s.w}×${s.h}${s.phone ? ' phone' : ''}${s.shell ? ' shell' : ''}${s.dark ? ' dark' : ''}`

const server = await createServer({ logLevel: 'error', server: { port: 5310, strictPort: false } })
await server.listen()
const base = server.resolvedUrls?.local[0]
if (!base) throw new Error('Vite did not report a local URL')
const browser = await launch()
let failed = 0

try {
  console.log(`Layout sweep (${SWEEP.length} sizes) against ${base}`)
  for (const s of SWEEP) {
    const { page, close } = await open(browser, base, s)
    const rep = await page.evaluate<LayoutReport>('window.__s3Check()')
    await close()
    const ok = rep.problems.length === 0 && rep.zones > 0
    if (!ok) failed++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label(s).padEnd(22)} mode=${rep.mode.padEnd(6)} zones=${rep.zones}${ok ? '' : `  ${rep.problems.join('; ') || 'no zones found'}`}`)
  }

  if (!process.argv.includes('--sweep-only')) {
    mkdirSync(OUT, { recursive: true })
    console.log(`Style frames → ${OUT}/`)
    for (const f of FRAMES) {
      const { page, close } = await open(browser, base, f)
      if (f.press) await page.getByRole('button', { name: f.press }).click()
      await page.waitForTimeout(1500) // first WebGL frames + soft shadows
      await page.screenshot({ path: `${OUT}/${f.name}.png` })
      await close()
      console.log(`  ${f.name}.png`)
    }
  }
} finally {
  await browser.close()
  await server.close()
}

if (failed) {
  console.log(`${failed} size(s) failed the layout check`)
  process.exit(1)
}
console.log('Layout check passed at every size')
