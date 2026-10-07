// Quick Find open/closed state (a tiny external store, so any button or shortcut can open it).
import { useEffect, useSyncExternalStore } from 'react'

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

/** Global shortcut: "/" (outside inputs) or Ctrl/⌘ K. */
export function useFindShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        openFind()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
