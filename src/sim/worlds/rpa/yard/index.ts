// World 3 of the switcher (Brief B5 §4): KGR's poultry slaughterhouse, RPA Rawa Teratai. The
// swimlane is real; every quantity and rupiah figure is synthetic. W0 stub: the plate, the road
// and the places; W1 builds the plant.
import { Part, TOP } from '../../../yard/kernel.ts'
import type { PrincipalFill } from '../../../yard/kernel.ts'
import type { WorldDef } from '../../../yard/types.ts'
import { PLACES, PLACE_LABELS, PLATE, ROAD } from './layout.ts'

const fills: Record<PrincipalFill, string> = { pA: '#3f6fb5', pB: '#5cc5dc', pC: '#c2543f', pD: '#cf973a', pE: '#57a483', pF: '#6b8096' }

const rpa: WorldDef = {
  id: 'rpa',
  kicker: 'Simulasi proses · RPA Rawa Teratai (KGR)',
  ariaLabel: 'Peta isometrik rumah potong ayam KGR: pemasok, penerimaan dan holding, pos veteriner, lini potong, chilling dan split-off, disposisi, gudang fresh, blast freezer, pengiriman, kantor. Tombol 1 sampai 9 dan 0 menuju tempat, Home seluruh peta.',
  watermark: ['Ilustrasi: angka dummy, bukan data KGR'],
  gap: 'Belum ada data',
  plate: PLATE,
  places: PLACES,
  labels: PLACE_LABELS,
  views: [
    { id: 'jaringan', label: 'Jaringan', open: [] },
    { id: 'lini', label: 'Lini', open: ['hall'] },
    { id: 'kantor', label: 'Kantor', open: ['kantor'], place: 'kantor' },
  ],
  focus: { label: 'Jalur', options: [['rpa', 'RPA'], ['trading', 'Trading'], ['both', 'Keduanya']], initial: 'both' },
  lenses: [
    { id: 'biaya', label: 'Lensa biaya', title: 'Batch costing sheet dan alokasi NRV (angka dummy)' },
    { id: 'data', label: 'Lensa kesiapan data', title: 'Kebutuhan data per stasiun dari swimlane KGR (data nyata)' },
  ],
  stages: {
    RPA: ['Pengadaan live bird', 'Produksi sampai split-off', 'Pemrosesan lanjut', 'Disposisi & yield', 'Costing batch', 'Penjualan', 'EOD settlement', 'Penagihan', 'Pembayaran', 'Pelaporan'],
    TRADING: ['Pengadaan & penerimaan', 'Penjualan', 'Penagihan', 'Pembayaran', 'Pelaporan'],
  },
  idle: 'Klik stasiun atau divisi untuk kartu swimlane-nya.',
  trackerIdle: 'Pilih batch untuk melihat fasenya.',
  fills,
  build(scene) {
    const p = new Part(scene.ink)
    p.box(PLATE.x0, PLATE.y0, -4, PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 4, 'gr')
    p.fill2(TOP(0, 0, 0), 0, ROAD.y0, PLATE.x1, ROAD.y1 - ROAD.y0, 'glass', 0.02)
    scene.scene.add(p.build('ground'))
    return { clock: () => ({ day: 1, hour: 9, days: 30 }), metrics: () => [] }
  },
}

export default rpa
