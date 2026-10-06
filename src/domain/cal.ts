// "Tambah ke kalender" (prototype calDetails, calUrl, calIssues). The calendar record is private
// per user (user_calendar), so calIssues takes the viewer's entries instead of reading the Board.
import { addDays, range } from './dates.ts'
import type { BoardIndex } from './lookup.ts'
import type { Permissions } from './permissions.ts'
import type { Rules } from './rules.ts'
import type { CalendarEntry, DateStr, Id, Task } from './types.ts'

export type CalProvider = 'google' | 'outlook365'
export const CAL_PROV: readonly (readonly [CalProvider, string])[] = [
  ['google', 'Google Calendar'],
  ['outlook365', 'Outlook'],
]

export type CalIssue =
  /** Task deleted or its project closed: remove the event. */
  | { id: Id; kind: 'gone'; title: string; end: DateStr }
  /** Deadline moved since the event was added. */
  | { id: Id; kind: 'changed'; title: string; old: DateStr; end: DateStr; t: Task }

export interface CalendarLinks {
  /** Event body: project, milestone, PIC, pemeriksa, schedule, proof, link. */
  calDetails: (t: Task) => string
  /** All-day event on the deadline, prefilled for Google Calendar or Outlook on the web. */
  calUrl: (t: Task, prov: CalProvider) => string
  calIssues: (entries: readonly CalendarEntry[]) => CalIssue[]
}

export function makeCalendarLinks(ix: BoardIndex, perms: Permissions, rules: Rules, appUrl: string): CalendarLinks {
  const calDetails = (t: Task): string => {
    const p = ix.project(t.projectId)
    const m = ix.milestone(t.milestoneId)
    return [
      `Project: ${p?.name ?? ''}`,
      m ? `Milestone: ${rules.msNo(m)} · ${m.title}` : '',
      `PIC: ${rules.mname(t.assignee) || '-'}`,
      rules.gated(p) ? `Pemeriksa: ${rules.mname(perms.validatorOf(t)) || '-'}` : '',
      `Jadwal: ${range(t.start, t.end)}`,
      t.proof ? `Bukti yang diminta: ${t.proof}` : '',
      '',
      `Buka di SAMB Project Board: ${appUrl}`,
    ]
      .filter((x, i) => x !== '' || i === 6)
      .join('\n')
  }
  return {
    calDetails,
    calUrl(t, prov) {
      const title = `Deadline: ${t.title}`
      const body = calDetails(t)
      const E = encodeURIComponent
      const next = addDays(t.end, 1)
      if (prov === 'google')
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${E(title)}&dates=${t.end.replace(/-/g, '')}/${next.replace(/-/g, '')}&details=${E(body)}&ctz=Asia%2FJakarta`
      return `https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&allday=true&subject=${E(title)}&startdt=${t.end}&enddt=${next}&body=${E(body)}`
    },
    calIssues(entries) {
      const out: CalIssue[] = []
      for (const c of entries) {
        const t = ix.task(c.taskId)
        if (!t || !rules.pActive(ix.project(t.projectId))) out.push({ id: c.taskId, kind: 'gone', title: c.title, end: c.end })
        else if (!rules.isDone(t) && t.end !== c.end)
          out.push({ id: c.taskId, kind: 'changed', title: t.title, old: c.end, end: t.end, t })
      }
      return out
    },
  }
}
