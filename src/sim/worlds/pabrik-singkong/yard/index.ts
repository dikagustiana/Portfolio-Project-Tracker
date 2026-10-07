// World 2 of the switcher (Brief B5 §3): BMG's cassava chip plant, on real BMG standard-cost
// figures. W0 stub: the plate, the road and the places; W1 builds the plant.
import { Part, TOP } from '../../../yard/kernel.ts'
import type { PrincipalFill } from '../../../yard/kernel.ts'
import type { WorldDef } from '../../../yard/types.ts'
import { PLACES, PLACE_LABELS, PLATE, ROAD } from './layout.ts'

const fills: Record<PrincipalFill, string> = { pA: '#3f6fb5', pB: '#8a9a5b', pC: '#c2543f', pD: '#cf973a', pE: '#57a483', pF: '#6b8096' }

const pabrikSingkong: WorldDef = {
  id: 'pabrik-singkong',
  kicker: 'Simulasi proses · pabrik singkong BMG',
  ariaLabel: 'Peta isometrik pabrik keripik singkong BMG: penerimaan, pengupasan, cuci dan potong, penggorengan, sortir dan QC, pengemasan, gudang barang jadi dan muat, kantor pabrik. Tombol 1 sampai 8 menuju tempat, 0 seluruh peta.',
  watermark: ['Data BMG: biaya standar FCC, basis aktual Januari–Agustus 2026. Sumber: deck BMG FCC biaya standar per kg dan business plan BMG.'],
  gap: 'Belum ada data',
  plate: PLATE,
  places: PLACES,
  labels: PLACE_LABELS,
  views: [
    { id: 'jaringan', label: 'Pabrik', open: [] },
    { id: 'lini', label: 'Lini', open: ['hall'], place: undefined },
    { id: 'kantor', label: 'Kantor pabrik', open: ['kantor'], place: 'kantor' },
  ],
  lenses: [{ id: 'biaya', label: 'Lensa biaya', title: 'Ganti metrik produksi dengan biaya standar per kg' }],
  stages: { BATCH: ['Terima', 'Kupas', 'Cuci-potong', 'Goreng', 'Sortir', 'Kemas', 'Kirim'] },
  idle: 'Klik tempat di peta untuk angka standarnya.',
  trackerIdle: 'Pilih batch untuk melihat tahapnya.',
  fills,
  build(scene) {
    const p = new Part(scene.ink)
    p.box(PLATE.x0, PLATE.y0, -4, PLATE.x1 - PLATE.x0, PLATE.y1 - PLATE.y0, 4, 'gr')
    p.fill2(TOP(0, 0, 0), 0, ROAD.y0, PLATE.x1, ROAD.y1 - ROAD.y0, 'glass', 0.02)
    scene.scene.add(p.build('ground'))
    return { clock: () => ({ day: 1, hour: 9, days: 27 }), metrics: () => [] }
  },
}

export default pabrikSingkong
