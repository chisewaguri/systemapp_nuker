const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
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

async function appsFixture(infos) {
  const { parseNukeLine } = load('src/lib/nukeList.ts', {})
  const files = new Map([
    ['/persist/nuke_list.txt', 'com.pending  Pending'],
    ['/persist/nuke_list.txt.old', 'com.restore  Restore'],
  ])
  const pkgs = ['com.pending', 'com.restore', 'com.installed']
  const { default: AppList } = load('src/lib/AppList.ts', {
    'kernelsu-alt': {
      listPackages: async () => pkgs,
      exec: async () => ({ errno: 0, stdout: pkgs.map(pkg => `package:${pkg}`).join('\n'), stderr: '' }),
      getPackagesInfo: async () => infos ?? pkgs.map(packageName => ({ packageName, appLabel: packageName, isSystem: true })),
    },
    '../constant': { PERSIST_DIR: '/persist' },
    './File': { File: {
      readIfExists: async file => files.get(file) ?? '',
      write: async (file, data) => files.set(file, data),
    } },
    './utils': { isDev: () => false },
    './nukeList': { parseNukeLine },
  })
  const apps = new AppList()
  await apps.waitForReady()
  return apps
}

async function applyPage(page, apps, selected) {
  const source = fs.readFileSync(path.join(root, `src/pages/${page}.tsx`), 'utf8')
  const body = source.split('const handleFabClick = useCallback(async () => {')[1]
    .split('}, [appListManager, showSnackBar, t])')[0]
  const run = new Function('appListManager', 'appListRef', 'runMutation', 'showSnackBar', 't', 'setApps', 'Cli', 'setLoadFailed',
    `return (async () => {${body}})()`)
  await run(apps, { current: { getSelectedPackages: () => selected } }, async task => { await task(); return true },
    () => {}, key => key, () => {}, { nuke: async () => true }, () => {})
}

test('Home can remove an app that is pending restoration', async () => {
  const apps = await appsFixture()
  await applyPage('Home', apps, ['com.restore'])
  assert.ok(apps.nukedAppList.some(app => app.packageName === 'com.restore'))
})

test('Restore can restore an app that is pending removal', async () => {
  const apps = await appsFixture()
  await applyPage('Restore', apps, ['com.pending'])
  assert.ok(apps.systemAppList.some(app => app.packageName === 'com.pending'))
})

test('app actions leave unselected pending work unchanged', async () => {
  const apps = await appsFixture()
  await applyPage('Home', apps, [])
  await applyPage('Restore', apps, [])
  assert.deepEqual(apps.nukedAppList.map(app => app.packageName), ['com.pending'])
})

test('partial and reordered host metadata preserves each package and searchable label', async () => {
  const apps = await appsFixture([{ packageName: 'com.installed', appLabel: 'Installed', isSystem: true }])
  const all = [...apps.systemAppList, ...apps.nukedAppList]
  assert.equal(all.length, 3)
  assert.deepEqual(new Set(all.map(app => app.packageName)), new Set(['com.pending', 'com.restore', 'com.installed']))
  assert.ok(all.every(app => typeof app.appLabel.toLowerCase() === 'string'))
  assert.equal(all.find(app => app.packageName === 'com.installed').appLabel, 'Installed')
})

test('backup operations return failure when the host rejects execution', async () => {
  const { Cli } = load('src/lib/Cli.ts', {
    'kernelsu-alt': { exec: async () => { throw new Error('host unavailable') } },
    './File': {}, 'i18next': {}, '../constant': { PERSIST_DIR: '/persist' },
  })
  assert.equal(await Cli.restore(true), false)
  assert.equal(await Cli.restore(false), false)
})

test('native backup-dialog dismissal clears the parent open state', () => {
  const events = new Map()
  const dialog = { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: () => {} }
  let dismissed = 0
  const { default: BackupRestoreDialog } = load('src/components/dialog/BackupRestoreDialog.tsx', {
    react: { useRef: () => ({ current: dialog }), useEffect: effect => effect() },
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    'react-dom': {}, 'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../../hooks/useDialogAnimation': { customizeDialogAnimation: () => {} },
    '../../hooks/useHistory': { useHistory: () => ({ push: () => {}, consume: () => {} }) },
  }, { document: { getElementById: () => null } })
  BackupRestoreDialog({ open: true, onDismiss: () => dismissed++, onDontRestore: () => {}, onRestore: () => {} })
  events.get('closed')()
  assert.equal(dismissed, 1)
})

const shell = process.env.TEST_SHELL || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh')
test('raw whiteouts reject data paths before filesystem operations and preserve system/partition mapping', () => {
  const source = fs.readFileSync(path.join(root, '../module/nuke.sh'), 'utf8')
  const fn = source.match(/whiteout_create\(\) \{[\s\S]*?\n\}/)[0]
  for (const input of ['/data', '/data/', '/data/app/Foo', '/system/data', '/system/data/app/Foo', '/system/app/Foo', '/product/app/Foo', '/database']) {
    const rejected = ['/data', '/system/data'].some(prefix => input === prefix || input.startsWith(prefix + '/'))
    const stubs = '\nMODULE_UPDATE_DIR=/fixture\nmkdir() { echo touched; }\nchmod() { :; }\nrm() { :; }\nbusybox() { :; }\n'
    const result = spawnSync(shell, ['-c', fn + stubs + `whiteout_create '${input}'; result=$?; echo "$target"; exit "$result"`], { encoding: 'utf8' })
    if (result.error) throw result.error
    assert.equal(result.status, rejected ? 1 : 0, input)
    assert.equal(result.stdout.includes('touched'), !rejected, input)
    if (!rejected) assert.ok(result.stdout.includes('/fixture' + (input.startsWith('/system/') ? input : '/system' + input)))
  }
})
test('cached apk paths match the exact package and skip /data copies', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-cache-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  // parser cache strings are UTF-16 with a length char in front, as seen on Android 16
  const entry = (name, pkg, apk) => fs.writeFileSync(path.join(dir, name),
    Buffer.from(`\u0007Baklava\u001a${pkg}${String.fromCharCode(apk.length)}${apk}￿`, 'utf16le'))
  entry('YouTube-16-1', 'com.google.android.youtube', '/product/app/YouTube/YouTube.apk')
  entry('Foo2-16-1', 'com.foo2', '/system/app/Foo2/Foo2.apk')
  entry('Wall-16-1', 'com.wall', '/product/overlay/MiuiGlobalWallpaperOverlay.apk')
  entry('Bar-16-1', 'com.bar', '/system/app/Bar/Bar.apk')
  entry('Bar-16-2', 'com.bar', '/data/app/~~x/com.bar-1/base.apk')
  const source = fs.readFileSync(path.join(root, '../module/nuke.sh'), 'utf8')
  const fn = source.match(/cached_apk_paths\(\) \{[\s\S]*?\n\}/)[0].replace('/data/system/package_cache/*/*', `${dir.replace(/\\/g, '/')}/*`)
  const result = spawnSync(shell, ['-c', `${fn}\ncached_apk_paths 'com.google.android.youtube com.foo com.wall com.bar'`], { encoding: 'utf8' })
  if (result.error) throw result.error
  assert.deepEqual(result.stdout.trim().split('\n').sort(), [
    'com.bar /system/app/Bar/Bar.apk',
    'com.google.android.youtube /product/app/YouTube/YouTube.apk',
    'com.wall /product/overlay/MiuiGlobalWallpaperOverlay.apk',
  ])
})
for (const [failure, writes] of [['cp', true], ['touch', true], ['write', false], ['cp+write', false], ['mv', false], [null, true]]) {
  test(`file write ${writes ? 'writes' : 'preserves the original'} on ${failure ?? 'no'} failure`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-write-test-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    // 'touch' covers a target that does not exist yet, where the staging file is created with a redirect.
    if (failure !== 'touch') fs.writeFileSync(path.join(dir, 'state.txt'), 'original\n')
    const { shellQuote } = load('src/lib/shell.ts', {})
    const { File } = load('src/lib/File.ts', {
      './shell': { shellQuote },
      'kernelsu-alt': { exec: async script => {
        // A read-only staging file makes the ': > "$tmp"' redirect fail like a host that rejects sibling files.
        if (failure === 'touch') fs.mkdirSync(path.join(dir, 'state.txt.tmp'))
        const stubs = {
          cp: 'cp() { return 1; }',
          mv: 'mv() { return 1; }',
          write: "printf() { command printf '%s' partial; return 1; }",
          // only the first printf fails, so the restore of the original can run
          'cp+write': "cp() { return 1; }; printf() { if [ -z \"$failed\" ]; then failed=1; command printf '%s' partial; return 1; fi; command printf \"$@\"; }",
        }[failure] ?? ''
        const result = spawnSync(shell, ['-c', stubs + '\n' + script], { cwd: dir, encoding: 'utf8' })
        if (failure === 'touch') fs.rmSync(path.join(dir, 'state.txt.tmp'), { recursive: true })
        if (result.error) throw result.error
        return { errno: result.status, stdout: result.stdout, stderr: result.stderr }
      } },
    })
    const write = File.write('state.txt', "new 'quoted' $data\nsecond line")
    if (writes) await write
    else await assert.rejects(write)
    assert.equal(fs.readFileSync(path.join(dir, 'state.txt'), 'utf8'), writes ? "new 'quoted' $data\nsecond line\n" : 'original\n')
    assert.deepEqual(fs.readdirSync(dir), ['state.txt'])
  })
}
