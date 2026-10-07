// Gantt tab (prototype viewGantt + bindGantt): day/week zoom, holiday and cuti shading, pale dashed
// bars for uncommitted dates, dependency arrows, milestone targets. Dragging a bar moves it,
// dragging its right edge resizes it: a planner saves the new dates (the database clears the
// commitment), the PIC commits them; anyone else just opens the task.
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Avatar } from '../../app/bits.tsx'
import { useFlows } from '../../app/flows.ts'
import { useOverlay } from '../../app/overlay-context.ts'
import { useUI } from '../../app/ui.ts'
import { messageOf } from '../../data/actions.ts'
import { useBoard } from '../../data/board-context.ts'
import { fmt, MS_LABEL, range, STAGES } from '../../domain/index.ts'
import type { DateStr, Id, Project, Task } from '../../domain/index.ts'
import { useReadOnly } from './hooks.ts'
import { NoMatch } from './ListTab.tsx'
import { draggedDates, ganttLayout } from './model.ts'
import type { GanttLayout } from './model.ts'

interface Props {
  p: Project
  /** The filtered tasks. */
  ts: readonly Task[]
  /** A PIC filter or search is active: milestones without matching tasks are left out. */
  filtering: boolean
}

export function Gantt(props: Props) {
  if (!props.ts.length) return <NoMatch />
  // A fresh chart (after the tab or an empty filter result) scrolls to today, like the prototype.
  return <GanttChart {...props} />
}

interface Drag {
  t: Task
  resize: boolean
  x: number
  /** Whole days moved so far. */
  k: number
  moved: boolean
}

/** Warnings not worth repeating after a drag (they are about the task, not its new dates). */
const QUIET = ['Belum ada pemeriksa', 'Bukti']

function GanttChart({ p, ts, filtering }: Props) {
  const { d, actions, refresh } = useBoard()
  const flows = useFlows()
  const { toast } = useOverlay()
  const ui = useUI()
  const ro = useReadOnly(p)
  const g = d.gated(p)

  // Dates of a dropped bar until the refetched board shows them (or the save fails).
  const [moved, setMoved] = useState<{ id: Id; start: DateStr; end: DateStr } | null>(null)
  const view = useMemo(
    () => (moved ? ts.map((t) => (t.id === moved.id ? { ...t, start: moved.start, end: moved.end } : t)) : ts),
    [ts, moved],
  )
  const L = useMemo(() => ganttLayout(d, p, view, ui.zoom, filtering), [d, p, view, ui.zoom, filtering])

  // First render scrolls to today − 4 days; afterwards the wrapper keeps its own scroll position.
  const wrap = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useLayoutEffect(() => {
    const w = wrap.current
    if (!w || scrolled.current) return
    scrolled.current = true
    w.scrollLeft = L.initialScroll
  }, [L.initialScroll])

  const drag = useRef<Drag | null>(null)
  const [live, setLive] = useState<{ id: Id; resize: boolean; k: number } | null>(null)

  const canDrag = (t: Task) => d.canPlan(p) || (g && d.canCommit(t))

  async function save(t: Task, k: number, resize: boolean) {
    const nd = draggedDates(t, k, resize)
    const when = range(nd.start, nd.end)
    setMoved({ id: t.id, ...nd })
    try {
      if (d.canPlan(p)) {
        await actions.saveTask({ id: t.id, start_date: nd.start, end_date: nd.end })
        const w = d.warnings({ ...t, ...nd, committed: false }, p).filter((x) => !QUIET.some((q) => x.startsWith(q)))
        toast(
          `Jadwal diubah: ${when}` +
            (t.committed ? ' · tanggal jadi belum dikomit, PIC perlu komit ulang' : '') +
            (w.length ? ` · ${w[0]}` : ''),
        )
      } else {
        await actions.commitTaskDates(t.id, nd.start, nd.end)
        toast(`Tanggal dikomit: ${when}`)
      }
      await refresh()
    } catch (e) {
      toast(messageOf(e))
    } finally {
      setMoved(null)
    }
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, t: Task) => {
    if (ro || e.button > 0) return
    if (d.locked(t) || !canDrag(t)) {
      flows.openTask(t.id)
      return
    }
    const resize = e.target instanceof Element && e.target.classList.contains('gh')
    drag.current = { t, resize, x: e.clientX, k: 0, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    setLive({ id: t.id, resize, k: 0 })
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g0 = drag.current
    if (!g0) return
    const dx = e.clientX - g0.x
    if (Math.abs(dx) > 4) g0.moved = true
    const k = Math.round(dx / L.DW)
    if (k !== g0.k) {
      g0.k = k
      setLive({ id: g0.t.id, resize: g0.resize, k })
    }
  }
  const onUp = () => {
    const g0 = drag.current
    if (!g0) return
    drag.current = null
    setLive(null)
    if (!g0.moved) flows.openTask(g0.t.id)
    else if (g0.k !== 0) void save(g0.t, g0.k, g0.resize)
  }
  // The browser took the gesture over (e.g. a touch scroll): drop the drag without acting.
  const onCancel = () => {
    drag.current = null
    setLive(null)
  }

  return (
    <>
      <div className="gwrap" id="gwrap" ref={wrap}>
        <div className="ginner">
          <GanttBg L={L} />
          <GanttArrows L={L} />
          <GanttHead L={L} />
          {L.rows.map((r) => {
            if (r.kind !== 'task') {
              const m = r.kind === 'ms' ? r.m : null
              return (
                <div key={r.key} className="grow msr">
                  <div className="glabel">
                    <span className="ell">{m ? `${d.msNo(m)} · ${m.title}` : 'Tanpa milestone'}</span>
                    {r.kind === 'ms' && (
                      <span className={`chip ${r.state}`} style={{ fontSize: 10.5, padding: '2px 7px' }}>
                        {MS_LABEL[r.state]}
                      </span>
                    )}
                  </div>
                  <div className="gtrack" style={{ width: L.W }}>
                    {r.kind === 'ms' && r.target && (
                      <>
                        <div
                          className={`gdia tgt${r.late ? ' late' : ''}`}
                          style={{ left: r.target.left }}
                          title={`Target ${d.msNo(r.m)}: ${fmt(r.m.target)}`}
                        />
                        <span className={`gtl${r.late ? ' late' : ''}`} style={{ left: r.target.labelLeft }}>
                          Target {d.msNo(r.m)} · {fmt(r.m.target)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            }
            const t = r.t
            const isLive = live?.id === t.id
            const k = isLive ? live.k : 0
            const left = isLive && !live.resize ? r.left + k * L.DW : r.left
            const width = isLive && live.resize ? Math.max(L.DW, r.width + k * L.DW) : r.width
            const draft = d.needsCommit(t)
            return (
              <div key={r.key} className="grow">
                <div className={`glabel${r.child ? ' child' : ''}`}>
                  <Avatar id={t.assignee} size={24} />
                  <button title={`${t.ref ? `${t.ref} · ` : ''}${t.title}`} onClick={() => flows.openTask(t.id)}>
                    {t.ref && <span className="ref">{t.ref}</span>}
                    {t.title}
                  </button>
                </div>
                <div className="gtrack" style={{ width: L.W }}>
                  <div
                    className={`gbar s-${t.stage}${d.isLate(t) ? ' late' : ''}${draft ? ' draft' : ''}${isLive ? ' dragging' : ''}`}
                    style={{ left, width }}
                    title={`${t.title} · ${range(t.start, t.end)} · ${d.workdays(t.start, t.end)} hari kerja${draft ? ' · tanggal belum dikomit' : ''}`}
                    onPointerDown={(e) => onDown(e, t)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onCancel}
                  >
                    <span>{t.title}</span>
                    {!ro && <i className="gh" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <div className="legend">
          {STAGES.map((s) => (
            <span key={s.id}>
              <i className={`s-${s.id}`} style={{ background: 'var(--sc)' }} />
              {s.name}
            </span>
          ))}
          <span>
            <i style={{ border: '2px solid var(--ink)', transform: 'rotate(45deg)' }} />
            Target milestone
          </span>
          {g && (
            <span>
              <i style={{ border: '1.5px dashed var(--muted)' }} />
              Tanggal belum dikomit
            </span>
          )}
          <span>
            <i style={{ background: 'var(--danger-soft)' }} />
            Libur / cuti bersama
          </span>
          <span>
            <i style={{ background: 'var(--danger)', height: 2 }} />
            Jadwal bentrok
          </span>
        </div>
        <span className="sub">{ro ? '' : 'Geser bar untuk ubah jadwal, tarik ujung kanan untuk ubah durasi.'}</span>
      </div>
    </>
  )
}

/** Weekend, holiday and cuti shading plus the today line. */
const GanttBg = memo(function GanttBg({ L }: { L: GanttLayout }) {
  return (
    <div className="gbg" style={{ left: 'var(--lw)', width: L.W }}>
      {L.shades.map((s) => (
        <div key={s.key} className={s.cls} style={{ left: s.left, width: L.DW }} />
      ))}
      <div className="gtoday" style={{ left: L.todayLeft }} title="Hari ini" />
    </div>
  )
})

/** Finish-to-start arrows; red and dashed when the waiting task starts before its dependency ends. */
const GanttArrows = memo(function GanttArrows({ L }: { L: GanttLayout }) {
  return (
    <svg className="garrows" style={{ left: 'var(--lw)', top: 48 }} width={L.W} height={L.height} aria-hidden="true">
      <defs>
        <marker id="ga-n" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M1 1L9 5L1 9z" fill="var(--muted)" />
        </marker>
        <marker id="ga-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M1 1L9 5L1 9z" fill="var(--danger)" />
        </marker>
      </defs>
      {L.arrows.map((a) => (
        <path
          key={a.key}
          d={a.path}
          fill="none"
          stroke={a.bad ? 'var(--danger)' : 'var(--muted)'}
          strokeWidth="1.5"
          strokeDasharray={a.bad ? '4 3' : undefined}
          markerEnd={`url(#ga-${a.bad ? 'r' : 'n'})`}
        />
      ))}
    </svg>
  )
})

/** Sticky month and day header. */
const GanttHead = memo(function GanttHead({ L }: { L: GanttLayout }) {
  return (
    <div className="ghead">
      <div className="grow" style={{ height: 48 }}>
        <div className="glabel">Task</div>
        <div className="gtrack" style={{ width: L.W }}>
          <div className="gmonths">
            {L.months.map((m) => (
              <div key={m.key} className="gm" style={{ width: m.width }}>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="gdays">
            {L.days.map((x) => (
              <div
                key={x.key}
                className={`gd${x.today ? ' today' : ''}${x.hol ? ' hol' : ''}`}
                style={{ width: L.DW }}
                title={x.hol?.name}
              >
                {x.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
