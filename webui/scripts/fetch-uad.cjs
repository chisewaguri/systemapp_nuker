// writes public/uad.json from uad-ng's list, trimmed by the same trimUad the webui uses
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/lib/uad.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const mod = { exports: {} }
// trimUad and UAD_URL dont touch these imports, so empty stubs are enough
new Function('require', 'module', 'exports', outputText)(() => ({}), mod, mod.exports)
const { trimUad, UAD_URL } = mod.exports

async function main() {
  const response = await fetch(UAD_URL, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`${UAD_URL} returned ${response.status}`)
  const trimmed = trimUad(await response.json())
  if (!trimmed) throw new Error('the uad-ng list is not shaped as expected')
  const out = path.join(root, 'public/uad.json')
  fs.writeFileSync(out, JSON.stringify(trimmed))
  console.log(`wrote ${Object.keys(trimmed).length} apps to ${path.relative(root, out)} (${fs.statSync(out).size} bytes)`)
}

main().catch(error => {
  console.error(`fetch-uad: ${error.message}`)
  process.exit(1)
})
