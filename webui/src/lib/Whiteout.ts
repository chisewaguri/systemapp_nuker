import { File } from './File'
import { PERSIST_DIR } from '../constant'
import { isDev } from './utils'

export class Whiteout {
  #whiteouts: string[] = []
  #savedWhiteouts: string[] = []
  #whiteoutPath = `${PERSIST_DIR}/raw_whiteouts.txt`
  #ready: Promise<void>

  constructor() {
    this.#ready = this.#getWhiteouts()
  }

  async waitForReady() {
    await this.#ready
  }

  async #getWhiteouts() {
    if (isDev()) {
      this.#whiteouts = [
        "/system/init.rc",
        "/system/etc/permission/cn.google.xml"
      ]
      this.#savedWhiteouts = [...this.#whiteouts]
      return
    }
    const content = await File.readIfExists(this.#whiteoutPath)

    this.#whiteouts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('$'))
    this.#savedWhiteouts = [...this.#whiteouts]
  }

  get whiteouts() {
    return this.#whiteouts
  }

  set whiteouts(whiteouts: string[]) {
    this.#whiteouts = whiteouts
  }

  async refresh() {
    await this.#getWhiteouts()
  }

  async write() {
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
