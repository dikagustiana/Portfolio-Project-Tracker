# Brief B4 (v3, cloud): rebuild the "Simulasi proses" world on Factory Yard, as a distribution command centre

Repository: Portfolio-Project-Tracker (SAMB Project Board) on GitHub. You are running in a
cloud session, not on the owner's laptop. Start a new branch, `sim-b4`, from `main`, and
commit this brief to it as `docs/sim/brief-b4.md` as the first commit. Commit after each
step and push `sim-b4` as you go. Never push to `main`. This brief replaces any earlier
copy of Brief B4.

Before anything else, confirm that the simulation engine (`src/sim/`) and the routes in
section 3 exist on `main`. If they live on another branch instead, stop and report which
branch has them.

## 1. Why this brief

Briefs 1 to 3 gave the simulation a working engine (cost drivers per team along SAMB's
distribution cycle) and a 3D world in a toy-like style. The world still reads as one
warehouse in an empty field. The owner wants a living, connected distribution network
where warehouse and fleet clearly affect each other: calm but busy, readable in three
seconds, and showing at every step who does the work, what drives its cost, and how the
cost travels down to the SKU.

The owner's chosen base is **Factory Yard** (`https://github.com/Khalidabdi1/factory`): a
live isometric town in one HTML file, drawn with three.js in the hairline style of
ai-iso-skill. Goods go from a factory to a warehouse to a shop; click anything for a card;
selected vehicles show their route; buildings open as section drawings; each stage only
runs as fast as the next lets it.

## 2. Bring Factory Yard into this repository (do this first)

- The owner reports that Factory Yard's author has allowed the repository to be cloned and
  adapted. The repository has no licence file. Write `NOTICE.md` at this repository's root
  recording:
  - that permission;
  - its date;
  - the link or screenshot reference the owner supplies (if you do not have it, leave a
    clearly marked placeholder and list it in the report).
- ai-iso-skill (`https://github.com/MrBongoC/ai-iso-skill`) is MIT, © 2026 Tolga Cohce: add
  its licence text and attribution to `NOTICE.md`. Add three.js (MIT) too.
- Fetch Factory Yard from GitHub and copy its source into this repository at
  `vendor/factory-yard/`, unchanged, as the reference you port from: `index.html` and
  `README.md`. Leave out its `docs/` images.

## 3. What stays, and the one rule about the engine

- Everything under `src/sim/` that computes: configuration, generator, allocation, trace,
  formatters, controls. **This brief changes no cost logic and no engine number.** Run the
  existing report script before and after; the outputs must match exactly.
- Where the cycle in section 5 needs data the engine does not have yet, the world still
  shows the step (the people, the movement, the click card), and the card says plainly
  "Belum ada di engine", with the missing item named. Never invent a number to fill it, and
  never take one from the owner's notes in this brief into the engine. Those changes belong
  to a separate engine brief, after the owner decides the open points in section 6.
- The routes `#/simulasi/distribusi` and `#/simulasi/b2b-b2c`.
- On-screen text in Bahasa Indonesia, and the label "Ilustrasi: angka dummy, bukan data
  SAMB".
- The number format the engine's formatters use today. Do not change it; note it in the
  report.
- Every other screen of the board. Touch only the simulation.

## 4. Porting Factory Yard

- Port its scene code from `vendor/factory-yard/index.html` into a module mounted inside a
  React component (an imperative three.js scene in its own canvas). Do not rewrite it into
  react-three-fiber unless something forces you to; keep its projection kernel (`P`, `W`,
  `plane`, `box`, `TOP`, `FRONT`, `SIDE`), hairline edges, flat unlit faces and section
  drawings.
- No CDN and no Google Fonts: three.js comes from npm, and fonts are self-hosted or a system
  stack. The page must pass the repository's existing Content-Security-Policy in
  `vercel.json` unchanged.
- Keep its fixed 1/60 s step and seed, so a given seed always plays out the same way. Keep
  a `?debug=1` hook like its `window.yard`, named `window.sim`, for tests.
- Replace whatever world the simulation draws today once the new scene works. Add
  three.js from npm if it is not already a dependency, and remove 3D libraries the new
  scene no longer uses.
- Adapt the town's colours through its CSS custom properties, light and dark, to section 8.

## 5. The world: SAMB's distribution cycle, step by step

Replace the town with SAMB's cycle. Places, reachable with the number keys and the place
buttons:

| Key | Place | Contents |
|---|---|---|
| 1 | Kantor | Komersial (forecast board), sales admin desks, Finance AR, tim tax |
| 2 | Prinsipal | Principal buildings where POs arrive and inbound trucks leave |
| 3 | Gudang | Receiving docks, admin GR screen, racks, picking and staging, loading docks; one shared inventory for B2B and B2C |
| 4 | Bay kurir | B2C parcels handed to couriers and marketplace pickups |
| 5 | Toko | Modern-trade stores (B2B deliveries, DO sign-off) |
| 6 | Konsumen | A residential area receiving B2C parcels |

The eleven steps below are the specification for what each place shows, what moves, and
what a click opens. "Engine" says whether the engine has the data today (have), lacks it
(new), or would need an assumption (assumption). For "new" and "assumption", the card names
what is missing instead of showing a number.

| # | Step and who | What moves | Click opens | Cost driver | Engine |
|---|---|---|---|---|---|
| 1 | Forecast and stock check (Komersial, with Gudang), start of month | Forecast board in Komersial; a question arrow to the warehouse; racks light up per SKU with their stock | A SKU: forecast and current stock | None new (Komersial time sits in the S&M pool, split per order line) | Invoices, order lines and inventory days per principal per month: have. Forecast per SKU: new |
| 2 | Minimum inventory and order need (Komersial, reading each principal's commercial terms) | Stock gauge with a minimum line and a lead-time line | The PO calculation, step by step: need = forecast + minimum stock − current stock − in transit; minimum stock = daily sales × minimum inventory days | None | Commercial terms per principal: new |
| 3 | PO to principal (sales admin) | A PO envelope flies to the principal's building; shared sales admin desks grey, dedicated desks in their principal's colour | A desk: the month's cost, PO count, cost per PO, split per principal, and a shared / dedicated toggle that shows the cost moving | PO count if shared; direct to the principal if dedicated; down to SKU by PO lines | PO data: new. Inbound frequency per principal per month could stand in, assuming one PO per arrival: assumption |
| 4a | Physical inbound (inbound team), day 3 | Principal truck at the dock; forklifts unload, palletise and put away | The dock: pallets in and cost per pallet | Pallets in | Engine uses effective CBM in, not pallets: change needed, new |
| 4b | WMS input (warehouse or sales admin: goods receipt per PO) | The admin screen flashes "GR" at the same moment | The admin desk: PO count and cost per PO | PO count | Same as step 3: new |
| 5 | Storage | Racks fill; empty space above low pallet stacks in another tint; a stay clock above each pallet | A pallet: SKU, cartons per pallet, layers against their limit, days stayed, pallet-day cost | Pallet-days = pallets × days stayed | Carton dimensions, actual layers and cartons per pallet per SKU (K-01), inventory days per principal (K-03), rent, space and storage pools per pallet-day, 85% normal utilisation: have |
| 6 | Outbound picking, about ten days later | A picker breaks a pallet; cartons go down to staging | Pallets and cartons picked, cost per unit | Owner's version: pallets out. Engine today: effective CBM out | Have (CBM); see open point B |
| 7 | Loading and delivery: one truck, many principals | Multi-coloured pallets board a truck; a load bar fills; the truck drives to stops A, B and C | A truck: its three cost groups (time-based: driver and fixed per asset-day; distance-based: fuel loaded and empty, tyres, maintenance; per trip: overhead, tolls and unloading in zones 2 and 3), m³ per principal, load factor, split to DO and then SKU, cost per carton | Trip → DO by m³ share; DO → SKU by m³ share; drops lengthen the trip (0,25 h per drop, detour factor 1,15) | Trips per class and zone, and delivery notes (recipient, class, zone, km, cartons, drops): have, but each note belongs to one principal, so mixed trucks are not modelled: new |
| 8 | Store sign-off; the driver brings the DO back to finance | A store lights green when its DO is signed; the DO envelope rides home with the truck | A store: DO, SKUs, cartons, date received | None new (the driver's time is in the trip cost) | Have |
| 9 | Invoice generated (Finance AR; satellite data pulled into SAP, which generates the invoice) | An invoice appears at the AR desk | Invoices generated per principal | Invoices generated per principal | Invoice count per principal (K-02): have. Sales admin and AR still share one pool: new |
| 10 | Invoice sent, faktur pajak, tukar faktur (tax team makes faktur pajak; AR sends and exchanges) | Envelopes holding invoice and faktur pajak; a tukar faktur queue | The queue and the tax desk | Tax: invoices sent | Tax team and invoices-sent count: new |
| 11 | Term of payment and cash: the capital clock | A clock over each invoice with three coloured segments; a coin drops in at the end | An invoice: days in each segment (delivery → invoice; invoice → faktur pajak → tukar faktur; tukar faktur → TOP 14 days → cash), receivable value, capital cost = rate × receivable × days ÷ 365 | Days in the three segments | DSO per principal per month: have, but as one number, not three segments: new |

**B2B and B2C.** Both draw from the one shared inventory and split only at outbound, as the
engine already assumes. B2B travels on large trucks carrying pallets to stores; B2C on small
vans or motorbikes carrying parcels from the courier bay to consumers. Each has its own tag
on the objects themselves, not only in lists.

**Backpressure, as in Factory Yard.** Each stage runs only as fast as the next allows:
- full racks keep inbound trucks at the docks;
- busy loading docks hold B2B loading;
- a full courier bay holds B2C packing;
- invoices not yet sent hold the capital clock.

## 6. Open points the owner decides later (show them; do not resolve them)

List these in the report, and show A and B as a note on the relevant click card:

- **A. Pallet rule.** The engine stacks to 180 cm on a 12.000 cm² base; the owner's rule
  is a 1,1 × 1,2 m base and 1 m height. For Oi Ocha 500 ml (41 × 28 × 23 cm) that is
  56 cartons per pallet against 32, which nearly doubles pallet-days on its own.
- **B. Picking driver.** Pallets out undercounts principals with many tiny orders (many
  DOs of one carton), which take picker time at carton level.
- **C. Mixed-principal trips** need a trip table (truck, driver, date, km, list of DOs) that
  no current source holds.
- **D.** Sales admin and AR to be split into separate pools; a tax team to be added.
- **E.** The capital clock in three segments instead of one DSO.
- **F.** Forecast per SKU and commercial terms per principal as new inputs.
- **G.** Number format: the simulation and the board's house format differ; one should win.

## 7. The interface (the owner's command-centre spec)

The spec asks for structure that Factory Yard deliberately leaves out. Follow the spec, and
keep Factory Yard's click-for-a-card inside it.

1. **Living canvas.** The network view by default; the gudang and the kantor open as
   section drawings.
2. **Top live metrics bar,** showing the operation's pulse:
   - order hari ini (B2B and B2C);
   - utilisasi gudang;
   - truk tersedia vs di jalan;
   - ketepatan kirim;
   - muatan tertunda.

   A **Lensa biaya** toggle replaces these with the engine's cost metrics (biaya per order
   B2C, biaya per DO B2B, biaya gudang bersama) and labels each place with the driver from
   section 5.
3. **Right contextual panel,** opening on any selection from the table in section 5 and on
   trucks, drivers, trips, stops, orders and documents. It shows status, progress, the
   driver it moves, the engine's figure (or "Belum ada di engine"), and its next step. A
   selected vehicle draws its route dashed and rings its next stop; **Ikuti** follows it.
4. **Bottom stage tracker** for the selected order or trip:
   - B2C: Order, Pick, Packing, Kurir, Selesai, Dana;
   - B2B: Order, Pick, Muat, Jalan, Diterima toko, Invoice, Tukar faktur, Dana.
5. **Context switcher:** Jaringan ↔ Gudang ↔ Kantor; fokus B2B, B2C or Gabungan; the place
   buttons; day and night; pause and speed (1×, 4×, 16×); the day counter.

## 8. Look and liveliness

- Factory Yard's hairline language: 1px edges at any zoom, flat unlit faces, two greys for
  lines, **one live colour** reserved for what is live (selection and route, a busy dock,
  a forklift beacon, an alert).
- Palette: soft cool whites and light blue-greys, muted teal and blue accents; soft green
  for healthy, soft amber for attention, restrained red for critical; principal colours
  only where the spec uses them (dedicated desks, pallets on mixed trucks). Premium and
  calm; not cartoonish, not photoreal.
- Busy but readable: people at desks, forklifts working, trucks at docks, parcels flowing to
  the courier bay, vehicles on the roads, fewer at night. Background activity stays soft.
  Problems stand out: a truck waiting too long, a full dock, low stock for a hot order.
- Under `prefers-reduced-motion: reduce`, motion slows to a minimum and the panels carry
  the state.

## 9. Steps

**V0. Bring in and port.** `NOTICE.md`, `vendor/factory-yard/`, and Factory Yard's town
running inside the simulation route as it is, under the CSP, with the debug hook. Report
anything that would not port.

**V1. Style frame (gate).** One still of the new world: network view with all six places,
the gudang open as a section drawing, a mixed-principal truck selected with its route, the
metrics bar and the right panel, at 1366 × 768 and at a phone width. Save them as PNGs in
`docs/sim/frames/`, with a frame of the simulation as it looks on `main` today for
comparison, and commit them. Link Factory Yard's own screenshot from its repository rather
than copying it. Push, and if the repository deploys branch previews, give the owner the
preview link. **Stop and wait for the owner to say "lanjut".**

**V2. The eleven steps.** Every row of section 5 moving and clickable, bound to the engine
where it has the data, with "Belum ada di engine" cards where it does not; B2B and B2C
distinction; backpressure.

**V3. Interface.** Metrics bar, Lensa biaya, right panel for every selectable object, stage
tracker, context switcher, follow, day and night.

**V4. Proof.**
- The engine report matches before and after, exactly.
- A fixed seed replays the same day.
- CSP test, light and dark, keyboard path and focus, reduced motion, and 1366 × 768 plus a
  phone width.
- Then the report.

## 10. Report

`docs/sim/report-b4.md`, starting with a ten-line summary in informal Indonesian, then:
what was ported and what was rewritten; the permission and attribution as recorded; each
step's evidence (screenshots, the engine report comparison, test results); for each of the
eleven steps, whether it runs on engine data or shows "Belum ada di engine"; the open points
A to G; and every deviation from this brief with its reason.
