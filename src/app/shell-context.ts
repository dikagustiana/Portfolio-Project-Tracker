import { createContext, use } from 'react'

export interface ShellApi {
  toggleDrawer: () => void
  closeDrawer: () => void
}

export const ShellCtx = createContext<ShellApi>({ toggleDrawer: () => {}, closeDrawer: () => {} })

export const useShell = (): ShellApi => use(ShellCtx)
