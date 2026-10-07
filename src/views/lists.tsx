// Renderers for the product views (src/domain/views.ts): every surface that shows Perlu tindakan,
// Menunggu orang lain or a week's schedule uses these, so a row reads the same everywhere.
import { useState } from 'react'
import { Avatar } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { peek } from '../app/nav.ts'
import { useBoard } from '../data/board-context.ts'
import { DAY_NAMES, daysSince, dow, fmt, VIEWS } from '../domain/index.ts'
import type { ActionItem, ScheduleItem, ViewId, WaitItem } from '../domain/index.ts'
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
              <div className="tt">{a.title}</div>
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
              <div className="tt">{w.title}</div>
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
                  <div className="tt">{x.title}</div>
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

/** Title of a product view, for section headers. */
export const viewTitle = (id: ViewId): string => VIEWS[id].title
