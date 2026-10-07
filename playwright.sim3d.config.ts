import { defineConfig } from '@playwright/test'

// Brief 3 V4: browser tests for the 3D sim that need no Supabase stack. The web server builds the
// dev preview page for production and serves it with the production CSP (vite.sim3d.config.ts).
// PW_CHROMIUM points at a pre-installed Chromium; PW_CHANNEL picks an installed browser
// (e.g. msedge) when Playwright's own download is missing.
export default defineConfig({
  testDir: 'e2e-sim3d',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5321',
    viewport: { width: 1366, height: 768 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    channel: process.env.PW_CHANNEL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite build -c vite.sim3d.config.ts --logLevel warn && npx vite preview -c vite.sim3d.config.ts',
    url: 'http://localhost:5321/src/sim/worlds/distribusi/ui/preview.html',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
