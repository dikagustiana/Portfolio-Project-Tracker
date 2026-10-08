// Brief B6 S0: Mode skenario on the distribution world, steps 1–3, in a production build under
// the production CSP. The drawer and its conversion preview, the director and its controls, the
// assumption pause, the result card with every figure badged, the link in the URL (it reopens the
// result, and says so when the engine data changed), and Keluar back to the live world.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const PREVIEW = '/src/sim/worlds/distribusi/ui/preview.html'
const DUMMY_SAMB = 'Ilustrasi: angka dummy, bukan data SAMB'

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

/** every figure inside a region carries a source badge */
async function allBadged(page: Page, selector: string): Promise<void> {
  const figs = page.locator(`${selector} .sc-fig`)
  const n = await figs.count()
  expect(n).toBeGreaterThan(3)
  expect(await page.locator(`${selector} .sc-fig .sc-badge`).count()).toBe(n)
}

test('a scenario runs from the drawer to the result, pauses at a gap, and lives in the URL', async ({ page }) => {
  const problems = await watch(page)
  await page.goto(`${PREVIEW}?host=1#/simulasi/distribusi`)
  await expect(page.getByText(DUMMY_SAMB)).toBeVisible({ timeout: 30_000 })

  // the drawer: presets, inputs, the conversion preview from the engine's cartons per pallet
  await page.getByRole('button', { name: /Jalankan skenario/ }).click()
  const drawer = page.getByRole('form', { name: /Jalankan skenario/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('menurut aturan palet engine (1,1 × 1,2 m, muatan 1,0 m)')).toBeVisible()
  await expect(drawer.locator('.sc-preview .lead')).toContainText('100 palet')
  await expect(drawer.locator('.sc-preview .lead')).toContainText('800 karton')
  await allBadged(page, '.sc-preview')
  // validation: no volume, no start
  await drawer.getByRole('spinbutton').first().fill('0')
  await expect(drawer.getByText('Volume harus bilangan bulat lebih dari 0')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Mulai' })).toBeDisabled()
  await drawer.getByRole('spinbutton').first().fill('100')
  await drawer.getByRole('radiogroup', { name: 'Sales admin' }).getByRole('radio', { name: 'Khusus' }).click()
  await drawer.getByRole('button', { name: 'Mulai' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/distribusi\/skenario\?s=[A-Za-z0-9_-]+$/)

  // director mode: caption, controls, scenario clock; Instan goes straight to the gap at step 3
  await expect(page.locator('.sc-caption')).toContainText('dari 11')
  await expect(page.getByRole('group', { name: 'Kontrol skenario' })).toContainText('Hari skenario 0')
  await page.getByRole('button', { name: 'Instan' }).click()
  const pause = page.getByRole('form', { name: 'Asumsi dibutuhkan' })
  await expect(pause).toBeVisible()
  await expect(page.locator('.sc-caption')).toContainText('Langkah 3 dari 11')
  await expect(page.locator('.sc-caption')).toContainText('menunggu asumsi')
  await expect(pause.getByText('Biaya sales admin khusus Prinsipal A per bulan')).toBeVisible()
  await expect(pause.getByText('Komersial (anggaran sales admin)')).toBeVisible()
  // nothing is pre-filled
  await expect(pause.getByRole('textbox')).toHaveValue('')
  await expect(pause.getByRole('button', { name: 'Simpan sebagai asumsi' })).toBeDisabled()
  await pause.getByRole('textbox').fill('12.000.000')
  await pause.getByRole('button', { name: 'Simpan sebagai asumsi' }).click()

  // the result card: waterfall from Rp 0, teams, the assumption, every figure badged
  const result = page.getByRole('region', { name: 'Hasil skenario' })
  await expect(result).toBeVisible()
  await expect(result.locator('.sc-big')).toContainText('Rp 195.000 per palet')
  await expect(result.getByRole('list', { name: 'Biaya per palet, dari Rp 0' })).toContainText('Rp 0 per palet')
  await expect(result.locator('.sc-asm')).toContainText('Rp 12.000.000 per bulan')
  await expect(result.locator('.sc-asm .sc-badge')).toHaveText('Asumsi')
  await expect(result.getByText('Langkah 3 · Sales admin membuat PO ke prinsipal')).toBeVisible()
  await allBadged(page, '.sc-result')
  await allBadged(page, '.sc-ledger')
  const url = page.url()

  // the same link reopens the same result
  await page.goto(url)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Hasil skenario' }).locator('.sc-big')).toContainText('Rp 195.000 per palet', { timeout: 30_000 })
  await expect(page.locator('.sc-banner')).toHaveCount(0)

  // a link made on other engine data still opens, and says so
  const enc = new URL(url).hash.split('s=')[1] ?? ''
  const saved = JSON.parse(Buffer.from(enc.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { h: string }
  saved.h = '00000000'
  const stale = Buffer.from(JSON.stringify(saved)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await page.goto(`${PREVIEW}?host=1#/simulasi/distribusi/skenario?s=${stale}`)
  await page.reload()
  await expect(page.getByText(/Data engine berubah sejak skenario ini dibuat/).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('region', { name: 'Hasil skenario' }).locator('.sc-big')).toContainText('Rp 195.000 per palet')

  // Keluar: back to the live world and its route
  await page.getByRole('button', { name: 'Keluar' }).click()
  await expect(page).toHaveURL(/#\/simulasi\/distribusi$/)
  await expect(page.getByText('Order hari ini')).toBeVisible()
  expect(await problems()).toEqual([])
})

test('the plant worlds show Jalankan skenario as coming later', async ({ page }) => {
  await page.goto(`${PREVIEW}?v=yard&world=pabrik-singkong`)
  const b = page.getByRole('button', { name: /Jalankan skenario/ })
  await expect(b).toBeDisabled({ timeout: 30_000 })
  await expect(b).toHaveAttribute('title', /S2/)
})
