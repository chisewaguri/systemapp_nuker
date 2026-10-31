const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('../helpers/runtime.cjs')

test('KSU I/O instance writes UTF-8 through base64 chunks and replaces via rename', async () => {
  const files = new Map()
  const operations = []
  let output = ''
  const io = {
    File: path => ({
      exists: () => files.has(path),
      isSymlink: () => false,
      isDirectory: () => false,
      isFile: () => files.has(path),
      length: () => new TextEncoder().encode(files.get(path) ?? '').length,
      delete: () => files.delete(path),
      deleteRecursive: () => files.delete(path),
      mkdirs: () => true,
      renameTo: target => {
        operations.push(['rename', path, target])
        files.set(target, files.get(path))
        files.delete(path)
        return true
      },
    }),
    FileInputStream: () => ({
      open: path => path,
      read: (path, size) => {
        const bytes = new TextEncoder().encode(files.get(path))
        const chunk = bytes.slice(0, size)
        files.set(path, new TextDecoder().decode(bytes.slice(chunk.length)))
        return chunk.length ? Buffer.from(chunk).toString('base64') : ''
      },
      close: () => true,
    }),
    FileOutputStream: () => ({
      open: path => { operations.push(['open', path]); output = ''; return path },
      write: (id, encoded) => { output += Buffer.from(encoded, 'base64').toString(); files.set(id, output); return true },
      flush: () => true,
      close: () => true,
    }),
  }
  const { KsuIo } = load('src/lib/file/KsuIo.ts', { 'kernelsu-alt': { io } })
  const fs = new KsuIo()
  files.set('/persist/config', 'old')
  await fs.write('/persist/config', '你好')
  assert.equal(files.get('/persist/config'), '你好\n')
  assert.deepEqual(operations.at(-1), ['rename', '/persist/config.tmp', '/persist/config'])
})

test('selected file implementation uses KSU I/O when supported', () => {
  const io = { support: true }
  const { file } = load('src/lib/file/index.ts', {
    'kernelsu-alt': { io },
    './KsuIo': { KsuIo: class KsuIo {} },
    './File': { ShellFile: class ShellFile {}, File: class File {} },
  })
  assert.equal(file.constructor.name, 'KsuIo')
})
