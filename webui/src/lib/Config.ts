import { PERSIST_DIR } from '../constant'
import { File } from './File'
import { configItem, type ConfigItem } from '../data/config'

export type { ConfigItem }

export default class Config {
    readonly #configPath = `${PERSIST_DIR}/config.sh`
    #config: ConfigItem[] = []

    constructor() {
        this.read()
    }

    async read() {
        if (import.meta.env.DEV) {
            this.#config = configItem.map(item => ({
                ...item,
                ...(item.key === 'mounting_mode' ? { value: 2 } : {}),
            }))
            return
        }

        const content = await File.read(this.#configPath).catch(() => {})
        const fileValues: Record<string, string | boolean | number> = {}
        if (content) {
            for (const line of content.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith('#')) continue
                const eqIndex = trimmed.indexOf('=')
                if (eqIndex === -1) continue
                const key = trimmed.slice(0, eqIndex).trim()
                const rawValue = trimmed.slice(eqIndex + 1).trim()
                if (rawValue === 'true') fileValues[key] = true
                else if (rawValue === 'false') fileValues[key] = false
                else if (!isNaN(Number(rawValue))) fileValues[key] = Number(rawValue)
                else fileValues[key] = rawValue
            }
        }

        this.#config = configItem.map(item => ({
            ...item,
            value: fileValues[item.key] ?? item.value,
        }))
    }

    async write() {
        if (import.meta.env.DEV) return
        const lines = this.#config.map(item => `${item.key}=${item.value}`)
        await File.write(this.#configPath, lines.join('\n'))
    }

    get config() {
        return this.#config
    }

    set config(config) {
        this.#config = config
    }
}
