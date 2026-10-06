// Project page: header + tabs Milestone, Value chain, Checklist, Pipeline, Gantt (prototype viewProject).
import { Head } from '../app/bits.tsx'
import type { Project } from '../domain/index.ts'

export function ProjectView({ p }: { p: Project }) {
  return <Head eyebrow="Project" title={p.name} />
}
