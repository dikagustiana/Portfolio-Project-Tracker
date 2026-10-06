// Project wizard helpers (prototype wzTaskDefaults). Ids are minted by the caller.
import { addDays } from './dates.ts'
import type { HolidayCalendar } from './holidays.ts'
import type { DateStr, Id } from './types.ts'

export interface TaskDates {
  start: DateStr
  end: DateStr
}

/**
 * Default dates for a new wizard task in milestone `mid`: start on the first working day after
 * the last task of this milestone or, if it has none, of the nearest earlier milestone with tasks
 * (today when there is none); end four days later.
 */
export type WzTaskDefaults = (
  msOrder: readonly Id[],
  tasksByMs: Readonly<Record<Id, readonly { end: DateStr }[] | undefined>>,
  mid: Id,
) => TaskDates

export function makeWzTaskDefaults(cal: HolidayCalendar, today: DateStr): WzTaskDefaults {
  return (msOrder, tasksByMs, mid) => {
    let last: DateStr | null = null
    for (let k = msOrder.indexOf(mid); k >= 0 && !last; k--) {
      const arr = tasksByMs[msOrder[k] ?? ''] ?? []
      const tail = arr[arr.length - 1]
      if (tail) last = tail.end
    }
    const start = cal.nextWorkday(last ? addDays(last, 1) : today)
    return { start, end: addDays(start, 4) }
  }
}
