// Assembles the slaughterhouse in the scene: the places as clickable swimlane objects, the four
// office divisions, the gate flags the readiness lens shows, and the crews, trucks and documents
// staged at one moment of a day (Brief B5 W1 style frame). W3 sets the batch moving.
import * as THREE from 'three'
import { pose } from '../../../yard/kernel.ts'
import { VAN_LEN, buildBoxTruck, buildDesk, buildEnvelope, buildPerson, buildSeated } from '../../../yard/models.ts'
import type { Entity, YardScene } from '../../../yard/scene.ts'
import type { Card, PlaceLabel } from '../../../yard/types.ts'
import { gateCard, gateOf, kantorCard, onPath, placeReady, stepOf, swimlaneCard } from './bind.ts'
import type { Jalur } from './bind.ts'
import { buildBeku, buildColdStock, buildFresh, buildGround, buildHall, buildKantor, buildPemasok, buildReceiving, buildSection, buildVetBooth } from './build.ts'
import { BEKU, BRIDGE, DOCK_BEKU, DOCK_FRESH, FRESH, PLACES, PLACE_LABELS, PLACE_STEPS, RAIL_Y, ROAD, SECTIONS } from './layout.ts'
import type { PlaceId } from './layout.ts'
import { buildBirdTruck, gateFlag } from './models.ts'

const SCALE = { vehicle: 1.35, person: 1.5, desk: 1.6, doc: 2.4 }

/** the four office divisions, one per internal lane, and where each sits in the Kantor */
const DIVISIONS: { lane: string; label: string; at: [number, number]; desks: [number, number][] }[] = [
  { lane: 'PURCHASING', label: 'Purchasing', at: [78, 108], desks: [[70, 111], [76, 111], [82, 111]] },
  { lane: 'OPERASIONAL', label: 'Operasional', at: [103, 108], desks: [[98, 111], [104, 111]] },
  { lane: 'SALES', label: 'Sales', at: [73, 125], desks: [[70, 128], [76, 128]] },
  { lane: 'ACCOUNTING', label: 'Accounting', at: [99, 125], desks: [[88, 128], [94, 128], [100, 128], [106, 128]] },
]
const divisionSteps = (lane: string): string[] => PLACE_STEPS.kantor.filter((l) => stepOf(l).lane === lane)

/** where each place's gate flags stand, in a row from this point */
const FLAG_AT: Partial<Record<PlaceId, [number, number]>> = {
  terima: [68, 62], vet: [114, 86], chill: [206, 88], lanjut: [258, 88], fresh: [218, 94], beku: [284, 94], kirim: [226, 182], kantor: [62, 148],
}

export interface RpaWorld {
  setJalur(j: Jalur): void
  setLens(lens: string | null): void
  labels(j: Jalur): PlaceLabel[]
}

export function buildWorld(scene: YardScene): RpaWorld {
  const ink = scene.ink
  let jalur: Jalur = 'both'
  const add = (e: Entity): Entity => scene.add(e)
  const station = (id: string, g: THREE.Object3D, pick: [number, number, number], steps: string[], extra?: () => Partial<Card>): Entity =>
    add({ id, kind: 'station', groups: [g], still: true, pick, card: () => swimlaneCard(id, steps, jalur, extra?.()) })

  const ground = buildGround(ink)
  ground.traverse((o) => {
    o.raycast = () => {}
  })
  scene.scene.add(ground)

  // ---- the suppliers (external) ----------------------------------------------------------------
  const pem = buildPemasok(ink)
  station('Pemasok', pem, [28, 46, 4], ['3', 'T4'])

  // ---- receiving, holding, weighing; the veterinary booth -----------------------------------------
  station('Penerimaan, holding dan timbang', buildReceiving(ink), [88, 36, 4], PLACE_STEPS.terima)
  station('Pos veteriner', buildVetBooth(ink), [123, 71, 3], PLACE_STEPS.vet)

  // ---- the processing hall and its sections ----------------------------------------------------
  const hall = buildHall(ink)
  scene.addPeek('hall', hall.peek)
  station('Hall proses', hall.group, [212, 50, 12], ['10', '11', '12', '13', '14', '15'])
  station('Lini potong', buildSection(ink, 'potong'), [166, RAIL_Y, 2], ['10'])
  station('Post-mortem', buildSection(ink, 'postmortem'), [SECTIONS.potong.x1 - 2, RAIL_Y + 7, 1], ['11'])
  station('Chilling dan split-off', buildSection(ink, 'chill'), [219, 46, 1], ['12'])
  station('Disposisi, cut-up dan MDM', buildSection(ink, 'lanjut'), [265, 46, 1], ['13', '14', '15'])

  // ---- the Fresh store, the cold building --------------------------------------------------------
  const fresh = buildFresh(ink)
  scene.addPeek('fresh', fresh.peek)
  station('Gudang Fresh', fresh.group, [245, 124, 8], PLACE_STEPS.fresh)
  const beku = buildBeku(ink)
  scene.addPeek('beku', beku.peek)
  station('Blast freezer dan cold storage', beku.group, [308, 125, 8], PLACE_STEPS.beku)
  const stock = buildColdStock(ink)
  fresh.peek.inside.add(stock.fresh)
  beku.peek.inside.add(stock.beku)

  // ---- people -----------------------------------------------------------------------------------
  const staff = buildPerson(ink, 'staff')
  staff.scale.setScalar(SCALE.person)
  staff.traverse((o) => {
    if (o.name === 'carry') o.visible = false
  })
  const person = (x: number, y: number, h: number, parent: THREE.Object3D): void => {
    const g = staff.clone()
    pose(g, x, y, h)
    parent.add(g)
  }
  const sp = SECTIONS.potong
  const sc = SECTIONS.chill
  const sl = SECTIONS.lanjut
  for (const [x, y, h] of [[80, 60, 0], [100, 60, Math.PI], [94, 66.4, -Math.PI / 2], [124, 35.6, -Math.PI / 2]] as const) person(x, y, h, scene.scene)
  for (const [x, y, h] of [
    [sp.x0 + 5, RAIL_Y + 4.6, -Math.PI / 2], [sp.x0 + 5.5, RAIL_Y - 3.8, -Math.PI / 2], [sp.x0 + 25, RAIL_Y + 3.4, -Math.PI / 2],
    [sp.x0 + 42, RAIL_Y + 5.6, -Math.PI / 2], [sp.x0 + 46, RAIL_Y + 5.6, -Math.PI / 2], [sp.x0 + 50, RAIL_Y + 5.6, -Math.PI / 2],
    [sp.x1 - 2, RAIL_Y + 8, Math.PI / 2],
    [sc.x0 + 25, RAIL_Y + 2.4, -Math.PI / 2], [sc.x0 + 30, RAIL_Y + 2.4, -Math.PI / 2], [sc.x0 + 35, RAIL_Y + 2.4, -Math.PI / 2],
    [sl.x0 + 6, 47.6, -Math.PI / 2], [sl.x0 + 11, 47.6, -Math.PI / 2], [sl.x0 + 16, 47.6, -Math.PI / 2], [sl.x0 + 6, 53.6, -Math.PI / 2], [sl.x0 + 11, 53.6, -Math.PI / 2],
    [sl.x0 + 31, 50.6, -Math.PI / 2], [sl.x0 + 4, RAIL_Y + 2.6, 0],
  ] as const)
    person(x, y, h, hall.peek.inside)
  for (const [x, y] of [[238, 128], [258, 112]] as const) person(x, y, 0, fresh.peek.inside)
  person(292, 126, Math.PI / 2, beku.peek.inside)

  // ---- trucks: live birds on the weighbridge, finished goods (Trading), chilled and frozen out ----
  const bird = buildBirdTruck(ink)
  bird.scale.setScalar(SCALE.vehicle)
  pose(bird, BRIDGE.x, BRIDGE.y0 + 1, -Math.PI / 2)
  add({ id: 'Truk live bird', kind: 'truck', groups: [bird], pick: [-5, 0, 2.6], card: () => swimlaneCard('Truk live bird', ['3', '4'], jalur, { status: 'di timbangan terima · toleransi ≤ 2%', followable: true }) })
  const fg = buildBoxTruck(ink, 'Barang jadi')
  fg.scale.setScalar(SCALE.vehicle)
  pose(fg, 44, ROAD.east, 0)
  add({ id: 'Truk barang jadi', kind: 'truck', groups: [fg], pick: [-6, 0, 3], card: () => swimlaneCard('Truk barang jadi (Trading)', ['T4', 'T5'], jalur, { status: 'dari pemasok barang jadi', followable: true }) })
  const chilled = buildBoxTruck(ink, 'Fresh', true)
  chilled.scale.setScalar(SCALE.vehicle)
  pose(chilled, DOCK_FRESH, FRESH.y1 + 0.5 + VAN_LEN * SCALE.vehicle, Math.PI / 2)
  add({ id: 'Truk chilled', kind: 'truck', groups: [chilled], pick: [-6, 0, 3], card: () => swimlaneCard('Truk chilled · stream Fresh', ['26', '27'], jalur, { status: 'muat di dok Fresh', followable: true }) })
  const frozen = buildBoxTruck(ink, 'Frozen', true)
  frozen.scale.setScalar(SCALE.vehicle)
  pose(frozen, DOCK_BEKU, BEKU.y1 + 0.5 + VAN_LEN * SCALE.vehicle, Math.PI / 2)
  add({ id: 'Truk frozen', kind: 'truck', groups: [frozen], pick: [-6, 0, 3], card: () => swimlaneCard('Truk frozen · stream Frozen', ['27'], jalur, { status: 'muat di dok frozen', followable: true }) })

  // ---- the Kantor: four divisions by lane, documents on the move ----------------------------------
  const kt = buildKantor(ink)
  scene.addPeek('kantor', kt.peek)
  add({ id: 'Kantor', kind: 'kantor', groups: [kt.group], still: true, pick: [90, 124, 5], card: () => kantorCard(jalur, DIVISIONS.map((d) => ({ lane: d.label, steps: divisionSteps(d.lane) }))) })
  const seat = buildSeated(ink)
  seat.scale.setScalar(SCALE.desk)
  for (const d of DIVISIONS) {
    const g = new THREE.Group()
    g.name = `div-${d.lane}`
    for (const [x, y] of d.desks) {
      const desk = buildDesk(ink)
      desk.scale.setScalar(SCALE.desk)
      pose(desk, x, y, 0)
      g.add(desk)
      const s = seat.clone()
      pose(s, x, y + 1.3 * SCALE.desk, -Math.PI / 2)
      g.add(s)
    }
    kt.peek.inside.add(g)
    add({ id: `Divisi ${d.label}`, kind: 'division', groups: [g], still: true, pick: [d.at[0], d.at[1] + 6, 1], card: () => swimlaneCard(`Divisi ${d.label}`, divisionSteps(d.lane), jalur) })
  }
  for (const [label, x, y, z] of [['PO', 73, 116, 1.3], ['YIELD', 101, 116, 1.3], ['BCS', 92, 133, 1.3], ['INV', 104, 133, 1.3]] as const) {
    const env = buildEnvelope(ink, label, 'paper')
    env.scale.setScalar(SCALE.doc)
    pose(env, x, y, 0.3, z)
    kt.peek.inside.add(env)
  }
  // a BA Penerimaan on its way from receiving to Accounting
  person(100, 96, Math.PI / 2, scene.scene)
  const ba = buildEnvelope(ink, 'BA', 'paper')
  ba.scale.setScalar(SCALE.doc)
  pose(ba, 100, 96, 0.4, 4.6)
  scene.scene.add(ba)

  // ---- gate flags: every open TBC where a step refers to it (Lensa kesiapan data) -----------------
  const gates = new THREE.Group()
  gates.name = 'gates'
  gates.visible = false
  scene.scene.add(gates)
  const flags: { g: THREE.Group; steps: string[] }[] = []
  for (const [place, at] of Object.entries(FLAG_AT) as [PlaceId, [number, number]][]) {
    const byGate = new Map<string, string[]>()
    for (const l of PLACE_STEPS[place]) {
      const s = stepOf(l)
      if (s.gate) byGate.set(s.gate, [...(byGate.get(s.gate) ?? []), l])
    }
    ;[...byGate.entries()].forEach(([id, steps], i) => {
      const gate = gateOf(id)
      if (!gate || scene.find(id)) return
      const g = gateFlag(ink, id)
      g.scale.setScalar(1.2)
      pose(g, at[0] + i * 5.4, at[1], 0)
      gates.add(g)
      flags.push({ g, steps })
      add({ id, kind: 'gate', groups: [g], still: true, pick: [1.6, 0, 4.6], card: () => gateCard(gate) })
    })
  }

  const labels = (j: Jalur): PlaceLabel[] => [
    ...PLACE_LABELS.map((l) => {
      const p = PLACES.find((x) => x.key === l.key)?.id
      return { ...l, ready: p ? placeReady(p, j) : undefined }
    }),
    ...DIVISIONS.map((d) => {
      const steps = divisionSteps(d.lane).map(stepOf).filter((s) => onPath(s, j))
      const ready = (['ADA', 'SEBAGIAN', 'BELUM'] as const).map((k) => steps.flatMap((s) => s.needs).filter((n) => n.status === k).length) as [number, number, number]
      return { key: '', label: d.label, at: [d.at[0], d.at[1], 5] as [number, number, number], driver: '', ready, lens: 'data' }
    }),
  ]

  return {
    labels,
    setJalur(j) {
      jalur = j
      for (const f of flags) f.g.visible = f.steps.some((l) => onPath(stepOf(l), j))
      scene.setLabels(labels(j))
      scene.setLens(scene.lens)
    },
    setLens(lens) {
      gates.visible = lens === 'data'
    },
  }
}

