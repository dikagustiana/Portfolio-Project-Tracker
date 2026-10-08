// A scenario in the URL (Brief B6 §2.2): #/simulasi/<world>/skenario?s=<encoded>, where the
// encoded value is base64url JSON { v: 1, w: world, h: engine data hash, i: inputs, a: assumptions }.
// A link whose hash differs from the engine's current data still opens, with a notice.
import type { WorldId } from '../yard/types.ts'
import type { Assumptions } from './types.ts'

export const SCENARIO_VERSION = 1

export interface Saved {
  v: number
  w: WorldId
  h: string
  i: Record<string, unknown>
  a: Assumptions
}

const toB64url = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s: string): string => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** key order fixed, so one scenario always encodes to one string */
const sorted = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))

export function encodeScenario(world: WorldId, hash: string, inputs: object, asm: Assumptions): string {
  const saved: Saved = { v: SCENARIO_VERSION, w: world, h: hash, i: sorted(inputs as Record<string, unknown>), a: sorted(asm) as Assumptions }
  return toB64url(JSON.stringify(saved))
}

export type Decoded = { ok: true; saved: Saved } | { ok: false; error: string }

export function decodeScenario(s: string): Decoded {
  let raw: unknown
  try {
    raw = JSON.parse(fromB64url(s))
  } catch {
    return { ok: false, error: 'Link skenario tidak terbaca' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Link skenario tidak terbaca' }
  const o = raw as Partial<Saved>
  if (o.v !== SCENARIO_VERSION) return { ok: false, error: `Versi skenario ${String(o.v)} tidak dikenal (versi ini ${SCENARIO_VERSION})` }
  if (typeof o.w !== 'string' || typeof o.h !== 'string' || !o.i || typeof o.i !== 'object') return { ok: false, error: 'Link skenario tidak lengkap' }
  const a: Assumptions = {}
  for (const [k, v] of Object.entries(o.a ?? {})) if (typeof v === 'number' && Number.isFinite(v)) a[k] = v
  return { ok: true, saved: { v: o.v, w: o.w, h: o.h, i: o.i, a } }
}

/** the route of a saved scenario */
export const scenarioHash = (world: WorldId, encoded: string): string => `#/simulasi/${world}/skenario?s=${encoded}`
