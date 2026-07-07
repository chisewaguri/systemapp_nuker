import { MOD_DIR, REPO } from '../constant'
import { File } from './File'

export interface ModuleInfo {
  version: string
  versionCode: number
}

export async function getModuleInfo(): Promise<ModuleInfo | null> {
  try {
    const content = await File.read(`${MOD_DIR}/module.prop`)
    const map: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1) continue
      map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }
    return {
      version: map['version'] || 'unknown',
      versionCode: parseInt(map['versionCode'], 10) || 0,
    }
  } catch {
    return null
  }
}

export async function checkForUpdate(currentCode: number): Promise<ModuleInfo | null> {
  try {
    const url = `https://raw.githubusercontent.com/${REPO}/master/update.json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.versionCode > currentCode) {
      return { version: data.version, versionCode: data.versionCode }
    }
    return null
  } catch {
    return null
  }
}
