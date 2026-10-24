const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

async function appsFixture(infos, extraPkgs = []) {
  const { parseNukeLine } = load('src/lib/nukeList.ts', {})
  const files = new Map([
    ['/persist/nuke_list.txt', 'com.pending  Pending'],
    ['/persist/nuke_list.txt.old', 'com.restore  Restore'],
  ])
  const pkgs = ['com.pending', 'com.restore', 'com.installed', ...extraPkgs]
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

test('app lists put pending apps first, then sort by app name', async () => {
  const apps = await appsFixture([
    { packageName: 'com.restore', appLabel: 'Zebra', isSystem: true },
    { packageName: 'com.installed', appLabel: 'mango', isSystem: true },
    { packageName: 'com.a', appLabel: 'Weather 10', isSystem: true },
    { packageName: 'com.z', appLabel: 'apple', isSystem: true },
    { packageName: 'com.m', appLabel: 'Weather 9', isSystem: true },
  ], ['com.a', 'com.z', 'com.m'])
  assert.deepEqual(apps.systemAppList.map(app => app.appLabel), ['Zebra', 'apple', 'mango', 'Weather 9', 'Weather 10'])
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

test('late-load detection distinguishes normal boot from a failed query', async () => {
  for (const [errno, stdout, expected] of [[0, 'late_load: true', true], [0, 'late_load: false', false], [0, '', false], [1, '', null]]) {
    const { Cli } = load('src/lib/Cli.ts', {
      'kernelsu-alt': { exec: async () => ({ errno, stdout, stderr: '' }) },
      './File': {}, './shell': {}, 'i18next': {}, '../constant': {},
    })
    if (expected === null) await assert.rejects(Cli.isLateLoaded(), /Could not read/)
    else assert.equal(await Cli.isLateLoaded(), expected)
  }
})
