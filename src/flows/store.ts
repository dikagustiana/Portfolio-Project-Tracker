// The latest board state, readable from event handlers (flows) and subscribable from dialogs.
// Dialogs render inside the overlay host, which sits above BoardProvider in the tree, so they
// cannot read BoardCtx directly; the Relay re-provides it from this store.
import type { BoardState } from '../data/board-context.ts'

export interface BoardStore {
  get: () => BoardState
  set: (b: BoardState) => void
  subscribe: (listener: () => void) => () => void
}

export function boardStore(initial: BoardState): BoardStore {
  let cur = initial
  const listeners = new Set<() => void>()
  return {
    get: () => cur,
    set(b) {
      if (b === cur) return
      cur = b
      listeners.forEach((l) => l())
    },
    subscribe(l) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
}
