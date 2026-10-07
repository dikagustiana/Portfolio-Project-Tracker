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
- Gate (7 Oct 2026): frames `v1-1366x768-light` and `v1-390x844-light` (plus dark, 1920, shell,
  interior) in `.sim-local/`; layout sweep green at all 32 sizes. Waiting for "lanjut" before V2.

### V2 as built — engine bindings

- `SimHost` opens world 2 in 3D by default (lazy `Sim3D` chunk + a separate `three` vendor
  chunk; the app shell bundle is unchanged). 2D stays when WebGL is missing, when the viewer
  prefers reduced motion, or after "Tampilan 2D" (remembered per browser as `simView`); a
  runtime 3D failure falls back to 2D (`Boundary3D`). The 3D view has its own world selector.
- Every card is engine-bound through `bindings2.ts` (pure, unit-tested): KPI row = the 2D
  metrics bar's figures (`metrics2.ts`, shared) with day-on-day deltas; Dock/Truk/Order lists,
  "Pelacakan alur", the selected-object card and the day summary from the world at the clock's
  day and hour; "Aturan alokasi" = world 2's own toggles; "Jejak angka" = `TraceView`;
  "Detail" = the 2D `DetailPanel2` (follow principal/platform, order waterfalls).
- Pins open their object; search finds objects, orders and B2B trucks. Clock pace matches the
  2D world (2,2 s per day ÷ speed; reduced motion steps an hour).
- Intra-day times the engine does not model are display-only schedules (ASSUMPTIONS.md).
- Proof: `sim-report` for both worlds is byte-identical to `2a21ed6` (before Brief 3).

### V3 as built — motion

- `motion2.ts` (pure, unit-tested) places every vehicle at (day, hour) from the engine's day
  records: B2B trips load at one of three dock doors then drive east to "Toko"; couriers come
  down the right road, wait at their bay slot and leave south to "Konsumen" at the pickup;
  inbound POs come down the left road, unload beside the west wall and leave by the back road;
  two forklifts shuttle while a truck loads or unloads. Tests pin continuity (no jumps, nose
  first), the timetable, and one truck per door.
- The site layout moved to make the routes clear: roads run off the map, dock bays sit at the
  three doors, the clock post and two trees no longer stand on a road.
- Buildings, vehicles and the interior are clickable (the drag only captures the pointer after
  4 px, so clicks reach the scene); a ring and a name tag mark the selection. Vehicle cards
  come from the engine (trip load and cost, manifest packages, PO cartons) and offer "Ikuti":
  the camera follows the vehicle until it leaves the map or the viewer drags.
- Pace: one simulated hour per second at 1× (a day in 16 s; a month in 30 s at 16×), slower
  than the 2D world's 2,2 s per day so vehicles can be followed by eye.

### V4 as built — hardening

- `npm run e2e:sim3d` (`playwright.sim3d.config.ts`, `e2e-sim3d/`): builds the preview page for
  production (`vite.sim3d.config.ts`) and serves it with the CSP copied from `vercel.json`; seven
  tests cover rendering without CSP violations, toggles, traces, pins/lists/search, vehicles and
  "Ikuti", SimHost's 2D fallbacks, and the overlay at 1366×768 and 390×844. No Supabase needed.
- `npm run sim3d:frames -- --tag=…`: the 32-size layout sweep plus style frames in `.sim-local/`.
- `e2e/sim.spec.ts` (Supabase stack) follows the 3D default; not runnable here without Docker.
- Results and numbers: [REPORT.md](REPORT.md).
