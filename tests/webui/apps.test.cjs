const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell, ts } = require('../helpers/runtime.cjs')

async function appsFixture(infos, extraPkgs = [], files = new Map([
  ['/persist/nuke_list.txt', 'com.pending  Pending'],
  ['/persist/nuke_list.txt.old', 'com.restore  Restore'],
])) {
  const { parseNukeLine } = load('src/lib/nukeList.ts', {})
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
  const {outputText} = ts.transpileModule(`async function runPage() {${body}}`, {
    compilerOptions: {target: ts.ScriptTarget.ES2022},
  })
  const run = new Function('appListManager', 'appListRef', 'runMutation', 'showSnackBar', 't', 'setApps', 'Cli', 'setLoadFailed', 'saveIcons', 'refreshLists',
    `${outputText}\nreturn runPage()`)
  await run(apps, { current: { getSelectedPackages: () => selected } }, async task => { await task(); return true },
    () => {}, key => key, () => {}, { nuke: async () => true }, () => {}, async () => {}, load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: {refresh: async () => {}}}}).refreshLists)
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

test('app-list writes preserve a hidden app saved APK path when another app is selected', async () => {
  const files = new Map([
    ['/persist/nuke_list.txt', 'com.hidden /system/app/Hidden/Hidden.apk Hidden'],
    ['/persist/nuke_list.txt.old', 'com.hidden /system/app/Hidden/Hidden.apk Hidden'],
  ])
  const apps = await appsFixture(undefined, [], files)
  apps.setNuke('com.installed', true)
  assert.equal(await apps.write(), true)
  assert.equal(files.get('/persist/nuke_list.txt'), 'com.hidden /system/app/Hidden/Hidden.apk Hidden\ncom.installed  com.installed')
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
    react: { useRef: () => ({ current: dialog }), useEffect: effect => effect(), useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    'react-dom': {}, 'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../../hooks/useDialogAnimation': { customizeDialogAnimation: () => {} },
    '../../hooks/useHistory': { useHistory: () => ({ push: () => {}, consume: () => {} }) },
    '../../lib/File': { File: { readIfExists: async () => '' } },
    '../../constant': { PERSIST_DIR: '/persist' },
    '../../lib/nukeList': load('src/lib/nukeList.ts', {}),
    './AppInfoDialog': {__esModule: true, default: 'AppInfoDialog'}, '../../lib/uad': {getUad: () => ({removal: 'unknown'})},
  }, { document: { getElementById: () => null } })
  BackupRestoreDialog({ open: true, onDismiss: () => dismissed++, onDontRestore: () => {}, onRestore: () => {} })
  events.get('closed')()
  assert.equal(dismissed, 1)
})

test('app list filter matches apps by uad-ng removal level and unlisted apps by unknown', () => {
  const levels = { 'com.ok': 'recommended', 'com.risky': 'unsafe' }
  let rendered
  let selection
  let handle
  let cursor = 0
  let pendingRendered
  let renderedTree
  const cancelled = []
  const states = []
  const { default: AppList } = load('src/components/AppList.tsx', {
    react: {
      useState: init => { const i = cursor++; if (!(i in states)) states[i] = typeof init === 'function' ? init() : init; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
      useCallback: fn => fn,
      useImperativeHandle: (_ref, create) => { handle = create() },
      forwardRef: fn => props => fn(props, null),
      useEffect: effect => effect(),
      useLayoutEffect: effect => effect(),
    },
    'react/jsx-runtime': {
      jsx: (type, props) => { if (type === 'PendingMatches') { pendingRendered = props.changes } else if (props && props.items) rendered.push(...props.items); return {type, props} },
      jsxs: (type, props) => { if (type === 'PendingMatches') { pendingRendered = props.changes } else if (props && props.items) rendered.push(...props.items); return {type, props} },
      Fragment: 'Fragment',
    },
    'react-i18next': { useTranslation: () => ({ t: (key, values) => values ? `${key} ${JSON.stringify(values)}` : key }) },
    '../lib/uad': {
      getUad: pkg => ({ removal: levels[pkg] ?? 'unknown', description: null }),
      removalLevels: [{ id: 'recommended', color: 'g' }, { id: 'unsafe', color: 'r' }, { id: 'unknown', color: 'x' }],
    },
    '../hooks/useIconObserver': { useIconObserver: () => ({ current: null }) },
    '../lib/AppListContext': { useAppList: () => ({ getSelection: () => ['com.risky'], setSelection: () => {}, pendingApps: [
      {packageName: 'com.pending.video', appLabel: 'Pending Video', nuked: false},
      {packageName: 'com.risky', appLabel: 'Pending Restore', nuked: true},
    ] }) },
    '../assets/android.svg?react': () => null,
    './dialog/AppInfoDialog': () => null,
    './SegmentedList': props => { rendered = props.items; return null },
    './PendingMatches': {__esModule: true, default: 'PendingMatches'},
  }, {window: {dispatchEvent: event => cancelled.push(event.detail)}})
  const apps = ['com.ok', 'com.risky', 'com.unlisted'].map(packageName => ({ packageName, appLabel: packageName === 'com.unlisted' ? 'Other app' : 'Shared name', pending: false, nuked: false }))
  const textOf = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join(' ') : node?.props ? textOf(node.props.children) : ''
  const visible = (selectedCategories, searchQuery = '') => {
    cursor = 0
    rendered = []
    pendingRendered = undefined
    renderedTree = AppList({ apps, searchQuery, selectedCategories, emptyMessage: 'No results', selectionKey: 'remove', onSelectionChange: (packages, hidden) => { selection = {packages, hidden} } })
    return rendered.filter(item => !item.hidden).map(item => item.key)
  }
  assert.deepEqual(visible([]), ['com.ok', 'com.risky', 'com.unlisted'])
  assert.match(textOf(rendered.find(row => row.key === 'com.ok').content), /com.ok/)
  assert.match(textOf(rendered.find(row => row.key === 'com.risky').content), /com.risky/)
  const unlisted = rendered.find(row => row.key === 'com.unlisted')
  assert.doesNotMatch(textOf(unlisted.content), /com.unlisted/)
  assert.match(JSON.stringify(unlisted.trailingContent), /com.unlisted/)
  assert.deepEqual(visible([], 'COM.UNLISTED'), ['com.unlisted'])
  assert.match(textOf(rendered.find(row => row.key === 'com.unlisted').content), /com.unlisted/)
  visible([])
  const identity = rendered.find(row => row.key === 'com.ok').content
  assert.equal(identity.type, 'button')
  identity.props.onClick({preventDefault() {}, stopPropagation() {}})
  const currentDetails = () => renderedTree.props.children.find(child => child?.props?.onClose)
  visible([])
  assert.equal(currentDetails().props.app.packageName, 'com.ok')
  assert.equal(currentDetails().props.navigation.onPrevious, undefined)
  currentDetails().props.navigation.onNext()
  visible([])
  assert.equal(currentDetails().props.app.packageName, 'com.risky')
  assert.deepEqual(selection.packages, ['com.risky'])
  currentDetails().props.navigation.onNext()
  visible([])
  assert.equal(currentDetails().props.app.packageName, 'com.unlisted')
  assert.equal(currentDetails().props.navigation.onNext, undefined)
  assert.equal(currentDetails().props.selection.checked, false)
  currentDetails().props.selection.onChange()
  visible([])
  assert.deepEqual(selection.packages, ['com.risky', 'com.unlisted'])
  assert.equal(currentDetails().props.selection.checked, true)
  currentDetails().props.selection.onChange()
  visible([])
  assert.deepEqual(selection.packages, ['com.risky'])
  visible(['unknown'])
  assert.equal(currentDetails().props.navigation, undefined)
  visible([])
  assert.equal(pendingRendered, undefined)
  assert.doesNotMatch(renderedTree.props.children.find(child => child?.props?.role === 'status').props.children, /review.pending_matches/)
  assert.deepEqual(visible(['unsafe']), ['com.risky'])
  assert.equal(pendingRendered.length, 1)
  assert.deepEqual(pendingRendered, [{kind: 'app', packageName: 'com.risky'}])
  assert.deepEqual(cancelled, [])
  assert.equal(selection.hidden, 0)
  assert.deepEqual(visible(['unknown']), ['com.unlisted'])
  assert.equal(selection.hidden, 1)
  assert.deepEqual(selection.packages, ['com.risky'])
  assert.deepEqual(visible(['recommended', 'unknown']), ['com.ok', 'com.unlisted'])
  apps[0].pending = true
  visible([])
  const findCheckbox = node => Array.isArray(node) ? node.map(findCheckbox).find(Boolean) : node?.type === 'md-checkbox' ? node : node?.props ? findCheckbox(node.props.children) : undefined
  const row = rendered.find(item => item.key === 'com.ok')
  const checkbox = findCheckbox([row.content, row.trailingContent])
  assert.equal(checkbox.props.id, 'app-select-com.ok')
  assert.equal(row.labelFor, undefined)
  assert.match(checkbox.props['aria-label'], /removal.recommended/)
  assert.match(checkbox.props['aria-label'], /app_info.pending_removal/)
  visible(['recommended'])
  handle.selectAllVisible()
  visible(['unsafe'])
  assert.deepEqual(selection.packages.sort(), ['com.ok', 'com.risky'])
  assert.equal(selection.hidden, 1)
  handle.deselectAllVisible()
  visible(['unsafe'])
  assert.deepEqual(selection.packages, ['com.ok'])
  assert.equal(selection.hidden, 1)
  assert.deepEqual(visible([], 'pending'), [])
  assert.doesNotMatch(JSON.stringify(renderedTree), /review.no_selectable_matches/)
  assert.equal(renderedTree.props.children[0], false)
  assert.doesNotMatch(JSON.stringify(renderedTree), /review.pending_below/)
  const resultStatus = renderedTree.props.children.find(child => child?.props?.role === 'status').props.children
  assert.match(resultStatus, /review.results_remove.*"count":0/)
  assert.match(resultStatus, /review.pending_matches.*"count":2/)
  assert.deepEqual(pendingRendered, [
    {kind: 'app', packageName: 'com.pending.video'},
    {kind: 'app', packageName: 'com.risky'},
  ])
  assert.deepEqual(cancelled, [])
  visible(['unsafe'], 'pending')
  assert.deepEqual(pendingRendered, [{kind: 'app', packageName: 'com.risky'}])
  visible([], 'COM.PENDING')
  assert.deepEqual(pendingRendered, [{kind: 'app', packageName: 'com.pending.video'}])

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
