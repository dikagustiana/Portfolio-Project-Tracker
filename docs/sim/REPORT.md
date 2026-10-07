# REPORT — Simulasi proses (world 1 "Distribusi")

> ## ⚠️ Repo-visibility warning
> `dikagustiana/Portfolio-Project-Tracker` is **PUBLIC** while the README requires the repo to be
> private. Per ground rule §1.2 the branch `feat/simulasi-proses` is therefore **not pushed** — it
> exists as local commits only, and no PR is opened. Everything below was built and verified locally.
> The PR description with the §6/§10 checklist is prepared and opens with one
> `git push -u origin feat/simulasi-proses` once the owner makes the repo private.

## What was built, by milestone

- **M0 — plan.** `docs/sim/PLAN.md`: repo visibility result, stack as found, file plan, Canvas 2D
  choice with reasons.
- **M1 — engine.** Seeded generator (mulberry32, seed `20261007`; 6 principals, 29 SKUs, 24 stores,
  3 zones, POs, stock ledger, DOs, trips, consolidated invoices, three-segment cash clock), cost
  allocation with every §4 toggle, recomputable traces, house-rule formatters,
  `scripts/sim-report.ts`. Controls 1–11 in Vitest across 66 toggle combinations
  (64 binary states + WACC 5 %/20 %).
- **M2 — static world.** Isometric Canvas 2D world (zoom-to-fit, theme tokens, soft shadows),
  metrics bar, right panel with driver volumes/pool costs/split bars/DO drill-down, timeline
  scrubber with the 11 step markers, keyboard-reachable overlay for every object, watermark.
  Screenshots at 1366×768, 1920×1080, 390×844, light and dark:
  `docs/sim/screenshots/sim-*.png`.
- **M3 — animation.** Sprite layer driven by the precomputed event log and one rAF clock (2,2 s per
  day at 1×): PO envelopes, arrival trucks, forklifts, picking boxes, trip trucks with mixed
  principal colours, store glow on signed DOs, DO envelopes to finance, invoice/faktur papers,
  coins to the bank; driver pop-ups aggregated per day; "Ikuti prinsipal" dims the world and shows
  the gross-profit→contribution waterfall; "Aturan alokasi" drawer with one-line notes per toggle.
  Screenshots: `docs/sim/screenshots/m3-*.png`. (No screen recording — CLI environment; the
  Playwright-driven screenshots show the animated states.)
- **M4 — hardening.** `e2e/sim.spec.ts` (owner sign-in via the shared magic-link helper →
  `#/simulasi`, keyboard reachability, trace recompute badge, `prefers-reduced-motion` jumps day to
  day), `npm run check` and `npm run build` green, chunk report below.

Nothing was left undone from Brief 1's scope.

## Results

| Check | Result |
|---|---|
| `npm run check` (lint 0 warnings + typecheck + Vitest) | ✅ 290 passed, 12 skipped (DB/e2e suites that require the local Supabase stack; same skips on `main` without Docker) |
| `npm run build` | ✅ built in ~2 s |
| Playwright | ✅ syntax/type-checked and committed; runs where the local stack lives (Docker unavailable on the build machine) |
| Chunk sizes | `SimScreen` **74,99 kB (23,5 kB gzip)** + 0,34 kB CSS, lazy; main bundle unchanged (react chunk 254,8 kB, index 13,7 kB) |
| Controls 1–11 | ✅ for every toggle combination (66 runs) |
| Determinism | dataset hash `80ab43da` for seed `20261007` |

## sim-report at defaults (abridged; full output via `npx tsx scripts/sim-report.ts`)

```
prinsipal  palet in palet out karton out palet-hari m³ bagian m³ PO inv. dibuat inv. dikirim pendapatan laba kotor
A              881     1.249      9.465     20.165 875,12 m³     49,1%    2      720      120     Rp 7,2 M  Rp 575,5 jt
B              100       209      7.229      2.541 141,96 m³        8%    2      720      120     Rp 6,9 M  Rp 824,1 jt
C              212       360      5.442      4.884 195,78 m³       11%    3      720      120     Rp 2,3 M  Rp 228,6 jt
D              338       501      8.182      7.977 400,75 m³     22,5%    2      720      120     Rp 4,5 M    Rp 450 jt
E               70       172      2.543      2.426 113,4 m³      6,4%    2      513      115  Rp 762,9 jt   Rp 68,7 jt
F               27       120      2.446      1.811   53,8 m³      3%    1      597      120     Rp 1,7 M  Rp 188,3 jt
```

The profiles read as designed: A eats pallet-days and truck m³ at revenue parity with B; C floods
the warehouse with small-order DOs; D pays its dedicated admin directly; E has a 46-day cash clock
on MT besar; F's stock sits longest relative to throughput.

## Known issues

- `tests/reference-sql.test.ts` fails on Windows checkouts with `core.autocrlf=true` (the migration
  is smudged to CRLF while the generated comparison is LF). Pre-existing, unrelated to this feature,
  passes on CI/Linux; the local clone uses `core.autocrlf=input`. A `.gitattributes` would fix it.

## Assumptions

All defaults and DUMMY parameters, with config keys and on-screen locations:
[ASSUMPTIONS.md](ASSUMPTIONS.md). Plan: [PLAN.md](PLAN.md).
