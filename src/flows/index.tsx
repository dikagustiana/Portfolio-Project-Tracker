// Flow implementations (prototype openTask, onCheck, moveTo, …): decide which dialog to open.
// The flows read the latest board from a store at call time, so the Flows object stays stable;
// dialogs get the live board through the Relay (see store.ts).
import { useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FlowsCtx } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'
import { useBoard } from '../data/board-context.ts'
import { makeFlows } from './impl.tsx'
import { boardStore } from './store.ts'

export function FlowsProvider({ children }: { children: ReactNode }) {
  const board = useBoard()
  const { toast, open } = useOverlay()
  const [store] = useState(() => boardStore(board))
  useLayoutEffect(() => {
    store.set(board)
  }, [store, board])
  const flows = useMemo(() => makeFlows({ store, toast, open }), [store, toast, open])
  return <FlowsCtx value={flows}>{children}</FlowsCtx>
}
