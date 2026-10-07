// sim-report: prints the dummy month per principal (world 1) or per principal/platform/
// priority (world 2) at the default toggle state and with each toggle flipped one at a
// time. Run: npx tsx scripts/sim-report.ts [--world b2b-b2c]
import { DEFAULT_TOGGLES } from '../src/sim/worlds/distribusi/engine/config.ts'
import type { PrincipalId, Toggles } from '../src/sim/worlds/distribusi/engine/config.ts'
import { computeAll, formatDays, formatM3, formatNumber, formatPct, formatRp, formatRpShort, toggleKey } from '../src/sim/worlds/distribusi/engine/index.ts'
import { hashJson } from '../src/sim/core/rng.ts'

const PIDS: PrincipalId[] = ['A', 'B', 'C', 'D', 'E', 'F']
const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const head = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s)

function report(toggles: Toggles, title: string): string {
  const { world, alloc } = computeAll(toggles)
  const lines: string[] = []
  lines.push(`## ${title}`)
  lines.push(`toggles: ${toggleKey(toggles)}`)
  lines.push('')
  const cols: [string, (p: PrincipalId) => string][] = [
    ['palet in', (p) => head(formatNumber(alloc.principal[p].palletsIn), 8)],
    ['palet out', (p) => head(formatNumber(alloc.principal[p].palletsOut), 9)],
    ['karton out', (p) => head(formatNumber(alloc.principal[p].cartonsOut), 10)],
    ['palet-hari', (p) => head(formatNumber(alloc.principal[p].palletDays), 10)],
    ['m³', (p) => head(formatM3(alloc.principal[p].m3Delivered), 9)],
    ['bagian m³', (p) => head(formatPct(alloc.principal[p].measureDelivered / PIDS.reduce((s, x) => s + alloc.principal[x].measureDelivered, 0)), 9)],
    ['PO', (p) => head(formatNumber(alloc.principal[p].pos), 4)],
    ['inv. dibuat', (p) => head(formatNumber(alloc.principal[p].invoicesGen), 8)],
    ['inv. dikirim', (p) => head(formatNumber(alloc.principal[p].invoicesSent), 8)],
    ['pendapatan', (p) => head(formatRpShort(alloc.principal[p].revenue), 12)],
    ['laba kotor', (p) => head(formatRpShort(alloc.principal[p].grossProfit), 12)],
  ]
  lines.push(pad('prinsipal', 10) + cols.map(([c]) => head(c, c.length + 1)).join(''))
  for (const p of PIDS) lines.push(pad(p, 10) + cols.map(([, f]) => f(p)).join(' '))
  lines.push('')

  lines.push('| pool | total | dialokasi | tidak dialokasi | mode | tarif per driver |')
  lines.push('|---|---:|---:|---:|---|---:|')
  for (const pool of alloc.pools) {
    lines.push(`| ${pool.def.team} | ${formatRp(pool.total)} | ${formatRp(pool.allocatedTotal)} | ${formatRp(pool.unallocated)} | ${pool.mode} | ${pool.mode === 'driver' ? formatRp(pool.rate, 1) + ` / ${pool.def.unit}` : '—'} |`)
  }
  lines.push('')

  lines.push('| prinsipal | pool PO | inbound | WMS | gudang | packing | AR | pajak | admin khusus | truk | modal kas | modal persediaan | biaya total | laba kotor | kontribusi | biaya/m³ | hari kas |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const p of PIDS) {
    const r = alloc.principal[p]
    const row = [
      r.poolCost.salesAdminShared, r.poolCost.inbound, r.poolCost.wms, r.poolCost.gudang, r.poolCost.packing,
      r.poolCost.arFinance, r.poolCost.tax, r.dedicatedAdmin, r.tripCost, r.capitalCash, r.capitalStock,
      r.grossProfit - r.contribution, r.grossProfit, r.contribution,
    ]
    lines.push(`| ${p} | ${row.map((x) => formatRpShort(x)).join(' | ')} | ${formatRpShort(r.costPerM3)} | ${formatDays(r.cashDays)} |`)
  }
  lines.push('')
  lines.push(`Tidak dialokasi: komersial ${formatRp(alloc.unallocated.komersial)}; pajak (G&A) ${formatRp(alloc.unallocated.taxGa)}; kapasitas truk tak terpakai ${formatRp(alloc.unallocated.truckCapacity)} — total ${formatRp(alloc.unallocated.total)}`)
  lines.push(`Total: pendapatan ${formatRp(alloc.totals.revenue)}; laba kotor ${formatRp(alloc.totals.grossProfit)}; biaya ${formatRp(alloc.totals.costs)}; dialokasi ${formatRp(alloc.totals.allocated)}`)
  lines.push(`Dataset hash: ${hashJson(world)}; PO ${world.pos.length}; DO ${world.dos.length}; trip ${world.trips.length}; invoice dibuat ${world.invoicesGen.length}; dikirim ${world.invoicesSent.length}`)
  lines.push('')
  return lines.join('\n')
}

const flips: [string, Toggles][] = [
  ['volumeMeasure', { ...DEFAULT_TOGGLES, volumeMeasure: 'chargeable' }],
  ['truckBasis', { ...DEFAULT_TOGGLES, truckBasis: 'capacity' }],
  ['palletRule', { ...DEFAULT_TOGGLES, palletRule: 'tall' }],
  ['outboundDriver', { ...DEFAULT_TOGGLES, outboundDriver: 'cartons' }],
  ['taxAllocation', { ...DEFAULT_TOGGLES, taxAllocation: 'ga' }],
  ['stockCapital', { ...DEFAULT_TOGGLES, stockCapital: true }],
  ['costOfCapital', { ...DEFAULT_TOGGLES, costOfCapital: 0.2 }],
]

function world1Report(): string {
  let out = report(DEFAULT_TOGGLES, 'World 1 Distribusi — default (m³ termuat, CBM murni, palet muatan 1,0 m, palet keluar, pajak dialokasikan, modal 12%)')
  for (const [key, t] of flips) out += '\n' + report(t, `World 1 flip: ${key}`)
  return out
}

type W2Index = typeof import('../src/sim/worlds/b2b-b2c/engine/index.ts')

interface W2 {
  computeAll2: W2Index['computeAll2']
  DEFAULT_TOGGLES: W2Index['DEFAULT_TOGGLES']
  toggleKey2: W2Index['toggleKey2']
}

function world2Report(w2: W2): string {
  const PLATFORMS = ['MP-A', 'MP-B', 'MP-C', 'MP-D', 'MP-E', 'WEB'] as const
  const money = (x: number): string => formatNumber(Math.round(x))
  const lines: string[] = []
  const blocks: [string, ReturnType<W2['computeAll2']>][] = [
    ['World 2 Gudang B2B+B2C — default (gudang bersama porsi volume keluar, tim outbound bersama, ongkir konsumen, modal 12%)', w2.computeAll2(w2.DEFAULT_TOGGLES)],
    ['World 2 flip: biaya gudang bersama tidak dibagi', w2.computeAll2({ ...w2.DEFAULT_TOGGLES, sharedSplit: 'none' })],
    ['World 2 flip: tim outbound terpisah', w2.computeAll2({ ...w2.DEFAULT_TOGGLES, sharedTeams: false })],
    ['World 2 flip: ongkir ditanggung penjual', w2.computeAll2({ ...w2.DEFAULT_TOGGLES, shippingBearer: 'penjual' })],
    ['World 2 flip: modal di persediaan', w2.computeAll2({ ...w2.DEFAULT_TOGGLES, stockCapital: true })],
    ['World 2 flip: biaya modal 20%', w2.computeAll2({ ...w2.DEFAULT_TOGGLES, costOfCapital: 0.2 })],
  ]
  for (const [title, { world, alloc }] of blocks) {
    lines.push(`## ${title}`)
    lines.push(`toggles: ${w2.toggleKey2(alloc.toggles)}`)
    lines.push('')
    lines.push('| pool | total | B2B | B2C | tidak dibagi |')
    lines.push('|---|---:|---:|---:|---:|')
    for (const pool of alloc.pools) {
      lines.push(`| ${pool.team} | ${formatRpShort(pool.total)} | ${formatRpShort(pool.b2b)} | ${formatRpShort(pool.b2c)} | ${formatRpShort(pool.unallocated)} |`)
    }
    lines.push('')
    lines.push('| prinsipal | kontribusi B2B | kontribusi B2C | pendapatan B2B | pendapatan B2C | HPP B2C |')
    lines.push('|---|---:|---:|---:|---:|---:|')
    for (const p of PIDS) {
      const r = alloc.principalChannel[p]
      lines.push(`| ${p} | ${formatRpShort(r.b2b)} | ${formatRpShort(r.b2c)} | ${formatRpShort(r.revenueB2b)} | ${formatRpShort(r.revenueB2c)} | ${formatRpShort(r.cogsB2c)} |`)
    }
    lines.push('')
    lines.push('| platform | order | GMV | HPP | fee | voucher | ongkir penjual | kemasan | retur | CS | shop | outbound+ISD | gudang bersama | modal | dana cair | kontribusi |')
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
    for (const pf of PLATFORMS) {
      const v = alloc.platform[pf]
      lines.push(`| ${pf} | ${v.orders} | ${formatRpShort(v.gmv)} | ${formatRpShort(v.cogs)} | ${formatRpShort(v.fee)} | ${formatRpShort(v.voucher)} | ${formatRpShort(v.sellerShipping)} | ${formatRpShort(v.packaging)} | ${formatRpShort(v.returnCost)} | ${formatRpShort(v.cs)} | ${formatRpShort(v.shop)} | ${formatRpShort(v.outbound)} | ${formatRpShort(v.shared)} | ${formatRpShort(v.capital)} | ${formatRpShort(v.netSettlement)} | ${formatRpShort(v.contribution)} |`)
    }
    lines.push('')
    lines.push('| prioritas | order | biaya layanan/order | HPP/order | pendapatan/order | kontribusi/order |')
    lines.push('|---|---:|---:|---:|---:|---:|')
    for (const pr of alloc.priority) {
      lines.push(`| ${pr.priority} | ${pr.orders} | ${money(pr.avgCost)} | ${money(pr.avgCogs)} | ${money(pr.avgRevenue)} | ${money(pr.avgContribution)} |`)
    }
    lines.push('')
    lines.push(`Harga kecepatan: ISD ${formatRpShort(alloc.isd.perOrder)}/order P0+P1 (${alloc.isd.p0p1Orders} order); P2 tanpa ISD. Menit reguler: B2B ${Math.round(alloc.outbound.b2bMinutes)} vs B2C ${Math.round(alloc.outbound.b2cMinutes)}.`)
    lines.push(`Total: order B2C ${world.orders.filter((o) => o.shipDay <= world.days).length}; DO B2B ${world.b2b.dos.length}; modal B2C ${formatRpShort(alloc.capitalB2c)}.`)
    lines.push('')
  }
  return lines.join('\n')
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--world')
  const world = flag >= 0 ? process.argv[flag + 1] : undefined
  if (world === 'b2b-b2c') {
    const w2 = (await import('../src/sim/worlds/b2b-b2c/engine/index.ts')) as unknown as W2
    console.log(world2Report(w2))
  } else {
    console.log(world1Report())
  }
}

await main()
