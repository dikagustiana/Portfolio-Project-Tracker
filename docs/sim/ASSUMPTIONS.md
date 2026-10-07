# Assumptions and DUMMY parameters (Brief 1 "Distribusi", shared with Brief 2)

Every value below is illustrative, chosen for the demonstration, and changeable in
`src/sim/engine/config.ts` (world 1) or `src/sim/worlds/*/config.ts` (world 2) without touching
logic code. The owner corrects them after the build. Config keys are given in `code` font.

## Brief 1 §11 defaults

| # | Assumption | Default used | Config key | Where it shows |
|---|---|---|---|---|
| 1 | Invoices | Generated 1 per DO per principal; sent 1 per store per principal per week, consolidated with faktur pajak; sent waits for the last generated invoice of the week | `CASH_TERMS` | Invoice panels, finance desk, metrics "Hari kas tertahan" |
| 2 | Tax | Allocated by invoices sent (toggle to G&A exists: **Aturan alokasi → Pajak**) | `Toggles.taxAllocation` | Pool table, waterfall "Tidak dialokasi" |
| 3 | Pallet | 1,1 × 1,2 m footprint, **load height 1,0 m excluding the 15 cm wooden pallet** (total 1,15 m); the tall rule is 1,8 m load height | `PALLET_RULES.*.heightM`, `.woodHeightM` | Rack stacks, pool "Gudang", panel "Aturan palet" |
| 4 | Truck allocation | Divide by m³ loaded (toggle **Dasar bagi truk → Kapasitas normal** shows "Kapasitas truk tak terpakai") | `Toggles.truckBasis`, `NORMAL_LOAD_FACTOR = 0.85` | Truck panel, unallocated line |
| 5 | Cost of capital | 12 % (slider 0–20 %, labelled "asumsi") | `DEFAULT_TOGGLES.costOfCapital` | Metrics bar, invoice traces |
| 6 | Nav visibility | Owner only, like Admin | `Shell.tsx` (`viewer.isOwner`) | Sidebar button "Simulasi proses" |

## Dummy world parameters (all DUMMY, world 1)

| Parameter | Value | Config key |
|---|---|---|
| Seed | `20261007` | `SEED` |
| Period | 30 days, "Bulan ilustrasi, Hari 1–30" | `DAYS` |
| Truck classes | L: 12 m³/2.500 kg, 3 trucks; M: 24 m³/6.000 kg, 3; H: 42 m³/14.000 kg, 3 — book values Rp 420/780/1.350 jt, 8-year life, insurance 1,5 %/yr, tax 1,25 %/yr, NBV 0,65, diesel Rp 15.000/l | `TRUCKS`, `TRUCK_COMMON` |
| Driver wage | Rp 250.000 / 285.000 / 320.000 per day (L/M/H) | `TRUCKS.*.driverWagePerDay` |
| Zones | Zona 1: 25 km one-way, no toll, 10 stores; Zona 2: 80 km, toll Rp 60.000, 8 stores; Zona 3: 180 km, toll Rp 150.000, 6 stores | `ZONES` |
| Locked convention | One truck makes one trip per day; loaded out, empty back | `Zone.assetDaysPerTrip = 1` |
| Team pools | Komersial 3×Rp 18 jt; Sales admin shared 3×Rp 12 jt; Sales admin dedicated D 1×Rp 12 jt; Inbound 6×Rp 11 jt; WMS 2×Rp 10 jt; Gudang 8×Rp 9,5 jt; Packing/outbound 10×Rp 9 jt; Finance AR 3×Rp 13 jt; Pajak 2×Rp 14 jt | `POOLS` |
| Cash terms | Regular: tukar faktur +2 d, TOP 14 d. MT besar: +14 d, TOP 30 d. Invoice = delivery + 0–1 d; payment = due + 0–3 d; consolidation weeks end d7/14/21/28/30 | `CASH_TERMS` |
| Volume toggle | Chargeable = max(m³, kg / 250) | `DENSITY_FACTOR_KG_PER_M3` |
| Inventory capital | DPO 30 days (toggle "Termasuk modal di persediaan") | `DPO_DAYS` |
| Principal profiles | A bulky/low value (price Rp 760 rb/karton, margin 8 %); B dense/high value (Rp 950 rb, 12 %); C small orders 1–2 karton (Rp 420 rb, 10 %); D dedicated admin (Rp 550 rb, 10 %); E mostly MT besar (80 % bias, Rp 300 rb, 9 %); F high minimum-inventory 21 d, lead 14 d (Rp 700 rb, 11 %) | `PRINCIPALS` |
| Opening stock | covers lead time + minimum inventory days ×1,08 safety | `generateWorld` |
| PO rule | checks on days 1/8/15/22: remaining forecast + minimum stock − current − in transit, ×1,05 | `PO_CHECK_DAYS` |
