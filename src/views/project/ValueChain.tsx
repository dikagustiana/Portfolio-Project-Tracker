// TEMPORARY local stub (not committed): the project-view branch provides the real VcStrip.
import type { Project } from '../../domain/index.ts'
export function VcStrip({ p }: { p: Project; sel?: string; link?: boolean }) {
  return <div className="sub">Value chain {p.name}</div>
}
