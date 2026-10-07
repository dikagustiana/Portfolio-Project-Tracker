# Assets used by the 3D sim layer

Rule (Brief 3 §2.3): CC0 only, or procedural geometry authored in-repo. Every entry records its
source and licence. Model budget: 3 MB total under `public/sim/models/`.

## V1 — fully procedural (no external assets)

| Asset | How it is made | Licence |
|---|---|---|
| Ground, roads, markings, dock bays | Flat planes/boxes with vertex colours, in-scene | repo licence |
| Warehouses, office annexes, roof ribs, roll-up doors | drei `RoundedBox` + primitives, flat materials in app-token colours | repo licence |
| Box trucks, courier vans, forklift (with operator), container | Composed RoundedBox primitives | repo licence |
| Pallets + kraft cartons | Instanced boxes (wood + kraft colours) | repo licence |
| Trees, planters | Low-poly cones/spheres/cylinders, rounded | repo licence |
| Map pins, signposts, clock post | Extruded/flat shapes; labels are DOM overlays (CSP-safe) | repo licence |

No `.glb`/`.gltf` files, no textures, no HDR environments, no WASM decoders, no `blob:` workers —
the production CSP (`script-src 'self'`, no `wasm-unsafe-eval`, no `blob:` in `img-src`) is
satisfied by construction.

## Shortlist if real models are introduced later (all CC0)

| Source | Pack | Licence | URL |
|---|---|---|---|
| Kenney | Toy Car Kit (vehicles) | CC0 1.0 | https://kenney.nl/assets/toy-car-kit |
| Kenney | City Kit (buildings/props) | CC0 1.0 | https://kenney.nl/assets |
| Quaternius | Ultimate Modular Buildings | CC0 1.0 | https://quaternius.com/packs/ultimatemodularbuildings.html |
| Quaternius | Vehicles pack | CC0 1.0 | https://quaternius.com/packs/vehicles.html |

Any model added later must be re-exported as untextured/vertex-coloured GLTF (external `.png` at
most, served same-origin from `public/sim/models/`), and its entry here updated with the exact
file, source URL, licence, and size.
