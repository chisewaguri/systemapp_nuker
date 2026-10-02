import { exec } from 'kernelsu-alt'
import { PERSIST_DIR } from '../constant'
import { File } from './File'
import { shellQuote } from './shell'

// a nuked app is gone from android, so ksu://icon has nothing to return for it.
// icons are saved as data urls while the app is still visible and used after.
const DIR = `${PERSIST_DIR}/icons`
const SIZE = 96

const iconPath = (pkg: string) => `${DIR}/${pkg}`

function draw(source: CanvasImageSource): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(source, 0, 0, SIZE, SIZE)
  return canvas.toDataURL('image/png')
}

// fetch keeps the canvas readable, an <img> from another origin can taint it
async function encode(pkg: string): Promise<string | null> {
  const url = `ksu://icon/${pkg}`
  try {
    const response = await fetch(url)
    if (response.ok) return draw(await createImageBitmap(await response.blob()))
  } catch { /* try the image route */ }
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await img.decode()
    return draw(img)
  } catch {
    return null
  }
}

/** Saves icons for apps that are about to be nuked. Best effort, a missing icon falls back to the robot. */
export async function saveIcons(packages: string[]): Promise<void> {
  if (packages.length === 0) return
  const made = await exec(`mkdir -p ${shellQuote(DIR)}`).catch(() => null)
  if (made?.errno !== 0) return
  for (const pkg of packages) {
    const data = await encode(pkg)
    if (data) await File.write(iconPath(pkg), data).catch(() => {})
  }
}

const loaded = new Map<string, Promise<string | null>>()

/** The saved icon as a data url, or null when there is none. */
export function savedIcon(pkg: string): Promise<string | null> {
  let icon = loaded.get(pkg)
  if (!icon) {
    icon = File.readIfExists(iconPath(pkg))
      .then(content => (content.startsWith('data:image/') ? content.trim() : null))
      .catch(() => null)
    loaded.set(pkg, icon)
  }
  return icon
}
