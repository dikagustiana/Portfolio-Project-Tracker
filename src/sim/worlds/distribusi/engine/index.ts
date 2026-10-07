// Facade over the engine: generate the world once, then allocate per toggle state, both
// memoised (brief §5 "computed once per toggle state"). The UI and the report script go
// through here so nothing recomputes on every frame.

import { DEFAULT_TOGGLES, SEED } from './config.ts'
import type { Toggles } from './config.ts'
import { allocate } from './cost.ts'
import type { Allocations } from './cost.ts'
import { buildEvents } from './events.ts'
import type { EventLog } from './events.ts'
import { generateWorld } from './generate.ts'
import type { World } from './types.ts'

export * from './config.ts'
export * from './cost.ts'
export * from './events.ts'
export * from '../../../core/format.ts'
export * from './generate.ts'
export * from '../../../core/rng.ts'
export * from '../../../core/trace.ts'
export * from './types.ts'

export interface Computed {
  world: World
  alloc: Allocations
  events: EventLog
}

let worldCache: World | undefined

export function getWorld(): World {
  if (!worldCache) worldCache = generateWorld(SEED)
  return worldCache
}

const computeCache = new Map<string, Computed>()

/** Canonical key of a toggle state — the memo key, and how toggles identify themselves in reports. */
export function toggleKey(t: Toggles): string {
  return [t.volumeMeasure, t.truckBasis, t.palletRule, t.outboundDriver, t.taxAllocation, t.stockCapital ? 'stockOn' : 'stockOff', `wacc${t.costOfCapital.toFixed(4)}`].join('|')
}

export function computeAll(toggles: Toggles = DEFAULT_TOGGLES): Computed {
  const key = toggleKey(toggles)
  const hit = computeCache.get(key)
  if (hit) return hit
  const world = getWorld()
  const alloc = allocate(world, toggles)
  const events = buildEvents(world, alloc)
  const computed = { world, alloc, events }
  computeCache.set(key, computed)
  return computed
}
