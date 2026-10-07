// Unit tests for domain helpers the golden file does not exercise: linkify, commitAfterEdit,
// decWho, reaches, formatting, e-mail escaping, reminders, calendar links and planning helpers.
import { describe, expect, it } from 'vitest'
import {
  addDays,
  createDomain,
  dn,
  escapeHtml,
  fmt,
  fmtLong,
  fmtTs,
  hash,
  initials,
  isoWeek,
  linkify,
  range,
  tsToDate,
  weekStartOf,
} from '../src/domain/index.ts'
import type { Board, Domain, Reminder, Task, Viewer } from '../src/domain/index.ts'
import { PROJECT_ID, PROTOTYPE_URL, prototypeBoard } from './fixtures/prototype-board.ts'

const TODAY = '2026-10-07'
const domain = (board: Board = prototypeBoard(), viewer: Viewer | null = null, today = TODAY): Domain =>
  createDomain(board, { today, appUrl: PROTOTYPE_URL, viewer })
const must = <T>(x: T | null | undefined, what: string): T => {
  if (x === null || x === undefined) throw new Error(`missing ${what}`)
  return x
}
const base = domain()
const taskOf = (d: Domain, id: string): Task => must(d.task(id), id)

describe('linkify', () => {
  it('returns no segments for empty input', () => {
    expect(linkify('')).toEqual([])
    expect(linkify(null)).toEqual([])
  })

  it('links http and https URLs and keeps the text around them', () => {
    expect(linkify('Lihat https://drive.google.com/x?a=1&b=2 dan http://intra/y.')).toEqual([
      { text: 'Lihat ' },
      { text: 'https://drive.google.com/x?a=1&b=2', href: 'https://drive.google.com/x?a=1&b=2' },
      { text: ' dan ' },
      { text: 'http://intra/y.', href: 'http://intra/y.' },
    ])
    expect(linkify('https://a.example')).toEqual([{ text: 'https://a.example', href: 'https://a.example' }])
  })

  it('never links other schemes', () => {
    for (const s of [
      'javascript:alert(1)',
      'JavaScript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://files.example.com/a',
      'mailto:x@example.com',
    ])
      expect(linkify(s)).toEqual([{ text: s }])
  })

  it('treats markup as text and stops a URL at "<"', () => {
    const s = '<a href="javascript:alert(1)">https://ok.example</a>'
    const segs = linkify(s)
    expect(segs).toEqual([
      { text: '<a href="javascript:alert(1)">' },
      { text: 'https://ok.example', href: 'https://ok.example' },
      { text: '</a>' },
    ])
    expect(segs.map((x) => x.text).join('')).toBe(s)
    expect(segs.every((x) => x.href === undefined || /^https?:\/\//.test(x.href))).toBe(true)
  })
})

describe('commitAfterEdit (prototype saveTask)', () => {
  const t = { ...taskOf(base, 'MB04') } // Yani's task in a gated project
  const committed: Task = { ...t, committed: true }
  const moved: Task = { ...committed, end: addDays(t.end, 2) }

  it('new task', () => {
    expect(base.commitAfterEdit(t, null, true)).toEqual({ committed: true, stamp: true })
    expect(base.commitAfterEdit(t, null, null)).toEqual({ committed: false, stamp: false })
    // Prototype quirk kept: stamp without a PIC, committed stays false.
    expect(base.commitAfterEdit({ ...t, assignee: '' }, null, true)).toEqual({ committed: false, stamp: true })
  })

  it('unchanged dates and PIC keep the commitment without a new stamp', () => {
    expect(base.commitAfterEdit(committed, committed, null)).toEqual({ committed: true, stamp: false })
    expect(base.commitAfterEdit(committed, committed, false)).toEqual({ committed: true, stamp: false })
    expect(base.commitAfterEdit(committed, committed, true)).toEqual({ committed: true, stamp: false })
    expect(base.commitAfterEdit(t, t, true)).toEqual({ committed: true, stamp: true })
  })

  it("'off' and a hidden commit box on changed dates clear it", () => {
    expect(base.commitAfterEdit(committed, committed, 'off')).toEqual({ committed: false, stamp: false })
    expect(base.commitAfterEdit(moved, committed, false)).toEqual({ committed: false, stamp: false })
  })

  it('changed dates with no explicit choice: recommitted only if the editor may commit for the same PIC', () => {
    expect(base.commitAfterEdit(moved, committed, null)).toEqual({ committed: true, stamp: true })
    const b = prototypeBoard()
    b.people = b.people.map((p) => ({ ...p, userId: `u-${p.id}` }))
    const as = (personId: string): Viewer => ({ userId: `u-${personId}`, personId, isSuperAdmin: false })
    expect(domain(b, as('m-yani')).commitAfterEdit(moved, committed, null)).toEqual({ committed: true, stamp: true })
    expect(domain(b, as('m-david')).commitAfterEdit(moved, committed, null)).toEqual({ committed: false, stamp: false })
    expect(base.commitAfterEdit({ ...committed, assignee: 'm-muti' }, committed, null)).toEqual({
      committed: false,
      stamp: false,
    })
  })

  it('light mode (gate mode off) leaves commitment alone', () => {
    const b = prototypeBoard()
    for (const p of b.projects) p.gateMode = false
    expect(domain(b).commitAfterEdit(moved, committed, 'off')).toEqual({ committed: true, stamp: false })
  })
})

describe('decWho', () => {
  it('shows the recorder when nobody else decided', () => {
    expect(base.decWho(null, 'm-dika')).toBe('Dika')
    expect(base.decWho({ deciderName: '', forum: 'Weekly review GM', decidedOn: '2026-10-12' }, 'm-dika')).toBe(
      'Dika · Weekly review GM',
    )
    expect(base.decWho(null, null)).toBe('Project Manager')
  })

  it('shows decider, forum, date, then the recorder', () => {
    expect(base.decWho({ deciderName: 'Pak X', forum: 'Weekly review GM', decidedOn: '2026-10-12' }, 'm-dika')).toBe(
      'Pak X · Weekly review GM · 12 Okt · dicatat Dika',
    )
    expect(base.decWho({ deciderName: 'Pak X', forum: '', decidedOn: '' }, 'm-dika')).toBe('Pak X · dicatat Dika')
    expect(base.decWho({ deciderName: 'Pak X', forum: '', decidedOn: '2026-10-12' }, null)).toBe(
      'Pak X · 12 Okt · dicatat Project Manager',
    )
  })
})

describe('reaches (dependency cycle check)', () => {
  it('follows deps transitively', () => {
    expect(base.reaches('MB21', 'TB-OKT')).toBe(true)
    expect(base.reaches('TB-OKT', 'MB21')).toBe(false)
    expect(base.reaches('MB27', 'TB-NOV')).toBe(true)
    expect(base.reaches('MB01', 'MB01')).toBe(true)
    expect(base.reaches('unknown', 'MB01')).toBe(false)
  })

  it('terminates on an existing cycle', () => {
    const b = prototypeBoard()
    const link = (id: string, deps: string[]): void => {
      must(b.tasks.find((t) => t.id === id), id).deps = deps
    }
    link('MB01', ['MB02'])
    link('MB02', ['MB03'])
    link('MB03', ['MB01'])
    const d = domain(b)
    expect(d.reaches('MB01', 'MB03')).toBe(true)
    expect(d.reaches('MB01', 'MB04')).toBe(false)
  })

  it('follows acceptance-only prerequisites too, as the database does', () => {
    const b = prototypeBoard()
    must(b.tasks.find((t) => t.id === 'MB05'), 'MB05').acceptDeps = ['MB04']
    const d = domain(b)
    expect(d.reaches('MB05', 'MB04')).toBe(true)
  })
})

describe('dates and text', () => {
  it('formats like the prototype (id-ID)', () => {
    expect(fmt('2026-10-07')).toBe('7 Okt')
    expect(fmt('2026-10-07', { weekday: 'short', day: 'numeric', month: 'short' })).toBe('Rab, 7 Okt')
    expect(fmtLong('2026-10-07')).toBe('Rabu, 7 Oktober 2026')
    expect(range('2026-10-05', '2026-10-09')).toBe('5 Okt – 9 Okt')
    expect(range('2026-10-05', '2026-10-05')).toBe('5 Okt')
  })

  it('formats timestamps and dates of instants in Asia/Jakarta', () => {
    expect(fmtTs(1791300779741)).toBe('6 Okt, 22.32')
    expect(tsToDate(Date.UTC(2026, 9, 6, 17, 0))).toBe('2026-10-07')
    expect(tsToDate(Date.UTC(2026, 9, 6, 16, 59))).toBe('2026-10-06')
  })

  it('does calendar arithmetic on day numbers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekStartOf('2026-10-07')).toBe('2026-10-05')
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05')
    expect(isoWeek('2026-10-07')).toBe(41)
    expect(isoWeek('2027-01-01')).toBe(53)
    expect(dn('')).toBeNaN()
  })

  it('escapes e-mail HTML exactly like the prototype E()', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(`&lt;a href=&quot;x&quot;&gt;Tom &amp; 'Jerry'&lt;/a&gt;`)
  })

  it('initials and hash', () => {
    expect(initials('Dika Irawan Putra')).toBe('DI')
    expect(initials('')).toBe('?')
    expect(hash('m-dika')).toBe(1129747973)
  })
})

describe('status chips (prototype due/statusChip)', () => {
  const t = taskOf(base, 'MB01') // ends 9 Okt
  it('time comes first, then the stage', () => {
    expect(base.due(t)).toEqual({ kind: 'soon', text: '2 hari lagi' })
    expect(base.due({ ...t, end: TODAY })).toEqual({ kind: 'soon', text: 'Deadline hari ini' })
    expect(base.due({ ...t, end: '2026-10-01' })).toEqual({ kind: 'late', text: 'Telat 6 hari' })
    expect(base.due({ ...t, stage: 'review' })).toEqual({ kind: 'rv', text: 'Menunggu pemeriksa' })
    expect(base.due({ ...t, stage: 'done' })).toEqual({ kind: 'ok', text: 'Diterima' })
    expect(base.due({ ...t, end: '2026-11-01' })).toBeNull()
    expect(base.statusChip({ ...t, end: '2026-11-01', stage: 'progress' })).toEqual({ kind: '', text: 'Dikerjakan' })
  })
})

describe('milestone numbers', () => {
  it('fall back to the immutable ref when a gate has no code', () => {
    const b = prototypeBoard()
    for (const m of b.milestones) m.code = null
    const d = domain(b)
    expect(d.msNo(must(d.mstone('G10'), 'G10'))).toBe('G10')
  })

  it('fall back to M1…Mn by order when a gate has neither code nor ref (prototype data)', () => {
    const b = prototypeBoard()
    for (const m of b.milestones) {
      m.code = null
      m.ref = ''
    }
    const d = domain(b)
    expect(d.msNo(must(d.mstone('G0'), 'G0'))).toBe('M1')
    expect(d.msNo(must(d.mstone('G10'), 'G10'))).toBe('M11')
  })
})

describe('value chain from the step template', () => {
  const p = must(base.project(PROJECT_ID), 'project')
  it('splits strip (chain + output) from side steps', () => {
    const steps = must(base.vcSteps(p), 'steps')
    expect(steps.strip.map((s) => s.code)).toEqual([
      'appraise',
      'procure',
      'receive',
      'store',
      'pick',
      'load',
      'transport',
      'deliver',
      'collect',
      'report',
    ])
    expect(steps.side.map((s) => s.code)).toEqual(['lp'])
    expect(base.vcLabel(must(steps.strip[0], 'first'))).toBe('⓪ Appraise')
    expect(base.vcLabel(must(steps.side[0], 'lp'))).toBe('Logistics services')
  })

  it('hasVC needs a template and at least one task in a step', () => {
    expect(base.hasVC(p)).toBe(true)
    const noTpl = prototypeBoard()
    for (const x of noTpl.projects) x.stepTemplateId = null
    const d = domain(noTpl)
    expect(d.hasVC(d.project(PROJECT_ID))).toBe(false)
    expect(d.vcSteps(d.project(PROJECT_ID))).toBeNull()
    const noSteps = prototypeBoard()
    for (const t of noSteps.tasks) t.steps = []
    const e = domain(noSteps)
    expect(e.hasVC(e.project(PROJECT_ID))).toBe(false)
  })
})

describe('digest e-mail', () => {
  const withEmail = (patch: Partial<Board['settings']> = {}, daily = true): Board => {
    const b = prototypeBoard(patch)
    b.people = b.people.map((p) => (p.id === 'm-yani' ? { ...p, email: 'yani@example.com', emailDaily: daily } : p))
    const t = must(b.tasks.find((x) => x.id === 'MB04'), 'MB04')
    t.title = `<script>alert("x")</script> & 'q'`
    return b
  }

  it('escapes stored text in the HTML body and keeps it raw in the text body', () => {
    const d = domain(withEmail())
    const mail = d.emailFor(must(d.digestFor('m-yani'), 'digest'))
    expect(mail.to).toBe('yani@example.com')
    expect(mail.html).toContain(`>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; 'q'</a></b>`)
    expect(mail.html).toContain(`href="${PROTOTYPE_URL}/#/p/MB/t/MB04"`)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain(`href="${PROTOTYPE_URL}"`)
    expect(mail.text).toContain(`• <script>alert("x")</script> & 'q'\n  Project Margin Bridge · G2 · `)
  })

  it('digestAll sends to people with an address and something to do', () => {
    const run = domain(withEmail()).digestAll(TODAY)
    expect(run.emails.map((e) => [e.memberId, e.count, e.to])).toEqual([['m-yani', 8, 'yani@example.com']])
    expect(run.skipped.map((s) => s.memberId)).toEqual(['m-david', 'm-dika', 'm-muti'])
    expect(run.reason).toBeNull()
  })

  it('honours emailDaily, pause, weekends and holidays', () => {
    expect(domain(withEmail({}, false)).digestAll(TODAY).skipped).toContainEqual({
      memberId: 'm-yani',
      name: 'Yani',
      reason: 'Email harian dimatikan',
    })
    expect(domain(withEmail({ emailPaused: true })).digestAll(TODAY)).toMatchObject({
      paused: true,
      reason: 'Email harian sedang dijeda',
      emails: [],
    })
    expect(base.digestAll('2026-10-10')).toMatchObject({ workday: false, reason: 'Akhir pekan', emails: [] })
    expect(base.digestAll('2026-12-25')).toMatchObject({ workday: false, reason: 'Hari libur: Natal' })
    expect(base.digestAll().date).toBe(TODAY)
  })
})

describe('reminders', () => {
  const reminder = (patch: Partial<Reminder> = {}): Reminder => ({
    id: 'r1',
    projectId: PROJECT_ID,
    taskId: 'MB04',
    toMember: 'm-yani',
    message: 'Halo Yani, mohon dicek <segera>.',
    note: null,
    status: 'menunggu',
    by: 'm-dika',
    at: 1791300779741,
    sentAt: null,
    ...patch,
  })
  const board = (email: string | null, r: Reminder[] = [reminder()]): Board => {
    const b = prototypeBoard()
    b.people = b.people.map((p) => (p.id === 'm-yani' ? { ...p, email } : p))
    b.reminders = r
    return b
  }

  it('queues a sendable reminder with the task details', () => {
    const d = domain(board('yani@example.com'))
    const t = taskOf(d, 'MB04')
    expect(d.remPending('MB04')?.id).toBe('r1')
    const { out, skip } = d.reminderQueue()
    expect(skip).toEqual([])
    expect(out).toHaveLength(1)
    const mail = must(out[0], 'reminder')
    expect(mail).toMatchObject({ id: 'r1', taskId: 'MB04', memberId: 'm-yani', name: 'Yani', to: 'yani@example.com' })
    expect(mail.subject).toBe(`[SAMB] Pengingat dari Dika: ${t.title}`)
    expect(mail.text).toBe(
      `Halo Yani, mohon dicek <segera>.\n\nTask: ${t.title}\nProject: Project Margin Bridge\nMilestone: G2 · ${must(d.mstone(t.milestoneId), 'ms').title}\nJadwal: ${range(t.start, t.end)}\nStatus: Belum mulai\nBukti yang diminta: ${t.proof}\n\nBuka SAMB Project Board:\n${PROTOTYPE_URL}\n\nPengingat ini dikirim oleh Dika lewat SAMB Project Board.`,
    )
    expect(mail.html).toContain('Halo Yani, mohon dicek &lt;segera&gt;.')
    expect(d.digestAll('2026-10-10').reminders).toHaveLength(1)
  })

  it('skips with a reason when it cannot be sent', () => {
    const d = domain(board(null))
    expect(d.remWhy(reminder())).toBe('Penerima belum punya email')
    expect(d.reminderQueue().skip).toEqual([{ id: 'r1', taskId: 'MB04', reason: 'Penerima belum punya email' }])
    expect(d.remPending('MB04')).toBeNull()
    expect(d.remStatusText(reminder(), false)).toBe('Pengingat ke Yani tidak akan terkirim: penerima belum punya email.')
    expect(domain(board('yani@example.com')).remWhy(reminder({ toMember: 'm-muti' }))).toBe('PIC task sudah diganti')
    expect(domain(board('yani@example.com')).remWhy(reminder({ taskId: 'gone' }))).toBe('Task sudah dihapus')
  })

  it('signs reminders without a recorder as the board PM and reports status', () => {
    const d = domain(board('yani@example.com'))
    expect(d.reminderEmail(reminder({ by: null }))?.subject).toMatch(/^\[SAMB\] Pengingat dari Project Manager SAMB Project Board: /)
    expect(d.remStatusText(reminder(), false)).toBe(
      'Pengingat ke Yani menunggu dikirim (dicatat 6 Okt, 22.32). Pengiriman aktif setelah email disambungkan.',
    )
    expect(d.remStatusText(reminder({ status: 'terkirim', sentAt: 1791300779741 }), true)).toBe(
      'Pengingat terakhir terkirim ke Yani · 6 Okt, 22.32',
    )
    expect(d.remStatusText(reminder({ status: 'dibatalkan', note: 'Task dihapus' }), true)).toBe(
      'Pengingat ke Yani dibatalkan: Task dihapus',
    )
    expect(domain(board('yani@example.com', [])).digestAll('2026-10-10').reminders).toEqual([])
  })
})

describe('calendar links', () => {
  const t = taskOf(base, 'MB01')
  it('describes the task', () => {
    expect(base.calDetails(t)).toBe(
      `Project: Project Margin Bridge\nMilestone: G0 · ${must(base.mstone('G0'), 'G0').title}\nPIC: -\nPemeriksa: Dika\nJadwal: 5 Okt – 9 Okt\nBukti yang diminta: ${t.proof}\n\nBuka di SAMB Project Board: ${PROTOTYPE_URL}/#/p/MB/t/${t.id}`,
    )
  })

  it('builds all-day deadline links', () => {
    const g = base.calUrl(t, 'google')
    expect(g.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&text=Deadline%3A%20Approve')).toBe(true)
    expect(g).toContain('&dates=20261009/20261010&')
    expect(g.endsWith('&ctz=Asia%2FJakarta')).toBe(true)
    const o = base.calUrl(t, 'outlook365')
    expect(o).toContain('&allday=true&subject=Deadline%3A%20Approve')
    expect(o).toContain('&startdt=2026-10-09&enddt=2026-10-10&')
  })

  it('reports moved and removed deadlines from the viewer calendar', () => {
    expect(
      base.calIssues([
        { taskId: 'MB01', end: '2026-10-08', title: 'old title', at: 0 },
        { taskId: 'GONE', end: '2026-10-01', title: 'Deleted', at: 0 },
        { taskId: 'MB02', end: taskOf(base, 'MB02').end, title: 'same', at: 0 },
      ]),
    ).toEqual([
      { id: 'MB01', kind: 'changed', title: t.title, old: '2026-10-08', end: '2026-10-09', t },
      { id: 'GONE', kind: 'gone', title: 'Deleted', end: '2026-10-01' },
    ])
  })
})

describe('planning helpers', () => {
  it('wzTaskDefaults starts after the last task, on a working day', () => {
    expect(base.wzTaskDefaults(['a', 'b'], { a: [{ end: '2026-12-23' }] }, 'b')).toEqual({
      start: '2026-12-28',
      end: '2027-01-01',
    })
    expect(base.wzTaskDefaults(['a'], {}, 'a')).toEqual({ start: TODAY, end: '2026-10-11' })
    expect(domain(prototypeBoard(), null, '2026-10-10').wzTaskDefaults(['a'], {}, 'a').start).toBe('2026-10-12')
  })

  it('nextSteps lists what is missing, with an action', () => {
    const p = must(base.project(PROJECT_ID), 'project')
    const steps = base.nextSteps(p)
    expect(steps.filter((s) => !s.ok)).toEqual([
      { ok: false, text: 'Tentukan PIC untuk "Capture data fisik November untuk laporan pertama: pallet-days, handling, trip, workload LP"', action: { kind: 'editTask', taskId: 'CAP-NOV' } },
      { ok: false, text: `Tulis bukti yang diminta untuk "${taskOf(base, 'TB-DES').title}"`, action: { kind: 'editTask', taskId: 'TB-DES' } },
      { ok: false, text: 'Tanggal task G0 dikomit PIC (0/3)', action: { kind: 'week' } },
    ])
    expect(steps).toHaveLength(10)
    const owner = domain(prototypeBoard(), { userId: 'u', personId: 'm-dika', isSuperAdmin: true })
    const last = must(owner.nextSteps(p).at(-1), 'last step')
    expect(last.ok).toBe(false)
    expect(last.text).toMatch(/^4 orang belum punya akun: undang lewat Anggota \(/)
    expect(last.action).toEqual({ kind: 'members' })
  })

  it('health reports overdue asks and late tasks', () => {
    const later = domain(prototypeBoard(), null, '2026-10-13')
    const h = must(later.health(must(later.project(PROJECT_ID), 'project')), 'health')
    expect(h.level).toBe('bad')
    expect(h.items).toContain('7 keputusan lewat batas')
    expect(h.items[0]).toMatch(/^\d+ task telat$/)
  })
})
