// Project page (spec §52): header, then Milestone | Task (Checklist · Pipeline · Gantt · Value
// chain) | Keputusan | Aktivitas | Anggota. Every task row opens the same record in the side peek.
import { Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { setUI, useUI } from '../app/ui.ts'
import type { Tab } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import type { Project } from '../domain/index.ts'
import { ActivityTab } from './project/ActivityTab.tsx'
import { AsksTab } from './project/AsksTab.tsx'
import { Gantt } from './project/Gantt.tsx'
import { ProjectHeader } from './project/Header.tsx'
import { Kanban } from './project/Kanban.tsx'
import { ListTab } from './project/ListTab.tsx'
import { MembersTab } from './project/MembersTab.tsx'
import { MilestoneTab } from './project/MilestoneTab.tsx'
import { effectiveWho, filterTasks, memberOptions, projectTab, topOf } from './project/model.ts'
import { Toolbar } from './project/Toolbar.tsx'
import { ValueChainTab } from './project/ValueChain.tsx'

export function ProjectView({ p }: { p: Project }) {
  const ui = useUI()
  const { d } = useBoard()
  const tab = projectTab(d, p, ui.tab)
  const top = topOf(tab)
  return (
    <>
      <ProjectHeader p={p} />
      <Toolbar p={p} tab={tab} />
      {top === 'milestone' ? (
        <MilestoneTab p={p} />
      ) : top === 'keputusan' ? (
        <AsksTab p={p} />
      ) : top === 'aktivitas' ? (
        <ActivityTab p={p} />
      ) : top === 'anggota' ? (
        <MembersTab p={p} />
      ) : (
        <TaskTab p={p} tab={tab} />
      )}
    </>
  )
}

function TaskTab({ p, tab }: { p: Project; tab: Tab }) {
  const ui = useUI()
  const { d } = useBoard()
  if (!d.ptasks(p.id).length) return <NoTasks p={p} />
  const who = effectiveWho(ui.who, memberOptions(d, p.id))
  const ts = filterTasks(d, p.id, who, ui.q)
  switch (tab) {
    case 'pipeline':
      return <Kanban p={p} ts={ts} />
    case 'gantt':
      return <Gantt p={p} ts={ts} filtering={ui.q !== '' || who !== 'all'} />
    case 'vc':
      return <ValueChainTab p={p} ts={ts} />
    default:
      return <ListTab p={p} ts={ts} />
  }
}

function NoTasks({ p }: { p: Project }) {
  const { d } = useBoard()
  const flows = useFlows()
  return (
    <div className="panel">
      <div className="empty">
        <h3>Belum ada task di project ini</h3>
        <p>Sebaiknya susun milestone dulu di tab Milestone, lalu pecah tiap milestone jadi task.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn w" onClick={() => setUI({ tab: 'milestone' })}>
            Ke tab Milestone
          </button>
          {d.canPlan(p) && !d.locked(p) && (
            <button className="btn primary w wp" onClick={() => flows.openTask(null, { projectId: p.id })}>
              <Icon name="plus" /> Tambah task
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
