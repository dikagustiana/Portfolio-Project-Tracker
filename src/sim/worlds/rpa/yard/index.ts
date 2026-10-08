// World 3 of the switcher (Brief B5 §4): KGR's poultry slaughterhouse, RPA Rawa Teratai. The
// owner's KGR swimlane is the specification and is shown as it is (data/swimlane-kgr.json);
// every quantity and rupiah figure is synthetic and labelled so. W1: the plant staged for the
// style frame, its swimlane cards and Lensa kesiapan data live; W3 adds the synthetic batch.
import type { PrincipalFill } from '../../../yard/kernel.ts'
import type { WorldDef } from '../../../yard/types.ts'
import { DUMMY, GAP, STAGES, costLens, pulse, readiness } from './bind.ts'
import type { Jalur } from './bind.ts'
import { PLACES, PLACE_LABELS, PLATE } from './layout.ts'
import { buildWorld } from './world.ts'

/** the kernel's six accent fills; this world uses none of them for meaning */
const fills: Record<PrincipalFill, string> = { pA: '#3f6fb5', pB: '#5cc5dc', pC: '#c2543f', pD: '#cf973a', pE: '#57a483', pF: '#6b8096' }

const rpa: WorldDef = {
  id: 'rpa',
  kicker: 'Simulasi proses · RPA Rawa Teratai (KGR)',
  ariaLabel:
    'Peta isometrik rumah potong ayam KGR: pemasok di luar pagar, penerimaan dan holding, pos veteriner, hall proses dengan lini potong, chilling dan split-off, disposisi, cut-up dan MDM, gudang fresh, blast freezer dan cold storage, pengiriman, dan kantor. Seret untuk menggeser, gulir untuk zoom, klik objek untuk kartu swimlane-nya. Tombol 1 sampai 9 dan 0 menuju tempat, Home seluruh peta, Escape menutup.',
  watermark: [DUMMY, 'Swimlane: data nyata KGR, Personal OS, dibaca 7 Oktober 2026'],
  gap: GAP,
  plate: PLATE,
  places: PLACES,
  labels: PLACE_LABELS,
  views: [
    { id: 'jaringan', label: 'Jaringan', open: [] },
    { id: 'lini', label: 'Hall proses', open: ['hall'] },
    { id: 'dingin', label: 'Fresh & beku', open: ['fresh', 'beku'] },
    { id: 'kantor', label: 'Kantor', open: ['kantor'], place: 'kantor' },
  ],
  focus: { label: 'Jalur', options: [['rpa', 'RPA'], ['trading', 'Trading'], ['both', 'Keduanya']], initial: 'both' },
  lenses: [
    { id: 'biaya', label: 'Lensa biaya', title: 'Batch costing sheet dan alokasi NRV (angka dummy)' },
    { id: 'data', label: 'Lensa kesiapan data', title: 'Kebutuhan data dan gate per stasiun, dari swimlane KGR (data nyata)' },
  ],
  stages: STAGES,
  idle: 'Klik stasiun, divisi kantor, truk atau gate untuk kartu swimlane-nya: lane, peran PIC, fase, risiko dan kontrol, dokumen dan akun, driver, kebutuhan data dan gate.',
  trackerIdle: 'Pilih stasiun atau batch untuk melihat fasenya.',
  fills,
  scenarioLater: 'S3',
  build(scene, { day = 8, hour = 10.75 }) {
    const world = buildWorld(scene)
    let jalur: Jalur = 'both'
    scene.setLabels(world.labels(jalur))
    return {
      clock: () => ({ day, hour, days: 30 }),
      metrics: (lens) => (lens === 'data' ? readiness(jalur) : lens === 'biaya' ? costLens() : pulse()),
      onLens: (lens) => world.setLens(lens),
      onFocus: (f) => {
        jalur = f as Jalur
        world.setJalur(jalur)
      },
      debug: { world },
    }
  },
}

export default rpa
