import { useBoard } from '../data/board-context.ts'

/** Badge count shared by sidebar, dashboard banner and "Minggu ini" (prototype actionCount). */
export function useActionCount(): number {
  const { d, extras } = useBoard()
  return d.inbox('').n + d.calIssues(extras.calendar).length
}

/**
 * E-mail is "connected" (prototype mailActive) only when a real sender is configured and has run;
 * dry-run logs (email_provider 'none') compose without sending.
 */
export function useMailActive(): boolean {
  const { board, extras } = useBoard()
  return board.settings.emailProvider !== 'none' && extras.emailLog.length > 0
}
