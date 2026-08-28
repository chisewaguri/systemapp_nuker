import { File } from './File'
import { PERSIST_DIR } from '../constant'
import { isDev } from './utils'

export class Whiteout {
  #whiteouts: string[] = []
  #savedWhiteouts: string[] = []
  #writable = false
  #whiteoutPath = `${PERSIST_DIR}/raw_whiteouts.txt`
  #ready: Promise<void>

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
      this.#writable = true
      return
    }
    const content = await File.readIfExists(this.#whiteoutPath)

    this.#whiteouts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('$'))
    this.#savedWhiteouts = [...this.#whiteouts]
    this.#writable = true
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
      return true
    } catch {
      this.#whiteouts = [...this.#savedWhiteouts]
      return false
    }
  }
}
