// Table loading shared by the browser (BoardProvider) and the daily-digest Edge Function.
import type { BoardTable } from './adapter.ts'

const PAGE = 1000

/** Stable sort keys so paging never skips or repeats a row. */
const ORDER: Record<BoardTable, string[]> = {
  projects: ['id'],
  project_members: ['project_id', 'person_id'],
  people: ['id'],
  people_contact: ['person_id'],
  milestones: ['id'],
  tasks: ['id'],
  task_deps: ['task_id', 'depends_on_task_id'],
  task_steps: ['task_id', 'template_step_id'],
  asks: ['id'],
  ask_tasks: ['ask_id', 'task_id'],
  decisions: ['id'],
  reminders: ['id'],
  holidays: ['date'],
  step_templates: ['id'],
  template_steps: ['id'],
  org_settings: ['id'],
  entities: ['code'],
  functions: ['id'],
  task_blockers: ['id'],
  task_reviews: ['id'],
  task_commitments: ['seq'],
  comments: ['id'],
  project_events: ['id'],
  invitations: ['id'],
  invitation_projects: ['invitation_id', 'project_id'],
  migration_flags: ['id'],
  profiles: ['user_id'],
  user_calendar: ['task_id'],
  email_log: ['run_date', 'id'],
}

/**
 * The event feed grows without bound; the client keeps the most recent rows (newest first) and
 * everything older stays queryable in the database. Whole-board loading is fine at today's scale
 * (ARCHITECTURE §H); the views already sit behind domain functions so they can move server-side.
 */
const RECENT: Partial<Record<BoardTable, number>> = { project_events: 5000 }

interface Page {
  order: (col: string, opts?: { ascending?: boolean }) => Page
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

/** The slice of a Supabase client this needs (structural, so the Deno Edge Function can pass its own). */
export interface TableSource {
  from: (table: string) => { select: (columns: string) => Page }
}

/** Every row of a table the client may read, paged past PostgREST's row limit. */
export async function fetchAll(supa: TableSource, table: BoardTable): Promise<unknown[]> {
  const out: unknown[] = []
  const cap = RECENT[table]
  for (let from = 0; ; from += PAGE) {
    let q = supa.from(table).select('*')
    for (const col of ORDER[table]) q = q.order(col, { ascending: cap === undefined })
    const to = cap === undefined ? from + PAGE - 1 : Math.min(from + PAGE, cap) - 1
    const { data, error } = await q.range(from, to)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < to - from + 1 || (cap !== undefined && out.length >= cap)) return out
  }
}
