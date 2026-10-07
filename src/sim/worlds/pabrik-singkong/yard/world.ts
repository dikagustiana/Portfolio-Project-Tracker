// Assembles the cassava plant in the scene: the static places as clickable entities and the
// people, trucks and goods staged at one moment of a standard day (Brief B5 W1 style frame).
// W2 drives the same actors from the plant's day.
import * as THREE from 'three'
import { Part, TOP, glow, pose } from '../../../yard/kernel.ts'
import { buildForklift, buildPerson, buildSeated, buildDesk } from '../../../yard/models.ts'
import type { Entity, YardScene } from '../../../yard/scene.ts'
import type { Card } from '../../../yard/types.ts'
import { formatNumber } from '../../../core/format.ts'
import { BIAYA_KIRIM_PER_KG, BIAYA_TRIP_CIKOKOL, BIAYA_TRIP_SEMARANG, KG_PER_TRIP, POOL_BERSAMA } from '../data/derive.ts'
import { ELEMEN, PRODUKSI_NORMAL_KG } from '../data/standar-fcc.ts'
import { GAP, cardCuci, cardGoreng, cardGudang, cardHall, cardKantor, cardKemas, cardKupas, cardPenerimaan, cardSortir, dec1 } from './bind.ts'
import { BELT_Y, RACK_BAYS, RACK_PITCH, RACK_X0, RACK_Y, buildConveyorOut, buildGround, buildGudang, buildHall, buildKantor, buildReceiving, buildSkidBay, buildStation } from './build.ts'
import { BINS, BRIDGE, CONVEYOR_X, DOCKS, GUDANG, HALL, KANTOR, SKIDS, STATIONS } from './layout.ts'
import { CASSAVA_TRUCK_LEN, VAN_DECK, VAN_LEN, VAN_SLOTS, buildBoxTruck, buildCassavaTruck, buildTubeSkid, cartonPallet } from './models.ts'

const SCALE = { vehicle: 1.35, person: 1.5, desk: 1.6 }

export interface BmgWorld {
  /** the shared pools A–E as a band across the stages, shown under Lensa biaya */
  poolBand: THREE.Group
}

export function buildWorld(scene: YardScene): BmgWorld {
  const ink = scene.ink
  const add = (e: Entity): Entity => scene.add(e)
  const still = (id: string, kind: string, g: THREE.Object3D, pick: [number, number, number], card: () => Card): Entity => add({ id, kind, groups: [g], still: true, pick, card })

  const ground = buildGround(ink)
  ground.traverse((o) => {
    o.raycast = () => {}
  })
  scene.scene.add(ground)

  // ---- the line hall and its stations ----------------------------------------------------------
  const hall = buildHall(ink)
  scene.addPeek('hall', hall.peek)
  still('Lini produksi', 'hall', hall.group, [164, 46, 17], cardHall)
  const stationCards = { kupas: cardKupas, cuci: cardCuci, goreng: cardGoreng, sortir: cardSortir, kemas: cardKemas } as const
  const stationNames = { kupas: 'Pengupasan', cuci: 'Cuci dan potong', goreng: 'Penggorengan', sortir: 'Sortir dan QC', kemas: 'Pengemasan' } as const
  for (const id of Object.keys(STATIONS) as (keyof typeof STATIONS)[]) {
    const s = STATIONS[id]
    still(stationNames[id], 'station', buildStation(ink, id), [(s.x0 + s.x1) / 2, 40, 2], stationCards[id])
  }

  // crews: peelers at their tables, operators at the washer and fryers, sorters, packers
  const staff = buildPerson(ink, 'staff')
  staff.scale.setScalar(SCALE.person)
  staff.traverse((o) => {
    if (o.name === 'carry') o.visible = false
  })
  const person = (x: number, y: number, h: number, parent: THREE.Object3D = hall.peek.inside): void => {
    const g = staff.clone()
    pose(g, x, y, h)
    parent.add(g)
  }
  for (const y of [24, 34, 44]) for (let x = STATIONS.kupas.x0 + 7; x < STATIONS.kupas.x0 + 31; x += 5) person(x, y - 1.2, Math.PI / 2)
  for (const [x, y, h] of [[STATIONS.cuci.x0 + 6, 34, Math.PI / 2], [STATIONS.cuci.x0 + 22, 52, -Math.PI / 2], [STATIONS.goreng.x0 + 12, 31, -Math.PI / 2], [STATIONS.goreng.x0 + 22, 43, -Math.PI / 2], [STATIONS.goreng.x0 + 16, 55, -Math.PI / 2]] as const) person(x, y, h)
  for (let x = STATIONS.sortir.x0 + 7; x < STATIONS.sortir.x0 + 24; x += 4) person(x, 30, Math.PI / 2)
  person(STATIONS.sortir.x0 + 28, 25.6, -Math.PI / 2)
  for (const y of [24, 34]) for (let x = STATIONS.kemas.x0 + 6; x < STATIONS.kemas.x0 + 24; x += 5) person(x, y - 1.2, Math.PI / 2)

  // a batch of chips on the main belt between frying and sorting: crates of the day's work
  const belt = new Part(ink)
  for (let x = HALL.x0 + 8; x < HALL.x1 - 6; x += 9) belt.box(x, BELT_Y - 0.5, 0.95, 1.6, 1.0, 0.35, x < STATIONS.goreng.x0 ? 'k' : 'paper')
  hall.peek.inside.add(belt.build('beltLoad'))

  // the shared pools A–E as a band along the south aisle, across every stage (Lensa biaya)
  const band = new Part(ink)
  const B = TOP(HALL.x0 + 2, 69.4, 0.05)
  band.fill2(B, 0, 0, HALL.x1 - HALL.x0 - 4, 4.2, 'paper', 0.02).rect2(B, 0, 0, HALL.x1 - HALL.x0 - 4, 4.2, 'live', 0.03)
  const hatch: number[] = []
  for (let u = 0.6; u < HALL.x1 - HALL.x0 - 5; u += 1.2) if (u < 1 || u > 96) hatch.push(u, 4.2, u + 1.0, 0)
  band.draw(B, hatch, 'live', 0.035)
  band.text(B, `POOL BERSAMA A–E · Rp ${dec1(POOL_BERSAMA)} per kg · basis ${formatNumber(PRODUKSI_NORMAL_KG)} kg produksi normal`, 2, 2.9, 1.5, 'hi', 'start', 0.05)
  for (const s of Object.values(STATIONS)) band.draw(TOP(0, 0, 0.05), [s.x0, 69.4, s.x0, 73.6], 'live', 0.06)
  const pools = ELEMEN.filter((e) => e.tahap === 'bersama')
  pools.forEach((e, i) => band.text(B, `${e.label.replace('Grup ', '')} ${dec1(e.rp)}`, 100 + i * 19, 2.9, 1.1, 'hi', 'start', 0.05))
  const poolBand = band.build('poolBand')
  poolBand.visible = false
  hall.peek.inside.add(poolBand)

  // ---- receiving --------------------------------------------------------------------------------
  const recv = buildReceiving(ink)
  still('Penerimaan', 'receiving', recv, [31, 30, 4], cardPenerimaan)
  const cassava = buildCassavaTruck(ink)
  cassava.scale.setScalar(SCALE.vehicle)
  const peeled = buildCassavaTruck(ink, true)
  peeled.scale.setScalar(SCALE.vehicle)
  const truckCard = (title: string, isPeeled: boolean, status: string): Card => ({
    kind: isPeeled ? 'Truk singkong daging (beli kupas)' : 'Truk singkong kulit', title, status, tone: 'live', channel: 'BATCH',
    rows: [['Muatan', isPeeled ? 'singkong sudah kupas' : 'singkong dalam kulit'], ['Asal', 'kebun dan pengepul']],
    driver: 'kg diterima → harga per kg',
    engineTitle: 'Angka standar BMG',
    engine: [{ label: 'Kg muatan truk ini', missing: `${GAP}: berat per truk dari timbangan` }],
    next: 'Bongkar ke bak hari ini; singkong tidak menginap',
    stage: { channel: 'BATCH', at: 0 },
  })
  const t1 = cassava.clone()
  const b2 = BINS[1]
  if (b2) pose(t1, b2.x, 35 + CASSAVA_TRUCK_LEN * SCALE.vehicle, Math.PI / 2)
  add({ id: 'Truk singkong 1', kind: 'truck', groups: [t1], pick: [-4, 0, 2.4], card: () => truckCard('Truk singkong 1', false, 'bongkar di bak 2') })
  const t2 = peeled.clone()
  pose(t2, BRIDGE.x, BRIDGE.y0 + 1, -Math.PI / 2)
  add({ id: 'Truk singkong 2', kind: 'truck', groups: [t2], pick: [-4, 0, 2.4], card: () => truckCard('Truk singkong 2', true, 'di jembatan timbang') })
  const t3 = cassava.clone()
  pose(t3, 24, 150, -Math.PI / 2)
  add({ id: 'Truk singkong 3', kind: 'truck', groups: [t3], pick: [-4, 0, 2.4], card: () => truckCard('Truk singkong 3', false, 'menuju penerimaan') })
  for (const [x, y] of [[13, 40], [27, 40]] as const) person(x, y, -Math.PI / 2, scene.scene)

  // ---- CNG in tube skids, by the fryers' south wall ---------------------------------------------
  const bay = buildSkidBay(ink)
  bay.traverse((o) => {
    o.raycast = () => {}
  })
  scene.scene.add(bay)
  const skidProto = buildTubeSkid(ink)
  skidProto.scale.setScalar(1.05)
  const cng = ELEMEN.find((e) => e.id === 'cng')
  ;[SKIDS.y0 + 4, SKIDS.y0 + 11].forEach((y, i) => {
    const g = skidProto.clone()
    pose(g, SKIDS.x1 - 1, y, 0)
    add({
      id: `Skid CNG ${i + 1}`, kind: 'skid', groups: [g], still: true, pick: [-7, 0, 3],
      card: () => ({
        kind: 'Skid tabung CNG', title: `Skid CNG ${i + 1}`, status: i === 0 ? 'tersambung ke penggorengan' : 'cadangan', tone: i === 0 ? 'live' : undefined, channel: 'BATCH',
        rows: [['CNG per kg produksi', `${cng?.driver ?? ''}`], ['Pada hari standar', `${formatNumber((cng?.qty ?? 0) * (PRODUKSI_NORMAL_KG / 27), 1)} MMBTU`]],
        driver: 'MMBTU per kg produksi',
        engineTitle: 'Angka standar BMG',
        engine: [{ label: 'Harga CNG', value: `Rp ${dec1(cng?.price ?? 0)} per MMBTU` }, { label: 'Isi per skid', missing: `${GAP}: MMBTU per skid dan jadwal tukar skid` }],
        next: 'Gas lewat stasiun PRS ke burner penggorengan',
        stage: { channel: 'BATCH', at: 3 },
      }),
    })
  })

  // ---- the conveyor to the store, the store, its docks and trucks --------------------------------
  const conv = buildConveyorOut(ink)
  still('Konveyor karton', 'conveyor', conv, [CONVEYOR_X, 88, 2], () => ({
    kind: 'Konveyor', title: 'Konveyor karton', status: 'jalan', tone: 'live', channel: 'BATCH',
    rows: [['Dari', 'pengemasan'], ['Ke', 'gudang barang jadi']],
    engine: [{ label: 'Karton per jam', missing: `${GAP}: laju kemas per jam` }],
    next: 'Gudang yang penuh menahan pengemasan',
    stage: { channel: 'BATCH', at: 5 },
  }))
  const gd = buildGudang(ink)
  scene.addPeek('gudang', gd.peek)
  still('Gudang barang jadi dan muat', 'gudang', gd.group, [235, 125, 12], cardGudang)
  const racks = new Part(ink)
  RACK_Y.forEach((ry, r) =>
    Array.from({ length: RACK_BAYS }).forEach((_, b) =>
      [0, 1].forEach((lvl) => {
        if ((b * 5 + r * 3 + lvl * 7) % 10 < (lvl ? 5 : 8)) cartonPallet(racks, RACK_X0 + RACK_PITCH * b + 3, ry, lvl ? 2 : 3)
      }),
    ),
  )
  gd.peek.inside.add(racks.build('rackPallets'))
  const upper = new Part(ink)
  RACK_Y.forEach((ry, r) =>
    Array.from({ length: RACK_BAYS }).forEach((_, b) => {
      if ((b * 5 + r * 3 + 7) % 10 < 5) cartonPallet(upper, RACK_X0 + RACK_PITCH * b + 3, ry, 2)
    }),
  )
  const upperG = upper.build('rackUpper')
  upperG.position.y = 3.0
  gd.peek.inside.add(upperG)
  const staging = new Part(ink)
  for (const [y, l] of [[106, 3], [110, 3], [120, 2], [130, 3], [134, 1], [144, 2]] as const) cartonPallet(staging, 261, y, l)
  gd.peek.inside.add(staging.build('staging'))
  const fk = buildForklift(ink)
  fk.scale.setScalar(SCALE.vehicle * 0.9)
  for (const [x, y, h] of [[252, 118, 0], [244, 131, Math.PI]] as const) {
    const g = fk.clone()
    pose(g, x, y, h)
    const beacon = g.getObjectByName('beacon')
    if (beacon) glow(beacon, ink, true)
    gd.peek.inside.add(g)
  }

  const dest: [number, string, number, number][] = [[0, 'Semarang', BIAYA_TRIP_SEMARANG, BIAYA_KIRIM_PER_KG.semarang], [1, 'Cikokol', BIAYA_TRIP_CIKOKOL, BIAYA_KIRIM_PER_KG.cikokol]]
  for (const [i, name, trip, perKg] of dest) {
    const dk = DOCKS[i]
    if (!dk) continue
    const g = buildBoxTruck(ink, `IFM ${name}`)
    g.scale.setScalar(SCALE.vehicle)
    pose(g, GUDANG.x1 + 0.5 + VAN_LEN * SCALE.vehicle, dk.y, 0)
    const load = new Part(ink)
    VAN_SLOTS.slice(0, i ? 4 : 3).forEach((lx) => cartonPallet(load, lx, 0, 2))
    const lg = load.build('load')
    lg.position.y = VAN_DECK
    lg.scale.setScalar(0.92)
    g.add(lg)
    add({
      id: `Truk IFM ${name}`, kind: 'truck', groups: [g], pick: [-6, 0, 3],
      card: () => ({
        kind: 'Truk kiriman · IFM', title: `Truk IFM ${name}`, status: `muat di dok ${dk.id}`, tone: 'warn', channel: 'BATCH',
        progress: { v: 0.9, max: 1, label: `isi rata-rata 90% · ${formatNumber(KG_PER_TRIP)} dari 3.500 kg` },
        rows: [['Tujuan', `IFM ${name}`], ['Kapasitas', '3.500 kg per trip']],
        driver: 'trip; per kg = biaya trip ÷ 3.150 kg',
        engineTitle: 'Angka business plan BMG',
        engine: [
          { label: name === 'Cikokol' ? 'Borongan + tol pada 50% trip' : 'Borongan per trip', value: `Rp ${formatNumber(trip)}` },
          { label: 'Per kg terkirim', value: `Rp ${dec1(perKg)}` },
          { label: 'Kg muatan truk ini', missing: `${GAP}: berat per surat jalan` },
        ],
        next: `Berangkat ke ${name}`,
        followable: true,
        stage: { channel: 'BATCH', at: 6 },
      }),
    })
  }

  // ---- the office: the costing officer and the factory general manager ---------------------------
  const kt = buildKantor(ink)
  scene.addPeek('kantor', kt.peek)
  still('Kantor pabrik', 'kantor', kt.group, [85, 95, 7], cardKantor)
  const seat = buildSeated(ink)
  seat.scale.setScalar(SCALE.desk)
  for (const [x, y] of [[KANTOR.x0 + 6, KANTOR.y0 + 8], [KANTOR.x0 + 11, KANTOR.y0 + 8], [KANTOR.x0 + 27, KANTOR.y0 + 8]] as const) {
    const d = buildDesk(ink)
    d.scale.setScalar(SCALE.desk)
    pose(d, x, y, 0)
    kt.peek.inside.add(d)
    const s = seat.clone()
    pose(s, x, y + 1.3 * SCALE.desk, -Math.PI / 2)
    kt.peek.inside.add(s)
  }
  const doc = new Part(ink)
  doc.box(KANTOR.x0 + 18, KANTOR.y0 + 16, 0.9, 1.8, 1.2, 0.1, 'paper')
  doc.text(TOP(KANTOR.x0 + 18, KANTOR.y0 + 16, 1.0), 'KARTU', 0.9, 0.85, 0.38, 'hi', 'middle', 0.04)
  kt.peek.inside.add(doc.build('costCard'))
  const walker = staff.clone()
  pose(walker, KANTOR.x0 + 20, KANTOR.y0 + 17, 0)
  kt.peek.inside.add(walker)

  return { poolBand }
}
