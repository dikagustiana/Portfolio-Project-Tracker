// Wraps every dialog: provides the live board (BoardCtx) and the flows (FlowsCtx) to content that
// the overlay host renders outside BoardProvider, so dialogs use useBoard()/useFlows() as usual
// and stay current with Realtime updates.
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { FlowsCtx } from '../app/flows.ts'
import type { Flows } from '../app/flows.ts'
import { BoardCtx } from '../data/board-context.ts'
import type { BoardStore } from './store.ts'

export function Relay({ store, flows, children }: { store: BoardStore; flows: Flows; children: ReactNode }) {
  const board = useSyncExternalStore(store.subscribe, store.get)
  return (
    <BoardCtx value={board}>
      <FlowsCtx value={flows}>{children}</FlowsCtx>
    </BoardCtx>
  )
}
