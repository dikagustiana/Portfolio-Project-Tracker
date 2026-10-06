// End-to-end parity (BRIEF §7, §9): the seed import, read back from Postgres and converted by the
// client's adapter, must reproduce the prototype's golden output exactly. Runs against a local
// Supabase database (SUPABASE_DB_URL); skipped when none is configured.
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { BOARD_TABLES, toBoard } from '../../src/data/adapter.ts'
import type { BoardRows } from '../../src/data/adapter.ts'
import { createDomain } from '../../src/domain/index.ts'
import { buildImportSql, readSeed } from '../../scripts/import-seed.ts'
import { PROTOTYPE_URL, readJson } from '../fixtures/prototype-board.ts'
import { goldenSnapshot } from '../fixtures/golden-snapshot.ts'

const DB = process.env.SUPABASE_DB_URL

function psql(sql: string): string {
  const r = spawnSync('psql', [DB ?? '', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stdout
}

describe.skipIf(!DB)('seed import read back through the adapter', () => {
  it('reproduces the golden file exactly', () => {
    psql(buildImportSql(readSeed()))

    // Every table as the client would load it (as a superuser here: this checks the data path,
    // RLS has its own suite). Contacts are left out because the export had no e-mail addresses.
    const rows = Object.fromEntries(
      BOARD_TABLES.map((t) => [t, t === 'people_contact' ? [] : (JSON.parse(psql(`select coalesce(json_agg(x), '[]') from public.${t} x;`)) as unknown[])]),
    ) as unknown as BoardRows

    // Only the imported board: other suites may add their own projects and people meanwhile.
    const seedProjects = new Set((rows.projects as { id: string; legacy_id: string | null }[]).filter((p) => p.legacy_id).map((p) => p.id))
    const inSeed = (r: { project_id?: string }) => !r.project_id || seedProjects.has(r.project_id)
    for (const t of BOARD_TABLES) (rows as Record<string, { project_id?: string }[]>)[t] = (rows[t] as { project_id?: string }[]).filter(inSeed)
    rows.projects = rows.projects.filter((p) => seedProjects.has(p.id))
    rows.people = rows.people.filter((p) => p.legacy_id)

    // Swap UUIDs for the prototype ids so results compare with the golden file directly.
    const legacy = new Map<string, string>()
    for (const t of ['people', 'projects', 'milestones', 'tasks', 'asks'] as const)
      for (const r of rows[t] as { id: string; legacy_id: string | null }[]) if (r.legacy_id) legacy.set(r.id, r.legacy_id)
    const mapped = JSON.parse(JSON.stringify(rows).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => legacy.get(u) ?? u)) as BoardRows

    const golden = readJson<Parameters<typeof goldenSnapshot>[1] & Record<string, unknown>>('reference/golden/prototype-golden.json')
    const { board } = toBoard(mapped)
    const d = createDomain(board, { today: golden.today, appUrl: PROTOTYPE_URL, viewer: null })
    const snap = goldenSnapshot(d, golden)
    for (const k of Object.keys(snap) as (keyof typeof snap)[]) expect(snap[k], k).toEqual(golden[k])
  })
})
