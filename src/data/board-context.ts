// Board context and hooks (kept apart from BoardProvider for fast refresh).
import { createContext, use, useEffect, useState } from 'react'
import type { Board, DateStr, Domain, Viewer } from '../domain/index.ts'
import type { Actions } from './actions.ts'
import type { BoardExtras, BoardTable } from './adapter.ts'

/** Today in Asia/Jakarta as 'YYYY-MM-DD', refreshed every minute so the board rolls over at midnight. */
export function useToday(): DateStr {
  const now = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const [today, setToday] = useState(now)
  useEffect(() => {
    const t = setInterval(() => setToday(now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return today
}

export interface BoardState {
  d: Domain
  board: Board
  extras: BoardExtras
  viewer: Viewer
  today: DateStr
  actions: Actions
  /** Refetch everything that project actions can touch (after a write). */
  refresh: () => Promise<void>
  /** Refetch one table (admin screens after direct writes). */
  refreshTable: (t: BoardTable) => Promise<void>
}

export const BoardCtx = createContext<BoardState | null>(null)

export function useBoard(): BoardState {
  const ctx = use(BoardCtx)
  if (!ctx) throw new Error('useBoard dipakai di luar BoardProvider.')
  return ctx
}

