// World 2 facade: generate once, allocate per toggle state, memoised (brief 1 §5 pattern).

import { DEFAULT_TOGGLES, SEED } from './config.ts'
import type { Toggles2 } from './config.ts'
import { allocate2 } from './cost.ts'
import type { Allocations2 } from './cost.ts'
import { generateWorld2 } from './generate.ts'
import type { World2 } from './types.ts'

export * from './config.ts'
export * from './cost.ts'
export * from './generate.ts'
export * from './types.ts'

export interface Computed2 {
  world: World2
  alloc: Allocations2
}

let worldCache: World2 | undefined

export function getWorld2(): World2 {
  if (!worldCache) worldCache = generateWorld2(SEED)
  return worldCache
}

const cache = new Map<string, Computed2>()

export function toggleKey2(t: Toggles2): string {
  return [t.sharedSplit, t.sharedTeams ? 'teamsShared' : 'teamsSeparate', `ship-${t.shippingBearer}`, t.stockCapital ? 'stockOn' : 'stockOff', `wacc${t.costOfCapital.toFixed(4)}`].join('|')
}

export function computeAll2(toggles: Toggles2 = DEFAULT_TOGGLES): Computed2 {
  const key = toggleKey2(toggles)
  const hit = cache.get(key)
  if (hit) return hit
  const world = getWorld2()
  const alloc = allocate2(world, toggles)
  const computed = { world, alloc }
  cache.set(key, computed)
  return computed
}
