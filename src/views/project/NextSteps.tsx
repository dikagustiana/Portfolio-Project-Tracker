// "Langkah berikutnya" checklist for planners (prototype nextStepsHtml).
import { useFlows } from '../../app/flows.ts'
import { useBoard } from '../../data/board-context.ts'
import type { NextStepAction, Project } from '../../domain/index.ts'
import { useGo, useReadOnly } from './hooks.ts'

const LABEL: Record<NextStepAction['kind'], string> = {
  team: 'Buka Tim',
  editProject: 'Edit project',
  newMs: 'Tambah milestone',
  newTask: 'Tambah task',
  editTask: 'Edit task',
  week: 'Minggu ini',
}
/** Planning actions carry the prototype's .wp class (hidden for non-planners). */
const PLAN_ONLY: ReadonlySet<NextStepAction['kind']> = new Set(['editProject', 'newMs', 'newTask'])

export function NextSteps({ p }: { p: Project }) {
  const { d, viewer } = useBoard()
  const flows = useFlows()
  const go = useGo()
  const ro = useReadOnly(p)
  if (!d.canPlan(p)) return null
  const L = d.nextSteps(p)
  const done = L.filter((x) => x.ok).length
  if (done === L.length)
    return (
      <div className="banner" style={{ background: 'var(--done-soft)', margin: 0 }}>
        <span>
          <b>✓ Persiapan beres.</b> Semua langkah persiapan project sudah lengkap.
        </span>
      </div>
    )

  const run = (a: NextStepAction) => {
    switch (a.kind) {
      case 'team':
        return go({ view: 'team' })
      case 'week':
        return go({ view: 'week' })
      case 'editProject':
        return flows.openProject(p.id)
      case 'newMs':
        return flows.openMs(p.id)
      case 'newTask':
        return flows.openTask(null, { projectId: p.id, milestoneId: a.milestoneId })
      case 'editTask':
        return flows.openTask(a.taskId)
    }
  }
  // "Buka Tim" is for the owner only (the Team screen is where people are linked).
  const shown = (a: NextStepAction | null): a is NextStepAction => !!a && !ro && (a.kind !== 'team' || viewer.isOwner)

  const todo = L.filter((x) => !x.ok)
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Langkah berikutnya</h2>
        <span className="sub">
          {todo.length} lagi · {done} sudah beres
        </span>
      </div>
      <div className="bar" style={{ margin: '-4px 0 10px' }}>
        <i style={{ width: `${(done / L.length) * 100}%` }} />
      </div>
      <div className="nx">
        {todo.map(({ text, action: a }, i) => (
          <div key={i} className="nx-row">
            <span className="nx-ic">✓</span>
            <span className="nx-t">{i === 0 ? <b>{text}</b> : text}</span>
            {shown(a) && (
              <button className={`btn sm${PLAN_ONLY.has(a.kind) ? ' wp' : ''}`} onClick={() => run(a)}>
                {LABEL[a.kind]}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
