import { useBoard } from '../data/board-context.ts'

/** Entity label from the entities table ('Group' → 'Group (lintas entitas)'), prototype entLabel. */
export function useEntityLabel(): (code: string) => string {
  const { extras } = useBoard()
  return (code) => extras.entities.find((e) => e.code === code)?.label ?? code
}
