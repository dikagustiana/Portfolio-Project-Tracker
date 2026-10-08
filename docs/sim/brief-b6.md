# Brief B6: Mode skenario — end-to-end runs in all three worlds

Repository: Portfolio-Project-Tracker (SAMB Project Board) on GitHub, cloud session. Start
the branch `sim-b6` from `main` if B5 has been merged, otherwise from `sim-b5`. Commit this
brief as `docs/sim/brief-b6.md` first. Commit after each step and push as you go. Never
push to `main`.

Briefs B4, B4.1 and B5 (`docs/sim/`) still apply in full. In particular:
- engine numbers do not change;
- anything an engine lacks is never filled with an invented number;
- movement happens only on engine events;
- people are shown by role, never by name, and KGR's free-text notes are never displayed;
- the visual language is the Factory Yard hairline style;
- on-screen text is in Bahasa Indonesia.

## 1. What this is for

Today each world shows a living operation. The owner wants each world to also **run one
scenario from start to finish**. For example: 100 pallets for one principal in the
distribution world, starting with the GM Commercial's forecast and ending when the cash
arrives.

The scenario plays step by step. The camera follows whoever is working, and a ledger
accumulates the cost at every step. At the end, a result card shows:
- the full cost per unit, built up as a waterfall;
- which teams carried that cost;
- how long cash was tied up;
- every assumption the scenario needed.

The scenario is also a **data-gap finder**. Wherever an engine lacks data, the scenario
stops and asks for the number, records it as an explicit assumption, and lists it on the
result card. Running a scenario therefore shows the team exactly which data they still need
to collect.

## 2. Binding principles

1. **One engine.** A scenario is a parameterised run of the world's existing engine, not a
   separate animation or a separate calculation:
   - Put the scenario layer in `src/sim/scenario/` (shared) and
     `src/sim/worlds/<world>/scenario/`. It composes engine functions with scenario inputs
     and assumptions.
   - New calculations a scenario needs (for example the order-need formula or the
     three-segment capital clock) live in the scenario layer with unit tests. They never
     change an engine's defaults or existing outputs.
   - The distribution engine report, the BMG standard-cost tests and the KGR costing tests
     from B5 must still pass unchanged.
2. **Deterministic and shareable:**
   - The same inputs, assumptions and seed always give the identical result.
   - A scenario is serialised into the URL:
     - `#/simulasi/<world>/skenario?s=<encoded>`;
     - a schema version (`v: 1`);
     - a hash of the engine data it ran on.

     If the engine data has changed since the link was made, the page says so ("Data
     engine berubah sejak skenario ini dibuat") and still opens.
3. **Gaps become explicit assumptions, never silent defaults:**
   - When a step needs a value the engine does not have, the scenario pauses at that step.
     It asks for the value with its name, unit, and the role that would normally own it
     (for KGR, also the gate ID and owner from the swimlane). The run continues only once
     the value is entered.
   - There are no pre-filled suggestions. The only exception is a value already documented
     in a source this repository holds, shown with that source.
   - Every entered value is an **Asumsi skenario**: saved in the URL, shown in the ledger
     wherever it is used, and listed on the result card.
4. **Every figure carries its source.** Every number in the ledger and the result card shows
   a small badge:
   - [Engine];
   - [FCC BMG] (the BMG standard-cost data);
   - [Swimlane KGR];
   - [Dummy] (synthetic data);
   - [Asumsi] (a scenario assumption);
   - [Hitungan] (computed in the scenario layer from badged inputs; hovering shows the
     formula and its inputs).

   No figure appears without a badge.
5. **Roles, not names.** Actors are shown by role, for example "GM Commercial membuat
   forecast".
6. **Number format** follows the formatters the simulation already uses (period for
   thousands, comma for decimals). Units are always shown.

## 3. The scenario shell (shared by all three worlds)

**Entry.** Each world gets a **Jalankan skenario** button. It opens an input drawer with:
- the world's inputs;
- validation;
- a live conversion preview (for example "100 palet = … karton menurut aturan palet engine",
  with the number computed from the engine);
- presets (section 4);
- **Mulai**.

**Director mode.** While a scenario runs:
- The camera follows the active step. Places and people not involved dim, and the acting
  roles and moving objects are highlighted.
- A caption bar reads, for example: "Langkah 3 dari 11 · Sales admin membuat PO ke
  prinsipal · driver: 4 PO · +Rp …".
- Controls: play and pause, previous step, next step, speed (1×, 4×, 16×, Instan), ulang,
  and keluar (back to the live world).
- A scenario clock counts days from the scenario start. It is separate from the live
  world's day counter.

**Ledger panel** (right side), one row per step:
- step;
- role;
- driver quantity and unit;
- rate;
- cost;
- cumulative cost;
- cost per scenario unit;
- source badge.

Rows group by team and collapse. The current step's row is highlighted.

**Assumption pause.** At a gap, the step's card opens in the panel with the missing
value(s), each with name, unit, owning role and why it is needed. **Simpan sebagai asumsi**
continues the run.

**Result card,** at the end:
1. **Biaya per unit** as a waterfall from Rp 0 to the full cost per unit, one bar per step
   or cost group, with its value on every bar.
2. **Biaya per tim**: a bar per team or division, with values on the bars.
3. **Garis waktu kas**: cash out and cash in events on the scenario clock, the days cash
   was tied up, and the capital cost.
4. **Asumsi skenario**: every assumption with its value, unit, owning role, and the step
   (and gate) where it was needed.
5. **Celah data**: every step that ran on an assumption, linked back to that step.
6. **Ringkasan**: the inputs, the totals, and the engine data version.

Result card actions:
- **Salin link**;
- **Unduh CSV** of the ledger (house number format, with the source column);
- **Tampilan cetak** (A4 landscape, light theme);
- **Bandingkan**: pick a second saved scenario to show both result cards side by side,
  with the differences per waterfall bar.

## 4. World scenarios

### 4.1 Distribusi

**Inputs:**
- **principal(s) and SKU(s)** from the engine's master data;
- **volume** in pallets or cartons, converted through the engine's cartons per pallet per
  SKU, with both shown;
- **channel**: B2B (store DOs), B2C (parcels) or a mix;
- **delivery profile**: number of stores or DOs, zone, drops per trip;
- **the month** whose engine pools apply.

**Scenario options for the open points** (default = the engine's current rule; the result
card states which option was used):
- **Titik terbuka A, aturan palet**: engine rule (180 cm on a 12.000 cm² base) or the
  owner's rule (1,1 × 1,2 m base, 1 m high). It changes cartons per pallet and therefore
  pallet-days.
- **Titik terbuka B, driver picking**: pallets out or cartons picked.

These options run only inside the scenario. They are what-ifs to help the owner decide,
and never change engine defaults.

**Sequence and roles.** The scenario walks the eleven steps of Brief B4, section 5:

| # | Step | Role(s) | What the scenario computes |
|---|---|---|---|
| 1 | Forecast and stock check | GM Commercial (Komersial), with Gudang | Forecast from the scenario volume; current stock (engine, or asumsi). No new cost; the S&M pool is split per order line |
| 2 | Order need | Komersial | Need = forecast + minimum stock − current stock − in transit; minimum stock = daily sales × minimum inventory days. Each missing term is asked for |
| 3 | PO to principal | Sales admin (shared or dedicated toggle) | PO count; cost per PO if shared, or direct to the principal if dedicated; down to SKU by PO lines |
| 4a | Physical inbound | Tim inbound | The engine's inbound driver as implemented (report which: pallets or effective CBM) × the engine rate |
| 4b | WMS goods receipt | Admin gudang or sales admin | PO count × cost per PO |
| 5 | Storage | Gudang | Pallet-days = pallets × days stayed (engine inventory days per principal, or asumsi) × the engine rate |
| 6 | Picking and outbound | Picker | Pallets out or cartons picked (option B) × rate |
| 7 | Loading and delivery | Driver and armada | Trips from m³ and truck class; trip cost from the engine; split to the scenario's DOs by m³ share. A shared truck needs the share of other principals' m³ (asumsi) |
| 8 | Store sign-off | Driver | No new cost; the DO returns to finance |
| 9 | Invoice generated | Finance AR | Invoices (engine count rule, or asumsi invoices per DO) × cost per invoice |
| 10 | Invoice sent, faktur pajak, tukar faktur | Tax, Finance AR | Invoices sent × cost per invoice |
| 11 | Term of payment and cash | Treasury | Receivable value (engine sales value, or asumsi selling value per carton); days in three segments (delivery → invoice, invoice → tukar faktur, tukar faktur → TOP); capital cost = rate × receivable × days ÷ 365 (rate: engine, or asumsi) |

**Result:**
- cost per pallet, per carton and per DO;
- cost as a share of sales value;
- cost per team (Komersial, Sales admin, Inbound, Simpan, Picking, Transport, Finance AR,
  Tax, Treasury);
- days cash was tied up.

**Presets** (engine data is dummy, so these are dummy too):
- "100 palet · satu prinsipal · B2B Zona 1";
- "Campuran B2B dan B2C".

### 4.2 Pabrik singkong (BMG)

**Inputs:**
- **monthly IFM order in kg of premium**, or kg of production, converted with the grade
  split (premium 93,5%) [FCC BMG];
- **destination split** Semarang and Cikokol;
- **share of cassava bought peeled** (standard 5,3% [FCC BMG]);
- **what-if drivers** from slide 3 of the deck: oil per kg, rendemen, peeling wage, peeled
  share. Each defaults to standard, and any change is marked as a what-if, never as
  "aktual";
- **payment terms**: to cassava suppliers and from IFM, each asumsi unless a repository
  source holds it.

**Sequence:**

| # | Step | Role(s) | What the scenario computes |
|---|---|---|---|
| 1 | Production plan from the IFM order | PPIC or kepala produksi | kg production = kg premium ÷ 93,5%; daily plan over 27 working days |
| 2 | Cassava purchase (daily; cassava cannot wait a day) | Purchasing | kg skin cassava = 3,0093 × kg production; peeled cassava by the peeled share; cash out on the supplier terms |
| 3 | Receiving | Gudang bahan baku | Kg received, at standard price per kg |
| 4 | Peeling | Kru kupas borongan | Peeling wage per kg peeled; rendemen 69,7% |
| 5 | Washing and slicing | Operator | Ammonium bicarbonate per kg |
| 6 | Frying | Operator penggorengan | Oil and CNG per kg; fryer hours against 680 a month (if the volume needs more, the scenario says so and asks for capacity per hour as asumsi) |
| 7 | Sorting and QC | QC | Premium, KW 2 and waste by the grade split; KW 2 credit at NRV (Rp 9.777,3 per kg) |
| 8 | Packing | Operator kemas | Packaging per kg |
| 9 | Finished goods and delivery | Gudang barang jadi, armada | Trips at 3.500 kg × 90% fill; Cikokol Rp 2.599.000 per trip plus toll Rp 1.100.000 on 50% of trips; Semarang Rp 560.000 per trip |
| 10 | Invoice and cash from IFM | Finance AR | Revenue at the IFM price (Rp 28.558,4 per kg, August 2026); cash in on the IFM terms |

**Shared pools A–E**: at the normal 295.087 kg a month they are absorbed at standard. At the
scenario's monthly volume, show the under- or over-absorption as a volume effect, the same
mechanism as slide 3's pool-volume bar.

**Result:**
- cost per kg of production and per kg of premium, as the slide 2 bridge;
- delivery cost per kg;
- margin against the IFM price;
- the volume effect;
- working capital (cassava paid daily against IFM paying on terms).

**Test:** at 295.087 kg with all drivers at standard, the scenario reproduces Rp 22.707,7
(± 0,5) per kg of production and Rp 23.913,4 per kg of premium.

**Preset:** "Volume normal: 295.087 kg produksi sebulan" [FCC BMG].

### 4.3 Rumah potong ayam (KGR)

All quantities and prices are [Dummy] until real KGR data replaces them. Steps, roles,
gates and documents are [Swimlane KGR].

**Inputs:**
- **path**: RPA, Trading or both;
- **batch size**: birds and average weight, or kg live bird;
- **live-bird price**, including PPh 22 and freight-in as acquisition cost;
- **disposition at step 13**: kg to whole carcass (FG), to cut-up (WIP), and frames to
  MDM;
- **sell-through of fresh by the end-of-day cutoff**;
- **split of the remainder** between blast freeze, repricing and write-off;
- **customer terms**.

**Sequence:**
- The scenario walks the swimlane steps in slot order. RPA has 38 steps through 10 phases;
  Trading has 23. The stage tracker shows the phases.
- Each step shows its lane and PIC role, the documents it produces, and its gate.
- **At an open gate the scenario pauses and asks for the value the gate stands for,** with
  the gate ID and the owner from the swimlane. For example:
  - TBC-15, normal monthly volume (the Pool A rate's denominator);
  - TBC-07, NRV reference prices per SKU, fresh and frozen;
  - TBC-36, normal holding shrink;
  - TBC-22, DOA threshold;
  - TBC-35, normal condemnation;
  - TBC-03, fresh shelf life;
  - TBC-01, end-of-day cutoff;
  - TBC-06, blast-freeze criteria;
  - TBC-11, payment terms.

**Costing,** exactly as Brief B5, section 4:
- Live bird is charged straight to the batch.
- DOA, holding mortality and condemnation above normal are period expenses.
- Pool A is applied as rate × live-weight kg into the line.
- The eight split-off categories; the seven-step NRV allocation, with Kondemnasi and Waste
  receiving nothing.
- Separable cut-up and MDM costs are added after the allocation (engineering estimates as
  asumsi).
- Pool B is applied only to kg frozen; cold-storage time after freezing is a period
  expense.
- Outbound freight is a selling cost.
- BST triggers revenue; the invoice carries the stream; cash arrives on the terms.
- The batch closes only at a zero difference.

**Result:**
- cost per kg per SKU (allocated joint cost + separable + Pool B for frozen) against
  value per kg;
- the batch's segmental P&L, Fresh vs Frozen;
- period expenses listed separately (DOA, mortality, condemnation above normal, overhead
  difference, cold-storage time, write-off);
- the cash timeline (live birds paid early against customers paying on terms);
- **Gate yang diasumsikan**: every gate the scenario had to assume, with its owner, linked
  to the Lensa kesiapan data.

**Preset:** "Batch contoh 1.000 ekor" [Dummy].

## 5. Tests

- **Determinism:** two runs with the same URL give identical ledgers.
- **URL round-trip:** encode, then decode, gives the same scenario.
- **Ledger:**
  - the rows sum to the result totals;
  - each waterfall closes to the total;
  - cost per unit × units = total.
- **Gaps:** with no assumptions entered, a scenario stops at its first gap. No step ever
  runs on a value without a badge.
- **Per world:**
  - Distribution: capital cost = rate × receivable × days ÷ 365 for each segment; options A
    and B change only the scenario, never the engine report.
  - BMG: the standard reproduction test in 4.2.
  - KGR:
    - the joint allocation adds back to the joint cost;
    - Kondemnasi and Waste receive nothing;
    - separable costs and Pool B never enter the joint pool;
    - period expenses never enter inventory cost;
    - the batch closes at zero.
- **Every existing test** from B4, B4.1 and B5 still passes; the distribution engine report
  is unchanged.

## 6. Steps

**S0. Shared shell (gate).**
- Build the input drawer, director mode, ledger, assumption pause, result card, URL
  encoding and source badges.
- Wire them to the distribution world for steps 1–3 only.
- Commit stills to `docs/sim/frames/` and give the preview link:
  - the drawer with its conversion preview;
  - director mode mid-step;
  - an assumption pause;
  - a result card with its waterfall.
- **Stop and wait for the owner to say "lanjut".**

**S1. Distribusi:** all eleven steps, options A and B, presets.

**S2. Pabrik singkong:** all ten steps, what-if drivers, the volume effect, the
reproduction test.

**S3. Rumah potong ayam:** the RPA path through all ten phases, then the Trading path,
gates as assumption pauses, and the segmental result.

**S4. Compare, export and print:** Bandingkan, CSV and the print view.

**S5. Proof and report.**
- A screen recording per world of a full scenario at 16×, with one assumption pause.
- Light and dark; keyboard; reduced motion; the CSP test.
- Then `docs/sim/report-b6.md`, starting with a ten-line summary in informal Indonesian,
  then:
  - per world: what runs on engine data and what needed assumptions;
  - the full list of assumptions each preset asks for;
  - test results;
  - every deviation from this brief with its reason.
