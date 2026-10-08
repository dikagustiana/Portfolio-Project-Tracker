// Small shared pieces of the board UI, ported from the prototype's HTML helpers
// (av, due/statusChip, flagsHtml, tip, linkify, head, ckBtn, whoLine, trowHtml, rowActs).
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBoard } from '../data/board-context.ts'
import { AVC, fmt, hash, initials, linkify, range } from '../domain/index.ts'
import type { Chip, Id, Project, Task } from '../domain/index.ts'
import { useFlows } from './flows.ts'
import { GLOSS } from './gloss.ts'
import { IC } from './icons.ts'
import type { IconName } from './icons.ts'
import { useShell } from './shell-context.ts'

export function Icon({ name }: { name: IconName }) {
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: IC[name] }} />
}

/** Initials avatar (prototype av). */
export function Avatar({ id, size }: { id: Id | null | undefined; size?: number }) {
  const { d } = useBoard()
  const m = d.person(id)
  const st = size ? { width: size, height: size } : undefined
  if (!m) return <span className="av none" style={st} title="Belum ditentukan">?</span>
  return (
    <span className="av" style={{ background: AVC[hash(m.legacyId ?? m.id) % AVC.length], ...st }} title={m.name}>
      {initials(m.name)}
    </span>
  )
}

export function ChipView({ chip }: { chip: Chip | null }) {
  if (!chip) return null
  return <span className={`chip ${chip.kind}`.trim()}>{chip.text}</span>
}

/** Up to two flags, the rest folded into "+n lainnya" (prototype flagsHtml). */
export function Flags({ t, p }: { t: Task; p: Project | null | undefined }) {
  const { d } = useBoard()
  const F = d.taskFlags(t, p)
  if (!F.length) return null
  const cls = ['f-bad', 'f-warn', 'f-info']
  const rest = F.slice(2)
  return (
    <div className="flags">
      {F.slice(0, 2).map(([l, x], i) => (
        <span key={i} className={`flag ${cls[l]}`}>
          {l < 2 ? '⚠ ' : ''}
          {x}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="flag f-info" title={rest.map((r) => r[1]).join(' · ')}>
          +{rest.length} lainnya
        </span>
      )}
    </div>
  )
}

/** (?) glossary tip with a popover (prototype tip/showPop). */
export function Tip({ k }: { k: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (e.target instanceof Node && btn.current?.contains(e.target)) return
      setPos(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null)
    document.addEventListener('click', close, true)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close, true)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [pos])
  useEffect(() => {
    // Flip above the button when the popover would leave the viewport.
    const el = pop.current
    const b = btn.current
    if (!el || !b || !pos) return
    const r = b.getBoundingClientRect()
    if (r.bottom + 8 + el.offsetHeight > window.innerHeight) el.style.top = `${r.top - el.offsetHeight - 8}px`
  }, [pos])
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tip"
        aria-label="Penjelasan"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (pos) return setPos(null)
          const r = e.currentTarget.getBoundingClientRect()
          const W = Math.min(280, window.innerWidth - 24)
          setPos({ left: Math.max(12, Math.min(r.left - 20, window.innerWidth - W - 12)), top: r.bottom + 8 })
        }}
      >
        ?
      </button>
      {pos && (
        <div ref={pop} className="pop" role="tooltip" style={{ left: pos.left, top: pos.top }}>
          {GLOSS[k] ?? ''}
        </div>
      )}
    </>
  )
}

/** Stored text rendered as text; only http(s) URLs become links (BRIEF §2.7). */
export function Linkified({ text }: { text: string | null | undefined }) {
  return (
    <>
      {linkify(text ?? '').map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

/** Page header (prototype head). */
export function Head({ eyebrow, title, actions }: { eyebrow: ReactNode; title: ReactNode; actions?: ReactNode }) {
  const { toggleDrawer } = useShell()
  return (
    <div className="topbar">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'nowrap', minWidth: 0 }}>
        <button className="icon-btn menu-btn" aria-label="Buka menu" onClick={toggleDrawer}>
          <Icon name="menu" />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="h1">{title}</h1>
        </div>
      </div>
      <div className="row">{actions}</div>
    </div>
  )
}

/** The round check box on a task (prototype ckBtn). */
export function CkBtn({ t }: { t: Task }) {
  const { d } = useBoard()
  const flows = useFlows()
  const st = d.isDone(t) ? 'on' : t.stage === 'review' ? 'rv' : ''
  if (d.locked(t)) return <button className={`ck ${st}`} disabled aria-label="Project tidak aktif" />
  // A package is submitted only once its sub-tasks are accepted.
  const open = d.isDone(t) || t.stage === 'review' ? [] : d.children(t.id).filter((k) => !d.isDone(k))
  if (open.length) {
    const why = `Menunggu sub-task diterima: ${open.map((k) => k.ref).join(', ')}`
    return <button className={`ck ${st}`} disabled aria-label={`${why}: ${t.title}`} title={why} />
  }
  const lbl = d.isDone(t) ? 'Sudah diterima' : t.stage === 'review' ? 'Menunggu pemeriksa' : 'Ajukan selesai'
  return (
    <button
      className={`ck ${st}`}
      aria-label={`${lbl}: ${t.title}`}
      title={lbl}
      onClick={(e) => {
        e.stopPropagation()
        flows.onCheck(t.id)
      }}
    />
  )
}

/** "PIC: X · Pemeriksa: Y" (prototype whoLine). */
export function WhoLine({ t, p }: { t: Task; p: Project | null | undefined }) {
  const { d } = useBoard()
  return (
    <>
      PIC: <b>{d.mname(t.assignee) || 'belum ditentukan'}</b>
      {d.gated(p) && (
        <>
          {' · Pemeriksa: '}
          <b>{d.mname(d.validatorOf(t)) || 'Project Admin'}</b>
        </>
      )}
    </>
  )
}

/** Quick calendar and reminder buttons on a checklist row (prototype rowActs). */
export function RowActs({ t }: { t: Task }) {
  const { d, board, extras } = useBoard()
  const flows = useFlows()
  const p = d.project(t.projectId)
  if (d.isDone(t) || !d.pActive(p)) return null
  const c = extras.calendar.find((x) => x.taskId === t.id)
  const canRem = d.canPlan(p) && !d.locked(t)
  const pend = d.remPending(t.id)
  const mailActive = board.settings.emailProvider !== 'none' && extras.emailLog.length > 0
  return (
    <div className="racts">
      {c && c.end === t.end ? (
        <span className="ra-ok" title={`Deadline ${fmt(c.end)} sudah ada di kalendermu`}>
          <Icon name="cal" />
          <span>Di kalender</span>
        </span>
      ) : (
        <button className="btn sm ghost ra" title="Tambah ke kalender" onClick={() => flows.openCal(t.id)}>
          <Icon name="cal" />
          <span>{c ? 'Perbarui kalender' : 'Tambah ke kalender'}</span>
        </button>
      )}
      {canRem &&
        (pend ? (
          <span className="ra-ok" title={d.remStatusText(pend, mailActive)}>
            <Icon name="bell" />
            <span>Pengingat menunggu</span>
          </span>
        ) : (
          <button className="btn sm ghost ra" title="Kirim pengingat" onClick={() => flows.openRemind(t.id)}>
            <Icon name="bell" />
            <span>Kirim pengingat</span>
          </button>
        ))}
    </div>
  )
}

/** One checklist row (prototype trowHtml). A package shows its sub-task progress; `child` indents a sub-task. */
export function TRow({ t, p, child }: { t: Task; p: Project | null | undefined; child?: boolean }) {
  const { d } = useBoard()
  const flows = useFlows()
  const pkg = d.hasChildren(t) ? d.taskProg(t) : null
  return (
    <div className={`trow${d.isDone(t) ? ' done' : ''}${child ? ' child' : ''}${pkg ? ' pkg' : ''}`}>
      <CkBtn t={t} />
      <button className="open" onClick={() => flows.openTask(t.id)}>
        <div className="tt">
          {t.ref && <span className="ref">{t.ref}</span>}
          {t.title}
        </div>
        <div className="line2">
          <WhoLine t={t} p={p} /> · {range(t.start, t.end)}
          {pkg && ` · ${pkg.d}/${pkg.n} sub-task diterima`}
          {!t.assignee && t.ownerFunctionId && ` · fungsi ${d.fn(t.ownerFunctionId)?.name ?? ''}`}
        </div>
        <Flags t={t} p={p} />
      </button>
      <div className="st">
        <ChipView chip={d.statusChip(t)} />
        <RowActs t={t} />
      </div>
    </div>
  )
}

