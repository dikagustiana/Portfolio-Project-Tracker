// Toast and modal host (prototype toast(), openModal()/closeModal(), twoStep()).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { OverlayCtx as Ctx } from './overlay-context.ts'
import type { ModalOpts } from './overlay-context.ts'

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null)
  const [modal, setModal] = useState<{ content: ReactNode; opts: ModalOpts; key: number } | null>(null)
  const seq = useRef(0)

  const toast = useCallback((text: string) => setMsg({ text, n: ++seq.current }), [])
  const open = useCallback((content: ReactNode, opts: ModalOpts = {}) => setModal({ content, opts, key: ++seq.current }), [])
  const close = useCallback(() => setModal(null), [])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(t)
  }, [msg])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal && !modal.opts.sticky) setModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal])

  const value = useMemo(() => ({ toast, open, close, isOpen: modal !== null }), [toast, open, close, modal])

  return (
    <Ctx value={value}>
      {children}
      <div id="modalRoot">
        {modal && (
          <div
            className="scrim"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !modal.opts.sticky) close()
            }}
          >
            <ModalBox key={modal.key} wide={modal.opts.wide}>
              {modal.content}
            </ModalBox>
          </div>
        )}
      </div>
      {msg && (
        <div className="toast" role="status" key={msg.n}>
          {msg.text}
        </div>
      )}
    </Ctx>
  )
}

function ModalBox({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Focus the first field, like the prototype's openModal.
    const f = ref.current?.querySelector<HTMLElement>('input:not([type=radio]):not([type=checkbox]),textarea,select')
    f?.focus()
  }, [])
  return (
    <div ref={ref} className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
      {children}
    </div>
  )
}

/** Two-click confirm button (prototype twoStep): first click arms with `armed` label for 4 s. */
export function TwoStep({ className, label, armed, onConfirm, disabled }: {
  className?: string
  label: string
  armed: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const [arm, setArm] = useState(false)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 4000)
    return () => clearTimeout(t)
  }, [arm])
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => (arm ? onConfirm() : setArm(true))}
    >
      {arm ? armed : label}
    </button>
  )
}
