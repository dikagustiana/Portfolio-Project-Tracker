// Principal colours are fixed per principal and used everywhere (brief §7.1); theme
// colours come from the app tokens in src/index.css so light and dark both work.

export type PrincipalId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** Fixed colour per principal, used everywhere (brief §7.1). Mirrors the colour fields in
 *  each world's PRINCIPALS config; kept literal here so core never imports a world. */
export const PRINCIPAL_COLOR: Record<PrincipalId, string> = {
  A: '#3e7bd6', B: '#8a5fd0', C: '#d08a3e', D: '#3ea88a', E: '#d05f8a', F: '#5f6fd0',
}
export const PRINCIPAL_COLOR_SOFT: Record<PrincipalId, string> = {
  A: '#dbe7fa', B: '#ece5fa', C: '#faeada', D: '#daf2ea', E: '#fae0ea', F: '#e3e6fa',
}
