// Labels and fixed lists from the prototype, verbatim (UI copy is reviewed; BRIEF §2.6).
import type { Maturity, MsState, ProjectStatus, Stage } from './types.ts'

export interface StageInfo {
  id: Stage
  name: string
  hint?: string
}

export const STAGES: readonly StageInfo[] = [
  { id: 'todo', name: 'Belum mulai' },
  { id: 'progress', name: 'Dikerjakan' },
  { id: 'review', name: 'Diperiksa', hint: 'menunggu pemeriksa' },
  { id: 'done', name: 'Selesai', hint: 'sudah diterima' },
]

export const stageName = (s: Stage): string => STAGES.find((x) => x.id === s)?.name ?? ''

/** Project card gradients. */
export const GRADS = ['samb3', 'samb1', 'samb2', 'samb4', 'teal', 'slate'] as const
/** Avatar colours, picked by hash(person id). */
export const AVC = ['#ee6420', '#7656e8', '#109e86', '#2b6fe0', '#d63e75', '#b7791f', '#0e8fa8', '#5a6b7b'] as const

export const MATURITY: Record<Maturity, string> = {
  prototype: 'Prototype',
  release: 'Rilis pertama',
  decision: 'Siap keputusan',
  bau: 'BAU',
}

export const MS_LABEL: Record<MsState | 'rescope', string> = {
  kosong: 'Belum ada task',
  jalan: 'Berjalan',
  siap: 'Siap diputuskan',
  lulus: 'Lulus',
  rescope: 'Ubah rencana',
  stop: 'Dihentikan',
}

export const P_LABEL: Record<ProjectStatus, string> = { aktif: 'Aktif', selesai: 'Selesai', dihentikan: 'Dihentikan' }

/** Minimal e-mail shape check used before composing a digest or reminder. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
