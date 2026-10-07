# REPORT — Simulasi proses: world 1 "Distribusi" + world 2 "Gudang B2B + B2C" (+ 3D, Brief 3)

> ## ⚠️ Repo-visibility warning
> `dikagustiana/Portfolio-Project-Tracker` is **PUBLIC** while the README requires the repo to be
> private. Briefs 1–2 were kept as local commits under ground rule §1.2. On 7 Oct 2026 the owner
> chose to push anyway: branch `sim-3d-b3` on `origin` carries Briefs 1, 2 and 3 (all figures
> DUMMY). `feat/simulasi-proses` and `feat/simulasi-b2b-b2c` remain local; their commits are in
> `sim-3d-b3`. Nothing was pushed to `main`.

## What was built

### Brief 1 — world 1 "Distribusi" (`feat/simulasi-proses`)

- **M0** `docs/sim/PLAN.md` — visibility result, stack, file plan, Canvas 2D reasoning.
- **M1** Engine: seeded generator (6 principals, 29 SKUs, 24 stores/3 zones, POs, stock ledger,
  DOs, trips, consolidated invoices, cash clock), allocation with every §4 toggle, recomputable
  traces, house-rule formatters, `scripts/sim-report.ts`. Controls 1–11 across 66 toggle states.
- **M2** Static isometric world, metrics bar, panels with drill-downs, timeline, keyboard overlay,
  watermark. Screenshots `docs/sim/screenshots/sim-*.png`.
- **M3** Sprite animation from the event log, driver pop-ups, Ikuti prinsipal + waterfall, Aturan
  alokasi drawer. Screenshots `m3-*.png`. (No recording — CLI environment.)
- **M4** Playwright smoke, reduced motion jumps, `check`/`build` green, chunk report.
- **Wrap-up** `docs/sim/` plan/assumptions/report, pallet load-height assumption (1,0 m excluding
  the wooden pallet), world-1 golden freeze.

### Brief 2 — world 2 "Gudang B2B + B2C" (`feat/simulasi-b2b-b2c`, N0–N4 built straight through)

- **N0** Refactor plan appended to `PLAN.md`.
- **N1** Refactor to `src/sim/core/` + `src/sim/worlds/{distribusi,b2b-b2c}/`; **control 8**: the
  world-1 dataset hash and full report (defaults + every toggle flip) are byte-identical after the
  refactor (`tests/sim-world1-golden.test.ts`, 9 assertions). World-2 engine: platforms MP-A…E +
  Website (fee %, settlement days, cut-off), Kurir 1–3, boxes, one shared piece ledger serving B2B
  (world-1 generator at 0,4× demand) and B2C orders with priorities and the cut-off rule; shared
  pools S1–S5 → principals → channels by m³ shipped (toggle) or "Biaya gudang bersama" (toggle);
  regular outbound by pick lines × standard minutes (toggle, separate teams add 15 %); ISD only to
  P0/P1; replenishment by pick-face units; CS by tickets, shop management by orders; B2C order
  economics per §4.3 with the ongkir toggle; contribution per principal×channel, per platform, cost
  to serve per priority. Controls 1–8 across 26 toggle states (28 tests). `sim-report --world
  b2b-b2c`.
- **N2** SimHost with the world selector (one nav button; `#/simulasi` → world 1,
  `#/simulasi/b2b-b2c` → world 2, lazy per world), static world 2 with every §7.4 object (dock
  with the 15.00 cut-off dial, bulk racks + pick face + replenishment lane, OMS + wave board, ISD
  zone, packing webcam, box shelf, dispatch + courier lanes, courier bay, B2B lane, desks,
  settlement ledger, bank), five-figure metrics bar, timeline with the 06.00–22.00 intra-day clock
  and 12.00/16.00 cut-off marks. Screenshots `w2-{1366x768,1920x1080,390x844}-{light,dark}.png`.
- **N3** Animation (priority-coloured order tokens, replenishment, picks, courier vans, B2B truck,
  returns, settlement coins), follow modes (principal + platform) with channel waterfalls, order
  waterfall GMV→contribution, toggles drawer. Screenshots `w2-playing/w2-follow-c/
  w2-follow-platform/w2-toggles.png`. (No recording.)
- **N4** Playwright smoke extended to both routes incl. the world selector, intra-day clock,
  keyboard reachability, traces and reduced motion in both worlds; `check`/`build` green; chunk
  report below.

Nothing from either brief's scope was left undone.

### Brief 3 — world 2 in 3D (`sim-3d-b3`, V0–V4)

- **V0** plan + asset rules ([PLAN.md](PLAN.md) "Brief 3", [ASSETS.md](ASSETS.md)): R3F + drei
  `RoundedBox`, fully procedural, CSP-safe by construction (no models, textures, HDR, WASM, blob
  workers, troika text, drei `<Html>`).
- **V1** style frame: toy-like iso scene and the §4 card system. The first attempt's overlay was
  absolutely positioned with fixed widths and collided at 1366 px (search bar wrapped into the
  scene, zoom buttons over the selected card, timeline against the tabs card, everything stacked
  on a phone); rebuilt as one CSS grid with fixed areas and three width modes (wide ≥ 1720,
  medium ≥ 900, phone with a bottom sheet) measured on the container, not the viewport. One
  camera module drives the render rig, the DOM labels and drag-to-pan (tested against three.js).
- **V2** engine bindings: world 2 opens in 3D by default (2D when WebGL is missing, the viewer
  prefers reduced motion, after "Tampilan 2D", or if 3D fails at runtime). KPI row, lists, order
  tracking, object cards and the day summary come from the engine through `bindings2.ts`;
  "Aturan alokasi", "Jejak angka" and "Detail" reuse world 2's toggles, `TraceView` and
  `DetailPanel2`. **sim-report for both worlds byte-identical** to `2a21ed6` (before Brief 3).
- **V3** motion: B2B trucks, couriers, inbound trucks and forklifts move with the engine's day
  (`motion2.ts`: continuity, nose-first, timetable and one-truck-per-door tested). Buildings,
  vehicles and the interior are clickable; "Ikuti" follows a vehicle. Display-only times are in
  [ASSUMPTIONS.md](ASSUMPTIONS.md).
- **V4** hardening: `e2e-sim3d` (7 Playwright tests, no Supabase) builds the preview for
  production and serves it with the **production CSP from vercel.json** — zero violations
  (negative control: an injected inline script is blocked and reported); toggles recompute,
  traces verify, clicks/follow work, SimHost falls back to 2D on reduced motion and without
  WebGL, no card overlaps. `scripts/sim3d-frames.ts` sweeps 32 screen sizes (overlap, sideways
  spill, off-area cards, page side-scroll). `e2e/sim.spec.ts` updated for the 3D default.

Fixed on the way (pre-existing): the 2D bar showed the shared warehouse cost as all B2C under
"Tidak dibagi" (it is charged to neither channel); cost per B2C order matched orders with a
nested scan (~60M compares per call, now a Set with identical output); the sim screen had no
menu button below 860 px, where the app hides its sidebar (3D view only).

## Results

| Check | Result |
|---|---|
| `npm run check` | ✅ lint 0 warnings, typecheck clean, **327 passed / 12 skipped** (DB/e2e suites needing the local Supabase stack; same skips on `main` without Docker) |
| `npm run build` | ✅ |
| Chunk sizes | SimHost **1,50 kB** (0,72 gzip) · world 1 `SimScreen` **37,6 kB** (12,0) · shared core `iso` **38,5 kB** (13,4) · world 2 `SimScreen2` **55,9 kB** (17,8) — each world lazy separately; board main bundle unchanged (react 254,8 kB, index 13,8 kB) |
| Brief 1 controls 1–11 | ✅ 66 toggle states |
| Brief 2 controls 1–8 | ✅ 26 toggle states (+ Brief 1's still green) |
| Control 8 (world 1 unchanged) | ✅ byte-identical dataset hash + report diff |
| Determinism | world 1 hash `80ab43da`; world 2 hash stable per seed `20261107` |
| Playwright | committed; runs where the local stack lives (Docker unavailable on the build machine) |
| Brief 3 `npm run check` | ✅ lint 0 warnings, typecheck clean, **345 passed / 12 skipped** (new: camera, bindings, motion, card format) |
| Brief 3 chunks | `SimHost` **3,1 kB** (1,4 gzip) · `Sim3D` **54,3 kB** (16,9) + css 13,0 kB · vendor `three` **912 kB** (242 gzip, lazy, not preloaded) · app shell unchanged (index 13,8 kB, react 254,8 kB) |
| Brief 3 `npm run e2e:sim3d` | ✅ 7/7 against the production build under the production CSP (run with `PW_CHANNEL=msedge` here) |
| Brief 3 layout sweep | ✅ 32 sizes, 900–1920 px desktop, app shell, tablet, phones portrait + landscape |
| Brief 3 sim-report | ✅ world 1 and world 2 byte-identical to `2a21ed6` (SHA-256 `2bb69c4e…` / `4a64125b…`) |
| Brief 3 frame pacing | headless Edge, production build, playing at 1× and 16×: median frame 4,2 ms, p95 ≤ 8,4 ms, no long tasks; worst single frame 25–29 ms on a day change at 16× |
| `e2e/sim.spec.ts` (Supabase) | updated for the 3D default; **not run** — Docker is unavailable on this machine |

## sim-report highlights

World 1 (defaults) — full output `npx tsx scripts/sim-report.ts`:

```
prinsipal  palet in palet out karton out palet-hari m³ bagian m³ PO inv. dibuat inv. dikirim pendapatan laba kotor
A              881     1.249      9.465     20.165 875,12 m³     49,1%    2      720      120     Rp 7,2 M  Rp 575,5 jt
B              100       209      7.229      2.541 141,96 m³        8%    2      720      120     Rp 6,9 M  Rp 824,1 jt
C              212       360      5.442      4.884 195,78 m³       11%    3      720      120     Rp 2,3 M  Rp 228,6 jt
D              338       501      8.182      7.977 400,75 m³     22,5%    2      720      120     Rp 4,5 M    Rp 450 jt
E               70       172      2.543      2.426  113,4 m³      6,4%    2      513      115  Rp 762,9 jt   Rp 68,7 jt
F               27       120      2.446      1.811   53,8 m³      3%    1      597      120     Rp 1,7 M  Rp 188,3 jt
```

World 2 (defaults) — `npx tsx scripts/sim-report.ts --world b2b-b2c`; the viewer's five questions:

- **Shared stock → channels**: S1–S5 pools split B2B/B2C by m³ shipped (e.g. Simpan Rp 90 jt →
  B2B 56 jt / B2C 34 jt), toggle "Tidak dibagi" keeps the whole Rp 230 jt as "Biaya gudang bersama".
- **Where channels separate**: outbound regular teams split by minutes (B2B 15,4 jt vs B2C 38,6 jt
  picker cost), ISD Rp 40 jt lands only on P0/P1.
- **One B2C order**: cost/order Rp 97–121 rb by priority; the order waterfall walks GMV − voucher −
  fee − kemasan − retur − tim − gudang − modal.
- **Price of speed**: P0 Rp 121,5 rb/order and P1 Rp 118,9 rb vs P2 Rp 97,5 rb — the ISD premium is
  ≈ Rp 22–24 rb/order.
- **Contribution**: per principal×channel (C: B2C Rp 2 M; D: B2B only Rp 100,9 jt), per platform
  (MP-A Rp 1,2 M … Website Rp 639,9 jt), F's voucher leakage visible before any operating cost.

## Known issues

- Brief 3: the "recompute sama" badge (shared `TraceView`, asserted by both e2e suites) is the one
  English phrase left on screen; renaming it is a one-word change in `TraceView` plus the specs.
- Brief 3: world 1 "Distribusi" has no 3D scene; its selector entry opens the 2D world.
- Brief 3: the B2B trucks' return leg is not drawn (they leave toward "Toko" and the Truk list
  marks them "Kembali" after four hours).

- `tests/reference-sql.test.ts` fails on Windows checkouts with `core.autocrlf=true` (CRLF smudge vs
  LF generation). Pre-existing, unrelated to the sim; passes on CI/Linux. A `.gitattributes` would fix.

## Assumptions

[ASSUMPTIONS.md](ASSUMPTIONS.md) — both worlds, every default with its config key and on-screen
location. Plan: [PLAN.md](PLAN.md). Assets: [ASSETS.md](ASSETS.md). Screenshots: [screenshots/](screenshots/)
(Brief 3: `s3d-*.png`).
