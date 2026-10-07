// The world switcher's list (Brief B5 §1): Dunia: Distribusi · Pabrik singkong · Rumah potong ayam.
// The three worlds are separate; nothing here links one to another.
import type { WorldId } from './types.ts'

export const WORLDS: { id: WorldId; label: string; hash: string }[] = [
  { id: 'distribusi', label: 'Distribusi', hash: '#/simulasi/distribusi' },
  { id: 'pabrik-singkong', label: 'Pabrik singkong', hash: '#/simulasi/pabrik-singkong' },
  { id: 'rpa', label: 'Rumah potong ayam', hash: '#/simulasi/rpa' },
]
