// Layout invariants of the 3D overlay (Brief 3 §4), checked in a real browser by
// scripts/sim3d-frames.ts over a sweep of screen sizes: no two cards overlap, no card's content
// spills sideways out of its card, every card stays inside the sim container, and the page
// never scrolls sideways. Cards opt in with a `data-zone` attribute.

export interface LayoutReport {
  mode: string
  zones: number
  problems: string[]
}

const EPS = 0.5

export function checkOverlayLayout(doc: Document): LayoutReport {
  const root = doc.querySelector('.s3-root')
  if (!root) return { mode: '?', zones: 0, problems: ['no .s3-root on the page'] }
  const mode = [...root.classList].find((c) => c.startsWith('s3-root--'))?.slice('s3-root--'.length) ?? '?'
  const box = root.getBoundingClientRect()
  const zones = [...root.querySelectorAll<HTMLElement>('[data-zone]')].filter((el) => el.getClientRects().length > 0)
  const rects = zones.map((el) => el.getBoundingClientRect())
  const name = (i: number): string => zones[i]?.dataset.zone ?? '?'
  const problems: string[] = []

  for (let i = 0; i < zones.length; i++) {
    const a = rects[i]
    if (!a) continue
    for (let j = i + 1; j < zones.length; j++) {
      const b = rects[j]
      if (b && a.left < b.right - EPS && b.left < a.right - EPS && a.top < b.bottom - EPS && b.top < a.bottom - EPS) {
        problems.push(`overlap: ${name(i)} × ${name(j)}`)
      }
    }
    const el = zones[i]
    if (el && el.scrollWidth > el.clientWidth + 1) problems.push(`content spills sideways: ${name(i)} (${el.scrollWidth} > ${el.clientWidth})`)
    if (a.left < box.left - EPS || a.right > box.right + EPS || a.top < box.top - EPS || a.bottom > box.bottom + EPS) {
      problems.push(`outside the sim area: ${name(i)}`)
    }
  }
  if (doc.documentElement.scrollWidth > doc.documentElement.clientWidth) problems.push('page scrolls sideways')
  return { mode, zones: zones.length, problems }
}
