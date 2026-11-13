import { File } from './File'
import { PERSIST_DIR } from '../constant'
import { isDev } from './utils'

export function normalizeWhiteoutPath(value: string): string {
  const path = value.replace(/\/+/g, '/').replace(/\/+$/, '')
  if (!path.startsWith('/') || /[\r\n\0]/.test(path) || path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('invalid_path')
  }
  if (/^\/(?:system\/)?data(?:\/|$)/.test(path)) throw new Error('data_not_supported')
  if (/^\/(?:system\/)?(?:system|vendor|product|system_ext|odm)?$/.test(path)) throw new Error('root_not_supported')
  return path.startsWith('/system/') ? path : `/system${path}`
}

export class Whiteout {
  #whiteouts: string[] = []
  #savedWhiteouts: string[] = []
  #writable = false
  #whiteoutPath = `${PERSIST_DIR}/raw_whiteouts.txt`
  #ready: Promise<void>
  #appliedWhiteouts: string[] = []
  #version = 0
  #listeners = new Set<() => void>()
  #view = {query: '', selection: [] as string[]}

  getView() {
    return this.#view
  }

  setView(view: Partial<{query: string, selection: string[]}>) {
    this.#view = {...this.#view, ...view}
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  getVersion = () => this.#version

  #notify() {
    this.#version++
    this.#listeners.forEach(listener => listener())
  }

  get pendingChanges(): {path: string, hiding: boolean}[] {
    return [
      ...this.#whiteouts.filter(path => !this.#appliedWhiteouts.includes(path)).map(path => ({path, hiding: true})),
      ...this.#appliedWhiteouts.filter(path => !this.#whiteouts.includes(path)).map(path => ({path, hiding: false})),
    ]
  }

  constructor() {
    this.#ready = this.#getWhiteouts()
  }

  async waitForReady() {
    await this.#ready
  }

  async #getWhiteouts() {
    this.#writable = false
    if (isDev()) {
      this.#whiteouts = [
        "/system/init.rc",
        "/system/etc/permission/cn.google.xml"
      ]
      this.#savedWhiteouts = [...this.#whiteouts]
      this.#appliedWhiteouts = [...this.#whiteouts]
      this.#writable = true
      this.#notify()
      return
    }
    const [content, applied] = await Promise.all([
      File.readIfExists(this.#whiteoutPath),
      File.readIfExists(`${this.#whiteoutPath}.old`),
    ])
    this.#appliedWhiteouts = applied.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#') && !line.startsWith('$'))

    this.#whiteouts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('$'))
    this.#savedWhiteouts = [...this.#whiteouts]
    this.#writable = true
    this.#notify()
  }

  get whiteouts() {
    return this.#whiteouts
  }

  set whiteouts(whiteouts: string[]) {
    this.#whiteouts = whiteouts
  }

  async refresh() {
    try {
      await this.#getWhiteouts()
    } catch (error) {
      this.#whiteouts = [...this.#savedWhiteouts]
      throw error
    }
  }

  async write() {
    if (!this.#writable) {
      this.#whiteouts = [...this.#savedWhiteouts]
      return false
    }
    try {
      await File.write(this.#whiteoutPath, this.#whiteouts.join('\n'))
      this.#savedWhiteouts = [...this.#whiteouts]
      this.#notify()
      return true
    } catch {
      this.#whiteouts = [...this.#savedWhiteouts]
      return false
    }
  }
}

export const whiteoutManager = new Whiteout()
