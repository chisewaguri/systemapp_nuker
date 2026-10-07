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
    './uad': { loadUad: async () => ({ kind: 'none', count: 0, date: null }) },
  })
  const apps = new AppList()
  await apps.waitForReady()
  return apps
}

async function applyPage(page, apps, selected) {
  const source = fs.readFileSync(path.join(root, `src/pages/${page}.tsx`), 'utf8')
  const handler = page === 'Home' ? 'applyNuke' : 'handleFabClick'
  const body = source.split(`const ${handler} = useCallback(async () => {`)[1]
    .split('}, [appListManager, showSnackBar, t])')[0]
  const run = new Function('appListManager', 'appListRef', 'runMutation', 'showSnackBar', 't', 'setApps', 'Cli', 'setLoadFailed', 'saveIcons', 'whiteoutManager',
    `return (async () => {${body}})()`)
  await run(apps, { current: { getSelectedPackages: () => selected } }, async task => { await task(); return true },
    () => {}, key => key, () => {}, { nuke: async () => true }, () => {}, async () => {}, { refresh: async () => {} })
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
    './File': {}, './shell': { shellQuote: value => `'${value}'` }, 'i18next': {}, '../constant': { PERSIST_DIR: '/persist' },
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
test('list lines split into package, system apk path and label', () => {
  const source = fs.readFileSync(path.join(root, '../module/nuke.sh'), 'utf8')
  const fns = ['is_apk_path', 'parse_list_line'].map(name => source.match(new RegExp(`${name}\\(\\) \\{[\\s\\S]*?\\n\\}`))[0]).join('\n')
  for (const [line, expected] of [
    ['com.a /system/app/A/A.apk My App', 'com.a|/system/app/A/A.apk|My App'],
    ['com.b  Label B', 'com.b||Label B'],
    ['com.c Old Label', 'com.c||Old Label'],
    ['com.d /data/app/x/base.apk D', 'com.d||D'],
  ]) {
    const result = spawnSync(shell, ['-c', `${fns}\nparse_list_line '${line}'; echo "$package_name|$saved_path|$label"`], { encoding: 'utf8' })
    if (result.error) throw result.error
    assert.equal(result.stdout.trim(), expected, line)
  }
})
test('whiteouts hide an app folder only under app or priv-app', () => {
  const source = fs.readFileSync(path.join(root, '../module/nuke.sh'), 'utf8')
  const fn = source.match(/whiteout_target\(\) \{[\s\S]*?\n\}/)[0]
  for (const [apk, expected] of [
    ['/system/app/Foo/Foo.apk', '/system/app/Foo'],
    ['/product/priv-app/Bar/Bar.apk', '/product/priv-app/Bar'],
    ['/product/overlay/Theme.apk', '/product/overlay/Theme.apk'],
    ['/system/framework/framework-res.apk', '/system/framework/framework-res.apk'],
    ['/vendor/overlay/sub/Vendor.apk', '/vendor/overlay/sub/Vendor.apk'],
  ]) {
    const result = spawnSync(shell, ['-c', `${fn}\nwhiteout_target '${apk}'`], { encoding: 'utf8' })
    if (result.error) throw result.error
    assert.equal(result.stdout.trim(), expected, apk)
  }
})
test('a webui nuke whiteouts app folders and lone overlay apks, records paths and uninstalls for user 0', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-flow-test-')).replace(/\\/g, '/')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const persist = `${dir}/data/adb/system_app_nuker`
  fs.mkdirSync(`${dir}/bin`)
  fs.mkdirSync(persist, { recursive: true })
  fs.mkdirSync(`${dir}/data/adb/modules/system_app_nuker`, { recursive: true })
  fs.writeFileSync(`${dir}/data/adb/modules/system_app_nuker/nuke.sh`, '')
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.a  App A\ncom.ov  Overlay')
  fs.writeFileSync(`${dir}/bin/pm`, `#!/bin/sh
case "$1 $2" in
  "list packages") case "$*" in *factory-only*) ;; *-s*) printf 'package:com.a\\npackage:com.ov\\n' ;; *) echo "package:$3" ;; esac ;;
  "path com.a") echo package:/system/app/A/A.apk ;;
  "path com.ov") echo package:/product/overlay/Ov.apk ;;
  "uninstall -k") echo "$5" >> "${dir}/uninstalled" ;;
esac
`)
  fs.writeFileSync(`${dir}/bin/busybox`, '#!/bin/sh\n[ "$1" = mknod ] && : > "$2"\nexit 0\n')
  fs.chmodSync(`${dir}/bin/pm`, 0o755)
  fs.chmodSync(`${dir}/bin/busybox`, 0o755)
  const script = path.join(root, '../module/nuke.sh').replace(/\\/g, '/')
  const result = spawnSync(shell, ['-c', `PATH="$(${process.platform === 'win32' ? `cygpath -u '${dir}/bin'` : `echo '${dir}/bin'`}):$PATH" SAN_TEST_ROOT="${dir}" DUMMYZIP=true sh "${script}"`], { encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  const update = `${dir}/data/adb/modules_update/system_app_nuker`
  assert.ok(fs.statSync(`${update}/system/app/A`).isFile())
  assert.ok(fs.statSync(`${update}/system/product/overlay/Ov.apk`).isFile())
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.a /system/app/A/A.apk App A\ncom.ov /product/overlay/Ov.apk Overlay\n')
  assert.equal(fs.readFileSync(`${dir}/uninstalled`, 'utf8'), 'com.a\ncom.ov\n')
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

const UAD_DOWNLOADED = '/persist/uad_lists.json'
// answers the sed range reads uad.ts uses for big files, everything else gets `other`
function sedExec(read, other = { errno: 0, stdout: '', stderr: '' }) {
  return async script => {
    const range = script.match(/^sed -n '(\d+),(\d+)p' '(.*)'$/)
    if (!range) return other
    const lines = read(range[3]).split('\n')
    if (lines.at(-1) === '') lines.pop()
    const part = lines.slice(Number(range[1]) - 1, Number(range[2]))
    return { errno: 0, stdout: part.length ? `${part.join('\n')}\n` : '', stderr: '' }
  }
}
function uadFixture({ downloaded, bundled }) {
  const fetched = []
  const mod = load('src/lib/uad.ts', {
    '../constant': { PERSIST_DIR: '/persist' },
    './File': { File: { exist: async file => file === UAD_DOWNLOADED && downloaded !== undefined } },
    './shell': { shellQuote: value => `'${value}'` },
    'kernelsu-alt': { exec: sedExec(file => (file === UAD_DOWNLOADED ? downloaded ?? '' : '')) },
  }, {
    fetch: async url => {
      fetched.push(url)
      if (bundled === undefined) throw new Error('no bundle')
      return { ok: true, json: async () => bundled }
    },
  })
  return { ...mod, fetched }
}

test('uad trim keeps level and description and rejects lists that are not uad shaped', () => {
  const { trimUad } = uadFixture({})
  assert.deepEqual(trimUad({
    'com.a': { list: 'Oem', description: ' A app.\n', removal: 'Recommended', dependencies: [] },
    'com.b': { description: '', removal: 'Unsafe' },
  }), { 'com.a': ['Recommended', 'A app.'], 'com.b': ['Unsafe', ''] })
  for (const bad of [[], {}, 'html', null, { 'com.a': { description: 'x' } }, { 'com.a': 'x' }]) {
    assert.equal(trimUad(bad), null, JSON.stringify(bad))
  }
})

test('uad removal levels map case-insensitively and unknown values fall back to unknown', () => {
  const { toRemoval } = uadFixture({})
  assert.equal(toRemoval('Recommended'), 'recommended')
  assert.equal(toRemoval('UNSAFE'), 'unsafe')
  assert.equal(toRemoval('Experimental'), 'unknown')
  assert.equal(toRemoval(''), 'unknown')
})

test('uad loads the downloaded copy first, then the bundle, then nothing', async () => {
  const upstream = JSON.stringify({ 'com.dl': { description: 'From download', removal: 'Expert' } })
  const bundled = { 'com.bundled': ['Advanced', 'From bundle'], 'com.blank': ['Recommended', '  '], 'com.gaps': ['Expert', 'First\n\n\nSecond\n \nThird'] }

  const dl = uadFixture({ downloaded: upstream, bundled })
  assert.deepEqual(await dl.loadUad(), { kind: 'downloaded', count: 1, date: null })
  assert.deepEqual(dl.getUad('com.dl'), { removal: 'expert', description: 'From download' })
  assert.deepEqual(dl.getUad('com.bundled'), { removal: 'unknown', description: null })

  for (const corrupt of ['<html>rate limited</html>', '[]', '{}']) {
    const fb = uadFixture({ downloaded: corrupt, bundled })
    assert.equal((await fb.loadUad()).kind, 'bundled', corrupt)
    assert.deepEqual(fb.getUad('com.bundled'), { removal: 'advanced', description: 'From bundle' })
    assert.deepEqual(fb.getUad('com.blank'), { removal: 'recommended', description: null })
    assert.deepEqual(fb.getUad('com.gaps'), { removal: 'expert', description: 'First\nSecond\nThird' })
  }

  const none = uadFixture({})
  assert.deepEqual(await none.loadUad(), { kind: 'none', count: 0, date: null })
  assert.deepEqual(none.getUad('com.anything'), { removal: 'unknown', description: null })
})

test('app list filter matches apps by uad-ng removal level and unlisted apps by unknown', () => {
  const levels = { 'com.ok': 'recommended', 'com.risky': 'unsafe' }
  let rendered
  const { default: AppList } = load('src/components/AppList.tsx', {
    react: {
      useState: init => [typeof init === 'function' ? init() : init, () => {}],
      useCallback: fn => fn,
      useImperativeHandle: () => {},
      forwardRef: fn => props => fn(props, null),
      useEffect: () => {},
    },
    'react/jsx-runtime': {
      jsx: (type, props) => { if (props && props.items) rendered = props.items; return null },
      jsxs: (type, props) => { if (props && props.items) rendered = props.items; return null },
      Fragment: 'Fragment',
    },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../lib/uad': {
      getUad: pkg => ({ removal: levels[pkg] ?? 'unknown', description: null }),
      removalLevels: [{ id: 'recommended', color: 'g' }, { id: 'unsafe', color: 'r' }, { id: 'unknown', color: 'x' }],
    },
    '../hooks/useIconObserver': { useIconObserver: () => ({ current: null }) },
    '../assets/android.svg?react': () => null,
    './dialog/AppInfoDialog': () => null,
    './SegmentedList': props => { rendered = props.items; return null },
  })
  const apps = ['com.ok', 'com.risky', 'com.unlisted'].map(packageName => ({ packageName, appLabel: packageName, pending: false, nuked: false }))
  const visible = selectedCategories => {
    rendered = undefined
    AppList({ apps, searchQuery: '', selectedCategories, emptyMessage: '' })
    return rendered.filter(item => !item.hidden).map(item => item.key)
  }
  assert.deepEqual(visible([]), ['com.ok', 'com.risky', 'com.unlisted'])
  assert.deepEqual(visible(['unsafe']), ['com.risky'])
  assert.deepEqual(visible(['unknown']), ['com.unlisted'])
  assert.deepEqual(visible(['recommended', 'unknown']), ['com.ok', 'com.unlisted'])
})

for (const [failure, kept] of [['download', true], ['notuad', true], ['move', true], [null, false]]) {
  test(`uad update ${kept ? 'keeps the current list' : 'replaces the list'} on ${failure ?? 'no'} failure and leaves no temp file`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-uad-update-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const persist = dir.replace(/\\/g, '/')
    const current = JSON.stringify({ 'com.old': { description: 'old', removal: 'Advanced' } })
    fs.writeFileSync(path.join(dir, 'uad_lists.json'), current)
    const fresh = failure === 'notuad' ? '<html>rate limited</html>' : JSON.stringify({ 'com.new': { description: 'new', removal: 'Unsafe' } })
    const stubs = {
      download: 'curl() { echo "curl: (6) could not resolve host" >&2; return 6; }',
      notuad: `curl() { while [ "$1" != "-o" ]; do shift; done; printf '%s' '${fresh}' > "$2"; }`,
      move: `curl() { while [ "$1" != "-o" ]; do shift; done; printf '%s' '${fresh}' > "$2"; }; mv() { return 1; }`,
    }[failure] ?? `curl() { while [ "$1" != "-o" ]; do shift; done; printf '%s' '${fresh}' > "$2"; }`
    const { updateUad, getUad } = load('src/lib/uad.ts', {
      '../constant': { PERSIST_DIR: persist },
      './File': { File: { exist: async f => fs.existsSync(f) } },
      './shell': { shellQuote: value => `'${value.replaceAll("'", "'\\''")}'` },
      'kernelsu-alt': { exec: async script => {
        const result = spawnSync(shell, ['-c', `${stubs}\n${script}`], { encoding: 'utf8' })
        if (result.error) throw result.error
        return { errno: result.status, stdout: result.stdout, stderr: result.stderr }
      } },
    }, { fetch: async () => ({ ok: false }) })

    const update = updateUad()
    if (kept) await assert.rejects(update)
    else await update
    assert.equal(fs.readFileSync(path.join(dir, 'uad_lists.json'), 'utf8'), kept ? current : fresh)
    assert.deepEqual(fs.readdirSync(dir), ['uad_lists.json'])
    if (!kept) assert.deepEqual(getUad('com.new'), { removal: 'unsafe', description: 'new' })
  })
}

test('opening a link from a description never runs shell syntax in the url', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-openlink-'))
  const marker = path.join(dir, 'pwned').replace(/\\/g, '/')
  let ran
  const { Cli } = load('src/lib/Cli.ts', {
    'kernelsu-alt': {
      toast: () => {},
      exec: async script => {
        const result = spawnSync(shell, ['-c', `am() { printf '%s\\n' "$@"; }\n${script}`], { encoding: 'utf8' })
        ran = result.stdout
        return { errno: result.status, stdout: result.stdout, stderr: result.stderr }
      },
    },
    './File': {}, './shell': load('src/lib/shell.ts', {}), 'i18next': {}, '../constant': { PERSIST_DIR: '/persist' },
  }, { setTimeout: fn => fn(), window: { open: () => {} } })
  const url = `https://example.org/a?x=1&y=$(touch ${marker})\`touch ${marker}\`;touch ${marker}`
  Cli.openLink(url)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(fs.existsSync(marker), false)
  assert.equal(ran.trim().split('\n').pop(), url)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('a slow older uad load cannot overwrite a newer one', async () => {
  let downloaded = ''
  let releaseBundle
  const bundleGate = new Promise(resolve => { releaseBundle = resolve })
  const { loadUad, uadReady, getUad } = load('src/lib/uad.ts', {
    '../constant': { PERSIST_DIR: '/persist' },
    './File': { File: { exist: async () => downloaded !== '' } },
    './shell': { shellQuote: value => `'${value}'` },
    'kernelsu-alt': { exec: sedExec(() => downloaded, { errno: 0, stdout: '2026-10-02\n', stderr: '' }) },
  }, {
    fetch: async () => {
      await bundleGate
      return { ok: true, json: async () => ({ 'com.a': ['Recommended', 'bundled'] }) }
    },
  })

  const startup = loadUad()
  downloaded = JSON.stringify({ 'com.a': { description: 'fresh', removal: 'Unsafe' } })
  assert.equal((await loadUad()).kind, 'downloaded')
  releaseBundle()
  await startup

  assert.deepEqual(getUad('com.a'), { removal: 'unsafe', description: 'fresh' })
  assert.equal((await uadReady()).kind, 'downloaded')
  assert.equal((await startup).kind, 'downloaded')
})

test('icon cache saves at nuke time and serves only data image urls back', async () => {
  const files = new Map()
  const fetched = []
  const { saveIcons, savedIcon } = load('src/lib/iconCache.ts', {
    'kernelsu-alt': { exec: async () => ({ errno: 0, stdout: '', stderr: '' }) },
    '../constant': { PERSIST_DIR: '/persist' },
    './File': { File: {
      write: async (f, data) => { files.set(f, data) },
      readIfExists: async f => files.get(f) ?? '',
    } },
    './shell': { shellQuote: value => `'${value}'` },
  }, {
    fetch: async url => { fetched.push(url); return url.endsWith('com.gone') ? { ok: false } : { ok: true, blob: async () => 'blob' } },
    createImageBitmap: async () => 'bitmap',
    document: { createElement: () => ({ getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/png;base64,AAAA' }) },
    Image: class { decode() { return Promise.reject(new Error('gone')) } },
  })

  await saveIcons(['com.yt', 'com.gone'])
  assert.deepEqual(fetched, ['ksu://icon/com.yt', 'ksu://icon/com.gone'])
  assert.deepEqual([...files.keys()], ['/persist/icons/com.yt'])
  assert.equal(await savedIcon('com.yt'), 'data:image/png;base64,AAAA')
  assert.equal(await savedIcon('com.gone'), null)

  files.set('/persist/icons/com.bad', 'javascript:alert(1)')
  assert.equal(await savedIcon('com.bad'), null)
})
