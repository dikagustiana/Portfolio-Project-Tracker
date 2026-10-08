// A figure with its source badge (Brief B6 §2.4): [Engine] [FCC BMG] [Swimlane KGR] [Dummy]
// [Asumsi] [Hitungan] [Input]. Every badge is focusable and carries its explanation in data-tip
// (the formula and inputs of a Hitungan, the source of an engine figure), which the shell's
// tooltip shows on hover and on keyboard focus.
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { explain, fmt } from '../figure.ts'
import { BADGE_LABEL } from '../types.ts'
import type { Fig, Line } from '../types.ts'

export function Badge({ f }: { f: Fig }) {
  const tip = explain(f)
  return (
    <span className={`sc-badge sc-b-${f.badge}`} tabIndex={0} data-tip={tip} aria-label={`Sumber ${BADGE_LABEL[f.badge]}: ${tip}`}>
      {BADGE_LABEL[f.badge]}
    </span>
  )
}

export function FigView({ f, signed, strong }: { f: Fig; signed?: boolean; strong?: boolean }) {
  return (
    <span className="sc-fig">
      {strong ? <b>{fmt(f, signed)}</b> : <span className="sc-num">{fmt(f, signed)}</span>}
      <Badge f={f} />
    </span>
  )
}

/** a line of text with its figures in place of {0} {1} … */
export function LineView({ l }: { l: Line }) {
  const parts = l.t.split(/(\{\d+\})/)
  return (
    <>
      {parts.map((p, k) => {
        const m = /^\{(\d+)\}$/.exec(p)
        const f = m ? l.f?.[Number(m[1])] : undefined
        return f ? <FigView key={k} f={f} /> : <span key={k}>{p}</span>
      })}
    </>
  )
}

/** One tooltip for the whole shell: follows hover and keyboard focus on any [data-tip]. */
export function Tips({ root }: { root: RefObject<HTMLElement | null> }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const show = (e: Event): void => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]')
      if (!t || !el.contains(t)) return
      const r = t.getBoundingClientRect()
      const below = r.top < 140
      setTip({ text: t.dataset.tip ?? '', x: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150), y: below ? r.bottom + 6 : r.top - 6, below })
    }
    const hide = (e: Event): void => {
      const t = (e.target as HTMLElement | null)?.closest('[data-tip]')
      if (t) setTip(null)
    }
    el.addEventListener('pointerover', show)
    el.addEventListener('focusin', show)
    el.addEventListener('pointerout', hide)
    el.addEventListener('focusout', hide)
    return () => {
      el.removeEventListener('pointerover', show)
      el.removeEventListener('focusin', show)
      el.removeEventListener('pointerout', hide)
      el.removeEventListener('focusout', hide)
    }
  }, [root])
  if (!tip) return null
  return (
    <div className={`sc-tip${tip.below ? ' below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  )
}
