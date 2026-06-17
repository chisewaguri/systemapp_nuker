import { listPackages, getPackagesInfo, type PackagesInfo } from 'kernelsu-alt'
import { PERSIST_DIR } from '../constant'
import { File } from './File'

export interface AppInfo extends Omit<PackagesInfo, 'versionName' | 'versionCode' | 'uid'> {
  versionName: string | null
  versionCode: number | null
  uid: number | null
  nuked: boolean
  pending: boolean
}

interface NukeInfo {
  packageName: string
  appLabel: string
}

export default class AppList {
  #apps: AppInfo[] = []
  #nuking: NukeInfo[] = []
  #ready: Promise<void>

  readonly #nukeListPath = `${PERSIST_DIR}/nuke_list.txt`

  constructor() {
    this.#ready = this.#init()
  }

  async #init() {
    await this.#refresh()
  }

  async #refresh() {
    await this.#getSystemAppList()
    await this.#getNukedAppList()
    await this.#getNukePendingList()
  }

  async #getSystemAppList() {
    if (import.meta.env.DEV) {
      this.#apps = [
        { packageName: 'com.android.settings', versionName: '14.0', versionCode: 1, appLabel: 'Settings', isSystem: true, uid: 1000, nuked: false, pending: false },
        { packageName: 'com.android.systemui', versionName: '14.0', versionCode: 1, appLabel: 'System UI', isSystem: true, uid: 1000, nuked: false, pending: false },
        { packageName: 'com.miui.home', versionName: '14.0', versionCode: 1, appLabel: 'Mi Launcher', isSystem: true, uid: 1000, nuked: false, pending: false },
        { packageName: 'com.android.chrome', versionName: '120.0', versionCode: 1, appLabel: 'Chrome', isSystem: false, uid: 10100, nuked: false, pending: false },
        { packageName: 'com.google.android.gms', versionName: '24.0', versionCode: 1, appLabel: 'Google Play Services', isSystem: true, uid: 1000, nuked: false, pending: false },
        { packageName: 'com.facebook.katana', versionName: '400.0', versionCode: 1, appLabel: 'Facebook', isSystem: false, uid: 10101, nuked: false, pending: false },
        { packageName: 'com.spotify.music', versionName: '9.0', versionCode: 1, appLabel: 'Spotify', isSystem: false, uid: 10102, nuked: false, pending: false },
        { packageName: 'com.miui.videoplayer', versionName: '5.0', versionCode: 1, appLabel: 'Mi Video', isSystem: true, uid: 1000, nuked: false, pending: false },
        { packageName: 'com.xiaomi.midrive', versionName: '3.0', versionCode: 1, appLabel: 'Mi Drive', isSystem: true, uid: 1000, nuked: false, pending: false },
      ]
      return
    }

    const pkgs = await listPackages('system').catch(() => [])

    let infos: PackagesInfo[]
    try {
      infos = await getPackagesInfo(pkgs) as PackagesInfo[]
    } catch {
      infos = pkgs.map((pkg: string) => ({
        packageName: pkg,
        versionName: '',
        versionCode: 0,
        appLabel: pkg,
        isSystem: true,
        uid: 0,
      }))
    }

    this.#apps = pkgs.map((_: string, i: number) => ({
      ...infos[i],
      nuked: false,
      pending: false,
    }))
  }

  async #getNukedAppList() {
    if (import.meta.env.DEV) {
      for (const pkg of ['com.android.chrome', 'com.facebook.katana']) {
        const existing = this.#apps.find(app => app.packageName === pkg)
        if (existing) {
          existing.nuked = true
        } else {
          this.#apps.push({
            packageName: pkg, versionName: null, versionCode: null,
            appLabel: pkg === 'com.android.chrome' ? 'Chrome' : 'Facebook',
            isSystem: false, uid: null, nuked: true, pending: false,
          })
        }
      }
      return
    }

    const nukeList = await File.read(`${this.#nukeListPath}.old`).catch(() => '')
    const nukedApps = nukeList.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('$'))

    for (const line of nukedApps) {
      const spaceIdx = line.indexOf(' ')
      const pkg = spaceIdx === -1 ? line : line.slice(0, spaceIdx)
      const label = spaceIdx === -1 ? line : line.slice(spaceIdx + 1)

      const existing = this.#apps.find(app => app.packageName === pkg)
      if (existing) {
        existing.nuked = true
      } else {
        this.#apps.push({
          packageName: pkg,
          versionName: null,
          versionCode: null,
          appLabel: label,
          isSystem: true,
          uid: null,
          nuked: true,
          pending: false,
        })
      }
    }
  }

  async #getNukePendingList() {
    if (import.meta.env.DEV) {
      const nukingPkgs = ['com.miui.videoplayer', 'com.xiaomi.midrive']
      this.#apps.forEach(app => {
        const inNukingList = nukingPkgs.includes(app.packageName)
        if (app.nuked && !inNukingList) {
          app.pending = true
        } else if (!app.nuked && inNukingList) {
          app.pending = true
        }
      })
      return
    }

    const nukeList = await File.read(`${this.#nukeListPath}`).catch(() => '')
    const nukedApps = nukeList.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('$'))
    this.#nuking = nukedApps.map((line: string) => {
      const spaceIdx = line.indexOf(' ')
      const pkg = spaceIdx === -1 ? line : line.slice(0, spaceIdx)
      const label = spaceIdx === -1 ? line : line.slice(spaceIdx + 1)
      return {
        packageName: pkg,
        appLabel: label,
      }
    })

    const nukingPkgs = new Set(this.#nuking.map(n => n.packageName))
    this.#apps.forEach(app => {
      const inNukingList = nukingPkgs.has(app.packageName)
      if (app.nuked && !inNukingList) {
        app.pending = true
      } else if (!app.nuked && inNukingList) {
        app.pending = true
      }
    })
  }

  /** Waits for the app list to finish initializing. */
  async waitForReady() {
    await this.#ready
  }

  /** Re-reads all app state from disk (system apps, nuked list, pending list). */
  async refresh() {
    await this.#refresh()
  }

  /** Returns all installed system apps, sorted with pending=true first. */
  get systemAppList(): AppInfo[] {
    return this.#apps
      .filter(app => !app.nuked)
      .sort((a, b) => (a.pending === b.pending ? 0 : a.pending ? -1 : 1))
  }

  /** Returns all system apps that are currently nuked, sorted with pending=true first. */
  get nukedAppList(): AppInfo[] {
    return this.#apps
      .filter(app => app.nuked)
      .sort((a, b) => (a.pending === b.pending ? 0 : a.pending ? -1 : 1))
  }

  /** Pending nuked app list that will be nuked on next reboot. */
  get nukingAppList(): NukeInfo[] {
    return this.#nuking
  }

  /** 
   * Marks an app to be nuked or cancels the nuke.
   * @param packageName - The package name of the app.
   * @param isNuke - `true` to mark for nuke, `false` to cancel.
   */
  setNuke(packageName: string, isNuke: boolean) {
    const idx = this.#nuking.findIndex(n => n.packageName === packageName)
    const app = this.#apps.find(app => app.packageName === packageName)

    if (isNuke && idx === -1 && app) {
      this.#nuking.push({ packageName, appLabel: app.appLabel })
    } else if (!isNuke && idx !== -1) {
      this.#nuking.splice(idx, 1)
    }

    if (app) {
      const inNukingList = this.#nuking.some(n => n.packageName === packageName)
      app.pending = app.nuked ? !inNukingList : inNukingList
    }
  }

  /**
   * Marks a nuked app to be restored or cancels the restore.
   * @param packageName - The package name of the app.
   * @param isRestore - `true` to mark for restore, `false` to cancel.
   */
  setRestore(packageName: string, isRestore: boolean) {
    const idx = this.#nuking.findIndex(n => n.packageName === packageName)
    const app = this.#apps.find(app => app.packageName === packageName)

    if (isRestore && idx !== -1) {
      this.#nuking.splice(idx, 1)
    } else if (!isRestore && idx === -1 && app) {
      this.#nuking.push({ packageName, appLabel: app.appLabel })
    }

    if (app) {
      const inNukingList = this.#nuking.some(n => n.packageName === packageName)
      app.pending = app.nuked ? !inNukingList : inNukingList
    }
  }

  /** Writes the current nuking list to persistent storage. */
  async write() {
    try {
      const lines = this.#nuking.map(n => `${n.packageName} ${n.appLabel.replace(/\n/g, ' ')}`)
      await File.write(`${this.#nukeListPath}`, lines.join('\n'))
      await this.#refresh()
      return true
    } catch {
      return false
    }
  }
}
