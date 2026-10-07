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

---

# World 2 "Gudang B2B + B2C" — assumptions and DUMMY parameters (Brief 2 §10)

All in `src/sim/worlds/b2b-b2c/engine/config.ts`. Generic labels only (MP-A…E, Website, Kurir 1–3, OMS/WMS/Agregator).

| # | Assumption | Default used | Config key | Where it shows |
|---|---|---|---|---|
| 1 | Regular outbound teams shared between B2B and B2C; only ISD is dedicated. Standard minutes: B2B line **1,2 menit**, B2C line **2,5 menit**, B2C package **1,8 menit**, B2B carton 0,4 menit. Separate teams (toggle off) add a **15 %** peak-sizing overhead | `STANDARD_MINUTES`, `SEPARATE_TEAM_OVERHEAD`, `Toggles2.sharedTeams` | Aturan alokasi → "Tim outbound dipakai bersama"; packing panel; priority view |
| 2 | Shipping borne by the **consumer**; fees are percentage-only, no fixed fee per order | `Toggles2.shippingBearer`, `Platform.feePct` | Aturan alokasi → "Ongkir ditanggung"; order waterfall |
| 3 | CS allocated by **tickets** (0,08 per order + 1 per return); shop management by **orders per platform** | `TICKETS_PER_ORDER`, pools `cs`, `shopMgmt` | CS/shop desks, platform panel |
| 4 | Returns inspected at the returns desk; **60 % restocked**, the rest quarantined (write-off 50 % of GMV); reverse shipping 70 % of forward | `RESTOCK_SHARE`, `RETURN_RATE` | Meja retur, order waterfall |
| 5 | Settlement days per platform from order complete: MP-A 7, MP-B 9, MP-C 5, MP-D 12, MP-E 8, Website 3 | `PLATFORMS.*.settlementDays` | Buku settlement, metrics "Hari dana tertahan" |
| 6 | One order = one package; box chosen by item volume (Polymailer ≤ 3,6 L, S ≤ 6 L, M ≤ 15 L, L else); chargeable weight = max(kg, cm³/6.000) | `BOXES`, `CHARGEABLE_VOLUME_DIVISOR_CM3_PER_KG` | Dispatch/manifest panel, shipping trace |
| 7 | The B2B exit follows Brief 1 exactly at **0,4× demand** (world-1 default toggles); PO lines scaled up by each SKU's B2C share so one pool serves both channels | `B2B.demandScale` | Jalur B2B, controls 2 & 8 |
| — | Priority mix: P0 6 %, P1 26 % (before cut-off), P2 rest; hours 06–21 weighted around lunch/evening; order volume 260/day × platform share | `PRIORITY`, `ORDERS_PER_DAY`, `Platform.orderShare` | OMS panel, priority view |
| — | Shared pools S1–S5: ASN 2×Rp 9 jt; inbound 6×Rp 10 jt; putaway 4×Rp 9,5 jt; storage 10×Rp 9 jt; stock mgmt 3×Rp 8 jt. ISD 4×Rp 10 jt; replenishment 3×Rp 8,5 jt; CS 2×Rp 8 jt; shop 2×Rp 9 jt; returns 2×Rp 8 jt | `POOLS` | Aturan alokasi, pool table in sim-report |
| — | B2C value share: C 45 %, E 20 %, F 15 %, A/B 10 % each, D 0 (B2B only). Vouchers: F 6 % of GMV, others ≤ 2 %. Returns: E 12 %, others ≤ 3 % | `B2C_VALUE_SHARE`, `VOUCHER_SHARE`, `RETURN_RATE` | Principal×channel view |
| — | Couriers: Kurir 1 Rp 6.000 + 3.200/kg (2 pickup/hari), Kurir 2 5.500 + 2.900 (1), Kurir 3 6.500 + 3.500 (2) | `COURIERS` | Courier lanes, bay, package panel |

## Brief 3 — display-only schedules in the 3D view

The engine works per day; the 3D view also needs a time of day for things the engine does not
time. These schedules only place objects and statuses on screen — no cost, allocation or trace
uses them (`sim-report` for both worlds is byte-identical before and after Brief 3).

| What | Schedule shown | Where defined | Where it shows |
|---|---|---|---|
| Courier pickups | Two-pickup couriers (Kurir 1, 3) at **11.00 and 17.00**; one-pickup courier (Kurir 2) at **17.00**, after the 16.00 cut-off so P1 orders still leave the same day | `pickupHour` (`src/sim/ui3d/bindings2.ts`) | Dock list (manifests), bay card, "Pelacakan alur" handover |
| B2B trips | Leave from **07.00**, one every 90 minutes, the last by 14.00; four hours out | `tripDepartHour`, `TRIP_HOURS` | Truk list status (Muat / Jalan / Kembali) |
| Inbound POs | Dock from **08.00**, one every two hours (last 18.00); unloading two hours | `inboundHour` | Dock list status (Dijadwalkan / Bongkar / Masuk rak) |
| Order flow within the ship day | Pick from 30 min after the order (07.00 for next-day orders), packing from 90 min; handed over at the courier's first pickup after that; "Selesai" three hours after a same-day handover | `orderStep`, `handoverHour` | "Pelacakan alur" steps, Order list status |
| Vehicles on the map (V3) | Each B2B trip loads at a dock door for 1,5 h before it leaves, then takes 1 h to drive off the map toward "Toko"; couriers drive in 1 h, wait 1 h at their bay slot, leave at the pickup and take 1 h to reach "Konsumen"; inbound trucks drive in 1 h, unload 2 h beside the west wall, leave by the back road in 1 h; forklifts shuttle while a truck loads or unloads | `vehicles2` and its constants (`src/sim/ui3d/motion2.ts`) | Moving trucks, vans and forklifts; vehicle cards; "Ikuti" |

## PR #3 review — world-2 model clarifications

| What | Rule now | Where defined |
|---|---|---|
| Outbound allocation base | Standard minutes = pick lines (B2B 1,2 / B2C 2,5 min) + dispatch per B2C package (1,8 min) and per B2B carton (0,4 min); orders, DOs and principals are charged the same minutes | `STANDARD_MINUTES`, `allocate2` |
| Mixed baskets | An order's revenue and order-level costs split over its items' principals by item GMV; shared warehouse cost by each item's own principal and m³. The order keeps its first item's principal as "lead" for colour/labels | `OrderEconomics.byPrincipal` |
| CS tickets | 0,08 per order plus one per return, charged to the order that raised it | `TICKETS_PER_ORDER` |
| Restocked returns | Back on the shelf on the return day (shared ledger `restocked`); non-restocked returns stay quarantined | `generateWorld2` |
| Manifests | Per courier per ship day, the day's packages split across that courier's pickups | `generateWorld2` |
| Stock capital (toggle) | Charged to the B2B exit's principal contribution and to total costs | `allocate2` |
| Goods cost (HPP), B2C | Item GMV × (1 − SKU margin) — the same basis as B2B's gross profit (value × margin). B2C piece prices are the B2B carton price ÷ pieces (wholesale), so B2C earns the same 8–12 % margin; there is no retail markup | `allocate2` (`OrderEconomics.cogs`), `pieceAttributes` |
