// Theme colour reading — DOM-only, so it stays out of the engine-importable colors.ts.

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
