import { chromium } from '@playwright/test'
const [link, ...paths] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(link)
await page.waitForTimeout(2500)
for (const p of paths) {
  const [hash, name] = p.split('=')
  await page.goto('http://localhost:5173/' + hash)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `/tmp/claude-0/shots/${name}.png`, fullPage: true })
  console.log(name, 'h1:', await page.locator('h1').first().textContent())
}
console.log('errors', JSON.stringify(errors.slice(0, 8)))
await browser.close()
