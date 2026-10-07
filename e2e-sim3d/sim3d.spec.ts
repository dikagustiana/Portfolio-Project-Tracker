// Brief 3 V4 — the 3D sim in a production build under the production CSP (no Supabase needed):
// it renders without CSP violations, its cards are engine-bound (toggles recompute, traces
// verify), the scene and lists open objects and vehicles, "Ikuti" follows a moving truck,
// SimHost falls back to 2D on reduced motion or missing WebGL, and the overlay never overlaps.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const PREVIEW = '/src/sim/worlds/distribusi/ui/preview.html'

interface LayoutReport {
  mode: string
  zones: number
  problems: string[]
}

/** Records CSP violations and page errors from the first script on. */
async function watch(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  return async () => [...errors, ...(await page.evaluate<string[]>('window.__csp'))]
}

async function open3d(page: Page, query = 'day=8&hour=10.75'): Promise<void> {
  await page.goto(`${PREVIEW}?v=3d&${query}`)
  await expect(page.locator('.s3-overlay')).toBeVisible()
  await expect(page.locator('.s3-root canvas')).toBeVisible()
}

const kpis = (page: Page) => page.locator('.s3-kpi b').allInnerTexts()

test('renders the 3D world under the production CSP, with engine numbers', async ({ page }) => {
  const problems = await watch(page)
  await open3d(page)
  // WebGL really drew: the canvas has a live context.
  expect(await page.evaluate(() => !!document.querySelector<HTMLCanvasElement>('.s3-root canvas')?.getContext('webgl2'))).toBe(true)
  await expect(page.getByText('Ilustrasi — angka dummy, bukan data SAMB')).toBeVisible()
  expect(await kpis(page)).toEqual(['Rp 97.366', 'Rp 204.869', 'Rp 230,0 jt'])
  await expect(page.locator('.s3-clock')).toContainText('Hari 8 · 10.45')
  await page.waitForTimeout(500)
  expect(await problems()).toEqual([])
})

test('"Aturan alokasi" recomputes every card and resets', async ({ page }) => {
  await open3d(page)
  const before = await kpis(page)
  await page.getByRole('button', { name: '⚙ Aturan alokasi' }).click()
  await page.getByRole('radio', { name: 'Penjual' }).click()
  await expect.poll(() => kpis(page)).not.toEqual(before)
  expect((await kpis(page))[0]).toBe('Rp 144.726')
  await page.getByRole('radio', { name: 'Tidak dibagi' }).click()
  await expect(page.locator('.s3-kpi').nth(2)).toContainText('tidak dibagi')
  await page.getByRole('button', { name: 'Kembalikan ke bawaan' }).click()
  await expect.poll(() => kpis(page)).toEqual(before)
})

test('pins, lists and search open cards whose traces recompute', async ({ page }) => {
  await open3d(page)
  await page.getByRole('button', { name: 'Buka Dock B2B' }).click()
  await expect(page.locator('.s3-selected .s3-title')).toHaveText('Jalur B2B (truk ke toko)')
  await page.locator('.s3-selected .s3-tracebtn').first().click()
  await expect(page.getByRole('dialog', { name: 'Jejak angka' })).toBeVisible()
  await expect(page.getByText('hitung ulang sama')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: /Order/ }).click()
  const first = await page.locator('.s3-list .s3-item-name').first().innerText()
  await page.locator('.s3-list .s3-item').first().click()
  await expect(page.locator('.s3-flow .s3-kicker')).toContainText(first.split(' · ')[0] ?? '')

  await page.getByRole('textbox', { name: /Cari objek/ }).fill('O-00010')
  await page.keyboard.press('Enter')
  await expect(page.locator('.s3-clock')).toContainText('Hari 1')
  await expect(page.locator('.s3-flow .s3-kicker')).toContainText('O-00010')
})

test('vehicles move with the clock, open from the map, and "Ikuti" follows them', async ({ page }) => {
  await open3d(page, 'day=8&hour=9.5')
  await page.getByRole('tab', { name: /Truk/ }).click()
  await page.locator('.s3-list .s3-item').nth(2).click()
  await expect(page.locator('.s3-selected')).toContainText('Muat di dock')
  await page.getByRole('button', { name: 'Ikuti', exact: true }).click()
  const tag = () => page.evaluate(() => {
    const e = document.querySelector<HTMLElement>('.s3-pin.is-tag')
    return e ? { x: parseFloat(e.style.left), y: parseFloat(e.style.top) } : null
  })
  const t1 = await tag()
  await page.getByRole('button', { name: 'Putar', exact: true }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Jeda', exact: true }).click()
  await expect(page.locator('.s3-selected')).toContainText('Menuju toko')
  const t2 = await tag()
  expect(t1 && t2 && Math.hypot(t2.x - t1.x, t2.y - t1.y)).toBeLessThan(40)

  // A drag ends following.
  await page.mouse.move(600, 420)
  await page.mouse.down()
  await page.mouse.move(660, 450, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Ikuti', exact: true })).toBeVisible()

  // A click on the canvas below the "Bay kurir" pin opens a waiting courier.
  await page.getByRole('button', { name: 'Reset tampilan' }).click()
  await page.locator('input[aria-label="Geser jam"]').fill('10.75')
  const pin = await page.getByRole('button', { name: 'Buka Bay kurir' }).boundingBox()
  expect(pin).not.toBeNull()
  let opened = ''
  for (const [dx, dy] of [-30, -10, 10, 30].flatMap((x) => [30, 45, 60, 75].map((y) => [x, y] as const))) {
    await page.mouse.click((pin?.x ?? 0) + (pin?.width ?? 0) / 2 + dx, (pin?.y ?? 0) + (pin?.height ?? 0) + dy)
    opened = await page.locator('.s3-selected .s3-title').innerText()
    if (opened.startsWith('Kurir')) break
  }
  expect(opened).toMatch(/^Kurir \d · MF-/)
})

test('SimHost: 3D by default, "Tampilan 2D"/"3D", and 2D on reduced motion or without WebGL', async ({ page, browser }) => {
  await page.goto(`${PREVIEW}?host=1#/simulasi/b2b-b2c`)
  await expect(page.locator('.s3-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'Tampilan 2D' }).click()
  await expect(page.getByRole('heading', { name: 'Gudang B2B + B2C' })).toBeVisible()
  await page.getByRole('button', { name: 'Tampilan 3D' }).click()
  await expect(page.locator('.s3-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'Distribusi' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/distribusi/)
  await expect(page.locator('.s3-overlay')).toHaveCount(0)

  const reduced = await browser.newContext({ reducedMotion: 'reduce' })
  const rp = await reduced.newPage()
  await rp.goto(`http://localhost:5321${PREVIEW}?host=1#/simulasi/b2b-b2c`)
  await expect(rp.getByRole('heading', { name: 'Gudang B2B + B2C' })).toBeVisible()
  await expect(rp.locator('.s3-overlay')).toHaveCount(0)
  await reduced.close()

  const noGl = await browser.newContext()
  await noGl.addInitScript(() => {
    // A browser without WebGL: every webgl/webgl2 context request fails.
    const proto = HTMLCanvasElement.prototype
    const original = Reflect.get(proto, 'getContext') as (this: HTMLCanvasElement, ...args: unknown[]) => unknown
    Reflect.set(proto, 'getContext', function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id.startsWith('webgl') ? null : original.call(this, id, ...rest)
    })
  })
  const np = await noGl.newPage()
  await np.goto(`http://localhost:5321${PREVIEW}?host=1#/simulasi/b2b-b2c`)
  await expect(np.getByRole('heading', { name: 'Gudang B2B + B2C' })).toBeVisible()
  await expect(np.getByRole('button', { name: 'Tampilan 3D' })).toHaveCount(0)
  await noGl.close()
})

for (const size of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`overlay cards never overlap at ${size.width}×${size.height}`, async ({ browser }) => {
    const phone = size.width < 768
    const ctx = await browser.newContext({ viewport: size, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 })
    const page = await ctx.newPage()
    await open3d(page)
    const rep = await page.evaluate<LayoutReport>('window.__s3Check()')
    expect(rep.mode).toBe(phone ? 'phone' : 'medium')
    expect(rep.problems).toEqual([])
    await ctx.close()
  })
}
