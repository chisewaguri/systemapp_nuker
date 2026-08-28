import { exec, spawn, toast } from 'kernelsu-alt'
import { File } from './File'
import { t } from 'i18next'
import { MOD_DIR, PERSIST_DIR } from '../constant'
import type { useSnackBar } from '../components/SnackBar'

export class Cli {
  static nuke(show: ReturnType<typeof useSnackBar>['show']): Promise<boolean> {
    return new Promise(resolve => {
      let out = ''
      const err: string[] = []
      let ps: ReturnType<typeof spawn>
      try {
        ps = spawn('busybox', ['nsenter', '-t1', '-m', `${MOD_DIR}/nuke.sh`], {
          env: { PATH: '/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH' }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        show(t('nuke.error', { stderr: message }), false)
        resolve(false)
        return
      }
      ps.stdout.on('data', data => out += data)
      ps.stderr.on('data', data => err.push(data))
      ps.on('exit', code => {
        if (code !== 0) {
          show(t('nuke.error', { stderr: err.join('\n') }), false)
          return resolve(false)
        }
        if (out.includes('Uninstall only mode')) {
          show(t('nuke.success_no_reboot'))
        } else {
          show(t('nuke.success'), true, 5000, {
            text: t('nuke.reboot'),
            callback: () => Cli.reboot(show),
          })
        }
        resolve(true)
      })
      ps.on('error', error => {
        show(t('nuke.error', { stderr: error.message }), false)
        resolve(false)
      })
    })
  }

  static reboot(show: ReturnType<typeof useSnackBar>['show']) {
    exec('svc power reboot || reboot').then(({errno, stderr}) => {
      if (errno != 0) show(t('nuke.reboot_error', { stderr }), false)
    })
  }

  static async restore(restore: boolean = true): Promise<boolean> {
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
  }

  static async needRestore() {
    try {
      const dirExist = await File.isDirectory(PERSIST_DIR)
      if (!dirExist) {
        await File.createDirectory(PERSIST_DIR).catch(() => {})
        return false
      }
      const ps = await exec(`[ -f ${PERSIST_DIR}/nuke_list.txt.bak ] || [ -f ${PERSIST_DIR}/raw_whiteouts.txt.bak ]`)
      return ps.errno === 0
    } catch {
      return false
    }
  }

  static openLink(url: string) {
    toast(`Redirecting to ${url}`)
    setTimeout(() => {
      exec(`am start -a android.intent.action.VIEW -d ${url}`)
        .then(({ errno }) => {
          if (errno !== 0) window.open(url, '_blank')
        })
        .catch(() => window.open(url, '_blank'))
    }, 100)
  }
}
