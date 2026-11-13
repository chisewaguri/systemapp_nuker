import { exec, toast } from 'kernelsu-alt'
import { File } from './File'
import { shellQuote } from './shell'
import { t } from 'i18next'
import { MOD_DIR, PERSIST_DIR } from '../constant'
import type { useSnackBar } from '../components/SnackBar'

export type BackupStatus = 'available' | 'absent' | 'error'
export interface RecoveryExclusions {
  packages: string[]
  paths: string[]
}

export class Cli {
  static #operationLog: string | null = null

  static async readOperationLog(): Promise<string> {
    return this.#operationLog ?? File.readIfExists(`${PERSIST_DIR}/last-operation.log`)
  }

  static openOperationLog() {
    window.dispatchEvent(new Event('san-operation-log'))
  }

  static async isLateLoaded(): Promise<boolean> {
    const { errno, stdout } = await exec('PATH=/data/adb/ksu/bin:$PATH; command -v ksud >/dev/null || exit 0; ksud debug info 2>/dev/null')
    if (errno !== 0) throw new Error('Could not read KernelSU load state')
    return /^late_load: true$/m.test(stdout)
  }

  static async nuke(show: ReturnType<typeof useSnackBar>['show']): Promise<boolean> {
    this.#operationLog = null
    const failure = () => show(t('nuke.failed'), false, 0, {
      text: t('global.details'), callback: () => Cli.openOperationLog(),
    })
    let result: Awaited<ReturnType<typeof exec>>
    try {
      // spawn emits a host error before its listener exists, exec rejects instead.
      result = await exec(`PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
        log=${shellQuote(`${PERSIST_DIR}/last-operation.log`)}
        : > "$log" || exit 1
        applied=${shellQuote(`${PERSIST_DIR}/config.sh.applied`)}
        snapshot="$applied.new.$$"
        cp ${shellQuote(`${PERSIST_DIR}/config.sh`)} "$snapshot" 2>/dev/null || rm -f "$snapshot"
        busybox nsenter -t1 -m ${MOD_DIR}/nuke.sh > "$log" 2>&1
        status=$?
        needs_reboot=false
        if [ "$status" -eq 0 ]; then
          if ! grep -q 'Uninstall only mode' "$log" || ! cmp -s "$snapshot" "$applied"; then
            needs_reboot=true
            touch ${shellQuote(`${PERSIST_DIR}/reboot_required`)}
          fi
          if [ ! -f "$snapshot" ] || ! mv -f "$snapshot" "$applied" 2>/dev/null; then
            rm -f "$applied"
          fi
        fi
        rm -f "$snapshot"
        cat "$log"
        if [ "$status" -eq 0 ] && { [ "$needs_reboot" = true ] || [ -f ${shellQuote(`${PERSIST_DIR}/reboot_required`)} ]; }; then
          echo '[SAN] Reboot required'
        fi
        exit "$status"`)
    } catch (error) {
      this.#operationLog = error instanceof Error ? error.message : String(error)
      failure()
      return false
    }
    this.#operationLog = [result.stdout, result.stderr].filter(Boolean).join('\n')
    if (result.errno !== 0) {
      failure()
      return false
    }
    if (result.stdout.includes('Uninstall only mode') && !result.stdout.includes('[SAN] Reboot required')) {
      show(t('nuke.success_no_reboot'))
    } else {
      show(t('nuke.success'), true, 5000, {
        text: t('nuke.reboot'),
        callback: () => Cli.requestReboot(),
      })
    }
    return true
  }

  static requestReboot() {
    window.dispatchEvent(new Event('san-reboot'))
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

  static async restore(restore: boolean = true, excluded?: RecoveryExclusions): Promise<boolean> {
    try {
      const { errno } = await exec(`
      for f in ${PERSIST_DIR}/*.bak; do
        [ -f "$f" ] || continue
        ${restore ? `
          target="\${f%.bak}"
          tmp="$target.restore.$$"
          case "$f" in
            */nuke_list.txt.bak) kind=app; set -- ${(excluded?.packages ?? []).map(shellQuote).join(' ')} ;;
            */raw_whiteouts.txt.bak) kind=path; set -- ${(excluded?.paths ?? []).map(shellQuote).join(' ')} ;;
            *) set -- ;;
          esac
          if [ "$#" -eq 0 ]; then
            cp -f "$f" "$tmp" || { rm -f "$tmp"; exit 1; }
          else
            (
              while IFS= read -r line || [ -n "$line" ]; do
                key="$line"
                [ "$kind" != app ] || key="\${line%% *}"
                skip=false
                for exclusion do
                  [ "$key" != "$exclusion" ] || skip=true
                done
                [ "$skip" = true ] || printf '%s\\n' "$line" || exit 1
              done < "$f"
            ) > "$tmp" || { rm -f "$tmp"; exit 1; }
          fi
          mv -f "$tmp" "$target" || { rm -f "$tmp"; exit 1; }
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
