// World 1 of the switcher (Brief B5 §1): SAMB's distribution network on Factory Yard's kernel, as
// Brief B4 built it. It reads world 2's computed month (computeAll2, whose B2B exit is the
// world-1 model); nothing here changes an engine number.
import { PRINCIPAL_COLOR } from '../../../core/colors.ts'
import type { PrincipalFill } from '../../../yard/kernel.ts'
import type { WorldDef } from '../../../yard/types.ts'
import { computeAll2 } from '../../b2b-b2c/engine/index.ts'
import { MISSING, STAGES, costLens, pulse } from './bind.ts'
import { PLACES, PLACE_LABELS, PLATE } from './layout.ts'
import { buildWorld } from './world.ts'

const fills = Object.fromEntries(Object.entries(PRINCIPAL_COLOR).map(([k, c]) => [`p${k}`, c])) as Record<PrincipalFill, string>

const distribusi: WorldDef = {
  id: 'distribusi',
  kicker: 'Simulasi proses · jaringan distribusi',
  ariaLabel:
    'Peta isometrik jaringan distribusi SAMB, hidup: kantor, prinsipal, gudang, bay kurir, toko dan konsumen. Seret untuk menggeser, gulir atau cubit untuk zoom, klik objek untuk kartunya. Tombol 1 sampai 6 menuju tempat, 0 seluruh peta, [ dan ] memilih kendaraan berikutnya, F mengikuti, Escape menutup, Spasi jeda.',
  watermark: ['Ilustrasi: angka dummy, bukan data SAMB'],
  gap: MISSING,
  plate: PLATE,
  places: PLACES,
  labels: PLACE_LABELS,
  views: [
    { id: 'jaringan', label: 'Jaringan', open: [] },
    { id: 'gudang', label: 'Gudang', open: ['gudang'], place: 'gudang' },
    { id: 'kantor', label: 'Kantor', open: ['kantor'], place: 'kantor' },
  ],
  focus: { label: 'Fokus', options: [['b2b', 'B2B'], ['b2c', 'B2C'], ['all', 'Gabungan']], initial: 'all' },
  lenses: [{ id: 'biaya', label: 'Lensa biaya', title: 'Ganti metrik operasi dengan metrik biaya engine' }],
  stages: STAGES,
  idle: 'Klik apa saja di peta — truk, dok, rak, meja, toko, dokumen — untuk status, driver biaya, angka engine dan langkah berikutnya.',
  trackerIdle: 'Pilih order, trip, truk atau dokumen untuk melihat tahapnya.',
  fills,
  build(scene, { day = 8, hour = 10.75 }) {
    const data = computeAll2()
    const world = buildWorld(scene, data, day, hour)
    return {
      clock: () => ({ day, hour, days: 30 }),
      metrics: (lens) => {
        if (lens) return costLens(data, day)
        const p = world.pending()
        return pulse(data, day, hour, world.fleet(), p.b2b, p.b2c)
      },
      debug: { world },
    }
  },
}

export default distribusi
