// Daily e-mail digest and reminder queue (prototype digestFor, emailFor, digestAll, remWhy,
// remPending, reminderEmail, reminderQueue). The digest is built from inbox(), so the e-mail, the
// "Minggu ini" page and the Edge Function (M6) apply one set of rules (reference/email-runner.js).
import { EMAIL_RE, stageName } from './constants.ts'
import { dn, fmt, fmtLong, fmtTs, range } from './dates.ts'
import { escapeHtml as E } from './format.ts'
import type { HolidayCalendar } from './holidays.ts'
import type { Inbox } from './inbox.ts'
import type { BoardIndex } from './lookup.ts'
import type { Rules } from './rules.ts'
import type { DateStr, Id, Person, Reminder, Task } from './types.ts'
import type { RecordTarget, Views } from './views.ts'

export interface DigestItem {
  id: Id
  title: string
  sub: string
  /** Deep link to the record (HTML e-mail and preview). */
  href?: string
}
export interface DigestSection {
  title: string
  items: DigestItem[]
}
export interface Digest {
  member: Person
  date: DateStr
  sections: DigestSection[]
  count: number
}

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}
export interface DigestEmail extends Email {
  memberId: Id
  name: string
  count: number
}
export interface DigestSkip {
  memberId: Id
  name: string
  reason: string
}
export interface ReminderOut extends Email {
  id: Id
  taskId: Id
  memberId: Id
  name: string
}
export interface ReminderSkip {
  id: Id
  taskId: Id
  reason: string
}
export interface DigestRun {
  date: DateStr
  workday: boolean
  paused: boolean
  /** Why nothing is sent today (holiday, weekend, paused); null on a normal run. */
  reason: string | null
  emails: DigestEmail[]
  skipped: DigestSkip[]
  /** Pending reminders that will go out (computed unless e-mail is paused, even on holidays). */
  reminders: ReminderOut[]
  reminderSkips: ReminderSkip[]
}

export interface DigestApi {
  digestFor: (personId: Id, date?: DateStr) => Digest | null
  emailFor: (d: Digest) => Email
  digestAll: (date?: DateStr) => DigestRun
  /** Reminders of a task, newest first. */
  remFor: (taskId: Id) => readonly Reminder[]
  /** Why a pending reminder cannot be sent, '' when it can. */
  remWhy: (r: Reminder) => string
  /** The task's sendable pending reminder, if any. */
  remPending: (taskId: Id) => Reminder | null
  /** Status line for a reminder. mailActive: the e-mail sender has run at least once. */
  remStatusText: (r: Reminder, mailActive: boolean) => string
  /** The reminder e-mail; null when its task no longer exists. */
  reminderEmail: (r: Reminder) => Email | null
  reminderQueue: () => { out: ReminderOut[]; skip: ReminderSkip[] }
}

const FOOTER_DIGEST =
  'Email ini dikirim otomatis setiap pagi hari kerja. Tidak ada email kalau tidak ada yang perlu kamu lakukan.'
const BUTTON = (url: string): string =>
  `<p style="margin-top:22px"><a href="${E(url)}" style="background:#14212c;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold">Buka SAMB Project Board</a></p>`

export function makeDigest(deps: {
  ix: BoardIndex
  cal: HolidayCalendar
  rules: Rules
  inbox: (who?: Id) => Inbox
  views: Views
  urlOf: (target: RecordTarget) => string
  today: DateStr
  appUrl: string
}): DigestApi {
  const { ix, cal, rules, inbox, views, urlOf, today, appUrl } = deps
  const { board } = ix
  const pname = (projectId: Id): string => ix.project(projectId)?.name ?? ''

  const digestFor = (mid: Id, date: DateStr = today): Digest | null => {
    const m = ix.person(mid)
    if (!m) return null
    const ib = inbox(mid)
    const seen = new Set<Id>()
    const live = (t: Task): boolean => rules.pActive(ix.project(t.projectId))
    // Execution units only: a package with sub-tasks shows up through its sub-tasks.
    const mine = board.tasks.filter((t) => live(t) && t.assignee === mid && !rules.isDone(t) && t.stage !== 'review' && rules.isLeaf(t))
    const tk = (t: Task): DigestItem => {
      const ms = ix.milestone(t.milestoneId)
      return {
        id: t.id,
        title: t.title,
        sub: `${pname(t.projectId)}${ms ? ` · ${rules.msNo(ms)}` : ''} · ${range(t.start, t.end)}`,
        href: urlOf({ kind: 'task', id: t.id }),
      }
    }
    const extra = views.actions(mid)
    const once = (arr: readonly Task[], f: (t: Task) => DigestItem): DigestItem[] =>
      arr
        .filter((x) => {
          if (seen.has(x.id)) return false
          seen.add(x.id)
          return true
        })
        .map(f)
    const sec: [string, DigestItem[]][] = [
      ['Deadline hari ini', once(mine.filter((t) => t.end === date), tk)],
      [
        'Sudah lewat deadline',
        once(
          mine.filter((t) => t.end < date).sort((a, b) => a.end.localeCompare(b.end)),
          (t) => ({ ...tk(t), sub: `${tk(t).sub} · telat ${dn(date) - dn(t.end)} hari` }),
        ),
      ],
      [
        'Hambatan yang butuh kamu',
        extra
          .filter((a) => a.kind === 'blocker')
          .map((a) => ({ id: a.key, title: a.title, sub: `${pname(a.projectId)} · ${a.detail}`, href: urlOf(a.target) })),
      ],
      ['Ditolak, perlu diperbaiki', once(ib.rejected, (t) => ({ ...tk(t), sub: `Alasan: ${t.rejectReason || '-'}` }))],
      [
        'Paket siap diajukan',
        extra
          .filter((a) => a.kind === 'submit-package')
          .map((a) => ({ id: a.key, title: a.title, sub: `${pname(a.projectId)} · semua sub-task diterima`, href: urlOf(a.target) })),
      ],
      ['Tanggal perlu kamu komit', once(ib.commits, tk)],
      ['Mulai hari ini', once(mine.filter((t) => t.start === date), tk)],
      [
        'Perlu kamu periksa',
        once(ib.toValidate, (t) => ({
          ...tk(t),
          sub: `Diajukan ${rules.mname(t.assignee) || 'PIC'} · ${pname(t.projectId)}`,
        })),
      ],
      [
        'Milestone perlu kamu putuskan',
        [
          ...ib.gates.map((x) => ({
            id: x.id,
            title: `${rules.msNo(x)} · ${x.title}`,
            sub: `${pname(x.projectId)} · semua task diterima`,
            href: urlOf({ kind: 'gate', id: x.id }),
          })),
          ...ib.stops.map((x) => ({
            id: x.id,
            title: `${rules.msNo(x)} · ${x.title}`,
            sub: `${pname(x.projectId)} · dihentikan, perlu tindak lanjut`,
            href: urlOf({ kind: 'gate', id: x.id }),
          })),
        ],
      ],
      [
        'Keputusan dibutuhkan',
        ib.asks.map((a) => ({
          id: a.id,
          title: a.question,
          sub: pname(a.projectId) + (a.due ? ` · batas ${fmt(a.due)}` : ''),
          href: urlOf({ kind: 'ask', id: a.id }),
        })),
      ],
      [
        'Project siap ditutup',
        ib.closes.map((p) => ({
          id: p.id,
          title: p.name,
          sub: 'Semua milestone lulus · buktikan hasil akhir lalu tutup',
          href: urlOf({ kind: 'project', id: p.id }),
        })),
      ],
    ]
    const sections = sec.filter((x) => x[1].length).map(([title, items]) => ({ title, items }))
    return { member: m, date, sections, count: sections.reduce((n, s) => n + s.items.length, 0) }
  }

  const emailFor = (d: Digest): Email => {
    const m = d.member
    const first = (m.name || '').split(/\s+/)[0] ?? ''
    const subject = `[SAMB] ${d.count} hal untuk kamu hari ini · ${fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}`
    const text =
      `Halo ${first},\n\nIni yang perlu kamu lakukan hari ini (${fmtLong(d.date)}):\n\n` +
      d.sections
        .map((s) => `${s.title.toUpperCase()}\n${s.items.map((i) => `• ${i.title}\n  ${i.sub}`).join('\n')}`)
        .join('\n\n') +
      `\n\nBuka SAMB Project Board untuk menindaklanjuti:\n${appUrl}\n\n${FOOTER_DIGEST}`
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#14212c;max-width:560px;line-height:1.5"><p>Halo ${E(first)},</p><p>Ini yang perlu kamu lakukan hari ini (<b>${E(fmtLong(d.date))}</b>):</p>` +
      d.sections
        .map(
          (s) =>
            `<p style="margin:18px 0 6px;font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#3e55d8">${E(s.title)}</p><ul style="margin:0;padding-left:18px">${s.items
              .map(
                (i) =>
                  `<li style="margin:0 0 6px"><b>${i.href ? `<a href="${E(i.href)}" style="color:#14212c">${E(i.title)}</a>` : E(i.title)}</b><br><span style="color:#66727e;font-size:13px">${E(i.sub)}</span></li>`,
              )
              .join('')}</ul>`,
        )
        .join('') +
      `${BUTTON(appUrl)}<p style="color:#66727e;font-size:12px">${FOOTER_DIGEST}</p></div>`
    return { to: m.email ?? '', subject, text, html }
  }

  const remWhy = (r: Reminder): string => {
    const t = ix.task(r.taskId)
    const m = ix.person(r.toMember)
    if (!t) return 'Task sudah dihapus'
    if (rules.isDone(t)) return 'Task sudah selesai'
    if (!rules.pActive(ix.project(t.projectId))) return 'Project tidak aktif'
    if (!m) return 'Penerima sudah dihapus'
    if (t.assignee !== m.id) return 'PIC task sudah diganti'
    if (!m.email || !EMAIL_RE.test(m.email)) return 'Penerima belum punya email'
    return ''
  }

  const reminderEmail = (r: Reminder): Email | null => {
    const t = ix.task(r.taskId)
    if (!t) return null
    const p = ix.project(r.projectId)
    const m = ix.person(r.toMember)
    const ms = ix.milestone(t.milestoneId)
    // Prototype: a reminder recorded without a linked member ('owner') is signed by the board PM.
    const by = r.by ? rules.mname(r.by) || 'PM project' : 'Project Manager SAMB Project Board'
    const rows: [string, string][] = [['Task', t.title], ['Project', p?.name ?? '']]
    if (ms) rows.push(['Milestone', `${rules.msNo(ms)} · ${ms.title}`])
    rows.push(['Jadwal', range(t.start, t.end)], ['Status', stageName(t.stage)])
    if (t.proof) rows.push(['Bukti yang diminta', t.proof])
    const footer = `Pengingat ini dikirim oleh ${by} lewat SAMB Project Board.`
    const subject = `[SAMB] Pengingat dari ${by}: ${t.title}`
    const text = `${r.message}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nBuka SAMB Project Board:\n${appUrl}\n\n${footer}`
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#14212c;max-width:560px;line-height:1.5"><p style="white-space:pre-wrap">${E(r.message)}</p><table style="border-collapse:collapse;font-size:14px">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:3px 14px 3px 0;color:#66727e;vertical-align:top">${E(k)}</td><td style="padding:3px 0"><b>${E(v)}</b></td></tr>`,
        )
        .join('')}</table>` +
      `${BUTTON(appUrl)}<p style="color:#66727e;font-size:12px">Pengingat ini dikirim oleh ${E(by)} lewat SAMB Project Board.</p></div>`
    return { to: m?.email ?? '', subject, text, html }
  }

  const reminderQueue = (): { out: ReminderOut[]; skip: ReminderSkip[] } => {
    const out: ReminderOut[] = []
    const skip: ReminderSkip[] = []
    for (const r of board.reminders) {
      if (r.status !== 'menunggu') continue
      const why = remWhy(r)
      const m = ix.person(r.toMember)
      const mail = why ? null : reminderEmail(r)
      if (why || !m || !mail) skip.push({ id: r.id, taskId: r.taskId, reason: why })
      else out.push({ id: r.id, taskId: r.taskId, memberId: m.id, name: m.name, ...mail })
    }
    return { out, skip }
  }

  return {
    digestFor,
    emailFor,
    digestAll(date = today) {
      const off = cal.offHol(date)
      const out: DigestRun = {
        date,
        workday: cal.isWork(date),
        paused: board.settings.emailPaused,
        reason: null,
        emails: [],
        skipped: [],
        reminders: [],
        reminderSkips: [],
      }
      if (!out.paused) {
        const q = reminderQueue()
        out.reminders = q.out
        out.reminderSkips = q.skip
      }
      if (!out.workday) {
        out.reason = off ? `Hari libur: ${off.name}` : 'Akhir pekan'
        return out
      }
      if (out.paused) {
        out.reason = 'Email harian sedang dijeda'
        return out
      }
      for (const m of board.people) {
        if (!m.email || !EMAIL_RE.test(m.email)) {
          out.skipped.push({ memberId: m.id, name: m.name, reason: 'Belum ada email' })
          continue
        }
        if (!m.emailDaily) {
          out.skipped.push({ memberId: m.id, name: m.name, reason: 'Email harian dimatikan' })
          continue
        }
        const d = digestFor(m.id, date)
        if (!d?.count) {
          out.skipped.push({ memberId: m.id, name: m.name, reason: 'Tidak ada yang perlu dilakukan' })
          continue
        }
        out.emails.push({ memberId: m.id, name: m.name, count: d.count, ...emailFor(d) })
      }
      return out
    },
    remFor: (taskId) => ix.remFor(taskId),
    remWhy,
    remPending: (taskId) => ix.remFor(taskId).find((r) => r.status === 'menunggu' && !remWhy(r)) ?? null,
    remStatusText(r, mailActive) {
      const who = rules.mname(r.toMember) || 'PIC'
      const why = remWhy(r)
      if (r.status === 'menunggu' && why) return `Pengingat ke ${who} tidak akan terkirim: ${why.toLowerCase()}.`
      if (r.status === 'menunggu')
        return `Pengingat ke ${who} menunggu dikirim (dicatat ${fmtTs(r.at)}). ${mailActive ? 'Dikirim pada putaran pengiriman berikutnya.' : 'Pengiriman aktif setelah email disambungkan.'}`
      if (r.status === 'terkirim') return `Pengingat terakhir terkirim ke ${who} · ${fmtTs(r.sentAt ?? r.at)}`
      return `Pengingat ke ${who} ${r.status === 'gagal' ? 'gagal dikirim' : 'dibatalkan'}${r.note ? `: ${r.note}` : ''}`
    },
    reminderEmail,
    reminderQueue,
  }
}
