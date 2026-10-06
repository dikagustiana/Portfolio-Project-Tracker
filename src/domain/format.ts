// Context-free text helpers. Everything returns plain strings or data; React escapes on render.
// The only HTML the domain builds is e-mail bodies, escaped with escapeHtml (prototype `E()`).

/** Stable non-negative string hash (prototype `hash`, used to pick avatar colours). */
export const hash = (s: string): number => {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Up to two initials, upper case ('Dika Irawan' → 'DI'). */
export const initials = (n: string | null | undefined): string =>
  (n || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()

/**
 * Escape for the e-mail HTML bodies, exactly like the prototype's `E()`: & < > " only.
 * (Bodies are built from double-quoted attributes and text nodes.)
 */
export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))

export interface LinkSegment {
  text: string
  /** Present only for http(s) URLs. */
  href?: string
}

/**
 * Split stored text into plain and link segments (prototype `linkify`). Only `http://` and
 * `https://` URLs become links; anything else (`javascript:`, `data:` …) stays text.
 */
export function linkify(s: string | null | undefined): LinkSegment[] {
  const str = s ?? ''
  const out: LinkSegment[] = []
  let last = 0
  for (const m of str.matchAll(/https?:\/\/[^\s<]+/g)) {
    if (m.index > last) out.push({ text: str.slice(last, m.index) })
    out.push({ text: m[0], href: m[0] })
    last = m.index + m[0].length
  }
  if (last < str.length) out.push({ text: str.slice(last) })
  return out
}
