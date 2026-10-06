// Working-day calendar (prototype HOL, hol, holCovered, isWork, workdays, holsIn, nextWorkday).
// Holidays are data (board.holidays). With settings.cutiIsWorkday a cuti bersama day is a working
// day everywhere working days matter; libur nasional days are never working days.
import { addDays, dn, ds, isWeekend } from './dates.ts'
import type { DateStr, Holiday, Settings } from './types.ts'

export interface HolidayCalendar {
  /** The holiday on a date (any type), or null. Gantt shading and week chips use this. */
  hol: (s: DateStr) => Holiday | null
  /** The holiday on a date only if it is a day off (libur, or cuti while cuti is not a workday). */
  offHol: (s: DateStr) => Holiday | null
  /** Years that have holiday data (prototype HOL_YEARS), ascending. */
  holYears: readonly number[]
  holCovered: (s: DateStr) => boolean
  isWork: (s: DateStr) => boolean
  /** Working days from a to b inclusive. */
  workdays: (a: DateStr, b: DateStr) => number
  /** All holidays from a to b inclusive, in date order. */
  holsIn: (a: DateStr, b: DateStr) => Holiday[]
  /** Only the days-off holidays from a to b inclusive. */
  offHolsIn: (a: DateStr, b: DateStr) => Holiday[]
  /** s itself when it is a working day, otherwise the next working day. */
  nextWorkday: (s: DateStr) => DateStr
}

export function makeCalendar(holidays: readonly Holiday[], settings: Pick<Settings, 'cutiIsWorkday'>): HolidayCalendar {
  const byDate = new Map(holidays.map((h) => [h.date, h]))
  const holYears = [...new Set(holidays.map((h) => Number(h.date.slice(0, 4))))].sort((a, b) => a - b)
  const cutiWorks = settings.cutiIsWorkday

  const hol = (s: DateStr): Holiday | null => byDate.get(s) ?? null
  const offHol = (s: DateStr): Holiday | null => {
    const h = byDate.get(s)
    return h && (h.type === 'libur' || !cutiWorks) ? h : null
  }
  const isWork = (s: DateStr): boolean => !isWeekend(s) && !offHol(s)
  const collect = (a: DateStr, b: DateStr, pick: (s: DateStr) => Holiday | null): Holiday[] => {
    const r: Holiday[] = []
    for (let i = dn(a); i <= dn(b); i++) {
      const h = pick(ds(i))
      if (h) r.push(h)
    }
    return r
  }

  return {
    hol,
    offHol,
    holYears,
    holCovered: (s) => holYears.includes(Number(s.slice(0, 4))),
    isWork,
    workdays(a, b) {
      let n = 0
      for (let i = dn(a); i <= dn(b); i++) if (isWork(ds(i))) n++
      return n
    },
    holsIn: (a, b) => collect(a, b, hol),
    offHolsIn: (a, b) => collect(a, b, offHol),
    nextWorkday(s) {
      let d = s
      while (!isWork(d)) d = addDays(d, 1)
      return d
    },
  }
}
