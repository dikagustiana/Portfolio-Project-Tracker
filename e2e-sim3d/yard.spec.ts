// Brief B5: the yard shell's three worlds in a production build under the production CSP (no
// Supabase needed). The world switcher and its routes, the distribution world unchanged by the
// refactor, and SimHost's fallbacks.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const PREVIEW = '/src/sim/worlds/distribusi/ui/preview.html'
const DUMMY_SAMB = 'Ilustrasi: angka dummy, bukan data SAMB'
const BMG = 'Data BMG: biaya standar FCC, basis aktual Januari–Agustus 2026. Sumber: deck BMG FCC biaya standar per kg dan business plan BMG.'
const DUMMY_KGR = 'Ilustrasi: angka dummy, bukan data KGR'

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

const dunia = (page: Page) => page.getByRole('radiogroup', { name: 'Dunia' })

test('the world switcher routes between the three worlds, under the production CSP', async ({ page }) => {
  const problems = await watch(page)
  await page.goto(`${PREVIEW}?host=1&debug=1#/simulasi`)
  await expect(page.getByText(DUMMY_SAMB)).toBeVisible({ timeout: 30_000 })
  for (const name of ['Distribusi', 'Pabrik singkong', 'Rumah potong ayam']) await expect(dunia(page).getByRole('radio', { name })).toBeVisible()
  await expect(dunia(page).getByRole('radio', { name: 'Distribusi' })).toHaveAttribute('aria-checked', 'true')

  await dunia(page).getByRole('radio', { name: 'Pabrik singkong' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/pabrik-singkong$/)
  await expect(page.getByText(BMG)).toBeVisible({ timeout: 30_000 })
  await expect(dunia(page).getByRole('radio', { name: 'Pabrik singkong' })).toHaveAttribute('aria-checked', 'true')
  for (const name of ['Penerimaan', 'Pengupasan', 'Cuci dan potong', 'Penggorengan', 'Sortir dan QC', 'Pengemasan', 'Gudang barang jadi dan muat', 'Kantor pabrik'])
    await expect(page.getByRole('group', { name: 'Tempat' }).getByRole('button', { name: new RegExp(name) })).toBeVisible()

  await dunia(page).getByRole('radio', { name: 'Rumah potong ayam' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/rpa$/)
  await expect(page.getByText(DUMMY_KGR)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('radiogroup', { name: 'Jalur' }).getByRole('radio', { name: 'Keduanya' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('group', { name: 'Tempat' }).getByRole('button')).toHaveCount(10)

  // the back button walks the routes back
  await page.goBack()
  await expect(page.getByText(BMG)).toBeVisible({ timeout: 30_000 })
  await dunia(page).getByRole('radio', { name: 'Distribusi' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/distribusi$/)
  await expect(page.getByText(DUMMY_SAMB)).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(500)
  expect(await problems()).toEqual([])
})

test('each route opens its world directly; b2b-b2c still opens the distribution world', async ({ page }) => {
  for (const [hash, text] of [['#/simulasi/rpa', DUMMY_KGR], ['#/simulasi/pabrik-singkong', BMG], ['#/simulasi/b2b-b2c', DUMMY_SAMB], ['#/simulasi/distribusi', DUMMY_SAMB]] as const) {
    await page.goto(`${PREVIEW}?host=1&x=${hash.length}${hash}`)
    await expect(page.getByText(text)).toBeVisible({ timeout: 30_000 })
  }
})

test('the distribution world is unchanged: metrics, Lensa biaya, a card bound to the engine', async ({ page }) => {
  const problems = await watch(page)
  await page.goto(`${PREVIEW}?v=yard&world=distribusi&debug=1`)
  await page.waitForFunction(() => 'sim' in window, null, { timeout: 30_000 })
  await expect(page.getByText('Order hari ini')).toBeVisible()
  await expect(page.locator('.yd-metric b').first()).toHaveText('24 DO · 60 order')
  await page.getByRole('button', { name: 'Lensa biaya' }).click()
  await expect(page.locator('.yd-metric b')).toHaveText(['Rp 105.444', 'Rp 204.869', 'Rp 230 jt'])
  await page.getByRole('button', { name: 'Lensa biaya' }).click()
  await page.evaluate(() => (window as unknown as { sim: { select: (id: string) => void } }).sim.select('L-03'))
  await expect(page.getByRole('heading', { name: /^L-03 · TR-08-/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pelacak tahap' }).getByText('Jalan')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Panel konteks')).toBeVisible()
  // number keys still go to places, and the day/night switch flips the scene
  await page.locator('.y-canvas').focus()
  await page.keyboard.press('3')
  await expect(page.getByRole('group', { name: 'Tempat' }).getByRole('button', { name: /Gudang/ })).toHaveAttribute('aria-current', 'true', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Malam' }).click()
  await expect(page.getByRole('button', { name: 'Siang' })).toHaveAttribute('aria-pressed', 'true')
  expect(await problems()).toEqual([])
})

test('SimHost falls back without WebGL: 2D distribution worlds, and the plant worlds say why the map is missing', async ({ browser }) => {
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
  await np.getByRole('tab', { name: 'Rumah potong ayam' }).click()
  await expect(np).toHaveURL(/#\/simulasi\/rpa$/)
  await expect(np.getByText('Peta ini butuh WebGL, yang dimatikan di browser ini.')).toBeVisible()
  await noGl.close()
})

test('prefers-reduced-motion still renders each world', async ({ browser }) => {
  const reduced = await browser.newContext({ reducedMotion: 'reduce' })
  const rp = await reduced.newPage()
  for (const [world, text] of [['distribusi', DUMMY_SAMB], ['pabrik-singkong', BMG], ['rpa', DUMMY_KGR]] as const) {
    await rp.goto(`http://localhost:5321${PREVIEW}?v=yard&world=${world}&debug=1`)
    await rp.waitForFunction(() => 'sim' in window, null, { timeout: 30_000 })
    await expect(rp.getByText(text)).toBeVisible()
  }
  await reduced.close()
})

type Sim = { select: (id: string | null) => void; all: () => { id: string; kind: string }[] }
const sim = (page: Page) => ({
  select: (id: string | null) => page.evaluate((x) => (window as unknown as { sim: Sim }).sim.select(x), id),
  all: () => page.evaluate(() => (window as unknown as { sim: Sim }).sim.all()),
})
async function openWorld(page: Page, world: string, query = ''): Promise<void> {
  await page.goto(`${PREVIEW}?v=yard&world=${world}&debug=1${query}`)
  await page.waitForFunction(() => 'sim' in window, null, { timeout: 30_000 })
}
const tiles = (page: Page) => page.locator('.yd-metric b').allInnerTexts()

test('Pabrik singkong: BMG standard figures on the tiles, the cards and Lensa biaya; the August waterfall in Kantor pabrik', async ({ page }) => {
  const problems = await watch(page)
  await openWorld(page, 'pabrik-singkong')
  await expect(page.getByText(BMG)).toBeVisible()
  expect(await tiles(page)).toEqual(['10.929 kg', '69,7%', '0,2611 kg', '0,0153 MMBTU', '93,5/3,5/3,0', '10.219 kg'])
  await page.getByRole('button', { name: 'Lensa biaya' }).click()
  expect(await tiles(page)).toEqual(['Rp 22.707,7', 'Rp 23.913,4', 'Rp 28.558,4', 'Rp 4.645,0', 'Rp 9.251,8', 'Rp 4.499,6'])
  await page.getByRole('button', { name: 'Lensa biaya' }).click()

  await sim(page).select('Penggorengan')
  const panel = page.getByRole('complementary', { name: 'Detail pilihan' })
  await expect(panel.getByRole('heading', { name: 'Penggorengan' })).toBeVisible()
  await expect(panel.getByText('Angka standar BMG')).toBeVisible()
  await expect(panel.getByText('Rp 17.258,0 per kg → 4.506,3')).toBeVisible()
  await expect(panel.getByText(/Belum ada data: jam goreng aktual harian/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pelacak tahap' }).locator('[aria-current="step"]')).toHaveText(/Goreng/)

  await sim(page).select('Kantor pabrik')
  await expect(panel.getByRole('list', { name: 'Agustus 2026: standar ke aktual, Rp per kg' })).toBeVisible()
  await expect(panel.getByText('Selisih lain (tidak dirinci di deck)')).toBeVisible()
  await expect(panel.getByText('−18,8', { exact: true })).toBeVisible()
  await expect(panel.getByText('21.630,6').first()).toBeVisible()
  await expect(panel.getByText(/Selisih 0,2 karena tiap baris dibulatkan/)).toBeVisible()
  expect(await problems()).toEqual([])
})

test('Rumah potong ayam: Lensa kesiapan data shows the swimlane totals, gates open their cards, Jalur filters', async ({ page }) => {
  const problems = await watch(page)
  await openWorld(page, 'rpa')
  await expect(page.getByText(DUMMY_KGR)).toBeVisible()
  await page.getByRole('button', { name: 'Lensa kesiapan data' }).click()
  expect((await tiles(page)).slice(0, 5)).toEqual(['135', '9', '34', '92', '42'])
  await sim(page).select('TBC-03')
  const panel = page.getByRole('complementary', { name: 'Detail pilihan' })
  await expect(panel.getByRole('heading', { name: 'TBC-03' })).toBeVisible()
  await expect(panel.getByText('Manajer Operasional + QC')).toBeVisible()
  await expect(panel.getByText('Kenapa penting')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Jalur' }).getByRole('radio', { name: 'Trading' }).click()
  await expect(page.locator('.yd-metric .yd-msub').first()).toContainText('jalur Trading')

  // the swimlane card: lane, PIC role, phase, risk, control, documents, accounts, drivers, needs, gate
  await sim(page).select('Penerimaan, holding dan timbang')
  await page.getByRole('radiogroup', { name: 'Jalur' }).getByRole('radio', { name: 'Keduanya' }).click()
  await expect(panel.getByRole('heading', { name: 'Penerimaan, holding dan timbang' })).toBeVisible()
  await expect(panel.getByRole('tab', { name: '9' })).toBeVisible()
  await panel.getByRole('tab', { name: '9' }).click()
  await expect(panel.getByRole('tabpanel')).toContainText('Timbang masuk lini')
  await expect(panel.getByRole('tabpanel')).toContainText('BASIS YIELD dan denominator Pool A')
  await expect(panel.getByRole('tabpanel')).toContainText('TBC-36')
  expect(await problems()).toEqual([])
})

test('Rumah potong ayam: no card shows a free-text note or a personal name', async ({ page }) => {
  await openWorld(page, 'rpa')
  // every entity's card, every step behind its tabs included, as the panel would render it
  const cards = await page.evaluate(() => {
    const w = window as unknown as { sim: { scene: { entities: { id: string; card: () => unknown }[] } } }
    return w.sim.scene.entities.map((e) => [e.id, JSON.stringify(e.card())] as [string, string])
  })
  expect(cards.length).toBeGreaterThan(30)
  const honorific = /\b(pak|bu|ibu|bapak|mas|mbak)\s+[a-z]+/i
  for (const [id, text] of cards) {
    expect(text, id).not.toMatch(honorific)
    expect(text, id).not.toMatch(/Catatan:/)
  }
  // and the panel as drawn, for one card
  await sim(page).select('Divisi Purchasing')
  const panel = page.getByRole('complementary', { name: 'Detail pilihan' })
  await expect(panel.getByRole('heading', { name: 'Divisi Purchasing' })).toBeVisible()
  expect(await panel.innerText()).not.toMatch(honorific)
})
