// Seeded randomness for the dummy world (brief §5): mulberry32 PRNG plus an FNV-1a hash
// used as the dataset hash in the determinism control. All generator randomness goes
// through one seeded instance, so one seed reproduces the whole month bit for bit.

export interface Rng {
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
  }
}

/** 32-bit FNV-1a as 8 hex digits. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Stable hash of a JSON-serialisable value; keys are sorted so field order never matters. */
export function hashJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      return Object.keys(o)
        .sort()
        .map((k) => [k, walk(o[k])])
    }
    return v
  }
  return fnv1a(JSON.stringify(walk(value)))
}
