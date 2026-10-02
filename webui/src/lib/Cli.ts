import { exec, toast } from 'kernelsu-alt'
import { File } from './File'
import { shellQuote } from './shell'
import { t } from 'i18next'
import { MOD_DIR, PERSIST_DIR } from '../constant'
import type { useSnackBar } from '../components/SnackBar'

export type BackupStatus = 'available' | 'absent' | 'error'

export class Cli {
  static async nuke(show: ReturnType<typeof useSnackBar>['show']): Promise<boolean> {
    let result: Awaited<ReturnType<typeof exec>>
    try {
      // spawn emits a host error before its listener exists, exec rejects instead.
      result = await exec(`PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH; busybox nsenter -t1 -m ${MOD_DIR}/nuke.sh`)
    } catch (error) {
      show(t('nuke.error', { stderr: error instanceof Error ? error.message : String(error) }), false)
      return false
    }
    if (result.errno !== 0) {
      show(t('nuke.error', { stderr: result.stderr }), false)
      return false
    }
    if (result.stdout.includes('Uninstall only mode')) {
      show(t('nuke.success_no_reboot'))
    } else {
      show(t('nuke.success'), true, 5000, {
        text: t('nuke.reboot'),
        callback: () => Cli.reboot(show),
      })
    }
    return true
  }

  static reboot(show: ReturnType<typeof useSnackBar>['show']) {
    // a late-loaded kernelsu is gone after a full reboot, so soft reboot like its manager does
    exec(`
      PATH=/data/adb/ksu/bin:$PATH
      if ksud debug info 2>/dev/null | grep -q '^late_load: true'; then
        ksud soft-reboot
      else
        svc power reboot || reboot
      fi
    `).then(({errno, stderr}) => {
      if (errno != 0) show(t('nuke.reboot_error', { stderr }), false)
    })
  }

  static async restore(restore: boolean = true): Promise<boolean> {
    try {
      const { errno } = await exec(`
      for f in ${PERSIST_DIR}/*.bak; do
        [ -f "$f" ] || continue
        ${restore ? `
          target="\${f%.bak}"
          tmp="$target.restore.$$"
          cp -f "$f" "$tmp" && mv -f "$tmp" "$target" || { rm -f "$tmp"; exit 1; }
        ` : `rm -f "$f" || exit 1`}
      done;
    `)
      return errno === 0
    } catch {
      return false
    }
  }

  static async needRestore(): Promise<BackupStatus> {
    try {
      const dirExist = await File.isDirectory(PERSIST_DIR)
      if (!dirExist) {
        await File.createDirectory(PERSIST_DIR)
        return 'absent'
      }
      const ps = await exec(`[ -f ${PERSIST_DIR}/nuke_list.txt.bak ] || [ -f ${PERSIST_DIR}/raw_whiteouts.txt.bak ]`)
      return ps.errno === 0 ? 'available' : 'absent'
    } catch {
      return 'error'
    }
  }

  static openLink(url: string) {
    toast(`Redirecting to ${url}`)
    setTimeout(() => {
      exec(`am start -a android.intent.action.VIEW -d ${shellQuote(url)}`)
        .then(({ errno }) => {
          if (errno !== 0) window.open(url, '_blank')
        })
        .catch(() => window.open(url, '_blank'))
    }, 100)
  }
}
