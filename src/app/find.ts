// Quick Find open/closed state (a tiny external store, so any button or shortcut can open it).
import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const openFind = (): void => {
  open = true
  emit()
}
export const closeFind = (): void => {
  open = false
  emit()
}

export function useFindOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => open,
  )
}
