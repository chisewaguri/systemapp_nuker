import { t } from 'i18next'
import { MOD_ID, NUKE_CONFIG_VERSION } from '../constant'
import { File } from './File'
import AppList from './AppList'
import type { useSnackBar } from '../components/SnackBar'

interface NukeConfigData {
  metadata: {
    modId: string
    version: number
    timestamp: string
  }
  packages: string[]
}

export class NukeConfig {
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
      snackBar(t('nuke_config.export_empty'), false)
    }
  }

  static import(
    onSelect: (open: boolean) => void
  ): void {
    onSelect(true)
  }

  static async handleImport(
    content: string | null,
    appList: AppList,
    snackBar: ReturnType<typeof useSnackBar>['show']
  ): Promise<void> {
    if (!content) return

    try {
      const config = JSON.parse(content) as NukeConfigData

      if (!config.metadata || config.metadata.modId !== MOD_ID || !config.packages) {
        snackBar(t('nuke_config.import_invalid'), false)
        return
      }

      if (config.packages.length === 0) {
        snackBar(t('nuke_config.import_empty'), false)
        return
      }

      let importedCount = 0
      for (const pkg of config.packages) {
        const app = appList.systemAppList.find(a => a.packageName === pkg)
        if (app && !app.nuked) {
          appList.setNuke(pkg, true)
          importedCount++
        }
      }

      await appList.write()

      if (importedCount === 0) {
        snackBar(t('nuke_config.import_empty'), false)
      } else {
        snackBar(t('nuke_config.import_success', { count: importedCount }))
      }
    } catch {
      snackBar(t('nuke_config.import_invalid'), false)
    }
  }
}
