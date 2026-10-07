// Plan checks shown next to tasks and projects: taskFlags (row badges), warnings (task form),
// reaches (dependency cycle check) and nextSteps (the "Langkah berikutnya" checklist).
// With settings.cutiIsWorkday, cuti bersama no longer counts as a holiday in these checks.
import { DAY_NAMES, dow, fmt, isWeekend } from './dates.ts'
import type { HolidayCalendar } from './holidays.ts'
import type { BoardIndex } from './lookup.ts'
import type { Permissions } from './permissions.ts'
import type { Rules } from './rules.ts'
import type { Holiday, Id, Person, Project, Task } from './types.ts'

/** 0 = problem, 1 = warning, 2 = info. */
export type FlagLevel = 0 | 1 | 2
export type Flag = [FlagLevel, string]

/** What the "Langkah berikutnya" row offers (the prototype rendered these as buttons). */
export type NextStepAction =
  | { kind: 'members' }
  | { kind: 'editProject' }
  | { kind: 'newMs' }
  | { kind: 'newTask'; milestoneId: Id }
  | { kind: 'editTask'; taskId: Id }
  | { kind: 'week' }

export interface NextStep {
  ok: boolean
  text: string
  action: NextStepAction | null
}

export interface Checks {
  taskFlags: (t: Task, p: Project | null | undefined) => Flag[]
  /** Warnings for a (draft) task in the task form, most important first. */
  warnings: (t: Task, p: Project | null | undefined) => string[]
  /** Does task `from` (through its deps) reach `target`? Adding target→from would then loop. */
  reaches: (from: Id, target: Id) => boolean
  nextSteps: (p: Project) => NextStep[]
}

const unique = <T>(xs: readonly T[]): T[] => xs.filter((x, i, a) => a.indexOf(x) === i)
const holKind = (h: Holiday): string => (h.type === 'libur' ? 'libur nasional' : 'cuti bersama')

export function makeChecks(
  ix: BoardIndex,
  cal: HolidayCalendar,
  perms: Permissions,
  rules: Rules,
  hasViewer: boolean,
): Checks {
  const { isDone, gated, msNo, msState, seqConflict, needsCommit, durDays } = rules
  const depsOf = (t: Task): Task[] => t.deps.map((id) => ix.task(id)).filter((d): d is Task => !!d)

  // Over both kinds of prerequisite, like the database's cycle check (task_deps_no_cycle).
  const reaches = (from: Id, target: Id, seen = new Set<Id>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    const t = ix.task(from)
    return [...(t?.deps ?? []), ...(t?.acceptDeps ?? [])].some((d) => reaches(d, target, seen))
  }

  return {
    taskFlags(t, p) {
      if (isDone(t)) return []
      const F: Flag[] = []
      const b = ix.openBlocker(t.id)
      if (b) F.push([0, `Terhambat: ${b.reason}`])
      if (t.rejectReason && t.stage !== 'review') F.push([0, `Ditolak: ${t.rejectReason}`])
      if (gated(p) && perms.selfAccept(t)) F.push([0, 'Pemeriksa sama dengan PIC, pilih pemeriksa lain'])
      const deps = depsOf(t)
      if (deps.some((d) => d.end >= t.start)) F.push([0, 'Jadwal bentrok dengan task yang ditunggu'])
      const sc = seqConflict(t)
      if (sc) F.push([1, `Mulai sebelum ${msNo(sc.pv)} selesai`])
      const hs = unique([t.start, t.end])
        .map(cal.offHol)
        .filter((h): h is Holiday => !!h)
      if (hs.length) F.push([1, `Jatuh di hari libur: ${hs.map((h) => h.name).join(', ')}`])
      if (durDays(t) > 14) F.push([1, `Durasi ${durDays(t)} hari, sebaiknya dipecah`])
      if (needsCommit(t) && t.stage !== 'review') F.push([2, 'Tanggal belum dikomit PIC'])
      const blocked = deps.filter((d) => !isDone(d))
      if (blocked.length) F.push([2, `Menunggu: ${blocked.map((d) => d.title).join(', ')}`])
      const par = t.parentId ? ix.task(t.parentId) : undefined
      if (par && (t.start < par.start || t.end > par.end)) F.push([1, `Di luar jadwal paket ${par.ref || par.title}`])
      const acc = t.acceptDeps.map((id) => ix.task(id)).filter((d): d is Task => !!d && !isDone(d))
      if (acc.length) F.push([2, `Diterima setelah: ${acc.map((d) => d.ref || d.title).join(', ')}`])
      return F.sort((a, b) => a[0] - b[0])
    },

    warnings(t, p) {
      if (!t.start || !t.end) return []
      const w: [number, string][] = []
      const W = (pr: number, s: string): void => {
        w.push([pr, s])
      }
      const dd = durDays(t)
      if (gated(p)) {
        if (perms.selfAccept(t))
          W(1, `Pemeriksa task ini jatuh ke ${rules.mname(perms.validatorOf(t))}, yang juga PIC-nya. Pilih pemeriksa lain.`)
        else if (!t.validator)
          W(10, `Belum ada pemeriksa. Yang menerima nanti: ${rules.mname(perms.validatorOf(t)) || 'Project Manager'}.`)
        if (!t.proof) W(11, 'Bukti yang diminta belum diisi. Tanpa ini pemeriksa tidak punya patokan.')
      }
      const m = ix.milestone(t.milestoneId)
      if (m) {
        if (msState(m) === 'stop') W(2, `${msNo(m)} sedang dihentikan.`)
        const sc = seqConflict(t)
        if (sc) W(3, `Mulai sebelum ${msNo(sc.pv)} selesai (${fmt(sc.pe)}), padahal ${msNo(sc.pv)} belum lulus.`)
        if (m.target && t.end > m.target) W(5, `Selesai setelah target ${msNo(m)} (${fmt(m.target)}).`)
        if (msState(m) === 'lulus' && !isDone(t) && ix.task(t.id)?.milestoneId !== t.milestoneId)
          W(6, `${msNo(m)} sudah lulus. Menambah task di sini akan membuka keputusannya lagi.`)
      }
      for (const d of depsOf(t)) if (d.end >= t.start) W(4, `Mulai sebelum "${d.title}" selesai (${fmt(d.end)}).`)
      const hs = cal.offHol(t.start)
      const he = cal.offHol(t.end)
      if (hs) W(7, `Tanggal mulai jatuh di ${holKind(hs)}: ${hs.name}.`)
      if (he && t.end !== t.start) W(7, `Tanggal selesai jatuh di ${holKind(he)}: ${he.name}.`)
      if (isWeekend(t.start)) W(8, `Tanggal mulai jatuh di hari ${DAY_NAMES[dow(t.start)] ?? ''}.`)
      if (isWeekend(t.end)) W(8, `Tanggal selesai jatuh di hari ${DAY_NAMES[dow(t.end)] ?? ''}.`)
      if (dd > 14) W(9, `Durasi ${dd} hari. Task di atas ~2 minggu sebaiknya dipecah jadi beberapa task.`)
      const mid = cal
        .offHolsIn(t.start, t.end)
        .filter((h) => h.date !== t.start && h.date !== t.end && !isWeekend(h.date))
      if (mid.length)
        W(
          12,
          `Rentang ini melewati ${mid.length} hari libur/cuti bersama (${mid.map((h) => `${fmt(h.date)} ${h.name}`).join(', ')}).`,
        )
      if (!cal.holCovered(t.start) || !cal.holCovered(t.end))
        W(13, `Data libur nasional hanya tersedia untuk ${cal.holYears.join(' dan ')}.`)
      return w.sort((a, b) => a[0] - b[0]).map((x) => x[1])
    },

    reaches: (from, target) => reaches(from, target),

    nextSteps(p) {
      const g = gated(p)
      const ms = ix.pms(p.id)
      const ts = ix.ptasks(p.id).filter((t) => !isDone(t))
      const r = rules.readiness(p)
      const noTask = ms.find((m) => !ix.mtasks(m.id).length)
      const noPic = ts.find((t) => !t.assignee)
      const self = ts.find(perms.selfAccept)
      const noProof = ts.find((t) => !t.proof)
      const people = unique([perms.pmOf(p), ...ts.map((t) => t.assignee), ...ts.map((t) => t.validator)].filter(Boolean))
        .map((id) => ix.person(id))
        .filter((x): x is Person => !!x)
      const unlinked = people.filter((m) => !m.userId)
      const admin = perms.isAdminIn(p.id)
      const edit: NextStepAction = { kind: 'editProject' }
      const L: NextStep[] = []
      // Prototype: "S.members.length > 0". Members are per project now, so count this project's memberships.
      L.push({ ok: ix.memberCount(p.id) > 0, text: 'Project Admin menambahkan anggota tim', action: admin ? { kind: 'members' } : null })
      L.push({ ok: !!p.outcome, text: 'Tulis hasil akhir', action: edit })
      L.push({ ok: !!p.measure, text: 'Tulis cara tahu sudah tercapai', action: edit })
      L.push({ ok: !!perms.pmOf(p), text: 'Tentukan PM', action: edit })
      L.push({ ok: ms.length > 0, text: 'Susun minimal satu milestone', action: { kind: 'newMs' } })
      L.push({
        ok: ms.length > 0 && !noTask,
        text: noTask ? `Tambahkan task untuk ${msNo(noTask)}` : 'Setiap milestone punya task',
        action: noTask ? { kind: 'newTask', milestoneId: noTask.id } : null,
      })
      L.push({
        ok: ts.length > 0 && !noPic,
        text: noPic ? `Tentukan PIC untuk "${noPic.title}"` : 'Setiap task punya PIC',
        action: noPic ? { kind: 'editTask', taskId: noPic.id } : null,
      })
      if (g)
        L.push({
          ok: ts.length > 0 && !self,
          text: self ? `Pilih pemeriksa lain untuk "${self.title}"` : 'Pemeriksa setiap task bukan PIC-nya sendiri',
          action: self ? { kind: 'editTask', taskId: self.id } : null,
        })
      if (g)
        L.push({
          ok: ts.length > 0 && !noProof,
          text: noProof ? `Tulis bukti yang diminta untuk "${noProof.title}"` : 'Setiap task punya bukti yang diminta',
          action: noProof ? { kind: 'editTask', taskId: noProof.id } : null,
        })
      if (g)
        L.push({
          ok: !!r?.ready,
          text: r ? `Tanggal task ${msNo(r.m)} dikomit PIC (${r.ok}/${r.n})` : 'Tanggal task dikomit PIC',
          action: r && !r.ready ? { kind: 'week' } : null,
        })
      if (hasViewer)
        L.push({
          ok: people.length > 0 && !unlinked.length,
          text: unlinked.length
            ? `${unlinked.length} orang belum punya akun: undang lewat Anggota (${unlinked
                .slice(0, 3)
                .map((m) => m.name)
                .join(', ')})`
            : 'Semua yang terlibat sudah terhubung ke akunnya',
          action: unlinked.length && admin ? { kind: 'members' } : null,
        })
      return L
    },
  }
}
