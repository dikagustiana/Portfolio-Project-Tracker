// End-to-end parity (BRIEF §7, §9): the seed import, read back from Postgres and converted by the
// client's adapter, must reproduce the prototype's golden output exactly. The prototype had no
// sub-tasks, so the comparison uses the exported board (top-level tasks and their own
// finish-to-start links); the structure the extraction derives from it is checked separately.
// Runs against a local Supabase database (SUPABASE_DB_URL); skipped when none is configured.
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

/** The imported board as the client would load it, with prototype ids in place of UUIDs. */
function loadSeedBoard(): BoardRows {
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
  return JSON.parse(JSON.stringify(rows).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => legacy.get(u) ?? u)) as BoardRows
}

describe.skipIf(!DB)('seed import read back through the adapter', () => {
  it('reproduces the golden file exactly for the exported board', () => {
    const all = loadSeedBoard()
    // The exported board: no sub-tasks, no derived prerequisites or Keputusan links.
    const tasks = all.tasks.filter((t) => !t.parent_task_id)
    const top = new Set(tasks.map((t) => t.id))
    const mapped: BoardRows = {
      ...all,
      tasks: tasks.map((t) => ({ ...t, owner_function_id: null })),
      task_deps: all.task_deps.filter((x) => x.kind === 'start' && top.has(x.task_id) && top.has(x.depends_on_task_id)),
      ask_tasks: [],
    }

    const golden = readJson<Parameters<typeof goldenSnapshot>[1] & Record<string, unknown>>('reference/golden/prototype-golden.json')
    const { board } = toBoard(mapped)
    const d = createDomain(board, { today: golden.today, appUrl: PROTOTYPE_URL, viewer: null })
    const snap = goldenSnapshot(d, golden)
    for (const k of Object.keys(snap) as (keyof typeof snap)[]) expect(snap[k], k).toEqual(golden[k])
  })

  it('carries the structure derived from the descriptions: packages, sub-tasks, typed prerequisites', () => {
    const { board } = toBoard(loadSeedBoard())
    const d = createDomain(board, { today: '2026-10-07', appUrl: PROTOTYPE_URL, viewer: null })
    const mb05 = d.task('MB05')
    expect(mb05 && d.children(mb05.id).map((c) => c.ref)).toEqual(['MB05.1', 'MB05.2', 'MB05.3'])
    expect(mb05?.acceptDeps).toEqual(['MB01', 'MB02'])
    // Progress counts leaves: 59 exported tasks, packages replaced by their 120 sub-tasks.
    const packages = board.tasks.filter((t) => d.hasChildren(t)).length
    expect(board.tasks.length).toBe(179)
    expect(d.prog(board.projects[0]?.id ?? '').n).toBe(179 - packages)
    // Sub-tasks stay inside their package's milestone and carry the inchstone's function.
    for (const c of board.tasks.filter((t) => t.parentId)) expect(c.milestoneId).toBe(d.task(c.parentId)?.milestoneId)
    expect(board.tasks.filter((t) => t.parentId && t.ownerFunctionId).length).toBeGreaterThan(100)
    expect(board.asks.reduce((n, a) => n + a.taskIds.length, 0)).toBe(9)
  })
})
