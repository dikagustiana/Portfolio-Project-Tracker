/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazy `three` chunk (three.js + react-three-fiber, ~240 kB gzip) is the only one over
    // 500 kB; it loads only when the owner opens the 3D sim, never with the app shell.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Vendor code changes rarely: separate chunks stay cached across app releases.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|@tanstack)[\\/]/ },
            // The 3D sim's renderer: only the lazy Sim3D chunk imports it.
            { name: 'three', test: /node_modules[\\/](three|three-stdlib|@react-three)[\\/]/ },
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
})
