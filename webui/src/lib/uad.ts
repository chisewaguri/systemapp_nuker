import { exec } from 'kernelsu-alt'
import { PERSIST_DIR } from '../constant'
import { File } from './File'
import { shellQuote } from './shell'

export const UAD_URL = 'https://raw.githubusercontent.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation/main/resources/assets/uad_lists.json'
export const UAD_REPO = 'https://github.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation'
const DOWNLOADED = `${PERSIST_DIR}/uad_lists.json`

export type Removal = 'recommended' | 'advanced' | 'expert' | 'unsafe' | 'unknown'
export type UadSource = { kind: 'downloaded' | 'bundled' | 'none', count: number, date: string | null }
type Trimmed = Record<string, [string, string]>

export const removalLevels: { id: Removal, color: string, icon: string }[] = [
  { id: 'recommended', color: 'var(--removal-recommended)', icon: 'verified' },
  { id: 'advanced', color: 'var(--removal-advanced)', icon: 'info' },
  { id: 'expert', color: 'var(--removal-expert)', icon: 'warning' },
  { id: 'unsafe', color: 'var(--removal-unsafe)', icon: 'dangerous' },
  { id: 'unknown', color: 'var(--removal-unknown)', icon: 'help' },
]

export function toRemoval(value: string): Removal {
  const id = value.toLowerCase()
  return removalLevels.some(level => level.id === id && id !== 'unknown') ? id as Removal : 'unknown'
}

/** Trims upstream uad_lists.json to `{ pkg: [removal, description] }`, or null when it isnt shaped like one. */
export function trimUad(raw: unknown): Trimmed | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Trimmed = {}
  for (const [pkg, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object' || typeof (entry as { removal?: unknown }).removal !== 'string') return null
    const { removal, description } = entry as { removal: string, description?: unknown }
    out[pkg] = [removal, typeof description === 'string' ? description.trim() : '']
  }
  return Object.keys(out).length > 0 ? out : null
}

function isTrimmed(raw: unknown): raw is Trimmed {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const values = Object.values(raw)
  return values.length > 0 && values.every(v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string')
}

let entries: Trimmed = {}
let source: UadSource = { kind: 'none', count: 0, date: null }
let loading: Promise<UadSource> | null = null

async function readDownloaded(): Promise<{ list: Trimmed, date: string | null } | null> {
  try {
    const content = await File.readIfExists(DOWNLOADED)
    if (!content.trim()) return null
    const list = trimUad(JSON.parse(content))
    if (!list) return null
    const { errno, stdout } = await exec(`date -r ${shellQuote(DOWNLOADED)} +%F`)
    return { list, date: errno === 0 && stdout.trim() ? stdout.trim() : null }
  } catch {
    return null
  }
}

async function readBundled(): Promise<Trimmed | null> {
  try {
    const response = await fetch('uad.json')
    if (!response.ok) return null
    const raw: unknown = await response.json()
    return isTrimmed(raw) ? raw : null
  } catch {
    return null
  }
}

/** Loads the downloaded list, then the bundled one. Never throws, an empty result labels every app unknown. */
export function loadUad(): Promise<UadSource> {
  const current: Promise<UadSource> = readUad().then(([list, read]): UadSource | Promise<UadSource> => {
    // a newer load started while this one was reading, so its result is stale
    if (loading && loading !== current) return loading
    entries = list
    source = read
    return read
  })
  loading = current
  return current
}

/** The current source, waiting for a load that is still running. */
export function uadReady(): Promise<UadSource> {
  return loading ?? loadUad()
}

async function readUad(): Promise<[Trimmed, UadSource]> {
  const downloaded = await readDownloaded()
  if (downloaded) {
    const count = Object.keys(downloaded.list).length
    return [downloaded.list, { kind: 'downloaded', count, date: downloaded.date }]
  }
  const bundled = await readBundled()
  return bundled
    ? [bundled, { kind: 'bundled', count: Object.keys(bundled).length, date: null }]
    : [{}, { kind: 'none', count: 0, date: null }]
}

export function uadSource(): UadSource {
  return source
}

export function getUad(pkg: string): { removal: Removal, description: string | null } {
  const entry = Object.hasOwn(entries, pkg) ? entries[pkg] : undefined
  if (!entry) return { removal: 'unknown', description: null }
  return { removal: toRemoval(entry[0]), description: entry[1].trim() || null }
}

/** Downloads the latest list as root. A failed or malformed download keeps the current copy. */
export async function updateUad(): Promise<UadSource> {
  const target = shellQuote(DOWNLOADED)
  const temp = shellQuote(`${DOWNLOADED}.new`)
  const url = shellQuote(UAD_URL)
  const download = await exec(`
    PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
    mkdir -p ${shellQuote(PERSIST_DIR)} || exit 1
    rm -f ${temp}
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL --max-time 60 ${url} -o ${temp}
    elif command -v wget >/dev/null 2>&1; then
      wget -q -T 60 -O ${temp} ${url}
    elif command -v busybox >/dev/null 2>&1; then
      busybox wget -q -T 60 -O ${temp} ${url}
    else
      echo "no curl or wget found" >&2
      exit 127
    fi
  `)
  if (download.errno !== 0) {
    await exec(`rm -f ${temp}`)
    throw new Error(download.stderr.trim() || `download failed (${download.errno})`)
  }
  const valid = await File.read(`${DOWNLOADED}.new`)
    .then(content => trimUad(JSON.parse(content)) !== null)
    .catch(() => false)
  if (!valid) {
    await exec(`rm -f ${temp}`)
    throw new Error('the downloaded list is not a uad-ng list')
  }
  const swap = await exec(`mv -f ${temp} ${target} || { rm -f ${temp}; exit 1; }`)
  if (swap.errno !== 0) throw new Error(swap.stderr.trim() || 'could not save the list')
  return loadUad()
}
