export const parseNukeLine = (line: string) => {
  const first = line.indexOf(' ')
  if (first === -1) {
    return { packageName: line, apkPath: '', appLabel: line }
  }

  const packageName = line.slice(0, first)
  const rest = line.slice(first + 1)
  if (!rest.startsWith('/')) {
    return { packageName, apkPath: '', appLabel: rest.trimStart() }
  }

  const second = rest.indexOf(' ')
  return {
    packageName,
    apkPath: second === -1 ? rest : rest.slice(0, second),
    appLabel: second === -1 ? packageName : rest.slice(second + 1),
  }
}
