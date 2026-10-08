// World 2 of the switcher (Brief B5 §3): BMG's cassava chip plant, built from Factory Yard's
// factory and run on real BMG standard-cost figures (data/standar-fcc.ts). W1: the plant staged at
// one moment of a standard day; W2 sets it moving.
import type { PrincipalFill } from '../../../yard/kernel.ts'
import type { PlaceLabel, WorldDef } from '../../../yard/types.ts'
import { PER_TAHAP } from '../data/derive.ts'
import { KETERANGAN_DATA } from '../data/standar-fcc.ts'
import { GAP, STAGES, costLens, dec1, pulse } from './bind.ts'
import { PLACES, PLACE_LABELS, PLATE } from './layout.ts'
import { buildWorld } from './world.ts'

/** the kernel's six accent fills; this world uses none of them for meaning */
const fills: Record<PrincipalFill, string> = { pA: '#3f6fb5', pB: '#8a9a5b', pC: '#c2543f', pD: '#cf973a', pE: '#57a483', pF: '#6b8096' }

/** under Lensa biaya each place names its Rp per kg of production and what drives it */
const RP: Record<string, string> = {
  '1': `Rp ${dec1(PER_TAHAP.penerimaan)}/kg · kg singkong`,
  '2': `Rp ${dec1(PER_TAHAP.kupas)}/kg · upah borongan kupas`,
  '3': `Rp ${dec1(PER_TAHAP.cuci)}/kg · amonium bikarbonat`,
  '4': `Rp ${dec1(PER_TAHAP.goreng)}/kg · minyak + CNG`,
  '5': 'kredit KW 2 · normal loss',
  '6': `Rp ${dec1(PER_TAHAP.kemas)}/kg · kantong + karton`,
  '7': 'biaya trip ÷ 3.150 kg',
  '8': `kartu biaya · pool A–E Rp ${dec1(PER_TAHAP.bersama)}/kg`,
}
const labels: PlaceLabel[] = PLACE_LABELS.map((l) => ({ ...l, driver: RP[l.key] ?? l.driver }))

const pabrikSingkong: WorldDef = {
  id: 'pabrik-singkong',
  kicker: 'Simulasi proses · pabrik singkong BMG',
  ariaLabel:
    'Peta isometrik pabrik keripik singkong BMG: penerimaan singkong, lini produksi dengan pengupasan, cuci dan potong, penggorengan, sortir dan QC, pengemasan, lalu gudang barang jadi dan muat, serta kantor pabrik. Seret untuk menggeser, gulir untuk zoom, klik objek untuk kartunya. Tombol 1 sampai 8 menuju tempat, 0 seluruh peta, Escape menutup, Spasi jeda.',
  watermark: [KETERANGAN_DATA],
  gap: GAP,
  plate: PLATE,
  places: PLACES,
  labels,
  views: [
    { id: 'jaringan', label: 'Pabrik', open: [] },
    { id: 'lini', label: 'Lini', open: ['hall'] },
    { id: 'kantor', label: 'Kantor pabrik', open: ['kantor'], place: 'kantor' },
  ],
  lenses: [{ id: 'biaya', label: 'Lensa biaya', title: 'Ganti metrik produksi dengan biaya standar per kg' }],
  stages: STAGES,
  idle: 'Klik stasiun, truk, skid CNG, gudang atau kantor pabrik untuk angka standar BMG, driver biaya dan langkah berikutnya.',
  trackerIdle: 'Pilih stasiun, truk atau karton untuk melihat tahap batch.',
  fills,
  scenarioLater: 'S2',
  build(scene, { day = 8, hour = 10.75 }) {
    const world = buildWorld(scene)
    return {
      clock: () => ({ day, hour, days: 27 }),
      metrics: (lens) => (lens === 'biaya' ? costLens() : pulse()),
      onLens: (lens) => {
        world.poolBand.visible = lens === 'biaya'
        if (lens === 'biaya') scene.forceOpen.add('hall')
        else if (scene.view !== 'lini') scene.forceOpen.delete('hall')
      },
      debug: { world },
    }
  },
}

export default pabrikSingkong
