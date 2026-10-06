// BRIEF §2.4: the client never holds the service-role key. Anything under src/ ships to the
// browser, and every VITE_ variable is inlined into the bundle.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  )

describe('client bundle sources', () => {
  it('never reference a service-role key', () => {
    // The env var name, the JWT role claim, or a secret-format API key.
    const leak = /SERVICE_ROLE|service_role|sb_secret_/
    const offenders = filesUnder(join(root, 'src')).filter((f) => leak.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('.env.example exposes no secret through a VITE_ variable', () => {
    const viteVars = readFileSync(join(root, '.env.example'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('VITE_'))
      .map((l) => l.split('=')[0])
    expect(viteVars.filter((v) => /SERVICE|SECRET|PASSWORD|JWT/i.test(v ?? ''))).toEqual([])
  })
})
