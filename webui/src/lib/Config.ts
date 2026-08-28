import { PERSIST_DIR } from '../constant'
import { File } from './File'
import { configItem, type ConfigItem } from '../data/config'
import { isDev } from './utils'

export type { ConfigItem }

export default class Config {
    readonly #configPath = `${PERSIST_DIR}/config.sh`
    #config: ConfigItem[] = []

    async read() {
        if (isDev()) {
            this.#config = configItem.map(item => ({
                ...item,
                ...(item.key === 'mounting_mode' ? { value: 2 } : {}),
            }))
            return
        }

        const content = await File.read(this.#configPath)
        const fileValues: Record<string, string | boolean | number> = {}
        for (const line of content.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eqIndex = trimmed.indexOf('=')
            if (eqIndex <= 0) throw new Error('Invalid config line')
            const key = trimmed.slice(0, eqIndex).trim()
            const rawValue = trimmed.slice(eqIndex + 1).trim()
            if (!rawValue || key in fileValues) throw new Error('Invalid config value')
            if (rawValue === 'true') fileValues[key] = true
            else if (rawValue === 'false') fileValues[key] = false
            else if (/^-?\d+$/.test(rawValue)) fileValues[key] = Number(rawValue)
            else fileValues[key] = rawValue
        }

        this.#config = configItem.map(item => {
            const value = fileValues[item.key]
            if (value === undefined || typeof value !== typeof item.value) {
                throw new Error(`Invalid config key: ${item.key}`)
            }
            if (item.options && (typeof value === 'boolean' || !item.options.includes(value))) {
                throw new Error(`Invalid config option: ${item.key}`)
            }
            return { ...item, value }
        })
    }

    async write() {
        if (isDev()) return
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
