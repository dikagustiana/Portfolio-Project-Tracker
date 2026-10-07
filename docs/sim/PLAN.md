# Simulasi proses — plan (M0)

Written before any code; kept as built except where the report notes a deviation.

## Repo visibility result

`gh repo view dikagustiana/Portfolio-Project-Tracker` → `visibility: PUBLIC`. The README marks the
repo **confidential and private-only**, so per ground rule §1.2 nothing was pushed: the branch
`feat/simulasi-proses` lives as local commits only, and the PR is opened after the owner flips the
repo to private. **Warning carried at the top of REPORT.md.**

## Stack as found

- Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`), Tailwind 4 (utilities only)
  over a reviewed `board.css`, TanStack Query, Supabase JS (client only — the sim never imports it).
- Hash routing in `src/app/ui.ts` (`View`, `fromHash`/`toHash`), owner-gated lazy views in
  `Shell.tsx` (the Admin pattern), Vitest with `include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts']`,
  Playwright against a local Supabase stack, CSP `script-src 'self'` (no eval) in `vercel.json`.
- Theme tokens (`--bg … --s-done`) and dark mode via `data-theme` + `prefers-color-scheme` in
  `src/index.css`; fonts Plus Jakarta Sans / JetBrains Mono (mono as a token with system fallback).

## File plan

```
src/sim/engine/   config, rng (mulberry32 + FNV-1a), generate (world), cost (allocation + traces),
                  events (precomputed log), format (house rule), index (memoised facade)
src/sim/ui/       SimScreen (state + rAF clock), WorldCanvas (isometric renderer), sprites,
                  objects (world map), MetricsBar, DetailPanel, TraceView, Timeline, TogglesDrawer,
                  Waterfall, colors, sim.css
scripts/          sim-report.ts (per-principal report), sim-golden.ts (freezes world 1 numbers)
tests/            sim-import-guard.test.ts (control 11), fixtures/sim-world1-golden.json
e2e/sim.spec.ts   Playwright smoke
docs/sim/         PLAN.md, ASSUMPTIONS.md, REPORT.md, screenshots/
```

Outside the feature folder only the two §8 hooks are touched: `src/app/ui.ts` (`'sim'` view,
`#/simulasi`) and `src/app/Shell.tsx` (lazy render + owner-only nav button).

## Rendering choice: Canvas 2D + requestAnimationFrame

1. The quality floor asks for 60 fps with ~150 moving sprites plus a few hundred static objects;
   Canvas repaints are predictable, while hundreds of animated DOM/SVG nodes jank at 16× speed.
2. Soft isometric art (shadows, gradients, dimming) is straightforward procedural Canvas work.
3. CSP-safe with zero runtime dependencies; theme colours are read from the app's CSS tokens.
4. Accessibility is carried by a parallel DOM overlay: every world object is a focusable button
   with an ARIA label; `prefers-reduced-motion` jumps instead of animating.
