import { chromium } from 'playwright-core'
const step = process.argv[2] ?? '2'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)) })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
await page.goto(`http://localhost:5199/src/sim/ui3d/dev3d.html?step=${step}`)
await page.waitForTimeout(2500)
await page.screenshot({ path: `.sim-local/dev3d-step${step}.png` })
console.log('shot step', step)
await browser.close()
