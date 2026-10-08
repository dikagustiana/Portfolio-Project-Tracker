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
import { BOARD_TABLES, CORE_TABLES, toBoard } from './adapter.ts'
import type { BoardRows, BoardTable } from './adapter.ts'
import { fetchAll } from './fetch.ts'

/** Tables the board cannot be built without; a failure on any other table degrades the board instead. */
const CORE: ReadonlySet<string> = new Set<string>(CORE_TABLES)

/** Fallback e-mail/calendar link before the owner sets org_settings.app_url. */
const defaultAppUrl = () => (typeof window !== 'undefined' ? window.location.origin : '')

export function BoardProvider({ supa, viewer, children, loading }: { supa: Supa; viewer: Viewer; children: ReactNode; loading: ReactNode }) {
  const qc = useQueryClient()
  const today = useToday()
  const results = useQueries({
    // The system role is part of the key: when it changes, every table is read again under the new rights.
    queries: BOARD_TABLES.map((t) => ({
      queryKey: ['t', t, viewer.userId, viewer.isSuperAdmin],
      queryFn: () => fetchAll(supa, t),
      staleTime: 30_000,
    })),
  })

  // Realtime: any change on a published table refetches that table (debounced).
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    // A membership change changes which projects are readable at all: refetch everything.
    const SCOPE = new Set(['project_members'])
    const bump = (table: string) => {
      const key = SCOPE.has(table) ? '*' : table
      clearTimeout(timers.get(key))
      timers.set(key, setTimeout(() => void qc.invalidateQueries({ queryKey: key === '*' ? ['t'] : ['t', table] }), 250))
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

  // A core table that fails takes the whole board down (there is nothing sensible to show). A table
  // outside the core (history, invitations, admin notes, per-user extras) that fails only empties its
  // slice and is reported, so one missing or stale table never blanks the app for everyone.
  const failed = results.find((r, i) => r.isError && CORE.has(BOARD_TABLES[i] ?? ''))
  const ready = results.every((r, i) => r.isSuccess || (r.isError && !CORE.has(BOARD_TABLES[i] ?? '')))
  const degradedKey = results.map((r, i) => (r.isError ? BOARD_TABLES[i] : '')).join(',')
  const dataKey = results.map((r) => r.dataUpdatedAt).join(',')

  const value = useMemo<BoardState | null>(() => {
    if (!ready) return null
    // A degraded table is empty, not stale: TanStack keeps the last good rows next to isError.
    const rows = Object.fromEntries(BOARD_TABLES.map((t, i) => [t, results[i]?.isError ? [] : (results[i]?.data ?? [])])) as unknown as BoardRows
    const degraded = BOARD_TABLES.filter((_, i) => results[i]?.isError)
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
      degraded,
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ['t'] })
      },
      refreshTable: async (t: BoardTable) => {
        await qc.invalidateQueries({ queryKey: ['t', t] })
      },
    }
    // results are tracked through dataKey and degradedKey; listing them would rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dataKey, degradedKey, today, viewer, supa, qc])

  if (failed?.error) throw failed.error
  if (!value) return loading
  return <BoardCtx value={value}>{children}</BoardCtx>
}
