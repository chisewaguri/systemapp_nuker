const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const root = path.resolve(__dirname, '../../webui')
const ts = createRequire(path.join(root, 'package.json'))('typescript')
function load(relative, imports, globals = {}) {
  const filename = path.join(root, relative)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), outputText)(name => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`)
    return imports[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}

const shell = process.env.TEST_SHELL || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh')

module.exports = { root, load, shell }
