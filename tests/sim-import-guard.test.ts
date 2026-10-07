// Control 11 (brief §6): the feature must not touch the database — no supabase client,
// no seed data imports anywhere under src/sim/.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const FORBIDDEN = [/src\/lib\/supabase/, /src\/data\//]

describe('control 11 — import guard', () => {
  it('no file under src/sim imports the database client or seed data', () => {
    const files = walk(join(import.meta.dirname, '..', 'src', 'sim'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const bad of FORBIDDEN) {
        expect(src.match(new RegExp(`from ['"].*${bad.source}`, 'g')), `${file} imports ${bad}`).toBeNull()
      }
    }
  })
})
