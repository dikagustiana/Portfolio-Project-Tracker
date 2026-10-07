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

/** CSS custom properties of the current theme, read once per theme change. */
export interface ThemeColors {
  bg: string
  surface: string
  surface2: string
  ink: string
  muted: string
  line: string
  accent: string
  accentSoft: string
  done: string
  warn: string
  danger: string
}

export function readTheme(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string): string => s.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--bg', '#f1f4f9'),
    surface: v('--surface', '#ffffff'),
    surface2: v('--surface-2', '#f5f7fb'),
    ink: v('--ink', '#2b3548'),
    muted: v('--muted', '#7c88a1'),
    line: v('--line', '#e2e7f0'),
    accent: v('--accent', '#3e55d8'),
    accentSoft: v('--accent-soft', '#e7ebfc'),
    done: v('--s-done', '#109e86'),
    warn: v('--warn', '#c8661a'),
    danger: v('--danger', '#d9402f'),
  }
}

/** Soft status tints for the metrics bar and pop-ups: teal healthy, amber attention. */
export const STATE = {
  ok: '#109e86',
  okSoft: '#dcf3ee',
  attention: '#c8661a',
  attentionSoft: '#fcefe1',
  critical: '#d9402f',
  criticalSoft: '#fbe2df',
  grey: '#8a95ab',
  greySoft: '#eef1f6',
}
