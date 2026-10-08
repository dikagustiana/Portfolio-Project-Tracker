// Assembles SAMB's world in the scene: the static places as clickable entities, and the actors
// (trucks, inbound trucks, couriers, forklifts, people, pallets, documents). Brief B4 V1 stages
// one moment — Hari 8, 10.45 — for the style frame; V2 drives the same actors from the engine's
// day schedule.
import * as THREE from 'three'
import { Path, W, glow, pose } from '../../../yard/kernel.ts'
import type { P2, PrincipalFill, Tone } from '../../../yard/kernel.ts'
import { buildCoin, buildDesk, buildEnvelope, buildForklift, buildPallet, buildPerson, buildSeated } from '../../../yard/models.ts'
import type { Entity, RouteInfo, YardScene } from '../../../yard/scene.ts'
import type { Computed2 } from '../../b2b-b2c/engine/index.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { formatNumber } from '../../../core/format.ts'
import type { Card, TripView } from './bind.ts'
import { MISSING, TEAM_SEATS, salesAdminPools, tripCard, tripsOfDay } from './bind.ts'
import {
  buildBay, buildDockLamp, buildGround, buildGudang, buildHousing, buildKantor, buildPlant, buildPool, buildSignLamp, buildStore,
} from './build.ts'
import { A2, BAY, COURIER_SLOTS, GUDANG, KANTOR, LOAD_DOCKS, PLANTS, POOL_BAYS, R1, RACK_BAYS, RACK_PITCH, RACK_ROWS, RACK_X0, RECV_DOCKS, SCALE, STORES, STORE_LANES, STORE_LINK } from './layout.ts'
import { TRUCK_DECK, TRUCK_SLOTS, buildCage, buildCourierVan, buildInboundTruck, buildMotorbike, buildParcel, buildTruck } from './models.ts'

const FLEET = ['L-01', 'L-02', 'L-03', 'M-01', 'M-02', 'M-03', 'H-01', 'H-02', 'H-03']

export interface World {
  /** trucks by code */
  trucks: Map<string, Entity & { state: string }>
  day: number
  hour: number
  fleet(): { available: number; road: number; dock: number }
  pending(): { b2b: number; b2c: number }
}

interface Truck extends Entity {
  code: string
  group: THREE.Group
  trip: TripView | null
  state: 'pool' | 'dock' | 'road' | 'away'
  stopsDone: number
  path: Path | null
  s: number
  stops: { s: number; name: string; at: P2 }[]
}

/** The zona 1 delivery loop: from the B2B docks up Jl. Niaga, east along the upper store lane
 *  (Toko 01–05, the engine's DO order), down the link, west along the lower lane (Toko 10–06),
 *  back down Jl. Niaga and along Jl. Raya to the pool. The drive itself is drawing only. */
function zona1Loop(dockY: number): { path: Path; stops: { name: string; at: P2 }[] } {
  const hi = STORE_LANES[0]?.lane ?? 43.5
  const lo = STORE_LANES[1]?.lane ?? 88.5
  const pts: P2[] = [
    [GUDANG.x1 + 16, dockY], [A2.north, dockY], [A2.north, hi], [STORE_LINK.lane, hi], [STORE_LINK.lane, lo], [A2.south, lo],
    [A2.south, R1.west], [236, R1.west], [236, 72],
  ]
  const order = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5]
  return { path: new Path(pts, 5), stops: order.map((i) => { const s = STORES[i]; return { name: s?.code ?? '', at: s?.stop ?? [0, 0] } }) }
}

export function buildWorld(scene: YardScene, data: Computed2, day: number, hour: number): World {
  const ink = scene.ink
  const add = (e: Entity): Entity => scene.add(e)
  const pools = data.alloc.b2bAlloc.pools
  const poolOf = (id: string) => pools.find((p) => p.def.id === id)

  // ---- static places ---------------------------------------------------------------------------
  const ground = buildGround(ink)
  ground.traverse((o) => {
    o.raycast = () => {}
  })
  scene.scene.add(ground)

  const gd = buildGudang(ink)
  scene.addPeek('gudang', gd.peek)
  const gudangPallets = data.alloc.b2bAlloc.pallets.palletsByDay[day]
  const onHand = gudangPallets ? Object.values(gudangPallets).reduce((s, x) => s + x, 0) : 0
  add({
    id: 'Gudang', kind: 'gudang', groups: [gd.group], still: true, pick: [199, 159, 12],
    card: (): Card => {
      const inbound = poolOf('inbound')
      const storage = poolOf('gudang')
      const packing = poolOf('packing')
      return {
        kind: 'Gudang · stok bersama B2B + B2C', title: 'Gudang utama', status: `${formatNumber(onHand)} posisi palet terisi hari ${day}`,
        rows: [['Dok terima', `${RECV_DOCKS.length} pintu`], ['Dok muat B2B', `${LOAD_DOCKS.length} pintu`], ['Bay kurir B2C', `${COURIER_SLOTS.length} slot`]],
        driver: 'palet masuk (inbound) · palet-hari (simpan) · palet keluar (outbound)',
        engine: [
          { label: 'Tarif inbound per palet', value: `Rp ${formatNumber(inbound?.rate ?? 0)}`, trace: inbound?.rateTrace },
          { label: 'Tarif simpan per palet-hari', value: `Rp ${formatNumber(storage?.rate ?? 0)}`, trace: storage?.rateTrace },
          { label: 'Tarif outbound per palet', value: `Rp ${formatNumber(packing?.rate ?? 0)}`, trace: packing?.rateTrace },
          { label: 'Kapasitas rak (untuk utilisasi)', missing: `${MISSING}: kapasitas gudang dalam posisi palet` },
        ],
        next: 'Klik rak, dok, atau meja admin GR untuk langkahnya',
        notes: [
          'Titik terbuka A: aturan palet engine saat ini alas 1,1 × 1,2 m, muatan 1,0 m (sama dengan aturan pemilik); engine juga punya aturan "tall" alas 1,0 × 1,2 m, muatan 1,8 m. Untuk Oi Ocha 500 ml (41 × 28 × 23 cm): 56 karton per palet pada 1,8 m lawan 32 pada 1 m, hampir dua kali palet-hari.',
          'Titik terbuka B: palet keluar kurang menghitung prinsipal dengan banyak pesanan kecil (banyak DO satu karton) yang memakan waktu picker di level karton.',
        ],
      }
    },
  })
  for (const d of LOAD_DOCKS) scene.scene.add(Object.assign(buildDockLamp(ink, GUDANG.x1 + 0.8, d.y - 4.4), { name: `dockLamp${d.id}` }))

  const kt = buildKantor(ink)
  scene.addPeek('kantor', kt.peek)
  const sa = salesAdminPools(data)
  add({
    id: 'Kantor', kind: 'kantor', groups: [kt.group], still: true, pick: [57, 45, 9],
    card: (): Card => ({
      kind: 'Kantor · Komersial, sales admin, Finance AR, pajak', title: 'Kantor PT SAMB', status: 'jam kerja',
      rows: [
        ['Komersial', `${TEAM_SEATS.komersial} orang · forecast & stok`],
        ['Sales admin', `${TEAM_SEATS.salesAdminShared} bersama + ${TEAM_SEATS.salesAdminDedicated} khusus Prinsipal D`],
        ['Finance AR', `${TEAM_SEATS.arFinance} orang`],
        ['Pajak dan pengiriman invoice', `${TEAM_SEATS.tax} orang`],
      ],
      driver: 'jumlah PO (sales admin) · invoice dibuat (AR) · invoice dikirim (pajak)',
      engine: [
        { label: 'Pool sales admin bersama', value: `Rp ${formatNumber(sa.shared.total)} · ${formatNumber(sa.shared.pos)} PO` },
        { label: 'Biaya per PO', value: `Rp ${formatNumber(sa.shared.rate)}`, trace: poolOf('salesAdminShared')?.rateTrace },
        { label: 'Admin khusus Prinsipal D', value: `Rp ${formatNumber(sa.dedicated.total)} langsung ke D` },
        { label: 'Komersial', value: `Rp ${formatNumber(poolOf('komersial')?.total ?? 0)} · tidak dialokasikan` },
      ],
      next: 'Buka meja untuk biayanya; forecast di papan Komersial',
      notes: ['Titik terbuka D: sales admin dan AR dipisah jadi pool masing-masing; tim pajak ditambahkan. Engine dummy sudah punya pool AR dan pajak terpisah.'],
    }),
  })

  const bay = buildBay(ink)
  add({
    id: 'Bay kurir', kind: 'bay', groups: [bay], still: true, pick: [234, 207, 5],
    card: (): Card => {
      const today = data.world.manifests.filter((m) => m.day === day)
      return {
        kind: 'Bay kurir · B2C', title: 'Bay kurir & marketplace pickup', status: `${today.length} manifest hari ${day}`, channel: 'B2C',
        rows: today.slice(0, 5).map((m) => [`${m.courier} · ${m.id}`, `${formatNumber(m.packages)} paket`] as [string, string]),
        driver: 'menit standar dispatch per paket',
        engine: [{ label: 'Manifest hari ini', value: formatNumber(today.length) }],
        next: 'Kurir mengambil paket pada jam pickup',
      }
    },
  })

  for (const pl of PLANTS) {
    const g = buildPlant(ink, pl.id, pl.x0, pl.y0)
    const pos = data.world.b2b.pos.filter((p) => p.principal === pl.id)
    const principal = data.world.b2b.principals.find((p) => p.id === pl.id)
    add({
      id: `Prinsipal ${pl.id}`, kind: 'plant', groups: [g], still: true, pick: [pl.x0 + 17, pl.y0 + 24, 8],
      card: (): Card => ({
        kind: 'Prinsipal', title: `Prinsipal ${pl.id}`, status: pos.some((p) => p.arrivalDay === day) ? 'truk inbound berangkat hari ini' : 'menunggu PO',
        rows: [
          ['PO bulan ini', formatNumber(pos.length)],
          ['Lead time', `${formatNumber(principal?.leadTimeDays ?? 0)} hari`],
          ['Hari persediaan minimum', `${formatNumber(principal?.minInventoryDays ?? 0)} hari`],
        ],
        driver: 'jumlah PO (sales admin bersama)',
        engine: [
          { label: 'PO dikirim', value: pos.map((p) => `${p.id} (hari ${p.day})`).join(', ') || '—' },
          { label: 'Syarat dagang per prinsipal (sumber)', missing: `${MISSING}: syarat dagang SAMB per prinsipal; engine memakai lead time dan hari minimum dummy` },
        ],
        next: 'PO berikutnya dari sales admin',
      }),
    })
  }

  const pool = buildPool(ink)
  add({
    id: 'Pool truk', kind: 'pool', groups: [pool], still: true, pick: [212, 30, 4],
    card: (): Card => {
      const f = world.fleet()
      return {
        kind: 'Pool armada B2B', title: 'Pool truk', status: `${f.available} tersedia · ${f.road} di jalan · ${f.dock} di dok`,
        rows: [['Armada', `${FLEET.length} truk (L, M, H)`]],
        driver: 'hari-aset (biaya tetap per hari-aset tersedia)',
        engine: [{ label: 'Trip hari ini', value: formatNumber(tripsOfDay(data, day).length) }],
        next: 'Truk berangkat ke dok muat sesuai jadwal trip',
      }
    },
  })

  const stores = STORES.map((st) => {
    const g = buildStore(ink, st.code, st.x0, st.y0)
    const lamp = buildSignLamp(ink, st.x0 + 9, st.y1 + 1.2)
    g.add(lamp)
    const storeId = data.world.b2b.stores[st.idx]?.id
    const e = add({
      id: st.code, kind: 'store', groups: [g], still: true, pick: [st.x0 + 9, st.y1, 5],
      card: (): Card => {
        const dos = data.world.b2b.dos.filter((d) => d.store === storeId && d.day === day)
        const cartons = dos.reduce((s, d) => s + d.lines.reduce((x, l) => x + l.cartons, 0), 0)
        const signed = signedStores.has(st.code)
        return {
          kind: 'Toko modern · zona 1', title: st.code, status: signed ? 'DO ditandatangani' : 'menunggu kiriman', tone: signed ? 'ok' : undefined, channel: 'B2B',
          rows: [
            ['DO hari ini', dos.map((d) => d.id).join(', ') || '—'],
            ['SKU', formatNumber(new Set(dos.flatMap((d) => d.lines.map((l) => l.sku))).size)],
            ['Karton', formatNumber(cartons)],
            ['Diterima', signed ? `hari ${day}` : '—'],
          ],
          engine: [{ label: 'Nilai DO hari ini', value: `Rp ${formatNumber(dos.reduce((s, d) => s + d.value, 0))}` }],
          next: signed ? 'Sopir membawa DO kembali ke Finance AR' : 'Truk zona 1 berhenti di sini',
          stage: { channel: 'B2B', at: signed ? 4 : 3 },
        }
      },
    })
    return { st, e, lamp }
  })
  const signedStores = new Set<string>()

  const housing = buildHousing(ink)
  add({
    id: 'Konsumen', kind: 'konsumen', groups: [housing], still: true, pick: [376, 186, 5],
    card: (): Card => {
      const done = data.world.orders.filter((o) => o.completeDay === day).length
      return {
        kind: 'Konsumen · B2C', title: 'Perumahan', status: `${formatNumber(done)} paket selesai hari ${day}`, channel: 'B2C',
        rows: [['Order selesai hari ini', formatNumber(done)]],
        engine: [{ label: 'Pengantaran ke rumah', missing: `${MISSING}: rute kurir ke alamat (di luar SAMB)` }],
        next: 'Dana cair dari platform setelah hari settlement',
        stage: { channel: 'B2C', at: 4 },
      }
    },
  })

  // ---- the B2B fleet ---------------------------------------------------------------------------
  const trips = tripsOfDay(data, day)
  const tripByTruck = new Map(trips.map((v) => [v.ta.trip.truckCode, v]))
  const trucks = new Map<string, Truck>()
  const truckProto = buildTruck(ink)
  truckProto.scale.setScalar(SCALE.vehicle)
  const TRUCK_REACH = 11.2 * SCALE.vehicle
  FLEET.forEach((code, i) => {
    const group = truckProto.clone()
    const t: Truck = {
      id: code, code, kind: 'truck', group, groups: [group], pick: [-6, 0, 3], trip: tripByTruck.get(code) ?? null, state: 'pool', stopsDone: 0, path: null, s: 0, stops: [],
      card(): Card {
        if (!this.trip) {
          return {
            kind: 'Truk B2B', title: code, status: 'tersedia di pool', tone: 'ok', channel: 'B2B', rows: [['Kelas', code[0] ?? '']], engine: [{ label: 'Trip hari ini', value: 'tidak ada' }],
            driver: 'hari-aset (biaya tetap per hari-aset tersedia)', next: 'Menunggu trip berikutnya', followable: false,
          }
        }
        const st = this.state === 'dock' ? 'muat di dok' : this.state === 'away' ? 'di luar peta · zona jauh' : this.state === 'road' ? `jalan ke ${this.stops[this.stopsDone]?.name ?? 'pool'}` : 'di pool'
        const c = tripCard(this.trip, this.stopsDone, st, this.state === 'dock' ? 'warn' : 'live', this.stops[this.stopsDone]?.name)
        if (this.state === 'dock') c.stage = { channel: 'B2B', at: 2 }
        return c
      },
      route(): RouteInfo | null {
        if (!this.path) return null
        const next = this.stops.find((x) => x.s > this.s + 0.5)
        return { path: this.path, s: this.s, closed: false, next: next?.at, stop: next?.name }
      },
    }
    const bay = POOL_BAYS[i]
    if (bay) pose(group, bay.x, bay.y, Math.PI / 2)
    trucks.set(code, t)
    add(t)
  })
  /** pallets on a truck in their principals' colours, slots filled by m³ share */
  const loadTruck = (t: Truck, n: number): void => {
    if (!t.trip) return
    const ta = t.trip.ta
    const order = (Object.entries(ta.measureByPrincipal) as [PrincipalId, number][]).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])
    const total = order.reduce((s, [, m]) => s + m, 0)
    const fill: PrincipalId[] = []
    for (const [p, m] of order) for (let k = 0; k < Math.max(1, Math.round((m / total) * TRUCK_SLOTS.length)); k++) fill.push(p)
    TRUCK_SLOTS.slice(0, n).forEach(([lx, ly], k) => {
      const p = fill[k] ?? order[0]?.[0] ?? 'A'
      const pal = buildPallet(ink, `p${p}` as PrincipalFill, 2, 0.95)
      pal.position.copy(W(lx, ly, TRUCK_DECK))
      t.group.add(pal)
    })
  }

  // ---- V1 staging: Hari 8, 10.45 ---------------------------------------------------------------
  const z1 = trips.find((v) => v.ta.trip.zone === 1)
  const z2 = trips.find((v) => v.ta.trip.zone === 2)
  const z3 = trips.find((v) => v.ta.trip.zone === 3)
  if (z1) {
    const t = trucks.get(z1.ta.trip.truckCode)
    if (t) {
      const loop = zona1Loop(LOAD_DOCKS[0]?.y ?? 136)
      t.path = loop.path
      t.stops = loop.stops.map((x) => ({ ...x, s: loop.path.project(...x.at) }))
      t.stopsDone = 2
      const a = t.stops[1]
      const b = t.stops[2]
      t.s = a && b ? a.s + (b.s - a.s) * 0.45 : 0
      const q = loop.path.at(t.s)
      pose(t.group, q.x, q.y, q.h)
      t.state = 'road'
      loadTruck(t, 4)
      for (const st of loop.stops.slice(0, 2)) signedStores.add(st.name)
      const doEnv = buildEnvelope(ink, 'DO')
      doEnv.scale.setScalar(SCALE.doc / SCALE.vehicle)
      doEnv.position.copy(W(-1.6, 0, 3.6))
      t.group.add(doEnv)
    }
  }
  if (z3) {
    const t = trucks.get(z3.ta.trip.truckCode)
    const dk = LOAD_DOCKS[1]
    if (t && dk) {
      t.state = 'dock'
      pose(t.group, GUDANG.x1 + 0.5 + TRUCK_REACH, dk.y, 0)
      loadTruck(t, 4)
    }
  }
  if (z2) {
    const t = trucks.get(z2.ta.trip.truckCode)
    if (t) {
      t.state = 'away'
      t.group.visible = false
    }
  }
  for (const s of stores) glow(s.lamp, ink, false)
  for (const s of stores) if (signedStores.has(s.st.code)) s.lamp.children.forEach((m) => {
    if (m instanceof THREE.Mesh && m.userData.fill) m.material = ink.fill.ok
  })
  const lampL = scene.scene.getObjectByName(`dockLamp${LOAD_DOCKS[1]?.id ?? 2}`)
  if (lampL) glow(lampL, ink, true)

  // inbound: today's arrivals at the receiving docks
  const arrivals = data.world.b2b.pos.filter((p) => p.arrivalDay === day)
  const inboundProto = buildInboundTruck(ink)
  inboundProto.scale.setScalar(SCALE.vehicle)
  arrivals.slice(0, RECV_DOCKS.length).forEach((po, i) => {
    const dk = RECV_DOCKS[i]
    if (!dk) return
    const g = inboundProto.clone()
    pose(g, dk.x, GUDANG.y1 + 0.5 + 12.6 * SCALE.vehicle, Math.PI / 2)
    add({
      id: `Inbound ${po.id}`, kind: 'inbound', groups: [g], pick: [-6, 0, 3],
      card: (): Card => ({
        kind: `Truk inbound · Prinsipal ${po.principal}`, title: po.id, status: `bongkar di Terima ${dk.id}`, tone: 'live', channel: 'B2B',
        rows: [['PO dibuat', `hari ${po.day}`], ['Tiba', `hari ${po.arrivalDay}`], ['Karton', formatNumber(po.lines.reduce((s, l) => s + l.cartons, 0))], ['Baris PO', formatNumber(po.lines.length)]],
        driver: 'palet masuk (tim inbound) · PO diterima (admin WMS, GR)',
        engine: [
          { label: 'Tarif inbound per palet', value: `Rp ${formatNumber(poolOf('inbound')?.rate ?? 0)}`, trace: poolOf('inbound')?.rateTrace },
          { label: 'Tarif GR per PO (admin WMS)', value: `Rp ${formatNumber(poolOf('wms')?.rate ?? 0)}`, trace: poolOf('wms')?.rateTrace },
        ],
        next: 'Forklift membongkar, palletise, lalu putaway ke rak',
        stage: { channel: 'B2B', at: 0 },
      }),
    })
  })

  // forklifts: one at the loading dock, one at receiving, one in the aisle
  const fkProto = buildForklift(ink)
  fkProto.scale.setScalar(SCALE.vehicle * 0.9)
  for (const [x, y, h, id] of [[GUDANG.x1 + 4.5, (LOAD_DOCKS[1]?.y ?? 152) - 2.6, Math.PI, 'FL-01'], [(RECV_DOCKS[0]?.x ?? 152) + 3, GUDANG.y1 + 4, -Math.PI / 2, 'FL-02'], [196, 156, 0, 'FL-03']] as const) {
    const g = fkProto.clone()
    pose(g, x, y, h)
    const beacon = g.getObjectByName('beacon')
    if (beacon) glow(beacon, ink, true)
    const inside = x < GUDANG.x1 && y < GUDANG.y1
    if (inside) gd.peek.inside.add(g)
    add({
      id: id, kind: 'forklift', groups: [g], pick: [-1.8, 0, 3.46],
      card: (): Card => ({
        kind: 'Forklift · gudang', title: id, status: id === 'FL-01' ? 'memuat L-02 di dok 2' : id === 'FL-02' ? 'membongkar truk inbound' : 'putaway ke rak',
        rows: [['Pekerjaan', id === 'FL-01' ? 'muat B2B' : id === 'FL-02' ? 'bongkar inbound' : 'putaway']],
        driver: id === 'FL-01' ? 'palet keluar (outbound)' : 'palet masuk (inbound)',
        engine: [{ label: 'Biaya per forklift', missing: `${MISSING}: biaya alat; tenaga ada di pool tim` }],
        next: 'Tugas berikutnya dari WMS',
      }),
    })
  }

  // pallets in the racks: neutral two-tone, lower level fuller than the upper; one low stack shows empty space above
  const rackG = new THREE.Group()
  rackG.name = 'rackPallets'
  const palK = buildPallet(ink, 'k', 3, 1.05)
  const palLow = buildPallet(ink, 'k', 1, 1.05)
  let n = 0
  RACK_ROWS.forEach((ry, r) =>
    Array.from({ length: RACK_BAYS }).forEach((_, b) =>
      [0, 1].forEach((lvl) => {
        const filled = (b * 7 + r * 3 + lvl * 5) % 10 < (lvl ? 6 : 8)
        if (!filled) return
        const g = (n++ % 9 === 4 ? palLow : palK).clone()
        pose(g, RACK_X0 + RACK_PITCH * b + 3, ry, 0, lvl ? 3.0 : 0.05)
        rackG.add(g)
      }),
    ),
  )
  gd.peek.inside.add(rackG)
  // staged pallets for L-02 in the dock lane, principal coloured (they board a mixed truck)
  if (z3) {
    const shares = (Object.entries(z3.ta.measureByPrincipal) as [PrincipalId, number][]).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])
    shares.slice(0, 3).forEach(([p], k) => {
      const g = buildPallet(ink, `p${p}` as PrincipalFill, 2, 0.95)
      pose(g, 246 + k * 0, (LOAD_DOCKS[1]?.y ?? 152) - 4 + k * 3.6, 0, 0.02)
      gd.peek.inside.add(g)
    })
  }

  // people in the gudang: GR admin at the screen, pickers, packers
  const staffProto = buildPerson(ink, 'staff')
  staffProto.scale.setScalar(SCALE.person)
  for (const [x, y, h] of [[144, 184.5, -Math.PI / 2], [207, 147, 0], [230, 168, Math.PI], [216, 185, -Math.PI / 2], [226, 185, -Math.PI / 2], [170, 186, 0]] as const) {
    const g = staffProto.clone()
    pose(g, x, y, h)
    g.traverse((o) => {
      if (o.name === 'carry') o.visible = false
    })
    gd.peek.inside.add(g)
  }
  const grScreen = buildEnvelope(ink, 'GR', 'live')
  grScreen.scale.setScalar(SCALE.doc * 0.6)
  pose(grScreen, 144, 181.6, 0, 2.2)
  gd.peek.inside.add(grScreen)
  const parcelProto = buildParcel(ink)
  parcelProto.scale.setScalar(SCALE.person)
  for (const [x, y] of [[213, 182], [215, 182.4], [223, 182], [226, 182.2], [234, 190], [236, 191]] as const) {
    const g = parcelProto.clone()
    pose(g, x, y, 0, x < 230 ? 0.9 : 0)
    gd.peek.inside.add(g)
  }

  // the bay kurir: two couriers waiting for the 11.00 pickup, cages of parcels
  const vanProto = buildCourierVan(ink)
  vanProto.scale.setScalar(SCALE.vehicle)
  const manifests = data.world.manifests.filter((m) => m.day === day)
  for (const [k, courier] of [[0, 'K1'], [2, 'K3']] as const) {
    const slot = COURIER_SLOTS[k]
    if (!slot) continue
    const g = vanProto.clone()
    pose(g, slot.x, BAY.y0 + 16, Math.PI / 2)
    const m = manifests.find((x) => x.courier === courier && x.pickup === 1) ?? manifests.find((x) => x.courier === courier)
    add({
      id: `Kurir ${courier.slice(1)}`, kind: 'courier', groups: [g], pick: [-2.8, 0, 2.6],
      card: (): Card => ({
        kind: 'Kurir · B2C', title: `Kurir ${courier.slice(1)}`, status: 'menunggu pickup 11.00', tone: 'live', channel: 'B2C',
        rows: [['Manifest', m?.id ?? '—'], ['Paket', formatNumber(m?.packages ?? 0)]],
        driver: 'menit standar dispatch per paket',
        engine: [{ label: 'Paket di manifest', value: formatNumber(m?.packages ?? 0) }],
        next: 'Serah terima paket, lalu ke konsumen',
        stage: { channel: 'B2C', at: 3 },
      }),
    })
  }
  for (const [x, f] of [[224, 0.9], [236, 0.6], [248, 0.3]] as const) {
    const g = buildCage(ink, f)
    pose(g, x, BAY.y0 + 3.2, 0)
    scene.scene.add(g)
  }
  // couriers out in the housing
  const bikeProto = buildMotorbike(ink)
  bikeProto.scale.setScalar(SCALE.vehicle * 1.4)
  for (const [x, y, h] of [[360, 154, 0], [262, 267, Math.PI], [410, 225.5, 0]] as const) {
    const g = bikeProto.clone()
    pose(g, x, y, h)
    scene.scene.add(g)
  }

  // the kantor: desks per team (engine headcounts), the dedicated desk in Prinsipal D's colour;
  // each team's desks are one clickable entity (a scenario's director lights the acting team)
  const seatProto = buildSeated(ink)
  seatProto.scale.setScalar(SCALE.desk)
  const team = (id: string, desks: [number, number][], tone: Tone, card: () => Card): void => {
    const g = new THREE.Group()
    g.name = id
    for (const [x, y] of desks) {
      const d = buildDesk(ink, tone)
      d.scale.setScalar(SCALE.desk)
      pose(d, x, y, 0)
      g.add(d)
      const s = seatProto.clone()
      pose(s, x, y + 1.3 * SCALE.desk, -Math.PI / 2)
      g.add(s)
    }
    kt.peek.inside.add(g)
    const xs = desks.map(([x]) => x)
    const ys = desks.map(([, y]) => y)
    add({ id, kind: 'desk', groups: [g], still: true, pick: [(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) + 1, 2.4], card })
  }
  const row = (n: number, x0: number, dx: number, y: number): [number, number][] => Array.from({ length: n }, (_, i) => [x0 + i * dx, y])
  const deskCard = (title: string, people: number, work: string, driver: string, engine: Card['engine'], notes?: string[]): Card => ({
    kind: 'Kantor · meja tim', title, status: `${formatNumber(people)} orang · jam kerja`, rows: [['Pekerjaan', work]], driver, engine, notes,
  })
  const komersial = poolOf('komersial')
  const shared = poolOf('salesAdminShared')
  const ar = poolOf('arFinance')
  const tax = poolOf('tax')
  team('Meja Komersial', row(TEAM_SEATS.komersial, 31, 5.5, 34), 'n', () =>
    deskCard('Meja Komersial', TEAM_SEATS.komersial, 'GM Commercial dan tim: forecast bulanan, cek stok, kebutuhan order', 'tidak dialokasikan engine', [
      { label: 'Pool Komersial', value: `Rp ${formatNumber(komersial?.total ?? 0)}`, trace: komersial?.totalTrace },
      { label: 'Driver alokasi', missing: `${MISSING}: engine tidak membagi pool Komersial ke prinsipal` },
    ]),
  )
  team('Meja sales admin bersama', row(TEAM_SEATS.salesAdminShared, 53, 5.5, 34), 'n', () =>
    deskCard('Meja sales admin bersama', TEAM_SEATS.salesAdminShared, 'PO ke prinsipal untuk semua prinsipal', 'jumlah PO', [
      { label: 'Pool sales admin bersama', value: `Rp ${formatNumber(sa.shared.total)} · ${formatNumber(sa.shared.pos)} PO` },
      { label: 'Biaya per PO', value: `Rp ${formatNumber(sa.shared.rate)}`, trace: shared?.rateTrace },
    ]),
  )
  team('Meja sales admin khusus D', [[53 + TEAM_SEATS.salesAdminShared * 5.5 + 3, 34]], 'pD', () =>
    deskCard('Meja sales admin khusus D', TEAM_SEATS.salesAdminDedicated, 'PO dan urusan admin Prinsipal D saja', 'langsung ke Prinsipal D', [
      { label: 'Admin khusus Prinsipal D', value: `Rp ${formatNumber(sa.dedicated.total)} langsung ke D`, trace: poolOf('salesAdminDedicated')?.totalTrace },
    ]),
  )
  team('Meja Finance AR', row(TEAM_SEATS.arFinance, 31, 6, 50), 'n', () =>
    deskCard('Meja Finance AR', TEAM_SEATS.arFinance, 'invoice dari DO yang kembali ditandatangani, penagihan', 'invoice dibuat', [
      { label: 'Biaya per invoice dibuat', value: `Rp ${formatNumber(ar?.rate ?? 0)}`, trace: ar?.rateTrace },
    ]),
  )
  team('Meja pajak', row(TEAM_SEATS.tax, 57, 6, 50), 'n', () =>
    deskCard('Meja pajak', TEAM_SEATS.tax, 'faktur pajak, pengiriman invoice, tukar faktur', 'invoice dikirim', [
      { label: 'Biaya per invoice dikirim', value: `Rp ${formatNumber(tax?.rate ?? 0)}`, trace: tax?.rateTrace },
    ]),
  )

  // documents in flight: today's PO to its principal, an invoice at the AR desk, a coin coming home
  const poToday = data.world.b2b.pos.find((p) => p.day === day)
  if (poToday) {
    const pl = PLANTS.find((x) => x.id === poToday.principal)
    if (pl) {
      const from: P2 = [54, KANTOR.y1 + 2]
      const to: P2 = [pl.x0 + 17, pl.y0 - 2]
      const k = 0.6
      const env = buildEnvelope(ink, 'PO', 'paper')
      env.scale.setScalar(SCALE.doc)
      pose(env, from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, 0.6, 9 + Math.sin(k * Math.PI) * 14)
      add({
        id: poToday.id, kind: 'document', groups: [env], pick: [0, 0, 0.2],
        card: (): Card => ({
          kind: `PO · Prinsipal ${poToday.principal}`, title: poToday.id, status: 'terbang ke prinsipal', tone: 'live', channel: 'B2B',
          rows: [['Dibuat', `hari ${poToday.day}`], ['Tiba di gudang', `hari ${poToday.arrivalDay}`], ['Baris', formatNumber(poToday.lines.length)], ['Karton', formatNumber(poToday.lines.reduce((s, l) => s + l.cartons, 0))]],
          driver: 'jumlah PO (sales admin bersama), ke SKU menurut baris PO',
          engine: [{ label: 'Biaya per PO', value: `Rp ${formatNumber(sa.shared.rate)}`, trace: poolOf('salesAdminShared')?.rateTrace }],
          next: `Prinsipal ${poToday.principal} mengirim truk inbound`,
          stage: { channel: 'B2B', at: 0 },
        }),
      })
    }
  }
  // a coin dropping into Finance AR: cash at the end of the capital clock
  const coin = buildCoin(ink)
  coin.scale.setScalar(SCALE.doc)
  pose(coin, 36, 52, 0, 14)
  scene.scene.add(coin)

  const world: World = {
    trucks,
    day,
    hour,
    fleet() {
      let available = 0
      let road = 0
      let dock = 0
      for (const t of trucks.values()) {
        if (t.state === 'pool') available++
        else if (t.state === 'dock') dock++
        else road++
      }
      return { available, road, dock }
    },
    pending() {
      const dockQueue = [...trucks.values()].filter((t) => t.state === 'dock').length * TRUCK_SLOTS.length
      const b2c = data.world.orders.filter((o) => o.shipDay === day && o.hour <= hour).length
      return { b2b: dockQueue, b2c }
    },
  }
  return world
}
