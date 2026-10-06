// Flow implementations (prototype openTask, onCheck, moveTo, …): decide which dialog to open.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { FlowsCtx } from '../app/flows.ts'
import type { Flows } from '../app/flows.ts'
import { useOverlay } from '../app/overlay-context.ts'

export function FlowsProvider({ children }: { children: ReactNode }) {
  const { toast } = useOverlay()
  const flows = useMemo<Flows>(() => {
    const todo = () => toast('Belum tersedia.')
    return {
      openTask: todo,
      openReview: todo,
      onCheck: todo,
      moveTo: todo,
      submitFlow: todo,
      openGate: todo,
      openMs: todo,
      moveMs: todo,
      openAsk: todo,
      openClose: todo,
      openProject: todo,
      startWizard: todo,
      openRemind: todo,
      openCal: todo,
      openPreview: todo,
      calRecord: todo,
      calRemove: todo,
    }
  }, [toast])
  return <FlowsCtx value={flows}>{children}</FlowsCtx>
}
