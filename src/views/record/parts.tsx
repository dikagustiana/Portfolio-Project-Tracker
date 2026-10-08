// Pieces shared by the record views, Beranda, Portofolio and project tabs: one look for a record
// row wherever it appears, the history timeline, comments, and small semantic status tags.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Linkified } from '../../app/bits.tsx'
import { eventLine } from '../../app/events.ts'
import { useOverlay } from '../../app/overlay-context.ts'
import { linkOf, peek } from '../../app/nav.ts'
import { messageOf } from '../../data/actions.ts'
import { useBoard } from '../../data/board-context.ts'
import { bareTitle, fmtTs, range } from '../../domain/index.ts'
import type { Id, ProjectEvent, RecordTarget, Task, Tone } from '../../domain/index.ts'
import { ago, taskStatus } from './status.ts'

export function RefTag({ r }: { r: string }) {
  return r ? <span className="ref">{r}</span> : null
}

export function Tag({ tone, children, box }: { tone: Tone; children: ReactNode; box?: boolean }) {
  return <span className={`tag tone-${tone}${box ? ' box' : ''}`}>{children}</span>
}

/** A section card with a title, an optional count and a "more" link. */
export function Section({ title, n, more, onMore, children, id }: {
  title: ReactNode
  n?: number
  more?: string
  onMore?: () => void
  children: ReactNode
  id?: string
}) {
  return (
    <section className="sec" id={id}>
      <div className="sec-h">
        <h2>
          {title}
          {n !== undefined && <span className="n">{n}</span>}
        </h2>
        {more && onMore && (
          <button className="more" onClick={onMore}>
            {more}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

/** Progress bar with the percentage; tone follows the state it describes. */
export function ProgBar({ p, tone = 'indigo', label }: { p: number; tone?: Tone; label?: string }) {
  return (
    <div className="prog" title={label}>
      <div className={`pbar tone-${tone}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <i style={{ width: `${Math.max(p ? 3 : 0, p)}%` }} />
      </div>
      <b>{p}%</b>
    </div>
  )
}

/** One task as a list row: ref, title, context line, status. Click opens the peek. */
export function TaskLine({ t, sub, showProject = true, end }: { t: Task; sub?: ReactNode; showProject?: boolean; end?: ReactNode }) {
  const { d } = useBoard()
  const s = taskStatus(d, t)
  const p = d.project(t.projectId)
  const par = t.parentId ? d.task(t.parentId) : undefined
  const prog = d.hasChildren(t) ? d.taskProg(t) : null
  return (
    <button className="li" onClick={() => peek(d, { kind: 'task', id: t.id })}>
      <RefTag r={t.ref} />
      <div style={{ minWidth: 0 }}>
        <div className="tt">{t.title}</div>
        <div className="sub">
          {sub ?? (
            <>
              {showProject && p ? `${p.name} · ` : ''}
              {par ? `${par.ref} · ` : ''}
              {range(t.start, t.end)}
              {t.assignee ? ` · ${d.mname(t.assignee)}` : t.ownerFunctionId ? ` · fungsi ${d.fn(t.ownerFunctionId)?.name ?? ''}` : ' · belum ada PIC'}
              {prog ? ` · ${prog.d}/${prog.n} sub-task` : ''}
            </>
          )}
        </div>
      </div>
      <div className="end">{end ?? <Tag tone={s.tone}>{s.text}</Tag>}</div>
    </button>
  )
}

/** A generic record row (gate, Keputusan, project) that opens in the peek. */
export function RecordLine({ target, r, title, sub, tone, label }: {
  target: RecordTarget
  r: string
  title: string
  sub: ReactNode
  tone: Tone
  label: string
}) {
  const { d } = useBoard()
  return (
    <button className="li" onClick={() => peek(d, target)}>
      <RefTag r={r} />
      <div style={{ minWidth: 0 }}>
        <div className="tt">{bareTitle(r, title)}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className="end">
        <Tag tone={tone}>{label}</Tag>
      </div>
    </button>
  )
}

/** History as a timeline (newest first). `withObject` shows which record each line is about. */
export function Timeline({ events, limit, withObject = true, empty = 'Belum ada riwayat.' }: {
  events: readonly ProjectEvent[]
  limit?: number
  withObject?: boolean
  empty?: string
}) {
  const { d, today } = useBoard()
  const [all, setAll] = useState(false)
  const shown = limit && !all ? events.slice(0, limit) : events
  if (!events.length) return <div className="empty-line">{empty}</div>
  const open = (e: ProjectEvent) => {
    const kind = e.objectType === 'milestone' ? 'gate' : e.objectType === 'ask' ? 'ask' : e.objectType === 'task' ? 'task' : null
    if (kind && e.objectId && (kind === 'task' ? d.task(e.objectId) : kind === 'gate' ? d.mstone(e.objectId) : d.ask(e.objectId)))
      peek(d, { kind, id: e.objectId })
  }
  return (
    <div className="tl">
      {shown.map((e) => {
        const l = eventLine(e)
        return (
          <div key={e.id} className={`ev tone-${l.tone}`}>
            <div style={{ minWidth: 0 }}>
              <div>
                <b>{l.who}</b> {l.verb}
                {withObject && (l.ref || l.title) && (
                  <>
                    {' '}
                    <button className="linkbtn" style={{ fontWeight: 600 }} onClick={() => open(e)}>
                      {l.ref ? `${l.ref} · ` : ''}
                      {l.title.length > 80 ? `${l.title.slice(0, 80)}…` : l.title}
                    </button>
                  </>
                )}
                {e.objectType === 'member' && !withObject && <> {l.title}</>}
              </div>
              {l.note && <div className="note">{l.note}</div>}
              <div className="when" title={fmtTs(e.at)}>
                {ago(e.at, today)}
                {withObject && d.project(e.projectId) ? ` · ${d.project(e.projectId)?.name ?? ''}` : ''}
              </div>
            </div>
          </div>
        )
      })}
      {limit && events.length > limit && (
        <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setAll((x) => !x)}>
          {all ? 'Tampilkan lebih sedikit' : `Lihat ${events.length - limit} riwayat lain`}
        </button>
      )}
    </div>
  )
}

/** Comments on a task or Keputusan: append-only, author and time kept. */
export function Comments({ kind, id, projectId }: { kind: 'task' | 'ask'; id: Id; projectId: Id }) {
  const { d, actions, refresh } = useBoard()
  const { toast } = useOverlay()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const list = d.commentsOf(id)
  const can = d.canContribute(projectId) && !d.locked({ projectId })
  const post = async () => {
    if (!body.trim()) return
    setBusy(true)
    try {
      await actions.addComment(kind, id, body.trim())
      setBody('')
      await refresh()
    } catch (e) {
      toast(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      {list.length === 0 && <div className="empty-line" style={{ marginBottom: 8 }}>Belum ada komentar.</div>}
      {list.map((c) => (
        <div key={c.id} className="cmt">
          <Avatar id={c.author} size={26} />
          <div style={{ minWidth: 0 }}>
            <div className="who">
              {d.mname(c.author) || 'Akun tanpa nama'}
              <small title={fmtTs(c.at)}>{fmtTs(c.at)}</small>
            </div>
            <div className="body">
              <Linkified text={c.body} />
            </div>
          </div>
        </div>
      ))}
      {can && (
        <div style={{ marginTop: 12 }}>
          <textarea
            className="inp"
            rows={2}
            placeholder="Tulis komentar untuk diskusi di record ini"
            aria-label="Komentar baru"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void post()
            }}
          />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn sm primary" disabled={busy || !body.trim()} onClick={() => void post()}>
              Kirim komentar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Copy the record's link (works for peek and full page alike). */
export function CopyLink({ target }: { target: RecordTarget }) {
  const { d } = useBoard()
  const { toast } = useOverlay()
  return (
    <button
      className="btn sm ghost"
      title="Salin tautan record ini"
      onClick={() => {
        const url = linkOf(d, target)
        void navigator.clipboard?.writeText(url).then(
          () => toast('Tautan disalin'),
          () => toast(url),
        )
      }}
    >
      Salin tautan
    </button>
  )
}

/** Breadcrumb: Project › Gate › Package › Record. */
export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="crumbs" aria-label="Lokasi">
      {items.map((x, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep">›</span>}
          {x.onClick ? <button onClick={x.onClick}>{x.label}</button> : <span>{x.label}</span>}
        </span>
      ))}
    </nav>
  )
}
