/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Browser config: our own VITE_ names, or the ones Vercel's Supabase integration sets. Exactly
// these public values are inlined; nothing else from the build environment reaches the bundle.
const PUBLIC_ENV = {
  VITE_SUPABASE_URL: ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  VITE_SUPABASE_PUBLISHABLE_KEY: ['VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
}

export default defineConfig(({ mode }) => ({
  define: (() => {
    const env = loadEnv(mode, process.cwd(), '')
    return Object.fromEntries(
      Object.entries(PUBLIC_ENV).map(([name, sources]) => [
        `import.meta.env.${name}`,
        JSON.stringify(sources.map((s) => env[s]).find(Boolean) ?? ''),
      ]),
    )
  })(),
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely: separate chunks stay cached across app releases.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|@tanstack)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
    // Domain and parity tests run on Jakarta time, like the golden file (BRIEF §9).
    env: { TZ: 'Asia/Jakarta' },
  },
}))
