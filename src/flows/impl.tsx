// The user flows (prototype openTask, onCheck, moveTo, submitFlow, openGate, …): each checks what
// the prototype checked, says why when the viewer may not, and opens the right dialog. Writes go
// through RPCs; the database is the authority and its message is shown when it refuses.
import type { ReactNode } from 'react'
import type { Flows } from '../app/flows.ts'
import type { ModalOpts } from '../app/overlay-context.ts'
import { getUI } from '../app/ui.ts'
import { messageOf } from '../data/actions.ts'
import { AskDialog } from '../modals/AskDialog.tsx'
import { CalDialog } from '../modals/CalDialog.tsx'
import { CloseDialog } from '../modals/CloseDialog.tsx'
import { GateDialog } from '../modals/GateDialog.tsx'
import { LOCK_MSG, PM_ONLY_MSG, reopenNote, withNote } from '../modals/logic.ts'
import { MilestoneForm } from '../modals/MilestoneForm.tsx'
import { PreviewDialog } from '../modals/PreviewDialog.tsx'
import { ProjectForm } from '../modals/ProjectForm.tsx'
import { RemindDialog } from '../modals/RemindDialog.tsx'
import { ReviewDialog } from '../modals/ReviewDialog.tsx'
import { SubmitDialog } from '../modals/SubmitDialog.tsx'
import { TaskForm } from '../modals/TaskForm.tsx'
import { Wizard } from '../modals/Wizard.tsx'
import { Relay } from './Relay.tsx'
import type { BoardStore } from './store.ts'

export interface FlowDeps {
  store: BoardStore
  toast: (msg: string) => void
  open: (content: ReactNode, opts?: ModalOpts) => void
}

export function makeFlows({ store, toast, open }: FlowDeps): Flows {
  const show = (node: ReactNode, opts?: ModalOpts) =>
    open(
      <Relay store={store} flows={flows}>
        {node}
      </Relay>,
      opts,
    )
  /** A write outside any dialog: the database's message as a toast on failure, then refresh. */
  const exec = async (work: () => Promise<unknown>, ok?: string): Promise<void> => {
    try {
      await work()
    } catch (e) {
      toast(messageOf(e))
      return
    }
    if (ok) toast(ok)
    try {
      await store.get().refresh()
    } catch {
      // Realtime refetches on its own.
    }
  }
  const lockMsg = () => toast(LOCK_MSG)

  const flows: Flows = {
    openTask(id, preset = {}) {
      const { d } = store.get()
      const t = id ? d.task(id) : undefined
      if (id && !t) return
      const p = d.project(t ? t.projectId : (preset.projectId ?? getUI().pid))
      if (!p) return
      if (!t) {
        if (d.locked(p)) return lockMsg()
        if (!d.canPlan(p)) return toast(PM_ONLY_MSG)
        return show(<TaskForm id={null} projectId={p.id} preset={preset} />)
      }
      // Officers do not edit tasks; they act from the task detail (commit, submit, withdraw).
      if (!d.canPlan(p) || d.locked(p) || (d.gated(p) && (t.stage === 'review' || d.isDone(t)))) return flows.openReview(t.id)
      show(<TaskForm id={t.id} projectId={p.id} />)
    },

    openReview(id) {
      if (!store.get().d.task(id)) return
      show(<ReviewDialog id={id} />)
    },

    onCheck(id) {
      const { d, actions } = store.get()
      const t = d.task(id)
      if (!t) return
      if (d.locked(t)) return lockMsg()
      if (!d.gated(d.project(t.projectId))) {
        const done = !d.isDone(t)
        const note = reopenNote(d, t, { milestoneId: t.milestoneId, stage: done ? 'done' : 'progress' })
        void exec(() => actions.setTaskStage(id, done ? 'done' : 'progress'), withNote(done ? 'Task selesai ✓' : 'Task dibuka lagi', note))
        return
      }
      if (t.stage === 'review' || d.isDone(t)) return flows.openReview(id)
      flows.submitFlow(id)
    },

    moveTo(id, stage) {
      const { d, actions } = store.get()
      const t = d.task(id)
      if (!t || t.stage === stage) return
      if (d.locked(t)) return lockMsg()
      if (!d.gated(d.project(t.projectId))) {
        const note = reopenNote(d, t, { milestoneId: t.milestoneId, stage })
        void exec(() => actions.setTaskStage(id, stage), note || undefined)
        return
      }
      if (stage === 'done') {
        const v = t.stage === 'review' && d.canValidate(t)
        toast(v ? 'Buka task untuk menerima atau menolak.' : 'Task masuk Done setelah diterima pemeriksa.')
        if (v) flows.openReview(id)
        return
      }
      if (stage === 'review') return flows.submitFlow(id)
      if (d.isDone(t)) {
        toast('Task yang sudah diterima hanya bisa dibuka lagi oleh pemeriksanya.')
        if (d.canValidate(t)) flows.openReview(id)
        return
      }
      if (t.stage === 'review') {
        if (!d.canAct(t.assignee, t.projectId)) return toast('Hanya PIC yang bisa menarik pengajuan.')
        void exec(async () => {
          await actions.withdrawSubmission(id)
          if (stage === 'todo') await actions.setTaskStage(id, 'todo')
        })
        return
      }
      void exec(() => actions.setTaskStage(id, stage))
    },

    submitFlow(id) {
      const { d } = store.get()
      const t = d.task(id)
      if (!t) return
      if (d.locked(t)) return lockMsg()
      if (!t.assignee) {
        toast('Tentukan PIC dulu sebelum mengajukan.')
        flows.openTask(t.id)
        return
      }
      if (!d.canAct(t.assignee, t.projectId)) return toast(`Hanya PIC (${d.mname(t.assignee)}) yang bisa mengajukan task ini.`)
      show(<SubmitDialog id={id} />)
    },

    openGate(milestoneId) {
      const { d } = store.get()
      const m = d.mstone(milestoneId)
      if (!m) return
      if (d.locked(m)) return lockMsg()
      if (!d.canDecide(m)) return toast(`Hanya pemutus (${d.mname(d.approverOf(m)) || 'Project Manager'}) yang bisa memutuskan milestone ini.`)
      show(<GateDialog id={m.id} />)
    },

    openMs(projectId, id) {
      const { d } = store.get()
      const p = d.project(projectId)
      if (!p || (id && !d.mstone(id))) return
      if (d.locked(p)) return lockMsg()
      if (!d.canPlan(p)) return toast(PM_ONLY_MSG)
      show(<MilestoneForm projectId={p.id} id={id} />)
    },

    moveMs(id, dir) {
      const { d, actions } = store.get()
      const m = d.mstone(id)
      if (!m || !d.canPlan(d.project(m.projectId))) return
      if (d.locked(m)) return lockMsg()
      const ms = d.pms(m.projectId)
      const j = ms.findIndex((x) => x.id === id) + dir
      if (j < 0 || j >= ms.length) return
      void exec(() => actions.moveMilestone(id, dir))
    },

    openAsk(projectId, id) {
      const { d, board } = store.get()
      const a = id ? board.asks.find((x) => x.id === id) : undefined
      if (id && !a) return
      const p = d.project(a ? a.projectId : projectId)
      if (!p) return
      if (!a) {
        if (d.locked(p)) return lockMsg()
        if (!d.canPlan(p)) return toast(PM_ONLY_MSG)
      }
      show(<AskDialog projectId={p.id} id={a?.id} />)
    },

    openClose(projectId, mode) {
      const { d } = store.get()
      const p = d.project(projectId)
      if (!p) return
      if (!d.canOwn(p)) return toast(`Hanya PM (${d.mname(d.pmOf(p)) || 'Project Manager'}) yang bisa melakukan ini.`)
      if (mode === 'close' && !d.readyToClose(p)) return toast('Project baru bisa ditutup setelah semua milestone lulus.')
      show(<CloseDialog projectId={p.id} mode={mode} />)
    },

    openProject(id) {
      const { d, viewer } = store.get()
      const p = d.project(id)
      if (!p) return
      if (!d.canPlan(p)) return toast(PM_ONLY_MSG)
      // A closed project stays read-only; the owner may still open it to delete it.
      if (d.locked(p) && !viewer.isOwner) return lockMsg()
      show(<ProjectForm id={p.id} />)
    },

    startWizard() {
      if (!store.get().viewer.isOwner) return toast('Hanya owner yang bisa membuat project baru.')
      show(<Wizard />, { sticky: true, wide: true })
    },

    openRemind(taskId) {
      const { d } = store.get()
      const t = d.task(taskId)
      if (!t) return
      const m = d.person(t.assignee)
      if (!d.canPlan(d.project(t.projectId)) || d.locked(t)) return toast('Hanya Project Manager yang bisa mengirim pengingat.')
      if (!m) return toast('Tentukan PIC dulu lewat Edit task, baru pengingat bisa dikirim.')
      if (!m.email) return toast(`${m.name} belum punya email. Owner perlu mengisinya di menu Tim.`)
      if (d.remPending(taskId)) return toast('Pengingat untuk task ini masih menunggu dikirim.')
      show(<RemindDialog taskId={taskId} />)
    },

    openCal(taskId) {
      const { d } = store.get()
      const t = d.task(taskId)
      if (!t || d.isDone(t) || !d.pActive(d.project(t.projectId))) return
      show(<CalDialog taskId={taskId} />)
    },

    openPreview(personId) {
      if (!store.get().d.person(personId)) return
      show(<PreviewDialog personId={personId} />)
    },

    calRecord(taskId) {
      const { d, actions } = store.get()
      const t = d.task(taskId)
      if (!t) return
      void exec(() => actions.calRecord(taskId, t.end, t.title.slice(0, 200)), 'Ditandai sudah diperbarui')
    },

    calRemove(taskId) {
      void exec(() => store.get().actions.calRemove(taskId), 'Ditandai sudah dihapus')
    },
  }
  return flows
}
