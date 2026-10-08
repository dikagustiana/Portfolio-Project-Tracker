# Brief B5: three worlds — Distribusi, Pabrik singkong (BMG), Rumah potong ayam (KGR)

Repository: Portfolio-Project-Tracker (SAMB Project Board) on GitHub, cloud session. Start
the branch `sim-b5` from `sim-b4` (or from `main` if `sim-b4` has been merged). Commit this
brief as `docs/sim/brief-b5.md` first. Commit after each step and push as you go. Never
push to `main`.

Brief B4 (`docs/sim/brief-b4.md`) and B4.1 still apply to the distribution world and to
everything shared. In particular:
- the distribution engine's numbers do not change;
- anything an engine lacks shows as "Belum ada di engine" (or "Belum ada data"), never as
  an invented number;
- movement happens only on engine events;
- the visual language is the Factory Yard hairline style;
- on-screen text is in Bahasa Indonesia.

## 1. What to build

The SAMB Group is not only a distribution network. It also runs a cassava chip plant (BMG)
and a poultry slaughterhouse (KGR, RPA Rawa Teratai). Each earns its money in a different
way, and each is costed per its own unit:

| World | What is transformed | Unit economics | How cost behaves |
|---|---|---|---|
| Distribusi (exists) | Principals' goods into goods on store shelves and in consumers' hands | Per carton, per DO, per pallet-day | Cost attaches to the flow: inbound, storage, picking, trip, invoice, capital clock |
| Pabrik singkong (BMG) | Cassava in its skin into fried cassava chips (FCC) | Per kg of production, then per kg of premium | Process costing: material and conversion per stage |
| Rumah potong ayam (KGR) | Live birds into whole carcasses, cut parts and by-products | Per kg of live bird, then value per blended output | Joint cost allocated to many products by net realisable value (NRV), in two stages |

Add a **world switcher** (Dunia: Distribusi · Pabrik singkong · Rumah potong ayam) at the top
of the simulation, with routes `#/simulasi/distribusi` (existing), `#/simulasi/pabrik-singkong`
and `#/simulasi/rpa`. The three worlds are separate: draw no links between them.

## 2. One shell, three worlds

Refactor before adding anything: the shell (metrics bar, Lensa biaya, place buttons with
number keys, context switcher, right panel, bottom stage tracker, day and night, speed, the
fixed-step seeded clock, the `window.sim` debug hook) becomes shared. Each world supplies:
- its own places and layout;
- its own engine and data;
- its own metrics;
- its own stage tracker;
- its own click cards.

Put each world under `src/sim/worlds/<world>/`. The distribution engine's report must match
exactly before and after the refactor.

## 3. World: Pabrik singkong (BMG)

### Visual base: Factory Yard's own factory

Build this world from the factory in Factory Yard (`vendor/factory-yard/`, already in the
repository with the author's permission recorded in `NOTICE.md`), not from scratch:
- its factory building and section drawing;
- its production line;
- its goods moving from factory to warehouse;
- its trucks;
- its rule that each stage runs only as fast as the next lets it.

Turn its production line into the eight places below, in order:
- incoming trucks and bins become cassava receiving;
- the line's stations become peeling, washing and slicing, frying, sorting and packing;
- its warehouse becomes the finished-goods store and loading bay.

Backpressure follows the cassava facts:
- a full sorting station holds the fryers;
- a full finished-goods store holds packing;
- cassava cannot wait more than a day, so receiving never queues overnight.

Use the same approach for the RPA world's processing line in section 4.

### Data

This world runs on **real BMG standard-cost figures**, not dummy ones. Put them in
`src/sim/worlds/pabrik-singkong/data/standar-fcc.ts`, each with its source, and show on
screen: "Data BMG: biaya standar FCC, basis aktual Januari–Agustus 2026. Sumber: deck BMG FCC
biaya standar per kg dan business plan BMG." Use the figures exactly as below; derive
anything else from them, never invent it.

Standard cost of FCC per kg of production (deck, slides 1–2):

| Stage | Element | Driver per kg of production | Standard price | Rp per kg of production |
|---|---|---|---|---|
| Penerimaan bahan baku | Singkong kulit | 3,0093 kg | Rp 2.673,5 per kg | 8.045,6 |
| | Singkong daging (bought peeled) | 0,1700 kg | Rp 4.526,8 per kg | 769,6 |
| Pengupasan | Upah borongan kupas | 2,0961 kg peeled (rendemen 69,7%) | Rp 268,8 per kg | 563,5 |
| Cuci dan potong | Amonium bikarbonat | 0,0073 kg | Rp 4.638,6 per kg | 33,6 |
| Penggorengan | Minyak olein | 0,2611 kg | Rp 17.258,0 per kg | 4.506,3 |
| | CNG | 0,0153 MMBTU | Rp 226.832,5 per MMBTU | 3.472,3 |
| Pengemasan | Kantong HDPE | 0,0161 kg | Rp 34.320,6 per kg | 553,4 |
| | Karton | 0,0226 karton | Rp 9.647,7 per karton | 217,9 |
| | Plakban, tali dan label | — | — | 45,7 |
| Bersama lintas tahap | Grup A operator | man-hour | pool ÷ 295.087 kg normal production | 1.591,5 |
| | Grup B support dan staf | man-hour | | 1.294,1 |
| | Grup C energi | kWh | | 174,5 |
| | Grup D mesin | kWh | | 932,1 |
| | Grup E pabrik umum | material value | | 507,4 |
| **Total** | | | | **22.707,7** |

From production kg to premium kg (slide 2):

| Item | Rp per kg |
|---|---|
| Biaya per kg produksi | 22.707,7 |
| Kredit KW 2 pada NRV (Rp 9.777,3 per kg) | (341,5) |
| Normal loss: kg KW 2 dan waste | 1.547,2 |
| Biaya per kg premium | 23.913,4 |
| Harga IFM, Agustus 2026 | 28.558,4 |
| Margin penuh, 16,3% | 4.645,0 |
| Kontribusi, 32,4% | 9.251,8 |

Grade split: premium 93,5%, KW 2 3,5%, waste 3,0%. Cassava and frying absorb 74,0% of
standard cost.

August 2026, standard to actual (slide 3): actual Rp 1.077,1 per kg below standard.
Production was 338.754 kg against 295.087 kg normal. The drivers:

| Driver | Effect, Rp per kg |
|---|---|
| Pool volume (A–E spread over more kg) | −580,0 |
| Minyak olein: 0,2330 against 0,2611 kg per kg | −485,3 |
| Singkong daging: 33,6% of cassava kg bought peeled against 5,3% | +528,1 |
| Lower peeling wage | −238,7 |
| Better rendemen | −180,3 |
| Pool spending, net | −102,1 |
| Material price | 0 (standard set in August) |

The drivers listed on slide 3 add up to −1.058,3, not −1.077,1. Show the gap of −18,8 as its
own bar, labelled "Selisih lain (tidak dirinci di deck)", rather than spreading it over the
named drivers. Show the whole bridge as a **waterfall** with values on every bar, from
standard to actual.

Delivery (business plan, Input Operasional, rows 140–145):
- trip capacity 3.500 kg, average fill 90%;
- Tangerang (Cikokol): Rp 2.599.000 borongan per trip, plus toll Rp 1.100.000 on 50% of
  trips;
- Semarang: Rp 560.000 per trip.

Working calendar: 27 working days a month; washing, slicing and frying each run 680 hours a
month (Input Operasional, rows 7 and 102–104).

Facts to respect:
- Fresh cassava cannot be stocked more than a day, so it arrives daily and the only stock
  worth showing is finished goods.
- KW 2 is sold at NRV; waste leaves the plant.
- About 97–98% of revenue comes from one customer, IFM, delivered to Semarang and Cikokol.

### Places (number keys)

| Key | Place | What moves | Click opens |
|---|---|---|---|
| 1 | Penerimaan | Trucks of cassava unload onto the scale and into bins; some loads already peeled | Kg received (skin and peeled), price per kg, the share bought peeled against standard |
| 2 | Pengupasan | Piece-rate peeling crews; peeled cassava moves on | Kg peeled, rendemen against 69,7%, peeling wage per kg |
| 3 | Cuci dan potong | Washing and slicing lines; texture improver dosing | Ammonium bicarbonate per kg |
| 4 | Penggorengan | Fryers with oil and CNG flame (CNG arrives in tube skids) | Oil and CNG per kg against standard, fryer hours against 680 |
| 5 | Sortir dan QC | Three streams split: premium, KW 2, waste | The grade split against 93,5 / 3,5 / 3,0, the KW 2 credit at NRV |
| 6 | Pengemasan | HDPE bags and cartons filled and taped | Packaging per kg |
| 7 | Gudang barang jadi dan muat | Finished goods; trucks loading to Semarang and Cikokol | Kg shipped, trips, fill, delivery cost per trip and per kg |
| 8 | Kantor pabrik | Costing officer prepares the cost card; factory general manager approves | The cost card for the day: standard against actual per element |

### Interface

- **Metrics bar:**
  - produksi hari ini (kg);
  - rendemen kupas;
  - minyak per kg;
  - CNG per kg;
  - komposisi grade;
  - kiriman ke IFM (kg, trip).
- **Lensa biaya:**
  - biaya per kg produksi by element;
  - biaya per kg premium;
  - margin against the IFM price;
  - the shared conversion pools A–E drawn as a band across all stages, with their basis of
    295.087 kg normal production.
- **Stage tracker** for a selected batch: Terima, Kupas, Cuci-potong, Goreng, Sortir, Kemas,
  Kirim.
- **Kantor pabrik** shows the standard-to-actual waterfall for August.

## 4. World: Rumah potong ayam (KGR, RPA Rawa Teratai)

### Source: the KGR swimlane

The owner's KGR swimlane is the specification for this world. Commit the owner's export
as `docs/sim/sources/KGR_swimlane_detail.md`. It was read on 7 October 2026 from the
`os_process_*` tables of the Personal OS database, `entity_code = 'KGR'`. Then generate
`src/sim/worlds/rpa/data/swimlane-kgr.json` from it with a script, and keep the script in
the repository so the snapshot can be refreshed. The snapshot holds:
- 48 steps in 9 lanes and 15 phases;
- the paths: RPA 38 steps, Trading 23 steps, 13 of them shared;
- 42 gates (TBC-xx);
- 135 data needs with their status (ADA 9, SEBAGIAN 34, BELUM 92).

What is real and what is synthetic:
- **Real, from the swimlane:** steps, lanes, phases, gates, data needs and their status,
  documents, accounts, drivers, risks and controls. Show them as they are, with the source
  and date.
- **Synthetic, labelled "Ilustrasi: angka dummy, bukan data KGR":** every quantity and
  rupiah figure (kg, birds, prices, costs, NRV). No KGR dataset exists in the repository.
- **Never display:**
  - the free-text "Catatan" notes;
  - any personal name.

  Some notes name individuals and describe payment arrangements. Show roles only (the
  lane and the PIC role), never the notes.

### Rules the world must respect (from the swimlane; do not simplify them away)

- **Two paths.** A path switch (Jalur: RPA · Trading · Keduanya) works like the B2B/B2C
  focus in distribution. Trading buys finished goods (T1–T10) and joins the shared steps
  from 18 onwards. At putaway (T10), stock is tagged with its origin, beli or potong.
- **Batch ID** (format DD.MM.YYYY plus expiry date) is issued at step 2 and activated at
  receipt. It ties the PO, line weighing, yield, costing, inventory, delivery note and
  invoice into one traceable chain. Selecting any object shows its Batch ID, and following
  a Batch ID highlights the whole chain.
- **Weighing:**
  - The weighing tolerance at receipt is ≤ 2% (step 4).
  - **Live-weight kg into the line (step 9) is the most important number:** it is the
    basis of every yield percentage and the denominator of applied overhead Pool A.
    Weight lost in holding is recorded separately.
- **Losses are period costs, not unit cost:** DOA at receipt (step 5), mortality in
  holding, and condemnation above its normal threshold (step 11). Condemnation has its own
  bucket and is never merged into waste.
- **Two veterinary gates** (antemortem, step 8; post-mortem and condemnation, step 11).
  The **verification of complete death by the penyelia halal** (step 10) is the one control
  whose failure cannot be fixed downstream.
- **The split-off is at step 12, into eight categories:**
  - Daging (the main product);
  - Ceker;
  - Hati & Ampela;
  - Usus;
  - Kepala;
  - Kondemnasi;
  - Output MDM;
  - Waste proses.

  Everything up to here is joint cost.
- **Carcass disposition (step 13)** follows the day's orders, not the process: whole
  carcass to finished goods, carcass to WIP for cut-up, or frame to MDM. The actual
  disposition per batch changes the Total NRV denominator, so it is recorded as actual,
  never as a fixed parameter.
- **Cut-up SKUs (step 14) are deliberately not named yet.** Show them as "SKU cut-up
  (belum ditetapkan)", never with invented or guessed names. Karkas and Hati & Ampela never
  enter step 14: counting them twice would distort every allocation ratio.
- **Costing (steps 19–23):**
  - Live bird is about 89% of batch cost and is charged straight to the batch.
  - Pool A is applied as rate × live-weight kg into the line. The rate's denominator is
    normal monthly volume from the demand plan, never installed capacity.
  - The joint cost is allocated by NRV in seven steps (Allocation Ratio = NRV of the SKU ÷
    Total NRV of the batch). Kondemnasi and Waste receive no allocation.
  - **Separable costs** (cut-up, MDM processing) are added per SKU **after** the joint
    allocation. Never put them in the joint pool.
  - Under the interim convention, selling cost is zero inside NRV until step 37, while
    separable costs use engineering estimates.
  - The difference between actual and applied overhead is a period expense (step 22).
  - A batch closes only when the reconciliation difference is exactly zero (step 23).
- **Fresh and frozen:**
  - All output enters the **Fresh** pool first (step 17), at estimated cost, trued up
    after costing (step 24).
  - Fresh becomes **Frozen** at one point only: the end-of-day disposition (step 30). Each
    remainder goes to blast freeze, repricing or write-off.
  - **Pool B** (blast freezing) is charged directly to frozen SKUs by kg frozen. It never
    enters joint cost, and it stops at the freezing event. Cold-storage time after that is
    a period expense.
  - There are two pools with two FIFOs: fresh by production batch, frozen by
    blast-freeze date.
- **Selling (steps 25–28):** BST (signed handover) triggers sales recognition and
  cut-off. The stream (fresh or frozen) and the Batch ID appear on the delivery note and the
  invoice. Outbound freight is a selling cost, never inventory.
- **Reporting:** the LCNRV test applies to frozen only (step 37), and the segmental P&L is
  Fresh vs Frozen (step 38).
- Cost per kg is always "per kg output campuran (blended)" or per SKU, never "per kg karkas".

### Places (number keys)

| Key | Place | Steps | What moves |
|---|---|---|---|
| 1 | Pemasok | 3, T4 | Live-bird trucks; finished-goods trucks on the Trading path |
| 2 | Penerimaan, holding dan timbang | 4, 5, 7, 9, T5, T6 | Weighing, QC and DOA check, holding pens, pre-operation sanitation, weighing into the line |
| 3 | Pos veteriner | 8, 11, T7 | Antemortem at the pens, post-mortem on the line |
| 4 | Lini potong | 10 | Halal slaughter, bleeding, scalding, plucking, evisceration; the penyelia halal's verification |
| 5 | Chilling dan split-off | 12 | Eight labelled bins filling by category |
| 6 | Disposisi, cut-up dan MDM | 13, 14, 15 | Carcasses branching to whole, cut-up or MDM |
| 7 | Gudang Fresh | 17, 18, 26, 29, T10 | Fresh pool, FIFO picking, the end-of-day count |
| 8 | Blast freezer dan cold storage | 30, 31 | End-of-day disposition; freezing; the frozen pool in rented cold rooms |
| 9 | Pengiriman | 27 | Chilled and frozen deliveries; BST signed |
| 10 | Kantor | 1, 2, 6, 13, 16, 19–25, 28, 32–38, T1–T3, T8, T9 | Divisions by lane: Purchasing, Operasional, Sales, Accounting, with people walking documents (PO, BA Penerimaan, Yield Report, Batch Costing Sheet, invoice), as in the distribution Kantor |

Each lane is a division or crew with a sign above it naming its steps and its main driver,
as in the distribution Kantor. External lanes (Pemasok, Veteriner) are marked as external.

### Interface

- **Metrics bar** (synthetic):
  - ekor and kg masuk lini;
  - susut holding;
  - yield per kategori against the benchmark;
  - kg Fresh and Frozen;
  - sisa fresh at the end-of-day cutoff.
- **Lensa biaya** (synthetic):
  - the batch costing sheet as a breakdown: live bird, direct labour, applied Pool A, the
    joint pool;
  - the seven-step NRV allocation across the categories;
  - separable costs added after;
  - Pool B on frozen SKUs;
  - cost per kg per SKU against value per kg.
- **Lensa kesiapan data** (real, from the swimlane): every station and division shows a
  three-part bar (ADA, SEBAGIAN, BELUM) of its data needs, and a gate marker where a TBC is
  open. Clicking a gate shows:
  - its ID and type (DECISION or DATA);
  - its owner;
  - the steps it blocks;
  - why it matters.

  The 16 gates no step refers to are listed in Kantor. Show the totals (9 / 34 / 92) in
  the metrics bar while this lens is on.
- **Click a step's place** for the swimlane card:
  - lane, PIC role and phase;
  - risk and control;
  - documents and accounts;
  - drivers;
  - data needs with status;
  - the gate.
- **Stage tracker** by phase for a selected batch:
  - RPA: Pengadaan live bird, Produksi sampai split-off, Pemrosesan lanjut, Disposisi &
    yield, Costing batch, Penjualan, EOD settlement, Penagihan, Pembayaran, Pelaporan.
  - Trading: its own five phases.

## 5. Steps

**W0. Shell and switcher.** Refactor the shell, add the world switcher and the routes, and
move the distribution world under `src/sim/worlds/distribusi/`. The engine report must
match exactly.

**W1. Style frames (gate).** One still of each new world in network view with its places
labelled and one place open as a section drawing, plus the world switcher, at 1366 × 768 and
at a phone width. Commit them to `docs/sim/frames/` and give the preview link. **Stop and
wait for the owner to say "lanjut".**

**W2. Pabrik singkong, moving and clickable.** The standard-cost data and its tests:
- The elements add up to Rp 22.707,7 within 0,5 (the deck's lines are rounded and sum to
  22.707,5). Show the deck's total, and note the rounding in the card.
- The premium bridge adds up to Rp 23.913,4.
- The August waterfall closes at −1.077,1 with its residual bar. Flows, metrics, Lensa biaya, cards, the waterfall, and the stage tracker.

**W3. Rumah potong ayam, moving and clickable.** The swimlane snapshot and its script,
with a test that the snapshot reproduces the source's counts (48 steps, 9 lanes, 15
phases, 42 gates, 135 data needs; 9 / 34 / 92). Then the synthetic batch and the costing
engine, with tests:
- the joint allocation adds back to the joint cost;
- Kondemnasi and Waste receive nothing;
- separable costs and Pool B never enter the joint pool;
- a batch closes only at a zero difference.

Then flows for both paths, metrics, Lensa biaya, Lensa kesiapan data, the swimlane cards,
the Batch ID trace, and the stage tracker. No personal names and no free-text notes
anywhere on screen.

**W4. Proof.** A screen recording per world at 1× and 16×; light and dark; keyboard; reduced
motion; the CSP test; the distribution engine report unchanged. Then
`docs/sim/report-b5.md`, starting with a ten-line summary in informal Indonesian, with every
figure's source, what is real and what is synthetic per world, and every deviation from
this brief with its reason.
