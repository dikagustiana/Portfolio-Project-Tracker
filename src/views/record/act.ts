// One write path for actions taken from a record view (peek or full page): busy state, the
// database's message on failure, a toast and a refresh on success. Unlike dialogs, records stay open.
import { useCallback, useRef, useState } from 'react'
import { useOverlay } from '../../app/overlay-context.ts'
import { messageOf } from '../../data/actions.ts'
import { useBoard } from '../../data/board-context.ts'

export function useAct() {
  const { refresh } = useBoard()
  const { toast } = useOverlay()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const running = useRef(false)
  const run = useCallback(
    async (work: () => Promise<unknown>, ok?: string): Promise<boolean> => {
      if (running.current) return false
      running.current = true
      setBusy(true)
      setErr('')
      try {
        await work()
      } catch (e) {
        setErr(messageOf(e))
        running.current = false
        setBusy(false)
        return false
      }
      if (ok) toast(ok)
      try {
        await refresh()
      } catch {
        // Realtime refetches on its own.
      }
      running.current = false
      setBusy(false)
      return true
    },
    [refresh, toast],
  )
  return { busy, err, setErr, run }
}
