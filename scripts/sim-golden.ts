// Dev script: freeze world 1's dataset hash and full report into the golden fixture that
// the control-8 test diffs against after the world-2 refactor. Run:
//   npx tsx scripts/sim-golden.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { DEFAULT_TOGGLES } from '../src/sim/engine/config.ts'
import type { Toggles } from '../src/sim/engine/config.ts'
import { computeAll, toggleKey } from '../src/sim/engine/index.ts'
import { hashJson } from '../src/sim/engine/rng.ts'

const PIDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const money = (x: number): string => Math.round(x).toString()

function reportBlock(toggles: Toggles): string {
  const { world, alloc } = computeAll(toggles)
  const lines: string[] = []
  lines.push(`toggles=${toggleKey(toggles)}`)
  for (const p of PIDS) {
    const r = alloc.principal[p]
    lines.push([
      p, money(r.palletsIn), money(r.palletsOut), money(r.cartonsOut), money(r.palletDays),
      r.m3Delivered.toFixed(4), r.pos, r.invoicesGen, r.invoicesSent, money(r.revenue), money(r.grossProfit),
      money(r.contribution), r.cashDays.toFixed(4), r.costPerM3.toFixed(4),
    ].join('|'))
  }
  for (const pool of alloc.pools) {
    lines.push(['pool', pool.def.id, money(pool.total), money(pool.allocatedTotal), money(pool.unallocated), pool.rate.toFixed(4)].join('|'))
  }
  lines.push(['totals', money(alloc.totals.revenue), money(alloc.totals.grossProfit), money(alloc.totals.costs), money(alloc.totals.allocated), money(alloc.unallocated.total)].join('|'))
  lines.push(`hash=${hashJson(world)}`)
  return lines.join('\n')
}

const out = {
  datasetHash: hashJson(computeAll(DEFAULT_TOGGLES).world),
  blocks: {
    default: reportBlock(DEFAULT_TOGGLES),
    chargeable: reportBlock({ ...DEFAULT_TOGGLES, volumeMeasure: 'chargeable' }),
    capacity: reportBlock({ ...DEFAULT_TOGGLES, truckBasis: 'capacity' }),
    tall: reportBlock({ ...DEFAULT_TOGGLES, palletRule: 'tall' }),
    cartons: reportBlock({ ...DEFAULT_TOGGLES, outboundDriver: 'cartons' }),
    ga: reportBlock({ ...DEFAULT_TOGGLES, taxAllocation: 'ga' }),
    stock: reportBlock({ ...DEFAULT_TOGGLES, stockCapital: true }),
    wacc20: reportBlock({ ...DEFAULT_TOGGLES, costOfCapital: 0.2 }),
  },
}
mkdirSync('tests/fixtures', { recursive: true })
writeFileSync('tests/fixtures/sim-world1-golden.json', JSON.stringify(out, null, 2) + '\n')
console.log('golden written; dataset hash', out.datasetHash)
