// Loads every table the signed-in user may read (RLS decides which rows), keeps it live with
// Supabase Realtime, and exposes the domain built over it. Realtime events only trigger
// refetches; their payloads are never used, so all data reaches the UI through RLS-filtered reads.
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createDomain } from '../domain/index.ts'
import type { Viewer } from '../domain/index.ts'
import type { Supa } from '../lib/supabase.ts'
import { makeActions } from './actions.ts'
import { BoardCtx, useToday } from './board-context.ts'
import type { BoardState } from './board-context.ts'
import { BOARD_TABLES, toBoard } from './adapter.ts'
import type { BoardRows, BoardTable } from './adapter.ts'

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
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
}

async function fetchAll(supa: Supa, table: BoardTable): Promise<unknown[]> {
  const out: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    let q = (supa.from(table) as unknown as { select: (c: string) => Page }).select('*')
    for (const col of ORDER[table]) q = q.order(col)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

/** Fallback e-mail/calendar link before the owner sets org_settings.app_url. */
const defaultAppUrl = () => (typeof window !== 'undefined' ? window.location.origin : '')

export function BoardProvider({ supa, viewer, children, loading }: { supa: Supa; viewer: Viewer; children: ReactNode; loading: ReactNode }) {
  const qc = useQueryClient()
  const today = useToday()
  const results = useQueries({
    queries: BOARD_TABLES.map((t) => ({ queryKey: ['t', t, viewer.userId], queryFn: () => fetchAll(supa, t), staleTime: 30_000 })),
  })

  // Realtime: any change on a published table refetches that table (debounced).
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const bump = (table: string) => {
      clearTimeout(timers.get(table))
      timers.set(table, setTimeout(() => void qc.invalidateQueries({ queryKey: ['t', table] }), 250))
    }
    const channel = supa
      .channel('board')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => bump(payload.table))
      .subscribe()
    return () => {
      timers.forEach(clearTimeout)
      void supa.removeChannel(channel)
    }
  }, [supa, qc])

  const ready = results.every((r) => r.isSuccess)
  const failed = results.find((r) => r.isError)
  const dataKey = results.map((r) => r.dataUpdatedAt).join(',')

  const value = useMemo<BoardState | null>(() => {
    if (!ready) return null
    const rows = Object.fromEntries(BOARD_TABLES.map((t, i) => [t, results[i]?.data ?? []])) as unknown as BoardRows
    const { board, extras } = toBoard(rows)
    const appUrl = extras.appUrl || defaultAppUrl()
    const d = createDomain(board, { today, appUrl, viewer })
    const actions = makeActions(supa)
    return {
      d,
      board,
      extras: { ...extras, appUrl },
      viewer,
      today,
      actions,
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ['t'] })
      },
      refreshTable: async (t: BoardTable) => {
        await qc.invalidateQueries({ queryKey: ['t', t] })
      },
    }
    // results are tracked through dataKey; listing them would rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dataKey, today, viewer, supa, qc])

  if (failed) throw failed.error
  if (!value) return loading
  return <BoardCtx value={value}>{children}</BoardCtx>
}
