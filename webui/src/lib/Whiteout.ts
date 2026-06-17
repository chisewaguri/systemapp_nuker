import { File } from './File'
import { PERSIST_DIR } from '../constant'

export class Whiteout {
  #whiteouts: string[] = []
  #whiteoutPath = `${PERSIST_DIR}/raw_whiteouts.txt`
  #ready: Promise<void>

  constructor() {
    this.#ready = this.#getWhiteouts()
  }

  async waitForReady() {
    await this.#ready
  }

  async #getWhiteouts() {
    if (import.meta.env.DEV) {
      this.#whiteouts = [
        "/system/init.rc",
        "/system/etc/permission/cn.google.xml"
      ]
      return
    }
    const content = await File.read(this.#whiteoutPath).catch(() => {})
    if (!content) {
      this.#whiteouts = []
      return
    }

    this.#whiteouts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('$'))
  }

  get whiteouts() {
    return this.#whiteouts
  }

  set whiteouts(whiteouts: string[]) {
    this.#whiteouts = whiteouts
  }

  async write() {
    try {
      await File.write(this.#whiteoutPath, this.#whiteouts.join('\n'))
      await this.#getWhiteouts()
      return true
    } catch {
      return false
    }
  }
}
