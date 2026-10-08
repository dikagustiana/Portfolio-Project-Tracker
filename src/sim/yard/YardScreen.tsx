// The simulation screen: the shared shell (YardShell.tsx) around one of the three worlds
// (Brief B5 §1–2). Each world's definition, scene and data load in their own chunk, so opening
// one world never downloads another.
import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import type { YardShellProps } from './YardShell.tsx'
import type { WorldDef, WorldId } from './types.ts'

type ScreenProps = Omit<YardShellProps, 'def'>

const shellFor = (load: () => Promise<{ default: WorldDef }>): ComponentType<ScreenProps> =>
  lazy(async () => {
    const [{ default: Shell }, { default: def }] = await Promise.all([import('./YardShell.tsx'), load()])
    return { default: (p: ScreenProps) => <Shell def={def} {...p} /> }
  })

const SCREENS: Record<WorldId, ComponentType<ScreenProps>> = {
  distribusi: shellFor(() => import('../worlds/distribusi/yard/index.ts')),
  'pabrik-singkong': shellFor(() => import('../worlds/pabrik-singkong/yard/index.ts')),
  rpa: shellFor(() => import('../worlds/rpa/yard/index.ts')),
}

export default function YardScreen({ world, ...rest }: ScreenProps & { world: WorldId }) {
  const Screen = SCREENS[world]
  return (
    <Suspense fallback={<div className="skel" style={{ height: '100%' }} />}>
      <Screen key={world} {...rest} />
    </Suspense>
  )
}
