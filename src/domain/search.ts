// Quick Find and record addresses (docs/ARCHITECTURE.md §G). Both work over the RLS-filtered
// board, so a restricted project can never appear in results, suggestions or counts.
import type { BoardIndex } from './lookup.ts'
import type { Rules } from './rules.ts'
import type { Id } from './types.ts'
import type { RecordKind, RecordTarget } from './views.ts'

export type HitKind = 'project' | 'task' | 'gate' | 'ask' | 'person'
export interface SearchHit {
  kind: HitKind
  id: Id
  projectId: Id
  ref: string
  title: string
  sub: string
  score: number
}

const SEG: Record<Exclude<RecordKind, 'project'>, string> = { task: 't', gate: 'g', ask: 'k' }
const enc = encodeURIComponent

/** Hash path of a project: #/p/MB or #/p/MB/<tab>. */
/**
 * A title without its own short id in front ("K01 · Sahkan …" → "Sahkan …"). Imported records
 * often carry the id in the text; lists already show it as a tag, so it is not repeated.
 */
export const bareTitle = (ref: string, title: string): string =>
  ref && title.startsWith(`${ref} · `) ? title.slice(ref.length + 3) : title

export const projectPath = (code: string, tab?: string): string => `#/p/${enc(code)}${tab ? `/${tab}` : ''}`
/** Hash path of a record: #/p/MB/t/MB12, #/p/MB/g/G3, #/p/MB/k/K01. */
export const recordPath = (code: string, kind: Exclude<RecordKind, 'project'>, ref: string): string =>
  `#/p/${enc(code)}/${SEG[kind]}/${enc(ref)}`

export interface Addressing {
  /** Path of a record or project ('' when it is not on the board). */
  pathOf: (target: RecordTarget) => string
  /** Absolute link for e-mails and calendars. */
  urlOf: (target: RecordTarget) => string
  /** Resolve a project by code or id. */
  resolveProject: (codeOrId: string) => Id
  /** Resolve a record address inside a project (case-insensitive ref, or a raw id). */
  resolveRecord: (projectId: Id, kind: Exclude<RecordKind, 'project'>, refOrId: string) => Id
  search: (q: string, limit?: number) => SearchHit[]
}

export function makeAddressing(ix: BoardIndex, rules: Rules, appUrl: string, involved: (projectId: Id) => boolean): Addressing {
  const { board } = ix
  const code = (projectId: Id): string => ix.project(projectId)?.code || projectId

  const pathOf = (t: RecordTarget): string => {
    if (t.kind === 'project') {
      const p = ix.project(t.id)
      return p ? projectPath(p.code || p.id) : ''
    }
    const rec = t.kind === 'task' ? ix.task(t.id) : t.kind === 'gate' ? ix.milestone(t.id) : ix.ask(t.id)
    return rec ? recordPath(code(rec.projectId), t.kind, rec.ref || rec.id) : ''
  }

  const score = (q: string, ref: string, title: string, text: string): number => {
    const r = ref.toLowerCase()
    const ti = title.toLowerCase()
    if (r && r === q) return 1000
    if (r && r.startsWith(q)) return 800 - Math.min(50, r.length - q.length)
    if (ti.startsWith(q)) return 600
    if (ti.split(/[^a-z0-9]+/i).some((w) => w.startsWith(q))) return 500
    if (ti.includes(q)) return 400
    if (text.toLowerCase().includes(q)) return 200
    return 0
  }

  return {
    pathOf,
    urlOf: (t) => {
      const p = pathOf(t)
      return p ? `${appUrl.replace(/\/$/, '')}/${p}` : appUrl
    },
    resolveProject: (s) => (ix.project(s) ?? ix.projectByCode(s))?.id ?? '',
    resolveRecord(projectId, kind, s) {
      if (kind === 'task') return (ix.taskByRef(projectId, s) ?? (ix.task(s)?.projectId === projectId ? ix.task(s) : undefined))?.id ?? ''
      if (kind === 'gate')
        return (ix.milestoneByRef(projectId, s) ?? (ix.milestone(s)?.projectId === projectId ? ix.milestone(s) : undefined))?.id ?? ''
      return (ix.askByRef(projectId, s) ?? (ix.ask(s)?.projectId === projectId ? ix.ask(s) : undefined))?.id ?? ''
    },
    search(raw, limit = 20) {
      const q = raw.trim().toLowerCase()
      if (!q) return []
      // A typed "MB/MB12" or "MB MB12" also works.
      const parts = q.split(/[\s/]+/).filter(Boolean)
      const scoped = parts.length === 2 ? ix.projectByCode(parts[0] ?? '') : undefined
      const needle = scoped ? (parts[1] ?? q) : q
      const hits: SearchHit[] = []
      const boost = (projectId: Id, open: boolean): number =>
        (rules.pActive(ix.project(projectId)) ? 30 : 0) + (involved(projectId) ? 20 : 0) + (open ? 10 : 0)
      const add = (h: Omit<SearchHit, 'score'>, s: number, open: boolean) => {
        if (s <= 0) return
        if (scoped && h.projectId !== scoped.id) return
        hits.push({ ...h, score: s + boost(h.projectId, open) })
      }
      for (const p of board.projects)
        add({ kind: 'project', id: p.id, projectId: p.id, ref: p.code, title: p.name, sub: p.entity }, score(needle, p.code, p.name, p.outcome), rules.pActive(p))
      for (const t of board.tasks)
        add(
          { kind: 'task', id: t.id, projectId: t.projectId, ref: t.ref, title: t.title, sub: ix.project(t.projectId)?.name ?? '' },
          score(needle, t.ref, t.title, t.desc),
          !rules.isDone(t),
        )
      for (const m of board.milestones)
        add(
          { kind: 'gate', id: m.id, projectId: m.projectId, ref: rules.msNo(m), title: m.title, sub: ix.project(m.projectId)?.name ?? '' },
          Math.max(score(needle, m.ref, m.title, m.criteria), m.code ? score(needle, m.code, '', '') : 0),
          !['lulus', 'stop'].includes(rules.msState(m)),
        )
      for (const a of board.asks)
        add(
          { kind: 'ask', id: a.id, projectId: a.projectId, ref: a.ref, title: a.question, sub: ix.project(a.projectId)?.name ?? '' },
          score(needle, a.ref, a.question, `${a.context} ${a.answer ?? ''}`),
          a.status !== 'decided',
        )
      if (!scoped)
        for (const p of board.people)
          if (score(needle, '', p.name, p.role) > 0)
            hits.push({ kind: 'person', id: p.id, projectId: '', ref: '', title: p.name, sub: p.role, score: score(needle, '', p.name, p.role) })
      return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'id')).slice(0, limit)
    },
  }
}
