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
  decisions: ['id'],
  reminders: ['id'],
  holidays: ['date'],
  step_templates: ['id'],
  template_steps: ['id'],
  org_settings: ['id'],
  entities: ['code'],
  user_calendar: ['task_id'],
  app_roles: ['user_id', 'role'],
  email_log: ['run_date', 'id'],
}

interface Page {
  order: (col: string) => Page
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

/** The slice of a Supabase client this needs (structural, so the Deno Edge Function can pass its own). */
export interface TableSource {
  from: (table: string) => { select: (columns: string) => Page }
}

/** Every row of a table the client may read, paged past PostgREST's row limit. */
export async function fetchAll(supa: TableSource, table: BoardTable): Promise<unknown[]> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supa.from(table).select('*')
    for (const col of ORDER[table]) q = q.order(col)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

