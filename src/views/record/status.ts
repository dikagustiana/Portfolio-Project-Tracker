// Plain helpers for record rows: a task's status as one signal, and relative time.
import { dn, fmt } from '../../domain/index.ts'
import type { Domain, Person, Task, Tone } from '../../domain/index.ts'

/** Status of a task as one small signal: blocked, late, review, done, active, draft, idle. */
export function taskStatus(d: Domain, t: Task): { tone: Tone; text: string } {
  if (d.isDone(t)) return { tone: 'green', text: d.gated(d.project(t.projectId)) ? 'Diterima' : 'Selesai' }
  if (d.isBlocked(t)) return { tone: 'red', text: 'Terhambat' }
  if (t.stage === 'review') return { tone: 'violet', text: 'Diperiksa' }
  if (d.isLate(t)) return { tone: 'red', text: `Telat ${dn(d.today) - dn(t.end)} hari` }
  if (t.rejectReason) return { tone: 'red', text: 'Perlu diperbaiki' }
  if (d.packageReady(t)) return { tone: 'indigo', text: 'Siap diajukan' }
  if (d.isDraft(t)) return { tone: 'amber', text: 'Draf' }
  if (t.stage === 'progress') return { tone: 'indigo', text: 'Dikerjakan' }
  const left = dn(t.end) - dn(d.today)
  if (left <= 3) return { tone: 'amber', text: left === 0 ? 'Deadline hari ini' : `${left} hari lagi` }
  return { tone: 'grey', text: 'Belum mulai' }
}

/** "2 jam lalu", "kemarin", "3 hari lalu", else the date. */
export function ago(ts: number, today: string): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(ts))
  const days = dn(today) - dn(day)
  if (days <= 0) {
    const mins = Math.round((Date.now() - ts) / 60000)
    if (mins < 1) return 'baru saja'
    if (mins < 60) return `${mins} menit lalu`
    return `${Math.round(mins / 60)} jam lalu`
  }
  if (days === 1) return 'kemarin'
  if (days < 7) return `${days} hari lalu`
  return fmt(day)
}

/** "Jabatan · Fungsi", without repeating the function when the job title already is it. */
export function jobLine(d: Domain, m: Person | undefined): string {
  if (!m) return ''
  const fn = d.fn(m.functionId)?.name ?? ''
  return [m.role, fn && fn.toLowerCase() !== m.role.trim().toLowerCase() ? fn : ''].filter(Boolean).join(' · ')
}
