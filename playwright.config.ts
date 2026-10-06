import { defineConfig } from '@playwright/test'

// Browser tests against a local Supabase stack (see e2e/helpers.ts). PW_CHROMIUM points at a
// pre-installed Chromium where downloads are not possible.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1360, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
})
