import { createContext, use } from 'react'
import type { ReactNode } from 'react'

export interface ModalOpts {
  /** Scrim click does not close (wizard). */
  sticky?: boolean
  /** Wider dialog (wizard). */
  wide?: boolean
}

export interface Overlay {
  toast: (msg: string) => void
  open: (content: ReactNode, opts?: ModalOpts) => void
  close: () => void
  isOpen: boolean
}

export const OverlayCtx = createContext<Overlay | null>(null)

export function useOverlay(): Overlay {
  const c = use(OverlayCtx)
  if (!c) throw new Error('useOverlay dipakai di luar OverlayProvider.')
  return c
}
