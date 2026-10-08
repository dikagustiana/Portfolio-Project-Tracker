// How a project event reads (docs/ARCHITECTURE.md §F): "Dika menerima MB12 · …". Pure, so the
// activity feed, records, Beranda and Tinjauan mingguan phrase history the same way.
import { bareTitle, dn, fmt } from '../domain/index.ts'
import type { EventVerb, ProjectEvent, Tone } from '../domain/index.ts'

const VERB: Record<EventVerb, [string, Tone]> = {
  task_created: ['menambah task', 'grey'],
  task_started: ['mulai mengerjakan', 'indigo'],
  task_submitted: ['mengajukan untuk diperiksa', 'violet'],
  task_withdrawn: ['menarik pengajuan', 'grey'],
  task_accepted: ['menerima', 'green'],
  task_completed: ['menyelesaikan', 'green'],
  task_rejected: ['menolak', 'red'],
  task_reopened: ['membuka lagi', 'amber'],
  task_deleted: ['menghapus task', 'grey'],
  pic_changed: ['mengganti PIC', 'grey'],
  commitment_made: ['mengomit tanggal', 'indigo'],
  commitment_changed: ['mengubah komitmen', 'amber'],
  commitment_cleared: ['membatalkan komitmen tanggal', 'amber'],
  blocker_raised: ['menandai terhambat', 'red'],
  blocker_resolved: ['menyelesaikan hambatan', 'green'],
  blocker_escalated: ['mengangkat hambatan menjadi Keputusan', 'amber'],
  gate_passed: ['meluluskan milestone', 'green'],
  gate_stopped: ['menghentikan milestone', 'red'],
  gate_rescoped: ['mengubah rencana milestone', 'amber'],
  decision_requested: ['meminta keputusan', 'amber'],
  decision_made: ['mencatat keputusan', 'green'],
  decision_reopened: ['membuka lagi keputusan', 'amber'],
  project_created: ['membuat project', 'indigo'],
  project_closed: ['menutup project', 'green'],
  project_stopped: ['menghentikan project', 'red'],
  project_reopened: ['membuka lagi project', 'amber'],
  member_added: ['menambah anggota', 'grey'],
  member_role_changed: ['mengubah peran', 'grey'],
  member_removed: ['mengeluarkan anggota', 'grey'],
  comment_added: ['berkomentar di', 'grey'],
}

const ROLE: Record<string, string> = { project_admin: 'Project Admin', member: 'Member', viewer: 'Viewer' }
export const roleLabel = (r: string | null | undefined): string => (r ? (ROLE[r] ?? r) : '—')

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

export interface EventLine {
  /** "Dika menerima" */
  who: string
  verb: string
  /** "MB12" */
  ref: string
  title: string
  /** Extra line: reason, dates, decider… ('' when none). */
  note: string
  tone: Tone
}

export function eventLine(e: ProjectEvent): EventLine {
  const [verb, tone] = VERB[e.verb] ?? [e.verb, 'grey']
  const m = e.meta
  let note: string
  switch (e.verb) {
    case 'task_rejected':
      note = str(m.reason) ? `Alasan: ${str(m.reason)}` : ''
      break
    case 'task_submitted':
      note = Number(m.round) > 1 ? `Putaran ${str(m.round)}` : ''
      break
    case 'commitment_changed': {
      const from = str(m.prev_end)
      const to = str(m.end)
      const base = str(m.baseline_end)
      const slip = from && to ? dn(to) - dn(from) : 0
      note = from && to ? `${fmt(from)} → ${fmt(to)} (${slip > 0 ? '+' : ''}${slip} hari)${base && base !== from ? ` · komitmen awal ${fmt(base)}` : ''}` : ''
      break
    }
    case 'commitment_made':
      note = str(m.end) ? `Selesai ${fmt(str(m.end))}` : ''
      break
    case 'commitment_cleared':
      note = str(m.end) && str(m.new_end) && m.end !== m.new_end ? `Jadwal berubah ${fmt(str(m.end))} → ${fmt(str(m.new_end))}` : ''
      break
    case 'pic_changed':
      note = `${str(m.from) || 'tanpa PIC'} → ${str(m.to) || 'tanpa PIC'}`
      break
    case 'blocker_raised':
      note = [str(m.reason), str(m.need) && `butuh ${str(m.need)}`, str(m.from) && `dari ${str(m.from)}`, str(m.function) && `fungsi ${str(m.function)}`]
        .filter(Boolean)
        .join(' · ')
      break
    case 'blocker_resolved':
      note = [str(m.resolution), m.days !== undefined ? `${str(m.days)} hari terhambat` : ''].filter(Boolean).join(' · ')
      break
    case 'blocker_escalated':
      note = str(m.ask) ? `Menjadi ${str(m.ask)}` : ''
      break
    case 'gate_passed':
    case 'gate_stopped':
    case 'gate_rescoped':
    case 'decision_made':
    case 'project_closed':
    case 'project_stopped':
    case 'project_reopened':
      note = [str(m.note), str(m.decider) && `diputuskan ${str(m.decider)}`, str(m.forum)].filter(Boolean).join(' · ')
      break
    case 'decision_reopened':
      note = str(m.note)
      break
    case 'member_added':
    case 'member_removed':
      note = roleLabel(str(m.role))
      break
    case 'member_role_changed':
      note = `${roleLabel(str(m.from))} → ${roleLabel(str(m.role))}`
      break
    case 'comment_added':
      note = str(m.excerpt)
      break
    default:
      note = ''
  }
  return { who: e.actorName || 'Sistem', verb, ref: e.objectRef, title: bareTitle(e.objectRef, e.objectTitle), note, tone }
}
