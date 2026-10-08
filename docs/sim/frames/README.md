# Brief B4 frames

Factory Yard's own screenshot, for comparison (not copied here):
[docs/factory-yard.png at bbef63f](https://github.com/Khalidabdi1/factory/blob/bbef63fbf98a7209fbd358826fe0130c5de225c8/docs/factory-yard.png).

All frames come from a production build served with the production Content-Security-Policy from
`vercel.json` (the `vite.sim3d.config.ts` preview), headless Chromium on SwiftShader. Every capture
logged zero CSP violations and zero page errors.

## V0: Factory Yard's town, ported as it is

| File | What it shows |
|---|---|
| `v0-town-1366x768.png` | The town from `vendor/factory-yard/index.html`, running as a React-mounted module with three.js from npm and the system monospace font |
| `v0-town-warehouse-section.png` | Warehouse 01 selected: the shell gives way to the section drawing, the card on the right |

## V1: style frame (gate)

The still is **Hari 8, 10.45** of world 2's engine month (seed 20261107; its B2B side is the
world-1 model at 0,4× demand). Positions are staged for the still; motion comes in V2.

| File | What it shows |
|---|---|
| `v1-network-1366x768-light.png` | Network view with all six places (1 Kantor, 2 Prinsipal, 3 Gudang, 4 Bay kurir, 5 Toko, 6 Konsumen, plus the truck pool); the gudang open as a section drawing (racks, receiving, GR desk, staging, B2C packing); the mixed-principal truck **L-03 · TR-08-1-20** selected (four principals, 48 % load) with its route dashed and its next stop ringed; the live metrics bar; the right panel with the engine's three cost groups, the split trip → DO → SKU, cost per carton, and "Belum ada di engine" for drop time and detour; the B2B stage tracker |
| `v1-network-1366x768-dark.png` | The same, in the board's dark theme |
| `v1-network-390x844-light.png` | The same at phone width (full page: the map, then the panel, then the tracker) |
| `v1-lensa-biaya-1366x768-light.png` | Lensa biaya on: the bar shows the engine's cost metrics (Rp 105.444 per B2C order, Rp 204.869 per B2B DO, Rp 230 jt shared warehouse — the same figures `main` shows for day 8), and each place names its cost driver |
| `main-today-1366x768.png`, `main-today-390x844.png` | The simulation as it looks on `main` today (Brief 3's 3D view, world 2, Hari 8 · 10.45), captured from a clean build of `origin/main` |

# Brief B5 frames

Captured with `node scripts/yard-frames.ts --out=docs/sim/frames`: a production build of the dev
preview page served with the production Content-Security-Policy from `vercel.json`, headless
Chromium on SwiftShader. Every capture logged zero CSP violations and zero page errors. All stills
are **Hari 8 · 10.45**, staged (movement comes in W2 and W3).

## W0: the distribution world after the shell refactor

| File | What it shows |
|---|---|
| `w0-distribusi-1366x768-light.png` | B4's V1 still (L-03 selected, gudang open) on the shared shell: unchanged except the new **Dunia** switcher row on top |

## W1: style frames of the two new worlds (gate)

Each world in network view with its places labelled and one place open as a section drawing,
with the world switcher, at 1366 × 768 and at a phone width (390 × 844, full page: map, then
the panel, then the tracker).

| File | What it shows |
|---|---|
| `w1-pabrik-singkong-1366x768-light.png` | BMG's plant on Factory Yard's factory: receiving canopy and bins, the sawtooth line hall **open as a section** (peeling, washing and slicing, frying, sorting, packing), the CNG skids, the conveyor, the finished-goods store with IFM trucks at its east docks, Kantor pabrik. The frying station selected: its card on real BMG standard figures; daily actuals say "Belum ada data" |
| `w1-pabrik-singkong-1366x768-dark.png` | The same in the board's dark theme |
| `w1-pabrik-singkong-390x844-light.png` | The same at phone width; the pins show their number keys only |
| `w1-pabrik-singkong-kantor-1366x768-light.png` | Kantor pabrik open, its cost card leading with the August waterfall, standard → actual, a value on every bar and the −18,8 residual as its own bar |
| `w1-pabrik-singkong-lensa-biaya-1366x768-light.png` | Lensa biaya: per kg production and premium, the IFM price, margin and contribution, pools A–E; each place names its Rp per kg; the pools drawn as a band across the stages |
| `w1-rpa-1366x768-light.png` | KGR's RPA: suppliers behind the fence (external), receiving and holding, the veterinary post, the processing hall **open as a section** (slaughter line, chilling and the eight split-off bins, disposition / cut-up / MDM), the Fresh store, the blast freezer and rented cold rooms, shipping, the Kantor. Chilling and split-off selected: its swimlane card (step 12, real) |
| `w1-rpa-1366x768-dark.png` | The same in dark |
| `w1-rpa-390x844-light.png` | The same at phone width, the swimlane card in full below the map |
| `w1-rpa-lensa-data-1366x768-light.png` | Lensa kesiapan data: the tiles show the swimlane's totals (135 needs; ADA 9 · SEBAGIAN 34 · BELUM 92; 42 gates); every place and division carries its ADA / SEBAGIAN / BELUM bar; gate flags stand where a TBC is open; TBC-03 selected |
| `w1-rpa-kantor-1366x768-light.png` | The Kantor open: four divisions by lane with their step counts, and the 16 gates no step refers to |

The RPA's operating and cost tiles show "—" with "dummy · menyusul di W3": its quantities and
rupiah figures are synthetic and come with the synthetic batch in W3.

# Brief B6 frames

## S0: the scenario shell, distribution world, steps 1–3 (gate)

Captured with `node scripts/yard-frames.ts --out=docs/sim/frames --only=s0`, the same production
build under the production CSP; every capture logged zero CSP violations and zero page errors.
The preset is "100 palet · satu prinsipal · B2B Zona 1" (Prinsipal A, all five SKUs). The pause
and result frames switch the sales admin to **Khusus**, which the engine holds only for
Prinsipal D, so step 3 has to ask.

| File | What it shows |
|---|---|
| `s0-drawer-1366x768-light.png` | **Jalankan skenario** opens the drawer: the two presets (badged Dummy, as the engine), principal and SKU choice, volume in palet or karton, and the live conversion "100 palet = 800 karton menurut aturan palet engine (1,1 × 1,2 m, muatan 1,0 m)" with each SKU's cartons per pallet [Engine] and its split [Hitungan]; Mulai at the foot |
| `s0-director-1366x768-light.png` | Director mode in the middle of step 3: the caption "Langkah 3 dari 11 · Sales admin membuat PO ke prinsipal · driver: 1 PO · +Rp 3.000.000"; the plate faded except the Kantor and Prinsipal A; the shared sales admin desks and plant A drawn live; the PO flying between them; the ledger by team with the current row and its working; the scenario tiles; the step tracker (4a–11 dashed: S1); the controls and "Hari skenario 0" |
| `s0-pause-1366x768-light.png` | The assumption pause at step 3: "Biaya sales admin khusus Prinsipal A per bulan", unit Rp/bulan, owner Komersial (anggaran sales admin), why it is needed; nothing pre-filled; **Simpan sebagai asumsi** |
| `s0-result-1366x768-light.png` | The result after entering the value: Rp 195.000 per palet, the waterfall from Rp 0 (a value and a badge on every bar), cost per team, the cash timeline (none yet, said so), the assumption badged [Asumsi] with its owner and step, Celah data linking to step 3, Ringkasan with the engine data version, Salin link (CSV, print and compare wait for S4) |
| `s0-result-1366x768-dark.png` | The same in the board's dark theme |
| `s0-director-390x844-light.png` | Director mode at phone width: the map, then the ledger, then the steps and controls |
