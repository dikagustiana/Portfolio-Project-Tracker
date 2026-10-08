import { useBoard } from '../data/board-context.ts'

/**
 * Badge count of Beranda (prototype actionCount): the length of the Perlu tindakan view it opens,
 * plus the viewer's own calendar events that need updating (shown in the same block).
 */
export function useActionCount(): number {
  const { d, extras } = useBoard()
  return d.actions('').length + d.calIssues(extras.calendar).length
}

/**
 * E-mail is "connected" (prototype mailActive) only when a real sender is configured and has run;
 * dry-run logs (email_provider 'none') compose without sending.
 */
export function useMailActive(): boolean {
  const { board, extras } = useBoard()
  return board.settings.emailProvider !== 'none' && extras.emailLog.length > 0
}
