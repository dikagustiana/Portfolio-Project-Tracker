// Cards and metrics for the cassava plant. Every figure comes from BMG's standard-cost data
// (data/standar-fcc.ts) or is derived from it (data/derive.ts); where the plant would need a daily
// actual that no source here holds, the card names it as "Belum ada data" instead of a number.
import { formatNumber, formatPct } from '../../../core/format.ts'
import type { Block, Card, Pulse } from '../../../yard/types.ts'
import {
  AGUSTUS_AKTUAL_PER_KG, AGUSTUS_LANGKAH, BIAYA_KIRIM_PER_KG, BIAYA_TRIP_CIKOKOL, BIAYA_TRIP_SEMARANG, KG_PER_JAM_GORENG, KG_PER_TRIP,
  KW2_HARIAN, PER_TAHAP, POOL_BERSAMA, PORSI_DAGING_STANDAR, PREMIUM_HARIAN, PRODUKSI_HARIAN, RENDEMEN_KUPAS, SELISIH_PEMBULATAN, SINGKONG_DAGING_HARIAN,
  SINGKONG_KULIT_HARIAN, SUM_ELEMEN, TRIP_HARIAN, WASTE_HARIAN,
} from '../data/derive.ts'
import { AGUSTUS_2026, ELEMEN, FAKTA, GRADE, JEMBATAN_PREMIUM, KALENDER, PENGIRIMAN, PRODUKSI_NORMAL_KG, SUMBER, TOTAL_DECK } from '../data/standar-fcc.ts'
import type { Elemen } from '../data/standar-fcc.ts'

export const GAP = 'Belum ada data'
export const STAGES = { BATCH: ['Terima', 'Kupas', 'Cuci-potong', 'Goreng', 'Sortir', 'Kemas', 'Kirim'] } as const

/** one decimal always, the way the deck prints Rp per kg: 22.707,7 · 4.645,0 */
export const dec1 = (x: number): string => {
  const s = formatNumber(x, 1)
  return s.includes(',') ? s : `${s},0`
}
export const rp1 = (x: number): string => `Rp ${dec1(x)}`
const rpkg = (x: number): string => `${rp1(x)} per kg`
const kg = (x: number, d = 0): string => `${formatNumber(x, d)} kg`
const el = (id: string): Elemen => ELEMEN.find((e) => e.id === id) as Elemen
const price = (e: Elemen): string => `Rp ${dec1(e.price ?? 0)} per ${e.unit === 'kg kupas' ? 'kg kupas' : (e.unit ?? 'kg')}`

const SRC_DECK = `${SUMBER.deck}, slide 1–2; basis aktual Januari–Agustus 2026.`
const DAY = `hari standar: ${formatNumber(PRODUKSI_NORMAL_KG)} kg ÷ ${KALENDER.hariKerjaSebulan} hari kerja`
/** August's effect of one named driver (deck slide 3), by its position on the slide */
const efek = (i: 0 | 1 | 2 | 3 | 4 | 5): string => {
  const v = AGUSTUS_2026.driver[i].rp
  return `${v > 0 ? '+' : ''}${dec1(v)} per kg`
}
const today = (what: string): { label: string; missing: string } => ({ label: `${what} hari ini`, missing: `${GAP}: ${what.toLowerCase()} aktual harian` })

export function cardPenerimaan(): Card {
  const k = el('singkong-kulit')
  const d = el('singkong-daging')
  return {
    kind: 'Penerimaan bahan baku', title: 'Penerimaan', status: 'singkong datang tiap hari', tone: 'live', channel: 'BATCH',
    rows: [
      ['Singkong kulit', `${k.driver} per kg produksi`],
      ['Singkong daging (beli kupas)', `${d.driver} per kg produksi`],
      ['Diterima pada hari standar', `${kg(SINGKONG_KULIT_HARIAN)} kulit · ${kg(SINGKONG_DAGING_HARIAN)} kupas`],
      ['Porsi beli kupas', `${formatPct(PORSI_DAGING_STANDAR, 1)} standar · ${formatPct(AGUSTUS_2026.porsiDagingAktual, 1)} Agustus`],
    ],
    driver: 'kg singkong per kg produksi · porsi dibeli sudah kupas',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'Harga singkong kulit', value: price(k) },
      { label: 'Harga singkong daging', value: price(d) },
      { label: 'Rp per kg produksi', value: `${dec1(k.rp)} + ${dec1(d.rp)}` },
      { label: 'Efek Agustus: beli kupas 33,6% lawan 5,3%', value: efek(2) },
      today('Kg diterima'),
    ],
    next: 'Ke bak, lalu meja kupas; yang dibeli sudah kupas langsung ke cuci',
    notes: [`Singkong segar tidak bisa disimpan lebih dari ${FAKTA.singkongMaksHari} hari: datang tiap hari, tidak antre semalam, dan tidak ada stok bahan baku yang ditampilkan.`],
    source: `${SRC_DECK} Hari standar = ${DAY}.`,
    stage: { channel: 'BATCH', at: 0 },
  }
}

export function cardKupas(): Card {
  const u = el('upah-kupas')
  return {
    kind: 'Stasiun · pengupasan', title: 'Pengupasan', status: 'kru borongan', tone: 'live', channel: 'BATCH',
    rows: [
      ['Kg kupas per kg produksi', `${u.driver.split(' ')[0]} kg`],
      ['Rendemen kupas standar', `${formatPct(RENDEMEN_KUPAS, 1)} (2,0961 ÷ 3,0093)`],
      ['Kg kupas pada hari standar', kg((u.qty ?? 0) * PRODUKSI_HARIAN)],
    ],
    driver: 'kg kupas × upah borongan per kg',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'Upah borongan', value: price(u) },
      { label: 'Rp per kg produksi', value: dec1(u.rp) },
      { label: 'Efek Agustus: upah kupas lebih rendah', value: efek(3) },
      { label: 'Efek Agustus: rendemen lebih baik', value: efek(4) },
      today('Rendemen'),
    ],
    next: 'Singkong kupas naik ke belt, ke cuci dan potong',
    source: SRC_DECK,
    stage: { channel: 'BATCH', at: 1 },
  }
}

export function cardCuci(): Card {
  const a = el('amonium')
  return {
    kind: 'Stasiun · cuci dan potong', title: 'Cuci dan potong', status: 'drum cuci · slicer · dosing', tone: 'live', channel: 'BATCH',
    rows: [
      ['Amonium bikarbonat', `${a.driver} per kg produksi`],
      ['Pada hari standar', kg((a.qty ?? 0) * PRODUKSI_HARIAN, 1)],
      ['Jam cuci, jam potong', `${KALENDER.jamSebulan.cuci} jam sebulan masing-masing`],
    ],
    driver: 'kg pengembang tekstur per kg produksi',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'Harga amonium bikarbonat', value: price(a) },
      { label: 'Rp per kg produksi', value: dec1(a.rp) },
      today('Jam cuci dan potong'),
    ],
    next: 'Irisan masuk penggorengan',
    source: `${SRC_DECK} Jam: ${KALENDER.sumber}.`,
    stage: { channel: 'BATCH', at: 2 },
  }
}

export function cardGoreng(): Card {
  const m = el('minyak')
  const c = el('cng')
  return {
    kind: 'Stasiun · penggorengan', title: 'Penggorengan', status: '3 penggoreng · CNG', tone: 'live', channel: 'BATCH',
    rows: [
      ['Minyak olein', `${m.driver} per kg · Agustus ${formatNumber(AGUSTUS_2026.minyakAktualKgPerKg, 4)} kg`],
      ['CNG', `${c.driver} per kg produksi`],
      ['Jam goreng sebulan', `${KALENDER.jamSebulan.goreng} jam`],
      ['Laju pada volume normal', `${kg(KG_PER_JAM_GORENG)} per jam (295.087 ÷ 680)`],
    ],
    driver: 'kg minyak dan MMBTU CNG per kg produksi',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'Minyak olein', value: `${price(m)} → ${dec1(m.rp)}` },
      { label: 'CNG', value: `${price(c)} → ${dec1(c.rp)}` },
      { label: 'Efek Agustus: minyak 0,2330 lawan 0,2611', value: efek(1) },
      today('Jam goreng'),
      today('Minyak per kg'),
    ],
    next: 'Keripik ke sortir dan QC; sortir yang penuh menahan penggorengan',
    source: `${SRC_DECK} Jam: ${KALENDER.sumber}.`,
    stage: { channel: 'BATCH', at: 3 },
  }
}

export function cardSortir(): Card {
  return {
    kind: 'Stasiun · sortir dan QC', title: 'Sortir dan QC', status: 'tiga aliran: premium, KW 2, waste', tone: 'live', channel: 'BATCH',
    shares: {
      label: 'komposisi grade standar',
      items: [
        { key: 'premium', color: 'var(--y-blue)', value: GRADE.premium, label: `premium ${formatPct(GRADE.premium, 1)}` },
        { key: 'kw2', color: 'var(--y-warn)', value: GRADE.kw2, label: `KW 2 ${formatPct(GRADE.kw2, 1)}` },
        { key: 'waste', color: 'var(--y-line)', value: GRADE.waste, label: `waste ${formatPct(GRADE.waste, 1)}` },
      ],
    },
    rows: [
      ['Premium, hari standar', kg(PREMIUM_HARIAN)],
      ['KW 2, dijual pada NRV', kg(KW2_HARIAN)],
      ['Waste, keluar pabrik', kg(WASTE_HARIAN)],
    ],
    driver: 'komposisi grade → biaya per kg premium',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'NRV KW 2', value: rpkg(JEMBATAN_PREMIUM.nrvKw2) },
      { label: 'Kredit KW 2 per kg produksi', value: `(${dec1(-JEMBATAN_PREMIUM.kreditKw2)})` },
      { label: 'Normal loss: kg KW 2 dan waste', value: dec1(JEMBATAN_PREMIUM.normalLoss) },
      today('Komposisi grade'),
    ],
    next: 'Premium ke pengemasan; KW 2 dijual; waste keluar pabrik',
    source: `${SUMBER.deck}, slide 2.`,
    stage: { channel: 'BATCH', at: 4 },
  }
}

export function cardKemas(): Card {
  const h = el('hdpe')
  const k = el('karton')
  const t = el('plakban')
  return {
    kind: 'Stasiun · pengemasan', title: 'Pengemasan', status: 'kantong HDPE · karton', tone: 'live', channel: 'BATCH',
    rows: [
      ['Kantong HDPE', `${h.driver} per kg produksi`],
      ['Karton', `${k.driver} per kg produksi`],
      ['Plakban, tali dan label', 'tanpa driver di deck'],
    ],
    driver: 'kg kantong dan jumlah karton per kg produksi',
    engineTitle: 'Angka standar BMG',
    engine: [
      { label: 'Kantong HDPE', value: `${price(h)} → ${dec1(h.rp)}` },
      { label: 'Karton', value: `Rp ${dec1(k.price ?? 0)} per karton → ${dec1(k.rp)}` },
      { label: 'Plakban, tali dan label', value: dec1(t.rp) },
      { label: 'Kemasan per kg produksi', value: rp1(PER_TAHAP.kemas) },
    ],
    next: 'Karton ke gudang barang jadi lewat konveyor; gudang yang penuh menahan pengemasan',
    source: SRC_DECK,
    stage: { channel: 'BATCH', at: 5 },
  }
}

export function cardGudang(): Card {
  return {
    kind: 'Gudang barang jadi dan muat', title: 'Gudang barang jadi', status: 'muat ke IFM: Semarang dan Cikokol', tone: 'live', channel: 'BATCH',
    progress: { v: PENGIRIMAN.isiRataRata, max: 1, label: `isi rata-rata ${formatPct(PENGIRIMAN.isiRataRata, 0)} dari ${formatNumber(PENGIRIMAN.kapasitasTripKg)} kg per trip` },
    rows: [
      ['Premium, hari standar', kg(PREMIUM_HARIAN)],
      ['Kg per trip (3.500 × 90%)', kg(KG_PER_TRIP)],
      ['Trip, hari standar', `${formatNumber(TRIP_HARIAN, 1)} trip`],
      ['Pelanggan', `IFM, ${Math.round(FAKTA.porsiPendapatanIfm[0] * 100)}–${Math.round(FAKTA.porsiPendapatanIfm[1] * 100)}% pendapatan`],
    ],
    driver: 'trip · kg terkirim',
    engineTitle: 'Angka business plan BMG',
    engine: [
      { label: 'Cikokol: borongan + tol pada 50% trip', value: `Rp ${formatNumber(BIAYA_TRIP_CIKOKOL)} per trip` },
      { label: 'Cikokol per kg', value: rpkg(BIAYA_KIRIM_PER_KG.cikokol) },
      { label: 'Semarang', value: `Rp ${formatNumber(BIAYA_TRIP_SEMARANG)} per trip` },
      { label: 'Semarang per kg', value: rpkg(BIAYA_KIRIM_PER_KG.semarang) },
      { label: 'Trip per tujuan hari ini', missing: `${GAP}: jadwal kiriman per tujuan` },
    ],
    next: 'Truk berangkat ke Semarang dan Cikokol',
    notes: ['Biaya kirim tidak termasuk dalam empat belas elemen biaya standar per kg produksi.'],
    source: `${PENGIRIMAN.sumber}; tol Cikokol dihitung pada 50% trip.`,
    stage: { channel: 'BATCH', at: 6 },
  }
}

/** the cost card: standard per element, and August's standard-to-actual waterfall */
export function cardKantor(): Card {
  const bars: Block = {
    kind: 'bars', title: 'Biaya standar per elemen, Rp per kg produksi',
    items: ELEMEN.map((e) => ({ label: e.label, value: e.rp, display: dec1(e.rp), tone: e.tahap === 'bersama' ? 'live' : undefined })),
    note: `Jumlah baris ${dec1(SUM_ELEMEN)}; total deck ${dec1(TOTAL_DECK)}. Selisih ${dec1(SELISIH_PEMBULATAN)} karena tiap baris dibulatkan.`,
  }
  const wf: Block = {
    kind: 'waterfall', title: 'Agustus 2026: standar ke aktual, Rp per kg',
    start: { label: 'Standar', value: TOTAL_DECK },
    steps: AGUSTUS_LANGKAH,
    end: { label: 'Aktual Agustus', value: AGUSTUS_AKTUAL_PER_KG },
    format: dec1,
    note: `Produksi ${formatNumber(AGUSTUS_2026.produksiKg)} kg lawan ${formatNumber(AGUSTUS_2026.produksiNormalKg)} kg normal. Driver di slide 3 berjumlah −1.058,3; sisa −18,8 tampil sebagai batangnya sendiri.`,
  }
  return {
    kind: 'Kantor pabrik · kartu biaya', title: 'Kartu biaya FCC', status: 'disiapkan costing, disetujui GM pabrik', channel: 'BATCH',
    rows: [
      ['Biaya per kg produksi (deck)', rp1(TOTAL_DECK)],
      ['Aktual Agustus per kg', rp1(AGUSTUS_AKTUAL_PER_KG)],
      ['Biaya per kg premium', rp1(JEMBATAN_PREMIUM.biayaPerKgPremium)],
      ['Harga IFM, Agustus 2026', rp1(JEMBATAN_PREMIUM.hargaIfmAgustus2026)],
      ['Margin penuh', `${rp1(JEMBATAN_PREMIUM.marginPenuh)} · ${formatPct(JEMBATAN_PREMIUM.marginPenuhPct, 1)}`],
      ['Kontribusi', `${rp1(JEMBATAN_PREMIUM.kontribusi)} · ${formatPct(JEMBATAN_PREMIUM.kontribusiPct, 1)}`],
    ],
    driver: 'standar × volume aktual, per elemen',
    engineTitle: 'Standar lawan aktual',
    engine: [
      { label: 'Aktual per elemen, hari ini', missing: `${GAP}: biaya aktual harian per elemen; deck hanya memberi jembatan Agustus per driver` },
    ],
    lead: [wf],
    blocks: [bars],
    source: `${SUMBER.deck}, slide 1–3.`,
  }
}

/** the hall as a whole: Rp per kg by stage, the shared pools as their own band */
export function cardHall(): Card {
  const stages: [string, number][] = [
    ['Penerimaan bahan baku', PER_TAHAP.penerimaan], ['Pengupasan', PER_TAHAP.kupas], ['Cuci dan potong', PER_TAHAP.cuci], ['Penggorengan', PER_TAHAP.goreng],
    ['Pengemasan', PER_TAHAP.kemas], ['Pool bersama A–E', PER_TAHAP.bersama],
  ]
  return {
    kind: 'Lini produksi FCC', title: 'Lini keripik singkong', status: 'kupas → cuci-potong → goreng → sortir → kemas', channel: 'BATCH',
    rows: [['Produksi normal sebulan', kg(PRODUKSI_NORMAL_KG)], ['Hari kerja', `${KALENDER.hariKerjaSebulan} hari`], ['Pool bersama A–E', `${rpkg(POOL_BERSAMA)} pada basis normal`]],
    driver: 'biaya proses per tahap; pool bersama dibagi volume normal',
    engineTitle: 'Angka standar BMG',
    engine: [{ label: 'Biaya per kg produksi', value: rp1(TOTAL_DECK) }],
    blocks: [{ kind: 'bars', title: 'Rp per kg produksi per tahap', items: stages.map(([label, v]) => ({ label, value: v, display: dec1(v), tone: label.startsWith('Pool') ? 'live' : undefined })) }],
    source: SRC_DECK,
  }
}

// ---- the metrics bar ----------------------------------------------------------------------------

export function pulse(): Pulse[] {
  return [
    { label: 'Produksi hari ini', value: kg(PRODUKSI_HARIAN), sub: 'hari standar · 295.087 ÷ 27' },
    { label: 'Rendemen kupas', value: formatPct(RENDEMEN_KUPAS, 1), sub: 'standar · 2,0961 ÷ 3,0093' },
    { label: 'Minyak per kg', value: `${formatNumber(el('minyak').qty ?? 0, 4)} kg`, sub: `standar · Agustus ${formatNumber(AGUSTUS_2026.minyakAktualKgPerKg, 4)}` },
    { label: 'CNG per kg', value: `${formatNumber(el('cng').qty ?? 0, 4)} MMBTU`, sub: 'standar' },
    { label: 'Komposisi grade', value: `${dec1(GRADE.premium * 100)}/${dec1(GRADE.kw2 * 100)}/${dec1(GRADE.waste * 100)}`, sub: 'premium/KW 2/waste, %' },
    { label: 'Kiriman ke IFM', value: kg(PREMIUM_HARIAN), sub: `${formatNumber(TRIP_HARIAN, 1)} trip · ${formatNumber(KG_PER_TRIP)} kg per trip` },
  ]
}

export function costLens(): Pulse[] {
  return [
    { label: 'Per kg produksi', value: rp1(TOTAL_DECK), sub: '14 elemen · standar' },
    { label: 'Per kg premium', value: rp1(JEMBATAN_PREMIUM.biayaPerKgPremium), sub: 'kredit KW 2 · normal loss' },
    { label: 'Harga IFM', value: rp1(JEMBATAN_PREMIUM.hargaIfmAgustus2026), sub: 'per kg · Agustus 2026' },
    { label: 'Margin penuh', value: rp1(JEMBATAN_PREMIUM.marginPenuh), sub: `${formatPct(JEMBATAN_PREMIUM.marginPenuhPct, 1)} dari harga IFM` },
    { label: 'Kontribusi', value: rp1(JEMBATAN_PREMIUM.kontribusi), sub: `${formatPct(JEMBATAN_PREMIUM.kontribusiPct, 1)} dari harga IFM` },
    { label: 'Pool A–E', value: rp1(POOL_BERSAMA), sub: `per kg · basis ${formatNumber(PRODUKSI_NORMAL_KG)} kg` },
  ]
}
