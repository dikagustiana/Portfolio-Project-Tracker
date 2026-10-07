// Renderers for the product views (src/domain/views.ts): every surface that shows Perlu tindakan,
// Menunggu orang lain or a week's schedule uses these, so a row reads the same everywhere.
import { useState } from 'react'
import { Avatar } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { peek } from '../app/nav.ts'
import { useBoard } from '../data/board-context.ts'
import { bareTitle, DAY_NAMES, daysSince, dow, fmt, fmtTs, MS_LABEL, P_LABEL, VIEWS } from '../domain/index.ts'
import type { ActionItem, Decision, ScheduleItem, WaitItem } from '../domain/index.ts'
import { RefTag, Tag } from './record/parts.tsx'

const projectName = (name: string | undefined) => (name ? `${name} · ` : '')

export function ActionRows({ items, showWho = false, limit, showProject = true }: {
  items: readonly ActionItem[]
  showWho?: boolean
  limit?: number
  showProject?: boolean
}) {
  const { d, today } = useBoard()
  const flows = useFlows()
  const [all, setAll] = useState(false)
  if (!items.length) return <div className="empty-line">{VIEWS['perlu-tindakan'].empty}</div>
  const shown = limit && !all ? items.slice(0, limit) : items
  const open = (a: ActionItem) => {
    if (a.kind === 'close') return flows.openClose(a.projectId, 'close')
    peek(d, a.target)
  }
  return (
    <div className="rows">
      {shown.map((a) => {
        const late = a.when < today && (a.kind === 'decide-ask' || a.kind === 'commit' || a.kind === 'rework' || a.kind === 'blocker')
        return (
          <button key={a.key} className="li" onClick={() => open(a)}>
            <RefTag r={a.ref} />
            <div style={{ minWidth: 0 }}>
              <div className="tt">{bareTitle(a.ref, a.title)}</div>
              <div className="sub">
                {showProject ? projectName(d.project(a.projectId)?.name) : ''}
                {a.detail}
                {showWho && a.who ? ` · ${d.mname(a.who)}` : ''}
                {late ? ` · sejak ${fmt(a.when)}` : ''}
              </div>
            </div>
            <div className="end">
              <Tag tone={a.tone}>{a.label}</Tag>
            </div>
          </button>
        )
      })}
      {limit && items.length > limit && (
        <button className="linkbtn" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setAll((x) => !x)}>
          {all ? 'Tampilkan lebih sedikit' : `Lihat ${items.length - limit} lainnya`}
        </button>
      )}
    </div>
  )
}

export function WaitRows({ items, limit }: { items: readonly WaitItem[]; limit?: number }) {
  const { d, today } = useBoard()
  const [all, setAll] = useState(false)
  if (!items.length) return <div className="empty-line">{VIEWS.menunggu.empty}</div>
  const shown = limit && !all ? items.slice(0, limit) : items
  const LABEL: Record<WaitItem['kind'], string> = { review: 'Pemeriksaan', decision: 'Keputusan', blocker: 'Hambatan', dependency: 'Prasyarat' }
  return (
    <div className="rows">
      {shown.map((w) => {
        const days = daysSince(w.since, today)
        return (
          <button key={w.key} className="li" onClick={() => peek(d, w.target)}>
            <RefTag r={w.ref} />
            <div style={{ minWidth: 0 }}>
              <div className="tt">{bareTitle(w.ref, w.title)}</div>
              <div className="sub">
                {projectName(d.project(w.projectId)?.name)}
                {w.onLabel}
              </div>
            </div>
            <div className="end">
              {w.on && <Avatar id={w.on} size={22} />}
              <Tag tone={days > 5 ? 'red' : days > 2 ? 'amber' : 'grey'}>
                {LABEL[w.kind]} · {days <= 0 ? 'hari ini' : `${days} hari`}
              </Tag>
            </div>
          </button>
        )
      })}
      {limit && items.length > limit && (
        <button className="linkbtn" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setAll((x) => !x)}>
          {all ? 'Tampilkan lebih sedikit' : `Lihat ${items.length - limit} lainnya`}
        </button>
      )}
    </div>
  )
}

/** A week's dated items, grouped by day. */
export function ScheduleRows({ items, showWho = false, limit }: { items: readonly ScheduleItem[]; showWho?: boolean; limit?: number }) {
  const { d, today } = useBoard()
  const [all, setAll] = useState(false)
  if (!items.length) return <div className="empty-line">{VIEWS['minggu-ini'].empty}</div>
  const shown = limit && !all ? items.slice(0, limit) : items
  const days = [...new Set(shown.map((x) => x.date))]
  return (
    <div className="rows">
      {days.map((day) => (
        <div key={day}>
          <div className="h3" style={{ margin: '10px 0 2px', color: day === today ? 'var(--accent)' : undefined }}>
            {DAY_NAMES[dow(day)]} · {fmt(day)}
            {day === today ? ' · hari ini' : ''}
          </div>
          {shown
            .filter((x) => x.date === day)
            .map((x) => (
              <button key={x.key} className="li" onClick={() => peek(d, x.target)}>
                <RefTag r={x.ref} />
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{bareTitle(x.ref, x.title)}</div>
                  <div className="sub">
                    {d.project(x.projectId)?.name ?? ''}
                    {showWho && x.who ? ` · ${d.mname(x.who)}` : ''}
                  </div>
                </div>
                <div className="end">
                  <Tag tone={x.tone}>{x.label}</Tag>
                </div>
              </button>
            ))}
        </div>
      ))}
      {limit && items.length > limit && (
        <button className="linkbtn" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setAll((x) => !x)}>
          {all ? 'Tampilkan lebih sedikit' : `Lihat ${items.length - limit} lainnya`}
        </button>
      )}
    </div>
  )
}

const label = <K extends string>(map: Record<K, string>, k: string): string => (k in map ? map[k as K] : k)

/**
 * The decision log (gates, project close/reopen, Keputusan) as a timeline. Each line names what
 * was decided, the decision or note, the rationale when recorded, and who decided where and when
 * next to who recorded it.
 */
export function DecisionRows({ items, showProject = true, empty = 'Belum ada keputusan yang dicatat.' }: {
  items: readonly Decision[]
  showProject?: boolean
  empty?: string
}) {
  const { d } = useBoard()
  if (!items.length) return <div className="empty-line">{empty}</div>
  return (
    <div className="tl">
      {items.map((x) => {
        const p = d.project(x.projectId)
        const a = x.askId ? d.ask(x.askId) : undefined
        const m = x.milestoneId ? d.mstone(x.milestoneId) : undefined
        const what =
          x.kind === 'ask'
            ? `${a?.ref ?? 'Keputusan'} · ${x.status === 'decided' ? 'diputuskan' : 'dibuka lagi'}`
            : x.kind === 'gate'
              ? `${m ? d.msNo(m) : 'Milestone'} · ${label(MS_LABEL, x.status)}`
              : `Project · ${label(P_LABEL, x.status)}`
        const tone = x.status === 'lulus' || x.status === 'decided' || x.status === 'selesai' ? 'green' : x.status === 'stop' || x.status === 'dihentikan' ? 'red' : 'amber'
        return (
          <div key={x.id} className={`ev tone-${tone}`}>
            <div style={{ minWidth: 0 }}>
              <div>
                <b>{what}</b>
                {a && (
                  <>
                    {' '}
                    <button className="linkbtn" onClick={() => peek(d, { kind: 'ask', id: a.id })}>
                      {(() => {
                        const q = bareTitle(a.ref, a.question)
                        return q.length > 70 ? `${q.slice(0, 70)}…` : q
                      })()}
                    </button>
                  </>
                )}
                {!a && m && (
                  <>
                    {' '}
                    <button className="linkbtn" onClick={() => peek(d, { kind: 'gate', id: m.id })}>
                      {m.title}
                    </button>
                  </>
                )}
              </div>
              {x.note && <div className="note">{x.note}</div>}
              {x.rationale && <div className="note">Alasan: {x.rationale}</div>}
              <div className="when">
                {showProject && p ? `${p.name} · ` : ''}
                {d.decWho(x.src, x.by)} · {fmtTs(x.at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
