// Mode skenario, distribution world (Brief B6 §4.1): one volume of one or more principals walked
// through the eleven steps of Brief B4 §5, from the GM Commercial's forecast to the cash. Every
// figure is read from the engine the yard already shows (world 2's computeAll2, whose B2B exit is
// the world-1 model), typed into the drawer, entered at a pause, or computed here from those.
// S0 wires steps 1–3; steps 4a–11 are listed and arrive in S1.
import { hashJson } from '../../../core/rng.ts'
import { formatNumber } from '../../../core/format.ts'
import type { PrincipalId } from '../../../core/colors.ts'
import { calc, eng, fig, inp, splitWhole, sum } from '../../../scenario/figure.ts'
import type { Fig, GapDef, Line, ScenarioDef, Stage, StepDef } from '../../../scenario/types.ts'
import { computeAll2 } from '../../b2b-b2c/engine/index.ts'
import { DAYS, PALLET_RULES, ZONES, palletFit } from '../engine/index.ts'
import type { Sku } from '../engine/index.ts'
import { KANTOR, PLANTS } from '../yard/layout.ts'
import { orderNeed, palletsFor } from './order.ts'

export interface DistInputs {
  /** principals */
  p: PrincipalId[]
  /** SKU ids of the chosen principals */
  sku: string[]
  vol: number
  /** the unit the volume is given in */
  vu: 'palet' | 'karton'
  ch: 'b2b' | 'b2c' | 'mix'
  /** share of the volume through B2B when the channel is a mix, in % */
  mix: number
  zone: '1' | '2' | '3'
  /** stores (one DO each) */
  stores: number
  drops: number
  /** the month whose engine pools apply: the engine holds one */
  month: 'engine'
  /** where the stock check reads current and in-transit stock */
  stock: 'engine' | 'asumsi'
  /** who raises the PO: the shared sales admin pool, or a dedicated admin */
  sa: 'bersama' | 'khusus'
}

interface SkuPlan {
  sku: Sku
  perPallet: Fig
  forecastEngine: Fig
  /** the scenario's forecast in cartons, and the pallets it fills */
  cartons: Fig
  pallets: Fig
}

interface SkuNeed {
  sku: Sku
  need: Fig
  pallets: Fig
}

export interface DistState {
  plan: SkuPlan[]
  need: SkuNeed[]
  /** principals with a PO, and their PO lines */
  pos: { p: PrincipalId; lines: number; cartons: Fig; pallets: Fig }[]
}

const PIDS: PrincipalId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const SRC = 'engine distribusi (dummy)'

const data = () => computeAll2()
const b2b = () => data().world.b2b
const alloc = () => data().alloc.b2bAlloc
const pool = (id: string) => {
  const p = alloc().pools.find((x) => x.def.id === id)
  if (!p) throw new Error(`pool ${id}`)
  return p
}
const principal = (id: PrincipalId) => {
  const p = b2b().principals.find((x) => x.id === id)
  if (!p) throw new Error(`prinsipal ${id}`)
  return p
}
const skusOf = (p: PrincipalId): Sku[] => principal(p).skus.map((s) => b2b().skus[s]).filter((s): s is Sku => !!s)

let hashMemo: string | undefined
function dataHash(): string {
  if (!hashMemo) {
    const a = alloc()
    hashMemo = hashJson({ world: b2b(), pools: a.pools.map((p) => [p.def.id, p.total, p.volumeTotal]), rules: PALLET_RULES, toggles: a.toggles })
  }
  return hashMemo
}

/** the scenario's volume per SKU: pallets (or cartons) split over the SKUs by the engine's
 *  forecast mix, then converted through the engine's cartons per pallet */
export function planOf(i: DistInputs): SkuPlan[] {
  const toggles = alloc().toggles
  const rule = PALLET_RULES[toggles.palletRule].label
  const skus = PIDS.filter((p) => i.p.includes(p)).flatMap(skusOf).filter((s) => i.sku.includes(s.id))
  const fits = skus.map((s) => eng(`Karton per palet ${s.code}`, palletFit(s, toggles).perPallet, 'karton/palet', `aturan palet engine ${rule}`))
  const fc = skus.map((s) => eng(`Forecast engine ${s.code}`, b2b().forecast[s.id] ?? 0, 'karton', `${SRC}, forecast bulan ini`))
  const vol = inp('Volume skenario', i.vol, i.vu)
  const weights = skus.map((_, k) => (i.vu === 'palet' ? (fc[k]?.value ?? 0) / Math.max(1, fits[k]?.value ?? 1) : (fc[k]?.value ?? 0)))
  const parts = splitWhole(i.vol, weights)
  const wTotal = weights.reduce((s, x) => s + x, 0)
  return skus.map((sku, k) => {
    const perPallet = fits[k] as Fig
    const forecastEngine = fc[k] as Fig
    const mixLabel = i.vu === 'palet' ? 'forecast engine dalam palet' : 'forecast engine'
    const share = fig(`Bagian ${sku.code} dari volume`, parts[k] ?? 0, i.vu, 'hitungan', {
      formula: `{0} dibagi menurut porsi ${mixLabel} ({1} dari ${formatNumber(wTotal, 1)}), sisa pembulatan terbesar`,
      inputs: [vol, forecastEngine],
    })
    if (i.vu === 'palet') {
      const cartons = calc(`Forecast skenario ${sku.code}`, 'karton', '{0} × {1}', [share, perPallet], (p, f) => p * f)
      return { sku, perPallet, forecastEngine, cartons, pallets: share }
    }
    return { sku, perPallet, forecastEngine, cartons: share, pallets: palletsFor(`Palet ${sku.code}`, share, perPallet) }
  })
}

const sumCartons = (plan: SkuPlan[]): Fig => sum('Forecast skenario', 'karton', plan.map((x) => x.cartons))
const sumPallets = (plan: SkuPlan[]): Fig => sum('Palet skenario', 'palet', plan.map((x) => x.pallets))

const DESK = {
  komersial: 'Meja Komersial',
  shared: 'Meja sales admin bersama',
  dedicated: 'Meja sales admin khusus D',
  ar: 'Meja Finance AR',
  tax: 'Meja pajak',
}
const plantOf = (p: PrincipalId) => PLANTS.find((x) => x.id === p)
const KANTOR_DOOR = [54, KANTOR.y1 + 2] as const

// ---- steps ------------------------------------------------------------------------------------

type Step = StepDef<DistInputs, DistState>

const step1: Step = {
  n: '1',
  title: () => 'GM Commercial membuat forecast dan cek stok',
  role: () => 'GM Commercial, dengan Gudang',
  team: 'Komersial',
  run: ({ inputs, state }) => {
    const total = sumCartons(state.plan)
    return {
      state,
      out: {
        driver: total,
        rate: null,
        cost: fig('Biaya langkah 1', 0, 'Rp', 'hitungan', { formula: 'tidak ada biaya baru: biaya tim Komersial dibagi per baris order di langkah 2', inputs: [] }),
        day: 0,
        detail: [
          { label: 'Forecast skenario', value: total },
          { label: 'Palet', value: sumPallets(state.plan) },
          ...PIDS.filter((p) => inputs.p.includes(p)).map((p) => ({
            label: `Forecast engine Prinsipal ${p} sebulan`,
            value: sum(`Forecast engine Prinsipal ${p}`, 'karton', state.plan.filter((x) => x.sku.principal === p).map((x) => x.forecastEngine)),
          })),
        ],
        notes: ['Volume dibagi ke SKU menurut porsi forecast engine; karton per palet dari aturan palet engine.'],
      },
    }
  },
  stage: () => ({
    box: [0, 300, 0, 222],
    open: ['kantor', 'gudang'],
    keep: ['Kantor', 'Gudang', DESK.komersial],
    live: [DESK.komersial, 'Gudang'],
    labels: ['1', '3'],
  }),
}

const stockGaps = (p: PrincipalId): GapDef[] => [
  {
    id: `stok-${p}`, label: `Stok saat ini Prinsipal ${p}`, unit: 'karton', owner: 'Gudang (kepala gudang)', min: 0, integer: true,
    why: 'Rumus kebutuhan order mengurangkan stok yang sudah ada untuk volume ini. Dibagi ke SKU menurut porsi forecast.',
  },
  {
    id: `transit-${p}`, label: `Stok dalam perjalanan Prinsipal ${p}`, unit: 'karton', owner: 'Sales admin (PO terbuka)', min: 0, integer: true,
    why: 'PO yang sudah dikirim tetapi barangnya belum tiba juga dikurangkan dari kebutuhan.',
  },
]

const step2: Step = {
  n: '2',
  title: () => 'Komersial menghitung kebutuhan order',
  role: () => 'Komersial',
  team: 'Komersial',
  gaps: ({ inputs }) => (inputs.stock === 'asumsi' ? PIDS.filter((p) => inputs.p.includes(p)).flatMap(stockGaps) : []),
  run: (ctx) => {
    const { inputs, state } = ctx
    const days = eng('Hari per bulan engine', DAYS, 'hari', SRC)
    const need: SkuNeed[] = []
    const detail: { label: string; value: Fig }[] = []
    for (const p of PIDS.filter((x) => inputs.p.includes(x))) {
      const items = state.plan.filter((x) => x.sku.principal === p)
      const pr = principal(p)
      const minDays = eng(`Hari persediaan minimum Prinsipal ${p}`, pr.minInventoryDays, 'hari', SRC)
      const fcP = sum(`Forecast skenario Prinsipal ${p}`, 'karton', items.map((x) => x.cartons))
      const cur: Fig[] = []
      const tr: Fig[] = []
      const mins: Fig[] = []
      for (const it of items) {
        let current: Fig
        let transit: Fig
        if (inputs.stock === 'asumsi') {
          current = calc(`Stok saat ini ${it.sku.code}`, 'karton', '{0} × {1} ÷ {2}', [ctx.asm(`stok-${p}`), it.cartons, fcP], (s, f, t) => (t > 0 ? (s * f) / t : 0), 1)
          transit = calc(`Stok dalam perjalanan ${it.sku.code}`, 'karton', '{0} × {1} ÷ {2}', [ctx.asm(`transit-${p}`), it.cartons, fcP], (s, f, t) => (t > 0 ? (s * f) / t : 0), 1)
        } else {
          // the engine's stock cover on day 1 (days of its own sales), applied to the scenario's sales
          const open = eng(`Stok engine ${it.sku.code} hari 1`, b2b().stock.find((s) => s.sku === it.sku.id && s.day === 1)?.open ?? 0, 'karton', `${SRC}, ledger stok`)
          const cover = calc(`Hari stok engine ${it.sku.code}`, 'hari', '{0} ÷ ({1} ÷ {2})', [open, it.forecastEngine, days], (o, f, d) => (f > 0 ? (o * d) / f : 0), 1)
          current = calc(`Stok saat ini ${it.sku.code}`, 'karton', '{0} ÷ {1} × {2}', [it.cartons, days, cover], (f, d, c) => (d > 0 ? (f / d) * c : 0), 1)
          transit = eng(`Stok dalam perjalanan ${it.sku.code}`, 0, 'karton', `${SRC}: tidak ada PO sebelum hari 1`)
        }
        const n = orderNeed(it.sku.code, it.cartons, days, minDays, current, transit)
        cur.push(current)
        tr.push(transit)
        mins.push(n.minStock)
        need.push({ sku: it.sku, need: n.need, pallets: palletsFor(`Palet order ${it.sku.code}`, n.need, it.perPallet) })
      }
      const mine = need.filter((x) => x.sku.principal === p)
      detail.push(
        { label: `Prinsipal ${p} · forecast`, value: fcP },
        { label: `Prinsipal ${p} · stok minimum`, value: sum(`Stok minimum Prinsipal ${p}`, 'karton', mins, 1) },
        { label: `Prinsipal ${p} · stok saat ini`, value: sum(`Stok saat ini Prinsipal ${p}`, 'karton', cur, 1) },
        { label: `Prinsipal ${p} · dalam perjalanan`, value: sum(`Dalam perjalanan Prinsipal ${p}`, 'karton', tr, 1) },
        { label: `Prinsipal ${p} · kebutuhan order`, value: sum(`Kebutuhan order Prinsipal ${p}`, 'karton', mine.map((x) => x.need)) },
        { label: `Prinsipal ${p} · palet order`, value: sum(`Palet order Prinsipal ${p}`, 'palet', mine.map((x) => x.pallets)) },
      )
    }
    const kom = pool('komersial')
    const engineLines = b2b().pos.reduce((s, po) => s + po.lines.length, 0)
    const rate = calc('Biaya Komersial per baris order', 'Rp/baris', '{0} ÷ {1}', [
      eng('Pool Komersial sebulan', kom.total, 'Rp', `${SRC}, ${kom.def.headcount} orang × Rp ${formatNumber(kom.def.costPerPerson)}`),
      eng('Baris PO engine sebulan', engineLines, 'baris', `${SRC}, ${b2b().pos.length} PO`),
    ], (t, l) => (l > 0 ? t / l : 0))
    const lines = fig('Baris order', need.filter((x) => x.need.value > 0).length, 'baris', 'hitungan', {
      formula: `banyaknya SKU dengan kebutuhan order > 0 di antara ${need.map((_, k) => `{${k}}`).join(', ')}`,
      inputs: need.map((x) => x.need),
    })
    const cost = calc('Biaya langkah 2', 'Rp', '{0} × {1}', [lines, rate], (l, r) => l * r)
    return {
      state: { ...state, need },
      out: {
        driver: lines, rate, cost, day: 0, detail,
        notes: [
          'Kebutuhan = forecast + stok minimum − stok saat ini − dalam perjalanan; stok minimum = penjualan harian × hari persediaan minimum.',
          inputs.stock === 'engine'
            ? 'Stok saat ini memakai hari stok engine pada hari 1 (stok engine ÷ penjualan harian engine) untuk penjualan harian skenario.'
            : 'Stok saat ini dan dalam perjalanan adalah asumsi skenario, dibagi ke SKU menurut porsi forecast.',
          'Engine tidak mengalokasikan pool Komersial; skenario membaginya per baris order (Brief B6 §4.1).',
        ],
      },
    }
  },
  stage: () => ({ place: 'kantor', open: ['kantor'], keep: ['Kantor', DESK.komersial], live: [DESK.komersial], labels: ['1'] }),
}

const adminGap = (p: PrincipalId): GapDef => ({
  id: `admin-khusus-${p}`, label: `Biaya sales admin khusus Prinsipal ${p} per bulan`, unit: 'Rp/bulan', owner: 'Komersial (anggaran sales admin)', min: 0,
  why: `Engine hanya punya sales admin khusus untuk Prinsipal D. Untuk Prinsipal ${p} biayanya belum ada.`,
})

const step3: Step = {
  n: '3',
  title: () => 'Sales admin membuat PO ke prinsipal',
  role: (i) => (i.sa === 'khusus' ? 'Sales admin khusus' : 'Sales admin bersama'),
  team: 'Sales admin',
  gaps: ({ inputs, state }) => (inputs.sa === 'khusus' ? [...new Set(state.need.filter((x) => x.need.value > 0).map((x) => x.sku.principal))].filter((p) => p !== 'D').map(adminGap) : []),
  run: (ctx) => {
    const { inputs, state } = ctx
    const perCheck = eng('PO per prinsipal per cek order', 1, 'PO', `${SRC}: satu PO per prinsipal per cek order (hari 1, 8, 15, 22)`)
    const pos: DistState['pos'] = []
    const costs: Fig[] = []
    const poFigs: Fig[] = []
    const detail: StepOutDetail = []
    const notes: string[] = []
    const shared = pool('salesAdminShared')
    for (const p of PIDS.filter((x) => inputs.p.includes(x))) {
      const mine = state.need.filter((x) => x.sku.principal === p && x.need.value > 0)
      if (!mine.length) {
        notes.push(`Prinsipal ${p}: stok cukup, tidak ada PO.`)
        continue
      }
      const poCount = calc(`PO Prinsipal ${p}`, 'PO', '{0} (ada kebutuhan order)', [perCheck], (x) => x)
      poFigs.push(poCount)
      let rate: Fig
      if (inputs.sa === 'bersama') {
        rate = eng('Biaya per PO, sales admin bersama', shared.rate, 'Rp/PO', `${SRC}, pool Rp ${formatNumber(shared.total)} ÷ ${formatNumber(shared.volumeTotal)} PO`)
      } else {
        const monthly = p === 'D' ? eng('Sales admin khusus Prinsipal D sebulan', pool('salesAdminDedicated').total, 'Rp/bulan', `${SRC}, langsung ke Prinsipal D`) : ctx.asm(`admin-khusus-${p}`)
        const enginePos = eng(`PO Prinsipal ${p} sebulan`, shared.volumeByPrincipal[p], 'PO', SRC)
        rate = calc(`Biaya per PO, sales admin khusus ${p}`, 'Rp/PO', '{0} ÷ {1}', [monthly, enginePos], (m, n) => (n > 0 ? m / n : 0))
      }
      const cost = calc(`Biaya PO Prinsipal ${p}`, 'Rp', '{0} × {1}', [poCount, rate], (n, r) => n * r)
      costs.push(cost)
      const lineCount = fig(`Baris PO Prinsipal ${p}`, mine.length, 'baris', 'hitungan', { formula: 'SKU dengan kebutuhan order > 0', inputs: mine.map((x) => x.need) })
      pos.push({ p, lines: mine.length, cartons: sum(`Karton PO Prinsipal ${p}`, 'karton', mine.map((x) => x.need)), pallets: sum(`Palet PO Prinsipal ${p}`, 'palet', mine.map((x) => x.pallets)) })
      detail.push(
        { label: `Prinsipal ${p} · tarif`, value: rate },
        { label: `Prinsipal ${p} · biaya PO`, value: cost },
        { label: `Prinsipal ${p} · per baris PO (ke SKU)`, value: calc(`Biaya PO per baris ${p}`, 'Rp/baris', '{0} ÷ {1}', [cost, lineCount], (c, l) => (l > 0 ? c / l : 0)) },
      )
    }
    if (inputs.sa === 'khusus' && inputs.p.includes('D')) notes.push('Engine juga membebankan PO Prinsipal D ke pool bersama; opsi "khusus" di skenario hanya memakai admin khusus.')
    if (inputs.sa === 'bersama' && inputs.p.includes('D')) notes.push('Engine juga membebankan admin khusus Prinsipal D langsung ke D; opsi "bersama" di skenario hanya memakai tarif per PO.')
    const poTotal = sum('Jumlah PO', 'PO', poFigs)
    const cost = sum('Biaya langkah 3', 'Rp', costs)
    const rate = pos.length === 1 ? (detail[0]?.value as Fig) : calc('Biaya rata-rata per PO', 'Rp/PO', '{0} ÷ {1}', [cost, poTotal], (c, n) => (n > 0 ? c / n : 0))
    return {
      state: { ...state, pos },
      out: {
        driver: poTotal, rate, cost, day: 0,
        detail: [...pos.map((x) => ({ label: `PO Prinsipal ${x.p}`, value: `${formatNumber(x.lines)} baris · ${formatNumber(x.cartons.value)} karton · ${formatNumber(x.pallets.value)} palet` })), ...detail],
        notes: ['Biaya PO turun ke SKU menurut baris PO.', ...notes],
      },
    }
  },
  stage: (i, s) => {
    const ps = s.pos.length ? s.pos.map((x) => x.p) : i.p
    const desk = i.sa === 'khusus' && ps.every((p) => p === 'D') ? DESK.dedicated : DESK.shared
    return {
      box: [0, 132, 0, 280],
      open: ['kantor'],
      keep: ['Kantor', desk, ...ps.map((p) => `Prinsipal ${p}`)],
      live: [desk, ...ps.map((p) => `Prinsipal ${p}`)],
      labels: ['1', '2'],
      flights: ps.flatMap((p) => {
        const pl = plantOf(p)
        return pl ? [{ kind: 'doc' as const, label: 'PO', from: KANTOR_DOOR, to: [pl.x0 + 17, pl.y0 - 2] as const }] : []
      }),
    }
  },
}

type StepOutDetail = { label: string; value: Fig | string }[]

/** steps of Brief B4 §5 that S1 wires */
const later = (n: string, title: string, role: string, team: string, stage: Stage): Step => ({ n, title: () => title, role: () => role, team, stage: () => stage })

const STEPS: Step[] = [
  step1,
  step2,
  step3,
  later('4a', 'Tim inbound membongkar dan menerima palet', 'Tim inbound', 'Inbound', { place: 'gudang', open: ['gudang'], keep: ['Gudang'], live: ['Gudang'], labels: ['3'] }),
  later('4b', 'Admin gudang membuat GR di WMS', 'Admin gudang', 'Inbound', { place: 'gudang', open: ['gudang'], keep: ['Gudang'], live: ['Gudang'], labels: ['3'] }),
  later('5', 'Gudang menyimpan palet', 'Gudang', 'Simpan', { place: 'gudang', open: ['gudang'], keep: ['Gudang'], live: ['Gudang'], labels: ['3'] }),
  later('6', 'Picker mengambil barang keluar', 'Picker', 'Picking', { place: 'gudang', open: ['gudang'], keep: ['Gudang'], live: ['Gudang'], labels: ['3'] }),
  later('7', 'Driver memuat dan mengantar', 'Driver dan armada', 'Transport', { place: 'toko', keep: [], live: [], labels: ['5'] }),
  later('8', 'Toko menandatangani DO', 'Driver', 'Transport', { place: 'toko', keep: [], live: [], labels: ['5'] }),
  later('9', 'Finance AR membuat invoice', 'Finance AR', 'Finance AR', { place: 'kantor', open: ['kantor'], keep: ['Kantor', DESK.ar], live: [DESK.ar], labels: ['1'] }),
  later('10', 'Tax mengirim invoice, faktur pajak, tukar faktur', 'Tax, Finance AR', 'Tax', { place: 'kantor', open: ['kantor'], keep: ['Kantor', DESK.tax], live: [DESK.tax], labels: ['1'] }),
  later('11', 'Treasury menunggu TOP dan kas masuk', 'Treasury', 'Treasury', { place: 'kantor', open: ['kantor'], keep: ['Kantor'], live: [], labels: ['1'] }),
]

// ---- inputs ---------------------------------------------------------------------------------

const allSkus = (ps: PrincipalId[]): string[] => PIDS.filter((p) => ps.includes(p)).flatMap((p) => principal(p).skus)

const DEFAULTS = (): DistInputs => ({
  p: ['A'], sku: allSkus(['A']), vol: 100, vu: 'palet', ch: 'b2b', mix: 100, zone: '1', stores: 10, drops: 10, month: 'engine', stock: 'engine', sa: 'bersama',
})

const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : d)
const whole = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d)

function normalize(raw: unknown): DistInputs {
  const d = DEFAULTS()
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const p = Array.isArray(o.p) ? PIDS.filter((x) => (o.p as unknown[]).includes(x)) : d.p
  const valid = allSkus(p)
  const sku = Array.isArray(o.sku) ? valid.filter((x) => (o.sku as unknown[]).includes(x)) : valid
  return {
    p, sku, vol: whole(o.vol, d.vol), vu: oneOf(o.vu, ['palet', 'karton'], d.vu), ch: oneOf(o.ch, ['b2b', 'b2c', 'mix'], d.ch), mix: whole(o.mix, d.mix),
    zone: oneOf(o.zone, ['1', '2', '3'], d.zone), stores: whole(o.stores, d.stores), drops: whole(o.drops, d.drops), month: 'engine',
    stock: oneOf(o.stock, ['engine', 'asumsi'], d.stock), sa: oneOf(o.sa, ['bersama', 'khusus'], d.sa),
  }
}

function validate(i: DistInputs): Partial<Record<keyof DistInputs, string>> {
  const e: Partial<Record<keyof DistInputs, string>> = {}
  if (!i.p.length) e.p = 'Pilih minimal satu prinsipal'
  if (!i.sku.length) e.sku = 'Pilih minimal satu SKU'
  if (!Number.isInteger(i.vol) || i.vol < 1) e.vol = 'Volume harus bilangan bulat lebih dari 0'
  else if (i.vol > 100_000) e.vol = 'Volume maksimum 100.000'
  if (i.ch !== 'b2b' && i.p.includes('D')) e.ch = 'Prinsipal D hanya B2B di engine (porsi B2C 0%)'
  if (i.ch === 'mix' && (!Number.isInteger(i.mix) || i.mix < 1 || i.mix > 99)) e.mix = 'Porsi B2B antara 1 dan 99%'
  if (i.ch !== 'b2c') {
    if (!Number.isInteger(i.stores) || i.stores < 1) e.stores = 'Minimal satu toko'
    if (!Number.isInteger(i.drops) || i.drops < 1) e.drops = 'Minimal satu drop per trip'
    else if (i.drops > i.stores) e.drops = 'Drop per trip tidak boleh lebih dari jumlah toko'
  }
  return e
}

/** keep the SKU choice in step with the principals: a newly chosen principal brings all its SKUs */
function adjust(next: DistInputs, prev: DistInputs): DistInputs {
  if (next.p === prev.p) return next
  const added = next.p.filter((p) => !prev.p.includes(p))
  const keep = next.sku.filter((s) => next.p.includes(b2b().skus[s]?.principal as PrincipalId))
  return { ...next, sku: [...keep, ...allSkus(added)].filter((s, k, a) => a.indexOf(s) === k) }
}

function preview(i: DistInputs): Line[] {
  if (!i.p.length || !i.sku.length || !(i.vol > 0)) return [{ t: 'Pilih prinsipal, SKU dan volume untuk melihat konversinya.' }]
  const plan = planOf(i)
  const rule = PALLET_RULES[alloc().toggles.palletRule].label
  const vol = inp('Volume skenario', i.vol, i.vu)
  const head: Line =
    i.vu === 'palet'
      ? { t: `{0} = {1} menurut aturan palet engine (${rule})`, f: [vol, sumCartons(plan)] }
      : { t: `{0} = {1} menurut aturan palet engine (${rule}), dibulatkan ke atas per SKU`, f: [vol, sumPallets(plan)] }
  const zone = ZONES.find((z) => String(z.id) === i.zone)
  return [
    head,
    ...plan.map((x) => ({ t: `${x.sku.code} · {0} · {1} · {2}`, f: [x.perPallet, x.pallets, x.cartons] })),
    { t: 'Volume dibagi ke SKU menurut porsi forecast engine bulan ini.' },
    i.ch === 'b2c'
      ? { t: 'Kanal B2C: paket lewat kurir (langkah 6–7 dihitung di S1).' }
      : {
          t: `Kanal ${i.ch === 'mix' ? `campuran, {0} B2B` : 'B2B'} · zona ${i.zone} ({1} sekali jalan) · {2} · {3}`,
          f: [inp('Porsi B2B', (i.ch === 'mix' ? i.mix : 100) / 100, '%'), eng(`Jarak zona ${i.zone}`, zone?.oneWayKm ?? 0, 'km', SRC), inp('Toko', i.stores, 'toko'), inp('Drop per trip', i.drops, 'drop per trip')],
        },
  ]
}

function summary(i: DistInputs): Line[] {
  const plan = planOf(i)
  return [
    { t: `Prinsipal ${i.p.join(', ')} · ${formatNumber(i.sku.length)} SKU (${i.sku.join(', ')})` },
    i.vu === 'palet' ? { t: 'Volume {0} = {1}', f: [inp('Volume skenario', i.vol, 'palet'), sumCartons(plan)] } : { t: 'Volume {0} = {1}', f: [inp('Volume skenario', i.vol, 'karton'), sumPallets(plan)] },
    { t: `Kanal ${i.ch === 'b2b' ? 'B2B' : i.ch === 'b2c' ? 'B2C' : `campuran ${formatNumber(i.mix)}% B2B`}${i.ch === 'b2c' ? '' : ` · zona ${i.zone} · ${formatNumber(i.stores)} toko · ${formatNumber(i.drops)} drop per trip`}` },
    { t: `Bulan engine (${DAYS} hari) · aturan palet engine ${PALLET_RULES[alloc().toggles.palletRule].label}` },
    { t: `Posisi stok: ${i.stock === 'engine' ? 'hari stok engine pada hari 1' : 'asumsi skenario'} · sales admin ${i.sa}` },
  ]
}

export const distribusiScenario: ScenarioDef<DistInputs, DistState> = {
  world: 'distribusi',
  title: 'Skenario distribusi',
  count: 11,
  steps: STEPS,
  dataHash,
  dataLabel: 'Engine distribusi (world 2, ekspor B2B = model world 1) · data dummy',
  fields: [
    { id: 'p', kind: 'checks', label: 'Prinsipal', groups: () => [{ label: '', options: PIDS.map((p) => [p, `Prinsipal ${p}`]) }] },
    { id: 'sku', kind: 'checks', label: 'SKU', groups: (i) => PIDS.filter((p) => i.p.includes(p)).map((p) => ({ label: `Prinsipal ${p}`, options: principal(p).skus.map((s) => [s, b2b().skus[s]?.code ?? s]) })) },
    { id: 'vu', kind: 'seg', label: 'Satuan volume', options: () => [['palet', 'Palet'], ['karton', 'Karton']] },
    { id: 'vol', kind: 'number', label: 'Volume', unit: (i) => i.vu, min: 1, step: 1 },
    { id: 'ch', kind: 'seg', label: 'Kanal', options: () => [['b2b', 'B2B'], ['b2c', 'B2C'], ['mix', 'Campuran']] },
    { id: 'mix', kind: 'number', label: 'Porsi B2B', unit: () => '%', min: 1, step: 1, show: (i) => i.ch === 'mix' },
    { id: 'zone', kind: 'seg', label: 'Zona', options: () => ZONES.map((z) => [String(z.id), `Zona ${z.id}`] as [string, string]), show: (i) => i.ch !== 'b2c' },
    { id: 'stores', kind: 'number', label: 'Toko (satu DO per toko)', unit: () => 'toko', min: 1, step: 1, show: (i) => i.ch !== 'b2c' },
    { id: 'drops', kind: 'number', label: 'Drop per trip', unit: () => 'drop', min: 1, step: 1, show: (i) => i.ch !== 'b2c' },
    { id: 'month', kind: 'seg', label: 'Bulan pool engine', options: () => [['engine', `Bulan engine (${DAYS} hari)`]], help: 'Engine memegang satu bulan.' },
    { id: 'stock', kind: 'seg', label: 'Posisi stok', options: () => [['engine', 'Hari stok engine'], ['asumsi', 'Isi sebagai asumsi']] },
    { id: 'sa', kind: 'seg', label: 'Sales admin', options: () => [['bersama', 'Bersama (per PO)'], ['khusus', 'Khusus']] },
  ],
  defaults: DEFAULTS,
  presets: [
    { id: 'p100', label: '100 palet · satu prinsipal · B2B Zona 1', badge: 'dummy', inputs: DEFAULTS(), note: 'Data engine dummy, jadi preset ini juga dummy.' },
    {
      id: 'campuran', label: 'Campuran B2B dan B2C', badge: 'dummy', note: 'Prinsipal C memegang porsi B2C terbesar di engine.',
      inputs: { ...DEFAULTS(), p: ['C'], sku: allSkus(['C']), vol: 60, ch: 'mix', mix: 60, stores: 8, drops: 8 },
    },
  ],
  normalize,
  validate,
  preview,
  units: (i) => inp('Volume skenario', i.vol, i.vu),
  summary,
  init: (i) => ({ plan: planOf(i), need: [], pos: [] }),
  teams: ['Komersial', 'Sales admin', 'Inbound', 'Simpan', 'Picking', 'Transport', 'Finance AR', 'Tax', 'Treasury'],
  adjust,
}

export default distribusiScenario
