import { t } from 'i18next'
import { MOD_ID, NUKE_CONFIG_VERSION } from '../constant'
import { File } from './File'
import AppList, { type AppInfo } from './AppList'
import { Cli } from './Cli'
import { runMutation } from './mutationLock'
import { refreshLists } from './refreshLists'
import type { useSnackBar } from '../components/SnackBar'

interface NukeConfigData {
  metadata: {
    modId: string
    version: number
    timestamp: string
  }
  packages: string[]
}

export interface ImportPreview {
  apps: AppInfo[]
  unavailable: string[]
  alreadyListed: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getPackages(value: unknown): string[] | null {
  if (!isRecord(value) || !isRecord(value.metadata)) return null
  if (value.metadata.modId !== MOD_ID || !Array.isArray(value.packages)) return null
  return value.packages.every(pkg => typeof pkg === 'string') ? value.packages : null
}

export class NukeConfig {
  static previewImport(content: string, appList: AppList): ImportPreview {
    let packages: string[] | null
    try {
      packages = getPackages(JSON.parse(content))
    } catch {
      packages = null
    }
    if (!packages) throw new Error(t('nuke_config.import_invalid'))
    const unique = [...new Set(packages)]
    const listed = new Set(appList.nukingAppList.map(app => app.packageName))
    const available = new Map(appList.systemAppList.map(app => [app.packageName, app]))
    return {
      apps: unique.filter(pkg => available.has(pkg)).map(pkg => available.get(pkg)!),
      unavailable: unique.filter(pkg => !listed.has(pkg) && !available.has(pkg)),
      alreadyListed: unique.filter(pkg => listed.has(pkg)).length,
    }
  }
  static async export(
    appList: AppList,
    snackBar: ReturnType<typeof useSnackBar>['show']
  ): Promise<void> {
    const nukingList = appList.nukingAppList

    if (nukingList.length === 0) {
      snackBar(t('nuke_config.export_empty'), false)
      return
    }

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

    const config: NukeConfigData = {
      metadata: {
        modId: MOD_ID,
        version: NUKE_CONFIG_VERSION,
        timestamp,
      },
      packages: nukingList.map(n => n.packageName),
    }

    const filePath = `/sdcard/Download/san-config-${timestamp}.json`

    try {
      await File.write(filePath, JSON.stringify(config, null, 2))
      snackBar(t('nuke_config.export_success', { path: filePath }))
    } catch {
      snackBar(t('nuke_config.export_error', { path: filePath }), false)
    }
  }

  static async applyImport(
    packages: string[],
    appList: AppList,
    snackBar: ReturnType<typeof useSnackBar>['show']
  ): Promise<void> {
    if (packages.length === 0) {
      snackBar(t('nuke_config.import_empty'), false)
      return
    }

    const started = await runMutation(async () => {
      let importedCount = 0
      for (const pkg of packages) {
        const app = appList.systemAppList.find(a => a.packageName === pkg)
        if (app) {
          appList.setNuke(pkg, true)
          importedCount++
        }
      }

      if (importedCount === 0) {
        snackBar(t('nuke_config.import_empty'), false)
        return
      }

      if (!await appList.write()) {
        snackBar(t('global.write_error'), false)
        return
      }

      snackBar(t('nuke_config.import_success', { count: importedCount }))
      await Cli.nuke(snackBar)
      await refreshLists(appList).catch(() => snackBar(t('global.read_error'), false))
    })
    if (!started) snackBar(t('global.processing'), true, 3000)
  }
}
