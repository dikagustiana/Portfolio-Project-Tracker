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

---

# World 2 plan (Brief 2, N0) — "Gudang B2B + B2C"

## Refactor plan

```
src/sim/core/                     shared, world-agnostic
  rng.ts format.ts trace.ts       PRNG, house formatters, traces
  iso.ts colors.ts                projection + principal colours
  TraceView.tsx Waterfall.tsx     number-trace viewer, generic waterfall
  Timeline.tsx sim.css            timeline (+ world-2 intra-day mode), layout css
  TogglesDrawer.tsx               drawer driven by any ToggleDef list
  SimHost.tsx                     screen shell: world selector + lazy worlds
src/sim/worlds/distribusi/        world 1 as built (engine/ + ui/), numbers unchanged
src/sim/worlds/b2b-b2c/           world 2 (engine/ + ui/)
```

- `SimHost` is the single lazy chunk the shell loads; it renders the header world selector
  ("Distribusi" / "Gudang B2B + B2C") and lazy-loads each world separately (`#/simulasi` and
  `#/simulasi/distribusi` → world 1, `#/simulasi/b2b-b2c` → world 2). One nav button, unchanged.
- World 1's files move unchanged (git mv); `tests/fixtures/sim-world1-golden.json` +
  `worlds/distribusi/engine/golden.test.ts` prove world 1's numbers are identical after the move
  (dataset hash + full report diff, control 8).
- The import guard (control 11) keeps walking all of `src/sim/`.

## How the B2B exit reuses world 1

`worlds/b2b-b2c/engine/generate.ts` imports the Brief 1 generator and runs it at a smaller scale
(`demandScale ≈ 0,4`, default behaviour preserved exactly when the option is absent — the golden
test pins this). The B2B side yields POs → arrivals → stock-in → DOs → trips → invoices exactly as
world 1. World 2 then generates B2C orders, and one **shared** stock ledger is built per SKU with
`out = B2B cartons out + B2C units picked`, so both channels draw from the same balances (control 2).

## World 2 engine sketch

- Config: platforms MP-A–E + Website (fee %, settlement days, order share, cut-off 12.00 MP-A /
  16.00 others), Kurir 1–3 (tariff per kg, base per package, pickups/day), boxes (Polymailer/S/M/L
  with dims + cost), standard minutes per B2B line and per B2C line, team pools (shared outbound,
  ISD dedicated, replenishment, CS by tickets, shop management by orders, returns desk), voucher
  and return rates per principal (F vouchers, E returns, C mostly B2C, D B2B only).
- Priorities: P0 instant (small share, processed immediately), P1 same day if before the platform's
  cut-off else P2, P2 next day. Orders carry a time of day (06.00–22.00).
- Allocation: shared pools S1–S5 → principals by ASN count / cartons received / pallets put away /
  pallet-days + location-days / locations counted + units quarantined; each principal's share then
  splits to channels by m³ shipped (toggle: "Porsi volume keluar" default / "Tidak dibagi" as the
  "Biaya gudang bersama" line). Regular outbound pools split by pick lines × standard minutes
  (toggle: shared on/off); ISD only to P0+P1; replenishment by pick-face units per channel.
- B2C order economics: GMV − seller voucher; marketplace fee = fee % × GMV; shipping by the
  "Ongkir ditanggung" toggle (default konsumen) with chargeable weight max(kg, cm³/6.000); packaging
  by chosen box; returns (reverse handling + restock/quarantine); CS by tickets; shop management by
  orders per platform; B2C capital cost over platform settlement days; B2B uses the world 1 clock.
- Contribution views: principal × channel, per platform, cost to serve per priority (P0/P1/P2).

---

# Brief 3 plan (V0) — 3D isometric rebuild

## What is reused (unchanged)

- `src/sim/core/` and both `worlds/*/engine/` — config, generators, allocation, traces,
  formatters, controls: untouched. **Proof at V2: `sim-report` for both worlds byte-identical**
  (the world-1 golden test already guards world 1 continuously).
- Routes and SimHost; the existing 2D Canvas worlds stay as the fallback (WebGL unavailable,
  `prefers-reduced-motion`, and the "Tampilan 2D" toggle).
- `scripts/sim-report.ts`, `docs/sim/*`.

## What is added

- `src/sim/ui3d/` — the 3D layer: `theme3d.ts` (token colours → scene palette), `Scene3D.tsx`
  (R3F Canvas: ortho camera ~35°/45°, sun + hemisphere lights, ground/roads/buildings/vehicles,
  roof fade), `overlay.tsx` (the §4 card system: KPI row, top-centre search + world selector +
  clock chip, selected-object card, "Pelacakan alur", tabs list, slim timeline, map controls,
  drawers, watermark), `Sim3D.tsx` (composition; takes a bindings prop at V2).
- Dependencies (pinned): `three`, `@react-three/fiber@9`, `@react-three/drei@10`. Nothing else.
  No `Environment`/HDR, no troika `<Text>`, no GLB textures, no WASM decoders, no blob workers —
  CSP-safe by construction (§2.2): procedural geometry from `RoundedBox` primitives + vertex/flat
  colours; labels are DOM (`drei Html` / absolutely positioned).
- Models: none for V1 — everything is procedural (CC0-equivalent: authored in-repo). If real
  models are added later, they must be CC0 (Kenney/Quaternius) under 3 MB total in
  `public/sim/models/` and recorded in `ASSETS.md`.

## Asset shortlist (for later milestones, all CC0)

| Source | Candidate | Licence | URL |
|---|---|---|---|
| Kenney | "Toy Car Kit" / "City Kit" | CC0 | https://kenney.nl/assets |
| Quaternius | "Ultimate Modular Buildings", "Vehicles" packs | CC0 | https://quaternius.com |
| In-repo procedural | RoundedBox buildings/trucks/forklifts/pallets (V1 approach) | repo licence | — |

V1 ships 100 % procedural; models stay optional.

## V1 gate plan

Static world-2 scene per §5.1 + every overlay card with placeholder content of the right shape
(§4), screenshots 1366×768 + a phone width (light) into `.sim-local/` (git-ignored), side-by-side
with the reference pending the owner attaching `reference-waretrack.png`. Stop for "lanjut".

### V1 as built

- Files: `camera3d.ts` (the one camera transform: render rig, projected labels and drag-to-pan
  all use it; unit-tested against three.js), `anchors2.ts` (label anchors), `theme3d.ts`
  (palette + `useDarkTheme`, follows `data-theme` like the 2D worlds), `pieces.tsx`,
  `Scene3D.tsx`, `overlay.tsx` + `sim3d.css`, `Sim3D.tsx`, `layoutCheck.ts`.
- Overlay layout is one CSS grid with fixed areas (top / mid / bottom + right column), so cards
  cannot overlap by construction. Mode comes from the measured container width, not the
  viewport: `wide` ≥ 1720 px (KPI row and search group share one row), `medium` ≥ 900 px (search
  group above the KPI row), `phone` below (panels share one collapsible bottom sheet). The camera
  frames the scene in the grid's free middle area, so the warehouse is not hidden behind cards.
- `node scripts/sim3d-frames.ts` starts Vite, sweeps 32 sizes (900–1920 px desktop, the app shell
  next to its sidebar, tablets, phones portrait + landscape) and fails on any overlap, sideways
  spill, card outside the sim area or page side-scroll; then writes the frames to `.sim-local/`.
- "Lihat dalam gudang" is a cutaway (roof off, walls lowered): the warehouse body is a closed box,
  so fading only the roof would show its own top face.
- Not wired into SimHost yet (V2): the overlay's world selector and clock are placeholders with
  the binding shape (`world`/`onWorld`, day/hour/speed/playing).
