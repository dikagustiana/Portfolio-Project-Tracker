// sim-report (brief §9 M1): prints the dummy month per principal at the default toggle
// state, and with each toggle flipped one at a time. Run: npx tsx scripts/sim-report.ts
// (Node 22+ strips types natively with --experimental-strip-types; plain `node` works too.)
import { DEFAULT_TOGGLES } from '../src/sim/worlds/distribusi/engine/config.ts'
import type { PrincipalId, Toggles } from '../src/sim/worlds/distribusi/engine/config.ts'
import { computeAll, formatDays, formatM3, formatNumber, formatPct, formatRp, formatRpShort } from '../src/sim/worlds/distribusi/engine/index.ts'
import { toggleKey } from '../src/sim/worlds/distribusi/engine/index.ts'
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

const flips: [keyof Toggles, Toggles][] = [
  ['volumeMeasure', { ...DEFAULT_TOGGLES, volumeMeasure: 'chargeable' }],
  ['truckBasis', { ...DEFAULT_TOGGLES, truckBasis: 'capacity' }],
  ['palletRule', { ...DEFAULT_TOGGLES, palletRule: 'tall' }],
  ['outboundDriver', { ...DEFAULT_TOGGLES, outboundDriver: 'cartons' }],
  ['taxAllocation', { ...DEFAULT_TOGGLES, taxAllocation: 'ga' }],
  ['stockCapital', { ...DEFAULT_TOGGLES, stockCapital: true }],
  ['costOfCapital', { ...DEFAULT_TOGGLES, costOfCapital: 0.2 }],
]

let out = report(DEFAULT_TOGGLES, 'Default (m³ termuat, CBM murni, palet 1,1×1,2 m tinggi 1,0 m, palet keluar, pajak dialokasikan, modal 12%)')
for (const [key, t] of flips) out += '\n' + report(t, `Flip: ${key}`)
console.log(out)
