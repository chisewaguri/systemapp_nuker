import type AppList from './AppList'
import { whiteoutManager } from './Whiteout'

export async function refreshLists(apps: AppList) {
  const results = await Promise.allSettled([apps.refresh(), whiteoutManager.refresh()])
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
}
