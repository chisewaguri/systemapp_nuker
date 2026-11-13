import { t } from 'i18next'
import type AppList from './AppList'
import type { useSnackBar } from '../components/SnackBar'
import { whiteoutManager } from './Whiteout'
import { Cli } from './Cli'
import { runMutation } from './mutationLock'
import { File } from './File'
import { PERSIST_DIR } from '../constant'
import { refreshLists } from './refreshLists'

export type PendingChange = { kind: 'app', packageName: string } | { kind: 'path', path: string }

export async function cancelPendingChange(change: PendingChange, apps: AppList, show: ReturnType<typeof useSnackBar>['show']) {
  return cancelPendingChanges([change], apps, show)
}

export async function cancelPendingChanges(changes: PendingChange[], apps: AppList, show: ReturnType<typeof useSnackBar>['show']) {
  let applied = false
  const started = await runMutation(async () => {
    const packages = new Set(changes.filter(change => change.kind === 'app').map(change => change.packageName))
    const paths = new Set(changes.filter(change => change.kind === 'path').map(change => change.path))
    const appChanges = apps.pendingApps.filter(app => packages.has(app.packageName))
    const pathChanges = whiteoutManager.pendingChanges.filter(item => paths.has(item.path))
    if (appChanges.length === 0 && pathChanges.length === 0) return
    let originalApps: string | undefined
    if (appChanges.length > 0 && pathChanges.length > 0) {
      try {
        originalApps = await File.readIfExists(`${PERSIST_DIR}/nuke_list.txt`)
      } catch {
        show(t('global.read_error'), false)
        return
      }
    }
    for (const app of appChanges) apps.setNuke(app.packageName, app.nuked)
    if (appChanges.length > 0 && !await apps.write()) {
      show(t('global.write_error'), false)
      return
    }
    if (pathChanges.length > 0) {
      const nextPaths = new Set(whiteoutManager.whiteouts)
      for (const item of pathChanges) {
        if (item.hiding) nextPaths.delete(item.path)
        else nextPaths.add(item.path)
      }
      whiteoutManager.whiteouts = [...nextPaths]
      if (!await whiteoutManager.write()) {
        let restored = true
        if (originalApps !== undefined) {
          try {
            await File.write(`${PERSIST_DIR}/nuke_list.txt`, originalApps)
          } catch {
            restored = false
          }
          await apps.refresh().catch(() => { restored = false })
        }
        show(t(restored ? 'global.write_error' : 'review.undo_partial'), false)
        return
      }
    }
    applied = await Cli.nuke(show)
    await refreshLists(apps).catch(() => {
      applied = false
      show(t('global.read_error'), false)
    })
  })
  if (!started) show(t('global.processing'))
  return started && applied
}
