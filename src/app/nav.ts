// Navigation by record identity (docs/ARCHITECTURE.md §G): one record, one address, wherever it
// is shown. Lists open records in the side peek; direct URLs and "Buka halaman penuh" open the
// full record view. Both go through the URL, so refresh and copy-link work.
import type { Domain, Id, RecordTarget } from '../domain/index.ts'
import { addrPath, go, setUI } from './ui.ts'
import type { Addr, RecKind, Tab } from './ui.ts'

/** The address of a record on the board, or null when it is not there (not readable). */
export function addrOf(d: Domain, t: RecordTarget): Addr | null {
  if (t.kind === 'project') return null
  const rec = t.kind === 'task' ? d.task(t.id) : t.kind === 'gate' ? d.mstone(t.id) : d.ask(t.id)
  if (!rec) return null
  const p = d.project(rec.projectId)
  return { code: p?.code || rec.projectId, kind: t.kind as RecKind, ref: rec.ref || rec.id }
}

/** Resolve an address to ids: projectId '' when the project is not readable, id '' when the record is not found. */
export function resolveAddr(d: Domain, a: Addr): { projectId: Id; id: Id } {
  const projectId = d.resolveProject(a.code)
  return { projectId, id: projectId ? d.resolveRecord(projectId, a.kind, a.ref) : '' }
}

/** Open a record in the side peek over the current screen; a project opens its page. */
export function peek(d: Domain, t: RecordTarget): void {
  if (t.kind === 'project') return openProject(d, t.id)
  const a = addrOf(d, t)
  if (a) setUI({ peek: a })
}

/** Open a record on its full page. */
export function openFull(d: Domain, t: RecordTarget): void {
  if (t.kind === 'project') return openProject(d, t.id)
  const a = addrOf(d, t)
  if (a) go({ view: 'record', pid: a.code, rec: a })
}

export function openProject(d: Domain, projectId: Id, tab: Tab = 'milestone', extra: Partial<Parameters<typeof go>[0]> = {}): void {
  const p = d.project(projectId)
  if (p) go({ view: 'project', pid: p.code || p.id, tab, who: 'all', q: '', ...extra })
}

/** Absolute link to a record or project for copying. */
export function linkOf(d: Domain, t: RecordTarget): string {
  if (t.kind === 'project') {
    const p = d.project(t.id)
    return p ? `${location.origin}${location.pathname}#/p/${encodeURIComponent(p.code || p.id)}` : ''
  }
  const a = addrOf(d, t)
  return a ? `${location.origin}${location.pathname}#/p/${addrPath(a)}` : ''
}
