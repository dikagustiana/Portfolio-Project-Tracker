// Production build of the dev preview page, served with the production Content-Security-Policy
// (copied from vercel.json), so e2e-sim3d can prove the 3D sim renders under the real CSP
// without the Supabase-backed app shell. Used only by playwright.sim3d.config.ts.
import { readFileSync } from 'node:fs'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

interface VercelJson {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as VercelJson
const headers = Object.fromEntries((vercel.headers[0]?.headers ?? []).map((h) => [h.key, h.value]))
if (!headers['Content-Security-Policy']) throw new Error('vercel.json has no Content-Security-Policy')

export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: 'dist-sim3d',
      emptyOutDir: true,
      rolldownOptions: { input: { preview: 'src/sim/worlds/distribusi/ui/preview.html' } },
    },
    preview: { port: 5321, strictPort: true, headers },
  }),
)
