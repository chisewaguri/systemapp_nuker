const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { load, shell } = require('../helpers/runtime.cjs')

function backupFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-backup-')).replace(/\\/g, '/')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const persist = `${dir}/persist`
  fs.mkdirSync(persist)
  let failure = ''
  const exec = async script => {
    const result = spawnSync(shell, ['-c', `${failure}\n${script}`], { encoding: 'utf8', timeout: 10000 })
    if (result.error) throw result.error
    return { errno: result.status, stdout: result.stdout, stderr: result.stderr }
  }
  const shellModule = load('src/lib/shell.ts', {})
  const { File } = load('src/lib/File.ts', { 'kernelsu-alt': { exec }, './shell': shellModule })
  const { Cli } = load('src/lib/Cli.ts', {
    'kernelsu-alt': { exec }, './File': { File }, './shell': shellModule,
    i18next: { t: key => key }, '../constant': { PERSIST_DIR: persist },
  })
  return { persist, Cli, fail: script => { failure = script } }
}

function restoreAction(Cli) {
  let restore
  const component = () => null
  const dialog = props => { restore = props.onRestore }
  const jsx = (type, props) => typeof type === 'function' ? type(props) : props.children
  const imports = {
    react: {
      StrictMode: component, useState: value => [value, () => {}],
      useEffect: () => {}, useCallback: callback => callback,
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    i18next: { t: key => key },
    'react-dom/client': { createRoot: () => ({ render: () => {} }) },
    './lib/Cli': { Cli },
    './lib/AppListContext': { AppListProvider: component, useAppList: () => ({ refresh: async () => {} }) },
    './lib/Whiteout': { whiteoutManager: { refresh: async () => {} } },
    './lib/mutationLock': load('src/lib/mutationLock.ts', {}),
    './lib/navigation': { readPagePath: () => '/' },
    './components/dialog/BackupRestoreDialog': dialog,
    './components/SnackBar': { useSnackBar: () => ({ show: () => {} }) },
  }
  for (const name of ['./lib/i18n', './index.css', '@material/web/all.js']) imports[name] = {}
  for (const name of ['./components/Layout', './pages/Home', './pages/Restore', './pages/Whiteout', './pages/Settings']) {
    imports[name] = component
  }
  load('src/main.tsx', imports, { document: { getElementById: () => ({}) } })
  assert.equal(typeof restore, 'function')
  return restore
}

test('restoring backups keeps them available until explicitly discarded', async t => {
  const { persist, Cli } = backupFixture(t)
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.safe  Safe\n')
  fs.writeFileSync(`${persist}/nuke_list.txt.bak`, 'com.saved  Saved\n')
  fs.writeFileSync(`${persist}/raw_whiteouts.txt.bak`, '/system/media/saved\n')
  assert.equal(await Cli.needRestore(), 'available')
  assert.equal(await Cli.restore(), true)
  for (const [name, expected] of [['nuke_list.txt', 'com.saved  Saved\n'], ['raw_whiteouts.txt', '/system/media/saved\n']]) {
    assert.equal(fs.readFileSync(`${persist}/${name}`, 'utf8'), expected)
    assert.equal(fs.readFileSync(`${persist}/${name}.bak`, 'utf8'), expected)
  }
  assert.equal(await Cli.needRestore(), 'available')
  assert.equal(await Cli.restore(false), true)
  assert.equal(await Cli.needRestore(), 'absent')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.saved  Saved\n')
  assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt`, 'utf8'), '/system/media/saved\n')
  assert.deepEqual(fs.readdirSync(persist).sort(), ['nuke_list.txt', 'raw_whiteouts.txt'])
})

test('WebUI keeps backups after failed apply and discards them after successful retry', async t => {
  const { persist, Cli } = backupFixture(t)
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.safe  Safe\n')
  fs.writeFileSync(`${persist}/nuke_list.txt.bak`, 'com.saved  Saved\n')
  fs.writeFileSync(`${persist}/raw_whiteouts.txt.bak`, '/system/media/saved\n')
  let succeeds = false
  const restore = restoreAction({
    restore: value => Cli.restore(value),
    nuke: async () => {
      assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.saved  Saved\n')
      assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt`, 'utf8'), '/system/media/saved\n')
      assert.equal(await Cli.needRestore(), 'available')
      return succeeds
    },
  })
  await restore()
  assert.equal(await Cli.needRestore(), 'available')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.bak`, 'utf8'), 'com.saved  Saved\n')
  assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt.bak`, 'utf8'), '/system/media/saved\n')

  succeeds = true
  await restore()
  assert.equal(await Cli.needRestore(), 'absent')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.saved  Saved\n')
  assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt`, 'utf8'), '/system/media/saved\n')
  assert.deepEqual(fs.readdirSync(persist).sort(), ['nuke_list.txt', 'raw_whiteouts.txt'])
})

for (const operation of ['cp', 'mv']) {
  test(`failed backup ${operation} preserves the current selection and permits retry`, async t => {
    const { persist, Cli, fail } = backupFixture(t)
    fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.safe  Safe\n')
    fs.writeFileSync(`${persist}/nuke_list.txt.bak`, 'com.saved  Saved\n')
    fail(`${operation}() { return 1; }`)
    assert.equal(await Cli.restore(), false)
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.safe  Safe\n')
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.bak`, 'utf8'), 'com.saved  Saved\n')
    assert.deepEqual(fs.readdirSync(persist).sort(), ['nuke_list.txt', 'nuke_list.txt.bak'])
    fail('')
    assert.equal(await Cli.needRestore(), 'available')
    assert.equal(await Cli.restore(), true)
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.saved  Saved\n')
  })
}

test('failed backup discard reports failure and keeps the backup for retry', async t => {
  const { persist, Cli, fail } = backupFixture(t)
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.safe  Safe\n')
  fs.writeFileSync(`${persist}/nuke_list.txt.bak`, 'com.saved  Saved\n')
  fail('rm() { return 1; }')
  assert.equal(await Cli.restore(false), false)
  assert.equal(await Cli.needRestore(), 'available')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.bak`, 'utf8'), 'com.saved  Saved\n')
  fail('')
  assert.equal(await Cli.restore(false), true)
  assert.equal(await Cli.needRestore(), 'absent')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.safe  Safe\n')
})
