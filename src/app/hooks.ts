import { useBoard } from '../data/board-context.ts'

/** Badge count shared by sidebar, dashboard banner and "Minggu ini" (prototype actionCount). */
export function useActionCount(): number {
  const { d, extras } = useBoard()
  return d.inbox('').n + d.calIssues(extras.calendar).length
}
