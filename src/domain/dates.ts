// Context-free date helpers, ported from the prototype's utils (reference/prototype.html).
// Calendar dates are 'YYYY-MM-DD' strings handled as UTC day numbers, so no result depends on
// the machine's time zone. Display strings use id-ID exactly like the prototype ('7 Okt',
// 'Rab, 7 Okt', 'Rabu, 7 Oktober 2026').
import type { DateStr, Ts } from './types.ts'

const DAY_MS = 864e5
/** Asia/Jakarta (WIB) is UTC+7 all year; no daylight saving since 1964. */
const WIB_OFFSET_MS = 7 * 3600e3

export const pad = (n: number): string => String(n).padStart(2, '0')

/** Day number (days since 1970-01-01) of a calendar date. NaN for '' or a malformed date. */
export const dn = (s: DateStr): number => {
  const [y, m, d] = s.split('-').map(Number)
  return Math.round(Date.UTC(y ?? NaN, (m ?? NaN) - 1, d ?? NaN) / DAY_MS)
}

/** Calendar date of a day number. */
export const ds = (n: number): DateStr => {
  const d = new Date(n * DAY_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const addDays = (s: DateStr, k: number): DateStr => ds(dn(s) + k)

/** Day of week, 0 = Sunday … 6 = Saturday. */
export const dow = (s: DateStr): number => new Date(dn(s) * DAY_MS).getUTCDay()

export const isWeekend = (s: DateStr): boolean => {
  const d = dow(s)
  return d === 0 || d === 6
}

/** Monday of the week containing s. */
export const weekStartOf = (s: DateStr): DateStr => addDays(s, -((dow(s) + 6) % 7))

/** ISO-8601 week number. */
export function isoWeek(s: DateStr): number {
  const n = dn(s)
  const th = n - ((dow(s) + 6) % 7) + 3
  const y = new Date(th * DAY_MS).getUTCFullYear()
  return 1 + Math.floor((th - dn(`${y}-01-01`)) / 7)
}

/** Calendar date in Asia/Jakarta of an instant (prototype `localDs`, which ran in WIB). */
export const tsToDate = (ts: Ts): DateStr => ds(Math.floor((ts + WIB_OFFSET_MS) / DAY_MS))

const DEFAULT_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const formatters = new Map<string, Intl.DateTimeFormat>()
const formatter = (key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat => {
  let f = formatters.get(key)
  if (!f) {
    f = make()
    formatters.set(key, f)
  }
  return f
}

/** Format a calendar date, default '7 Okt'. */
export const fmt = (s: DateStr, o: Intl.DateTimeFormatOptions = DEFAULT_FMT): string =>
  formatter(`d:${JSON.stringify(o)}`, () => new Intl.DateTimeFormat('id-ID', { ...o, timeZone: 'UTC' })).format(
    new Date(dn(s) * DAY_MS),
  )

/** 'Rabu, 7 Oktober 2026' (prototype `fmtLong`). */
export const fmtLong = (s: DateStr): string =>
  fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Timestamp as '6 Okt, 22.32' in Asia/Jakarta, regardless of the runtime's time zone. */
export const fmtTs = (ts: Ts): string =>
  formatter('ts', () =>
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }),
  ).format(new Date(ts))

/** '5 Okt – 9 Okt', or a single date when both ends match. */
export const range = (a: DateStr, b: DateStr): string => (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`)

/** Indonesian day names indexed by dow(). */
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const
