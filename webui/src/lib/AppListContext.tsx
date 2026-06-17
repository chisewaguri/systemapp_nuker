import { createContext, useContext, useMemo, type ReactNode } from 'react'
import AppList from './AppList'

const AppListContext = createContext<AppList | null>(null)

export function AppListProvider({ children }: { children: ReactNode }) {
  const appList = useMemo(() => new AppList(), [])
  return <AppListContext.Provider value={appList}>{children}</AppListContext.Provider>
}

export function useAppList(): AppList {
  const ctx = useContext(AppListContext)
  if (!ctx) throw new Error('useAppList must be used within AppListProvider')
  return ctx
}
