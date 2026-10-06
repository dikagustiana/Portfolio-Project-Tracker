// Shared dialog plumbing: one submit path for every dialog (button disabled while pending, the
// database's message in the dialog's .err, close + toast on success, then refresh), the
// prototype's required-field marking (need / markBad) and the decider-attribution state.
import { useCallback, useRef, useState } from 'react'
import { useOverlay } from '../app/overlay-context.ts'
import { messageOf } from '../data/actions.ts'
import type { DecisionSourceInput } from '../data/actions.ts'
import { useBoard } from '../data/board-context.ts'

export interface Done {
  /** Toast after success. */
  ok?: string
  /** Runs once the board has refreshed (e.g. navigate to the new project). */
  after?: () => void
  /** Keep the dialog open after success. */
  keep?: boolean
}

export interface Submit {
  busy: boolean
  err: string
  setErr: (msg: string) => void
  /** Runs one write; false when it failed (the message is in `err`) or another write is pending. */
  run: (work: () => Promise<unknown>, done?: Done) => Promise<boolean>
}

export function useSubmit(): Submit {
  const { refresh } = useBoard()
  const { toast, close } = useOverlay()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const running = useRef(false)
  const run = useCallback(
    async (work: () => Promise<unknown>, done: Done = {}): Promise<boolean> => {
      if (running.current) return false
      running.current = true
      setBusy(true)
      setErr('')
      try {
        await work()
      } catch (e) {
        running.current = false
        setBusy(false)
        setErr(messageOf(e))
        return false
      }
      if (!done.keep) close()
      if (done.ok) toast(done.ok)
      try {
        await refresh()
      } catch {
        // Realtime refetches on its own; the write itself succeeded.
      }
      if (done.keep) {
        running.current = false
        setBusy(false)
      }
      done.after?.()
      return true
    },
    [refresh, toast, close],
  )
  return { busy, err, setErr, run }
}

export const focusId = (id: string): void => {
  document.getElementById(id)?.focus()
}

type NeedPair = readonly [id: string, value: string, msg: string]

export interface Bad {
  /** Prototype need(): mark the empty fields among `pairs`, focus the first, return its message ('' when all filled). */
  need: (pairs: readonly (NeedPair | null | false)[]) => string
  /** Prototype markBad(): mark fields, focus the first, return msg. */
  mark: (ids: readonly string[], msg: string) => string
  /** Mark exactly these fields (the wizard re-renders a step with only its new marks); [] clears all. */
  only: (ids: readonly string[], msg: string) => string
  /** The field was edited: drop its mark. */
  ok: (id: string) => void
  /** Class list for a field: base plus 'bad' when marked. */
  cls: (id: string, base?: string) => string
}

export function useBad(): Bad {
  const [bad, setBad] = useState<ReadonlySet<string>>(() => new Set())
  const need = useCallback((pairs: readonly (NeedPair | null | false)[]): string => {
    const list = pairs.filter((x): x is NeedPair => !!x)
    const miss = list.filter(([, v]) => !v.trim())
    setBad((b) => {
      const n = new Set(b)
      for (const [k] of list) n.delete(k)
      for (const [k] of miss) n.add(k)
      return n
    })
    const first = miss[0]
    if (!first) return ''
    focusId(first[0])
    return first[2]
  }, [])
  const mark = useCallback((ids: readonly string[], msg: string): string => {
    setBad((b) => new Set([...b, ...ids]))
    if (ids[0]) focusId(ids[0])
    return msg
  }, [])
  const only = useCallback((ids: readonly string[], msg: string): string => {
    setBad(new Set(ids))
    if (ids[0]) focusId(ids[0])
    return msg
  }, [])
  const ok = useCallback((id: string) => {
    setBad((b) => {
      if (!b.has(id)) return b
      const n = new Set(b)
      n.delete(id)
      return n
    })
  }, [])
  const cls = (id: string, base = 'inp'): string => (bad.has(id) ? `${base} bad` : base)
  return { need, mark, only, ok, cls }
}

/** Who actually decided, where and when (prototype decSrcHtml fields). */
export interface DecSrc {
  by: string
  on: string
  forum: string
}
export const newDecSrc = (today: string): DecSrc => ({ by: '', on: today, forum: '' })
/** Prototype decSrcRead: trimmed, decision date defaults to today. */
export const decSrcInput = (s: DecSrc, today: string): DecisionSourceInput => ({
  deciderName: s.by.trim(),
  forum: s.forum.trim(),
  decidedOn: s.on || today,
})
