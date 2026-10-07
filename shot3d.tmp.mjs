// V1 gate shots: 1920x1080 and 1366x768 (light) into the git-ignored .sim-local/.
import { chromium } from 'playwright-core'

const launch = async () => {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      continue
    }
  }
  return chromium.launch()
}

const browser = await launch()
for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('CAMDEBUG')) console.log(m.type() === 'error' ? 'ERR: ' : '', m.text().slice(0, 250)) })
  page.on('pageerror', (e) => console.log('PAGE ERR:', String(e).slice(0, 300)))
  await page.goto(`http://localhost:5199/src/sim/worlds/distribusi/ui/preview.html?v=3d&min=1`)
  await page.waitForTimeout(2600)
  const name = `.sim-local/v1-${width}x${height}.png`
  await page.screenshot({ path: name })
  console.log('shot', name)
  await page.close()
}
await browser.close()
