// Control 8 (Brief 2 §6): world 1's numbers are identical before and after the world-2
// refactor. The golden fixture was frozen on the pre-refactor branch with
// `npx tsx scripts/sim-golden.ts`; this test diffs the dataset hash and the full report
// (at defaults and with each toggle flipped) against it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashJson } from '../src/sim/core/rng.ts'
import { DEFAULT_TOGGLES } from '../src/sim/worlds/distribusi/engine/config.ts'
import type { Toggles } from '../src/sim/worlds/distribusi/engine/config.ts'
import { computeAll, toggleKey } from '../src/sim/worlds/distribusi/engine/index.ts'

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

const golden = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'sim-world1-golden.json'), 'utf8')) as {
  datasetHash: string
  blocks: Record<string, string>
}

describe('control 8 — world 1 unchanged by the world-2 refactor', () => {
  it('dataset hash matches the frozen golden', () => {
    expect(hashJson(computeAll(DEFAULT_TOGGLES).world)).toBe(golden.datasetHash)
  })

  for (const [name] of Object.entries(golden.blocks)) {
    it(`report block "${name}" is byte-identical`, () => {
      const toggles: Toggles =
        name === 'default'
          ? DEFAULT_TOGGLES
          : name === 'chargeable'
            ? { ...DEFAULT_TOGGLES, volumeMeasure: 'chargeable' }
            : name === 'capacity'
              ? { ...DEFAULT_TOGGLES, truckBasis: 'capacity' }
              : name === 'tall'
                ? { ...DEFAULT_TOGGLES, palletRule: 'tall' }
                : name === 'cartons'
                  ? { ...DEFAULT_TOGGLES, outboundDriver: 'cartons' }
                  : name === 'ga'
                    ? { ...DEFAULT_TOGGLES, taxAllocation: 'ga' }
                    : name === 'stock'
                      ? { ...DEFAULT_TOGGLES, stockCapital: true }
                      : { ...DEFAULT_TOGGLES, costOfCapital: 0.2 }
      expect(reportBlock(toggles)).toBe(golden.blocks[name])
    })
  }
})
