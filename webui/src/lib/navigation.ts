export const pagePaths = ['/', '/restore', '/whiteout', '/settings'] as const

export type PagePath = typeof pagePaths[number]

export function readPagePath(hash: string): PagePath {
  const path = hash.startsWith('#') ? hash.slice(1) : hash
  return pagePaths.find(page => page === path) ?? '/'
}

export function pageHash(path: PagePath) {
  return `#${path}`
}
