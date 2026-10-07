// Shared hooks for the Project page.
import { useBoard } from '../../data/board-context.ts'
import type { Project } from '../../domain/index.ts'
import { useShell } from '../../app/shell-context.ts'
import { setUI } from '../../app/ui.ts'
import type { UIState } from '../../app/ui.ts'

/**
 * The prototype's RO for this project: no write access at all (no linked person and not the
 * super admin, or a viewer/non-member here). Members are not read-only: they act on their own tasks.
 */
export function useReadOnly(p: Project): boolean {
  const { d, viewer } = useBoard()
  const role = d.roleIn(p.id)
  return (!viewer.isSuperAdmin && !viewer.personId) || !role || role === 'viewer'
}

/** Navigate like the prototype's data-go / data-proj: close the drawer and scroll to the top. */
export function useGo(): (patch: Partial<UIState>) => void {
  const { closeDrawer } = useShell()
  return (patch) => {
    setUI(patch)
    closeDrawer()
    window.scrollTo(0, 0)
  }
}
