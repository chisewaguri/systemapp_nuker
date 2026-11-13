const { root, load, shell } = require('../helpers/runtime.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

async function appsFixture(infos, extraPkgs = [], suppliedFiles) {
  const { parseNukeLine } = load('src/lib/nukeList.ts', {})
  const files = suppliedFiles ?? new Map([
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

test('import preview separates new, already listed and unavailable packages without applying changes', async () => {
  const apps = await appsFixture()
  let writes = 0
  const { NukeConfig } = load('src/lib/NukeConfig.ts', {
    i18next: { t: key => key }, '../constant': { MOD_ID: 'san', NUKE_CONFIG_VERSION: 2 },
    './File': { File: { write: async () => { writes++ } } }, './AppList': {},
    './Cli': { Cli: { nuke: async () => { throw new Error('Preview must not apply changes') } } },
    './mutationLock': { runMutation: async task => { await task(); return true } },
    './refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: {}}}),
  })
  const preview = NukeConfig.previewImport(JSON.stringify({metadata: {modId: 'san'}, packages: ['com.installed', 'com.installed', 'com.pending', 'com.missing']}), apps)
  assert.deepEqual(preview.apps.map(app => app.packageName), ['com.installed'])
  assert.deepEqual(preview.unavailable, ['com.missing'])
  assert.equal(preview.alreadyListed, 1)
  assert.equal(writes, 0)
  assert.deepEqual(apps.nukingAppList.map(app => app.packageName), ['com.pending'])
  assert.throws(() => NukeConfig.previewImport('{', apps))
})

test('nuke failure retains complete installer output and offers persistent details', async () => {
  const messages = []
  let command = ''
  const { Cli } = load('src/lib/Cli.ts', {
    'kernelsu-alt': { exec: async value => { command = value; return { errno: 1, stdout: 'Installer rejected module', stderr: 'dummy installation failed' } } },
    './File': { File: {} }, './shell': { shellQuote: value => `'${value}'` },
    i18next: { t: key => key }, '../constant': { MOD_DIR: '/module', PERSIST_DIR: '/persist' },
  })
  assert.equal(await Cli.nuke((...args) => messages.push(args)), false)
  assert.match(await Cli.readOperationLog(), /Installer rejected module/)
  assert.match(await Cli.readOperationLog(), /dummy installation failed/)
  assert.equal(messages.at(-1)[2], 0)
  assert.equal(typeof messages.at(-1)[3].callback, 'function')
  assert.match(command, /last-operation\.log/)
})

test('a new page notification dismisses an older global notification', () => {
  const messages = []
  const {useSnackBar} = load('src/components/SnackBar.tsx', {
    react: {
      useState: initial => {
        const current = {state: initial}
        messages.push(current)
        return [current.state, next => { current.state = typeof next === 'function' ? next(current.state) : next }]
      },
      useCallback: callback => callback, useRef: value => ({current: value}), useEffect: () => {},
    },
    'react/jsx-runtime': {jsx: () => null, jsxs: () => null},
    'react-dom': {},
  })
  const globalMessage = useSnackBar()
  const pageMessage = useSnackBar()
  globalMessage.show('Could not check recovery files', false)
  pageMessage.show('Failed to save changes', false)
  assert.equal(messages[0].state.visible, false)
  assert.equal(messages[1].state.visible, true)
  assert.equal(messages[1].state.message, 'Failed to save changes')
  pageMessage.hide()
  assert.equal(messages[1].state.visible, false)
})

test('persistent errors use the layout notice area and disappear immediately when dismissed', () => {
  const target = {}
  const jsx = (type, props) => ({type, props})
  const {default: SnackBar} = load('src/components/SnackBar.tsx', {
    react: {useState: initial => [typeof initial === 'boolean' ? true : 'show', () => {}], useRef: initial => ({current: initial}), useCallback: callback => callback, useEffect() {}},
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-dom': {createPortal: (node, container) => ({node, container})},
  }, {document: {getElementById: id => id === 'notice-root' ? target : null}})
  const state = {message: 'Persistent error', success: false, visible: true}
  const error = SnackBar({state, onHide() {}})
  assert.equal(error.container, target)
  assert.equal(error.node.props.role, 'alert')
  assert.equal(SnackBar({state: {...state, visible: false}, onHide() {}}), null)
  assert.equal(SnackBar({state: {...state, success: true}, onHide() {}}).props.role, 'status')
})

test('the import picker accepts exported sdcard paths and validates the folder boundary on submission', () => {
  const {resolvePickerPath} = load('src/lib/FileSelector.tsx', {
    react: {}, 'react-dom': {}, 'kernelsu-alt': {},
    'react/jsx-runtime': {},
    '@material/web/all': {}, '../hooks/useDialogAnimation': {}, '../hooks/useHistory': {},
    './shell': {}, 'react-i18next': {},
  })
  const root = '/storage/emulated/0/'
  assert.equal(resolvePickerPath('/sdcard/Download/san-config-example.json', root), `${root}Download/san-config-example.json`)
  assert.equal(resolvePickerPath('/sdcard', root), '/storage/emulated/0')
  assert.equal(resolvePickerPath(`${root}Download/list.json`, root), `${root}Download/list.json`)
  for (const path of ['/storage/emulated/01/list.json', '/sdcard/../data/list.json', '/data/list.json', 'list.json', '/sdcard/Download/list\n.json']) {
    assert.equal(resolvePickerPath(path, root), null, path)
  }
  assert.equal(resolvePickerPath('/system/etc/file.xml', '/'), '/system/etc/file.xml')
})

test('raw path validation rejects data, partition roots and traversal before applying changes', () => {
  const { normalizeWhiteoutPath } = load('src/lib/Whiteout.ts', {
    './File': { File: { readIfExists: async () => '' } },
    '../constant': { PERSIST_DIR: '/persist' }, './utils': { isDev: () => false },
  })
  for (const value of ['/', '/system', '/system/', '/data/app/A', '/system/data/A', '//data/app/A', '/system//data/A', '/system/product', '/system/../data/A', '/system/etc\ninit.rc']) {
    assert.throws(() => normalizeWhiteoutPath(value), value)
  }
  assert.equal(normalizeWhiteoutPath('/product/app/Foo/'), '/system/product/app/Foo')
  assert.equal(normalizeWhiteoutPath('/system/etc/file.xml'), '/system/etc/file.xml')
})

test('raw pending changes distinguish paths to hide from paths to restore', async () => {
  const files = new Map([
    ['/persist/raw_whiteouts.txt', '/system/etc/new.xml\n/system/etc/kept.xml'],
    ['/persist/raw_whiteouts.txt.old', '/system/etc/old.xml\n/system/etc/kept.xml'],
  ])
  const { Whiteout } = load('src/lib/Whiteout.ts', {
    './File': { File: { readIfExists: async path => files.get(path) ?? '' } },
    '../constant': { PERSIST_DIR: '/persist' }, './utils': { isDev: () => false },
  })
  const manager = new Whiteout()
  await manager.waitForReady()
  assert.deepEqual(manager.pendingChanges, [
    {path: '/system/etc/new.xml', hiding: true},
    {path: '/system/etc/old.xml', hiding: false},
  ])
})

test('path search and selection survive refresh without writing device state', async () => {
  let writes = 0
  const {Whiteout} = load('src/lib/Whiteout.ts', {
    './File': {File: {readIfExists: async () => '/system/etc/kept.xml', write: async () => { writes++ }}},
    '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
  })
  const paths = new Whiteout()
  await paths.waitForReady()
  paths.setView({query: 'etc'})
  paths.setView({selection: ['/system/etc/kept.xml']})
  await paths.refresh()
  assert.deepEqual(paths.getView(), {query: 'etc', selection: ['/system/etc/kept.xml']})
  assert.equal(writes, 0)
})

for (const change of [
  {kind: 'app', packageName: 'com.pending'},
  {kind: 'app', packageName: 'com.restore'},
  {kind: 'path', path: '/system/etc/new.xml'},
  {kind: 'path', path: '/system/etc/old.xml'},
]) {
  test(`cancelling pending ${change.packageName ?? change.path} preserves unrelated pending work`, async () => {
    const apps = await appsFixture()
    const files = new Map([
      ['/persist/raw_whiteouts.txt', '/system/etc/new.xml\n/system/etc/kept.xml'],
      ['/persist/raw_whiteouts.txt.old', '/system/etc/old.xml\n/system/etc/kept.xml'],
    ])
    const {Whiteout} = load('src/lib/Whiteout.ts', {
      './File': {File: {readIfExists: async path => files.get(path) ?? '', write: async (path, content) => files.set(path, content)}},
      '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
    })
    const paths = new Whiteout()
    await paths.waitForReady()
    let applied = 0
    const {cancelPendingChange} = load('src/lib/PendingChanges.ts', {
      './File': {File: {}}, '../constant': {PERSIST_DIR: '/persist'},
      './refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: paths}}),
      './Whiteout': {whiteoutManager: paths},
      './Cli': {Cli: {nuke: async () => { applied++; return true }}},
      './mutationLock': load('src/lib/mutationLock.ts', {}),
      i18next: {t: key => key},
    })
    assert.equal(await cancelPendingChange(change, apps, () => {}), true)
    assert.equal(applied, 1)
    assert.deepEqual(apps.pendingApps.map(app => app.packageName).sort(), ['com.pending', 'com.restore'].filter(pkg => pkg !== change.packageName))
    assert.deepEqual(paths.pendingChanges.map(item => item.path).sort(), ['/system/etc/new.xml', '/system/etc/old.xml'].filter(path => path !== change.path))
    assert.ok(paths.whiteouts.includes('/system/etc/kept.xml'))
  })
}

test('a failed cancellation write does not run the installer or discard the pending path', async () => {
  const {Whiteout} = load('src/lib/Whiteout.ts', {
    './File': {File: {readIfExists: async path => path.endsWith('.old') ? '' : '/system/etc/new.xml', write: async () => { throw new Error('write failed') }}},
    '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
  })
  const paths = new Whiteout()
  await paths.waitForReady()
  let applied = false
  const messages = []
  const {cancelPendingChange} = load('src/lib/PendingChanges.ts', {
    './File': {File: {}}, '../constant': {PERSIST_DIR: '/persist'},
    './refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: paths}}),
    './Whiteout': {whiteoutManager: paths},
    './Cli': {Cli: {nuke: async () => { applied = true }}},
    './mutationLock': load('src/lib/mutationLock.ts', {}),
    i18next: {t: key => key},
  })
  assert.equal(await cancelPendingChange({kind: 'path', path: '/system/etc/new.xml'}, await appsFixture(), (...args) => messages.push(args)), false)
  assert.equal(applied, false)
  assert.deepEqual(paths.pendingChanges, [{path: '/system/etc/new.xml', hiding: true}])
  assert.equal(messages.at(-1)[0], 'global.write_error')
})

for (const failure of ['none', 'snapshot', 'paths', 'rollback']) {
  test(`batch undo preserves unrelated changes and handles ${failure} failure`, async () => {
    const original = '# saved apps\ncom.pending /system/app/Pending/Pending.apk Pending app\ncom.kept /system/app/Kept/Kept.apk Kept app\ncom.other /system/app/Other/Other.apk Other app'
    const appFiles = new Map([
      ['/persist/nuke_list.txt', original],
      ['/persist/nuke_list.txt.old', 'com.restore /system/app/Restore/Restore.apk Restore\ncom.kept /system/app/Kept/Kept.apk Kept app'],
    ])
    const apps = await appsFixture(undefined, ['com.kept', 'com.other'], appFiles)
    const pathFiles = new Map([
      ['/persist/raw_whiteouts.txt', '/system/etc/new.xml\n/system/etc/kept.xml'],
      ['/persist/raw_whiteouts.txt.old', '/system/etc/old.xml\n/system/etc/kept.xml'],
    ])
    const {Whiteout} = load('src/lib/Whiteout.ts', {
      './File': {File: {readIfExists: async path => pathFiles.get(path) ?? '', write: async (path, content) => {
        if (failure === 'paths' || failure === 'rollback') throw new Error('path write failed')
        pathFiles.set(path, content)
      }}},
      '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
    })
    const paths = new Whiteout()
    await paths.waitForReady()
    let applied = 0
    const messages = []
    const {cancelPendingChanges} = load('src/lib/PendingChanges.ts', {
      './refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: paths}}),
      './Whiteout': {whiteoutManager: paths},
      './Cli': {Cli: {nuke: async () => { applied++; return true }}},
      './mutationLock': load('src/lib/mutationLock.ts', {}), i18next: {t: key => key},
      '../constant': {PERSIST_DIR: '/persist'},
      './File': {File: {readIfExists: async path => {
        if (failure === 'snapshot') throw new Error('snapshot read failed')
        return appFiles.get(path) ?? ''
      }, write: async (path, content) => {
        if (failure === 'rollback') throw new Error('rollback write failed')
        appFiles.set(path, content)
      }}},
    })
    assert.equal(typeof cancelPendingChanges, 'function')
    const ok = await cancelPendingChanges([
      {kind: 'app', packageName: 'com.pending'},
      {kind: 'app', packageName: 'com.restore'},
      {kind: 'path', path: '/system/etc/new.xml'},
    ], apps, (...args) => messages.push(args))
    assert.equal(ok, failure === 'none')
    assert.equal(applied, failure === 'none' ? 1 : 0)
    assert.match(appFiles.get('/persist/nuke_list.txt'), /com.kept \/system\/app\/Kept\/Kept.apk Kept app/)
    assert.match(appFiles.get('/persist/nuke_list.txt'), /com.other \/system\/app\/Other\/Other.apk Other app/)
    assert.ok(paths.whiteouts.includes('/system/etc/kept.xml'))
    assert.ok(paths.pendingChanges.some(item => item.path === '/system/etc/old.xml' && !item.hiding))
    if (failure === 'none') {
      assert.deepEqual(apps.pendingApps.map(app => app.packageName), ['com.other'])
      assert.deepEqual(paths.pendingChanges, [{path: '/system/etc/old.xml', hiding: false}])
    } else if (failure === 'rollback') {
      assert.equal(messages.at(-1)[0], 'review.undo_partial')
    } else {
      assert.equal(appFiles.get('/persist/nuke_list.txt'), original)
      assert.deepEqual(apps.pendingApps.map(app => app.packageName).sort(), ['com.other', 'com.pending', 'com.restore'])
      assert.equal(messages.at(-1)[0], failure === 'snapshot' ? 'global.read_error' : 'global.write_error')
    }
  })
}

test('undo keeps the mutation lock until both refreshes finish after a read failure', async () => {
  const lock = load('src/lib/mutationLock.ts', {})
  let release
  let started
  let finished = false
  const refreshing = new Promise(resolve => { started = resolve })
  const delayedRefresh = new Promise(resolve => { release = resolve })
  const apps = {
    pendingApps: [{packageName: 'com.pending', nuked: false}],
    setNuke() {}, write: async () => true, refresh: async () => { throw new Error('read failed') },
  }
  const paths = {pendingChanges: [], refresh: () => { started(); return delayedRefresh }}
  const {cancelPendingChange} = load('src/lib/PendingChanges.ts', {
    './File': {File: {}}, '../constant': {PERSIST_DIR: '/persist'},
    './Whiteout': {whiteoutManager: paths},
    './refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: paths}}),
    './Cli': {Cli: {nuke: async () => true}}, './mutationLock': lock, i18next: {t: key => key},
  })
  const result = cancelPendingChange({kind: 'app', packageName: 'com.pending'}, apps, () => {}).then(value => { finished = true; return value })
  await refreshing
  await new Promise(setImmediate)
  assert.equal(lock.mutationBusy(), true)
  assert.equal(finished, false)
  release()
  assert.equal(await result, false)
  assert.equal(lock.mutationBusy(), false)
})

test('matching pending review opens without cancelling work and removes its listener on cleanup', () => {
  const listeners = new Map()
  const effects = []
  const cancelled = []
  const stateUpdates = []
  const jsx = (type, props) => ({type, props})
  const {default: PendingChanges} = load('src/components/PendingChanges.tsx', {
    react: {useState: initial => [initial, value => stateUpdates.push(value)], useEffect: effect => effects.push(effect), useSyncExternalStore: () => {}},
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/AppListContext': {useAppList: () => ({pendingApps: []})},
    '../hooks/useMutationBusy': {useMutationBusy: () => false},
    './dialog/ReviewDialog': {}, './dialog/AppInfoDialog': {}, './SelectAll': {}, '../lib/uad': {getUad: () => ({removal: 'recommended'})},
    '../lib/Whiteout': {whiteoutManager: {pendingChanges: []}},
    '../lib/File': {File: {exist: async () => false}}, '../constant': {PERSIST_DIR: '/persist'},
  }, {window: {addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name)}})
  PendingChanges({onReboot() {}, onCancel: change => cancelled.push(change)})
  const cleanup = effects.map(effect => effect())
  const selected = [{kind: 'app', packageName: 'com.pending'}]
  assert.equal(typeof listeners.get('san-review-pending'), 'function')
  listeners.get('san-review-pending')({detail: selected})
  assert.equal(stateUpdates.includes(selected), true)
  assert.equal(stateUpdates.at(-1), true)
  assert.deepEqual(cancelled, [])
  cleanup.forEach(dispose => dispose?.())
  assert.equal(listeners.size, 0)
})

test('pending review preserves successful undo, exposes failures and reviews a captured batch', async () => {
  const state = []
  let cursor = 0
  let success = true
  let rebootRequests = 0
  const batches = []
  const manager = {pendingApps: [{packageName: 'com.pending', appLabel: 'Pending', nuked: false}]}
  const paths = {pendingChanges: []}
  const jsx = (type, props) => ({type, props})
  const {default: PendingChanges} = load('src/components/PendingChanges.tsx', {
    react: {useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] }, useEffect() {}, useSyncExternalStore() {}},
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/AppListContext': {useAppList: () => manager}, '../hooks/useMutationBusy': {useMutationBusy: () => false},
    './dialog/ReviewDialog': {__esModule: true, default: 'ReviewDialog'}, './dialog/AppInfoDialog': {}, './SelectAll': {__esModule: true, default: 'SelectAll'}, '../lib/uad': {getUad: () => ({removal: 'recommended'})},
    '../lib/Whiteout': {whiteoutManager: paths}, '../lib/File': {}, '../constant': {},
  })
  const render = () => { cursor = 0; return PendingChanges({onReboot() { rebootRequests++ }, onCancel: async () => success, onCancelAll: async changes => {
    batches.push(changes)
    manager.pendingApps = manager.pendingApps.filter(app => !changes.some(change => change.kind === 'app' && change.packageName === app.packageName))
    paths.pendingChanges = paths.pendingChanges.filter(item => !changes.some(change => change.kind === 'path' && change.path === item.path))
    return true
  }}) }
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const review = tree => all(tree, 'ReviewDialog')[0]
  all(render(), 'md-text-button').find(node => node.props.children === 'nuke.reboot').props.onClick()
  assert.equal(rebootRequests, 1)
  assert.equal(review(render()).props.open, false)
  assert.deepEqual(batches, [])
  all(render(), 'md-text-button')[0].props.onClick()
  assert.equal(review(render()).props.open, true)
  const cancel = tree => all(review(tree), 'md-text-button').find(node => node.props['aria-label'])
  await cancel(render()).props.onClick()
  assert.equal(review(render()).props.open, true)
  success = false
  await cancel(render()).props.onClick()
  assert.equal(review(render()).props.open, false)
  all(render(), 'md-text-button')[0].props.onClick()
  manager.pendingApps.push({packageName: 'com.restore', appLabel: 'Restore', nuked: true})
  const select = tree => all(review(tree), 'md-text-button').find(node => node.props.children === 'review.select_undo')
  select(render()).props.onClick()
  assert.equal(batches.length, 0)
  assert.equal(review(render()).props.title, 'review.select_undo_title')
  assert.doesNotMatch(JSON.stringify(review(render()).props.children), /review.undo_selected_message/)
  assert.equal(review(render()).props.actions.props.children[1].props.disabled, true)
  assert.deepEqual(all(review(render()), 'h2').map(node => node.props.children), ['app_info.pending_restore', 'app_info.pending_removal'])
  review(render()).props.actions.props.children[0].props.onClick()
  assert.equal(review(render()).props.title, 'review.pending_title')
  assert.equal(batches.length, 0)
  select(render()).props.onClick()
  all(review(render()), 'SelectAll')[0].props.onChange()
  assert.equal(review(render()).props.actions.props.children[1].props.disabled, false)
  manager.pendingApps.push({packageName: 'com.later', appLabel: 'Later', nuked: false})
  await review(render()).props.actions.props.children[1].props.onClick()
  assert.deepEqual(batches, [[{kind: 'app', packageName: 'com.pending'}, {kind: 'app', packageName: 'com.restore'}]])
  assert.deepEqual(manager.pendingApps.map(app => app.packageName), ['com.later'])
  assert.equal(review(render()).props.open, true)
  manager.pendingApps.push({packageName: 'com.keep', appLabel: 'Keep', nuked: true})
  paths.pendingChanges.push({path: '/system/etc/selected.xml', hiding: true})
  select(render()).props.onClick()
  const selectLater = all(review(render()), 'md-checkbox').find(node => node.props['aria-label'] === 'review.cancel_remove: Later (com.later)')
  selectLater.props.onChange()
  all(review(render()), 'md-checkbox').find(node => node.props['aria-label'] === 'review.cancel_hide: /system/etc/selected.xml').props.onChange()
  assert.equal(all(review(render()), 'SelectAll')[0].props.indeterminate, true)
  await review(render()).props.actions.props.children[1].props.onClick()
  assert.deepEqual(batches[1], [{kind: 'app', packageName: 'com.later'}, {kind: 'path', path: '/system/etc/selected.xml'}])
  assert.deepEqual(manager.pendingApps.map(app => app.packageName), ['com.keep'])
  assert.deepEqual(paths.pendingChanges, [])
  manager.pendingApps = []
  const empty = review(render())
  assert.equal(empty.props.open, true)
  assert.match(JSON.stringify(empty.props.children), /review.pending_empty/)
  assert.equal(all(render(), 'span').find(node => node.props.role === 'status').props.children, 'review.pending_empty')
})

test('a filtered pending review limits batch undo to its matching apps and paths', async () => {
  const states = []
  const listeners = new Map()
  const effects = []
  const batches = []
  let cursor = 0
  const jsx = (type, props) => ({type, props})
  const {default: PendingChanges} = load('src/components/PendingChanges.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
      useEffect: effect => effects.push(effect), useSyncExternalStore() {},
    },
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/AppListContext': {useAppList: () => ({pendingApps: [
      {packageName: 'com.match', appLabel: 'Matching app', nuked: false},
      {packageName: 'com.other', appLabel: 'Unrelated app', nuked: true},
    ]})},
    '../hooks/useMutationBusy': {useMutationBusy: () => false},
    './dialog/ReviewDialog': {__esModule: true, default: 'ReviewDialog'}, './dialog/AppInfoDialog': {},
    './SelectAll': {__esModule: true, default: 'SelectAll'}, '../lib/uad': {getUad: () => ({removal: 'recommended'})},
    '../lib/Whiteout': {whiteoutManager: {pendingChanges: [{path: '/system/etc/match.xml', hiding: true}]}},
    '../lib/File': {File: {exist: async () => false}}, '../constant': {PERSIST_DIR: '/persist'},
  }, {window: {addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name)}})
  const render = () => { cursor = 0; return PendingChanges({onReboot() {}, onCancel: async () => true, onCancelAll: async changes => { batches.push(changes); return true }}) }
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const review = () => all(render(), 'ReviewDialog')[0]
  render()
  effects.forEach(effect => effect())
  listeners.get('san-review-pending')({detail: [{kind: 'app', packageName: 'com.match'}, {kind: 'path', path: '/system/etc/match.xml'}]})
  assert.equal(review().props.open, true)
  assert.match(JSON.stringify(review().props.children), /Matching app/)
  assert.doesNotMatch(JSON.stringify(review().props.children), /Unrelated app/)
  assert.deepEqual(batches, [])
  all(review(), 'md-text-button').find(node => node.props.children === 'review.select_undo').props.onClick()
  all(review(), 'SelectAll')[0].props.onChange()
  await review().props.actions.props.children[1].props.onClick()
  assert.deepEqual(batches, [[{kind: 'app', packageName: 'com.match'}, {kind: 'path', path: '/system/etc/match.xml'}]])
  assert.equal(review().props.open, false)
  review().props.onClose()
  all(render(), 'md-text-button')[0].props.onClick()
  assert.match(JSON.stringify(review().props.children), /Unrelated app/)
})

test('path checkboxes are always available and pending paths remain in the global review', () => {
  const states = []
  let cursor = 0
  let handle
  let rows
  let effects = []
  let selection
  let pendingRendered
  const batches = []
  const jsx = (type, props) => {
    if (type === 'PendingMatches') { pendingRendered = props.changes }
    return typeof type === 'function' ? type(props) : {type, props}
  }
  const {default: WhiteoutList} = load('src/components/WhiteoutList.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
      useImperativeHandle: (_ref, create) => { handle = create() }, forwardRef: render => render,
      useMemo: create => create(), useEffect: effect => { effects.push(effect) },
      useLayoutEffect: effect => { effects.push(effect) },
    },
    'react/jsx-runtime': {jsx, jsxs: jsx},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    './SegmentedList': {__esModule: true, default: props => { rows = props.items; return null }},
    './PendingMatches': {__esModule: true, default: 'PendingMatches'},
  }, {window: {dispatchEvent: event => batches.push(event.detail)}})
  const props = {
    whiteouts: ['/system/etc/kept.xml', '/system/etc/second.xml', '/system/etc/new.xml'], searchQuery: '', emptyMessage: '',
    pendingChanges: [{path: '/system/etc/new.xml', hiding: true}, {path: '/system/etc/old.xml', hiding: false}],
    onSelectionChange: (...args) => { selection = args },
  }
  const render = () => { cursor = 0; effects = []; WhiteoutList(props, {}); effects.forEach(effect => effect()) }
  render()
  assert.deepEqual(rows.map(row => row.key), ['/system/etc/kept.xml', '/system/etc/second.xml'])
  assert.equal(rows[0].trailingContent.props.children.type, 'md-checkbox')
  handle.selectAll()
  render()
  const selected = ['/system/etc/kept.xml', '/system/etc/second.xml']
  assert.deepEqual(handle.getSelectedWhiteouts(), selected)
  props.searchQuery = 'second'
  render()
  assert.deepEqual(selection, [selected, 1, 1])
  handle.deselectAllVisible()
  render()
  assert.deepEqual(handle.getSelectedWhiteouts(), ['/system/etc/kept.xml'])
  handle.selectAll()
  render()
  props.whiteouts = ['/system/etc/second.xml', '/system/etc/new.xml']
  render()
  render()
  assert.deepEqual(handle.getSelectedWhiteouts(), ['/system/etc/second.xml'])
  handle.clearSelection()
  render()
  assert.deepEqual(selection, [[], 0, 1])
  props.searchQuery = '/SYSTEM/ETC/NEW'
  render()
  assert.deepEqual(pendingRendered, [{kind: 'path', path: '/system/etc/new.xml'}])
  handle.selectAll()
  render()
  assert.deepEqual(handle.getSelectedWhiteouts(), [])
})

test('removal options preserve modes, optional descriptions and typed saves', () => {
  const {configItem} = load('src/data/config.ts', {})
  const saved = []
  const jsx = (type, props) => ({type, props})
  const {default: Config} = load('src/components/Config.tsx', {
    'react/jsx-runtime': {jsx, jsxs: jsx},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    './SegmentedList': {__esModule: true, default: 'SegmentedList'},
  })
  const tree = Config({items: [...configItem, {key: 'toggle', value: false, options: [false, true]}], onSave: (...args) => saved.push(args)})
  const select = tree.props.items.find(item => item.key === 'nuke_mode').content
  assert.deepEqual(select.props.children.map(option => option.props.value), ['whiteout_only', 'whiteout_uninstall', 'uninstall_only'])
  for (const option of select.props.children) {
    assert.equal(option.props.children.find(child => child?.props.slot === 'supporting-text')?.props.children, option.props.value === 'whiteout_uninstall' ? undefined : `config.nuke_mode_${option.props.value}_desc`)
    select.props.onChange({target: {value: option.props.value}})
  }
  assert.deepEqual(saved, [['nuke_mode', 'whiteout_only'], ['nuke_mode', 'whiteout_uninstall'], ['nuke_mode', 'uninstall_only']])
  select.props.onChange({target: {value: 'invalid'}})
  assert.equal(saved.length, 3)
  const toggle = tree.props.items.find(item => item.key === 'toggle').content
  toggle.props.onChange({target: {value: 'true'}})
  toggle.props.onChange({target: {value: 'false'}})
  assert.deepEqual(saved.slice(3), [['toggle', true], ['toggle', false]])
})

test('installer capture keeps the real shell exit status and marks only reboot-requiring success', async t => {
  const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'san-ux-log-'))
  t.after(() => fs.rmSync(persist, {recursive: true, force: true}))
  const appliedPath = path.join(persist, 'config.sh.applied')
  let lastApplied = 'nuke_mode=whiteout_uninstall\nmounting_mode=2\nmagic_mount=true\ncurrent_manager=KSU'
  fs.writeFileSync(appliedPath, lastApplied)
  for (const [output, exitCode, reboot, mode] of [
    ['installer failed', 1, false, 0],
    ['Uninstall only mode detected', 0, true, 1],
    ['Uninstall only mode detected', 0, false, 1],
    ['Nuking complete', 0, true, 2],
  ]) {
    fs.rmSync(path.join(persist, 'reboot_required'), {force: true})
    const config = `nuke_mode=${output.includes('Uninstall only mode') ? 'uninstall_only' : 'whiteout_uninstall'}\nmounting_mode=${mode}\nmagic_mount=true\ncurrent_manager=KSU`
    fs.writeFileSync(path.join(persist, 'config.sh'), config)
    const { Cli } = load('src/lib/Cli.ts', {
      'kernelsu-alt': {exec: async command => {
        const result = spawnSync('/bin/sh', ['-c', `busybox() { echo '${output}'; echo 'installer diagnostics' >&2; return ${exitCode}; }\n${command}`], {encoding: 'utf8'})
        return {errno: result.status, stdout: result.stdout, stderr: result.stderr}
      }},
      './File': {File: {}}, './shell': load('src/lib/shell.ts', {}),
      i18next: {t: key => key}, '../constant': {MOD_DIR: '/module', PERSIST_DIR: persist},
    })
    const messages = []
    assert.equal(await Cli.nuke((...args) => messages.push(args)), exitCode === 0)
    const log = fs.readFileSync(path.join(persist, 'last-operation.log'), 'utf8')
    assert.match(log, new RegExp(output))
    assert.match(log, /installer diagnostics/)
    assert.equal(fs.existsSync(path.join(persist, 'reboot_required')), reboot)
    if (exitCode === 0) assert.equal(messages.at(-1)[0], reboot ? 'nuke.success' : 'nuke.success_no_reboot')
    if (exitCode === 0) lastApplied = config
    assert.equal(fs.readFileSync(appliedPath, 'utf8'), lastApplied)
    assert.equal(fs.readdirSync(persist).some(name => name.startsWith('config.sh.applied.new.')), false)
  }
})

function reviewFixture({read = async () => {}, mode = 'whiteout_uninstall', operation = 'remove', pending = false, removal = () => 'unsafe'} = {}) {
  let accepted = false
  let cursor = 0
  let effectCursor = 0
  let pendingEffects = []
  const state = []
  const effects = []
  const {default: AppReviewDialog} = load('src/components/dialog/AppReviewDialog.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useEffect: (effect, deps) => {
        const i = effectCursor++
        const previous = effects[i]
        if (!previous || deps.some((value, index) => value !== previous.deps[index])) pendingEffects.push(() => {
          previous?.cleanup?.()
          effects[i] = {deps, cleanup: effect()}
        })
      },
    },
    'react/jsx-runtime': {jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props})},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    '../../lib/uad': {getUad: pkg => ({removal: removal(pkg)})},
    './ReviewDialog': {default: 'review-dialog'},
    './AppInfoDialog': {default: 'app-info-dialog'},
    '../../lib/Config': {__esModule: true, default: class {
      config = [{key: 'nuke_mode', value: mode}]
      read = read
    }},
  })
  const props = {open: true, apps: [{packageName: 'com.android.settings', appLabel: 'Settings', pending}], operation, onClose: () => {}, onConfirm: () => { accepted = true }}
  const render = () => {
    cursor = 0; effectCursor = 0; pendingEffects = []
    const tree = AppReviewDialog(props)
    pendingEffects.forEach(effect => effect())
    return tree
  }
  return {render, props, get accepted() { return accepted }, settle: async () => { await new Promise(resolve => setTimeout(resolve, 0)); return render() }}
}

for (const [mode, summary] of [
  ['whiteout_only', 'review.mode_whiteout_summary'],
  ['whiteout_uninstall', 'review.mode_hide_summary'],
  ['uninstall_only', 'review.mode_uninstall_summary'],
]) {
  test(`removal review explains ${mode} before confirmation`, async () => {
    const ui = reviewFixture({mode, removal: () => 'recommended'})
    assert.equal(ui.render().props.actions.props.children[1].props.disabled, true)
    const review = await ui.settle()
    assert.equal(review.props.children[0].props.children, summary)
    assert.equal(review.props.actions.props.children[1].props.disabled, false)
  })
}

test('removal review blocks an unknown mode', async () => {
  const ui = reviewFixture({mode: 'invalid', removal: () => 'recommended'})
  ui.render()
  const review = await ui.settle()
  assert.equal(review.props.children[0].props.role, 'alert')
  assert.equal(review.props.actions.props.children[1].props.disabled, true)
})

test('risky app review requires acknowledgement before its confirm action is enabled', async () => {
  const ui = reviewFixture()
  ui.render()
  let review = await ui.settle()
  assert.equal(review.props.actions.props.children[1].props.disabled, true)
  assert.equal(ui.accepted, false)
  review.props.beforeActions.props.children[0].props.onChange()
  review = ui.render()
  assert.equal(review.props.actions.props.children[1].props.disabled, false)
  review.props.actions.props.children[1].props.onClick()
  assert.equal(ui.accepted, true)
})

test('app review keeps visible identity for ambiguous and unrated apps while compacting ordinary entries', () => {
  const levels = {safe: 'recommended', advanced: 'advanced', expert: 'expert', unsafe: 'unsafe', unknown: 'unknown', first: 'recommended', second: 'recommended', fallback: 'recommended'}
  const ui = reviewFixture({removal: pkg => levels[pkg]})
  ui.props.apps = Object.keys(levels).map(packageName => ({packageName, appLabel: packageName === 'first' ? 'Duplicate' : packageName === 'second' ? 'duplicate' : packageName === 'fallback' ? 'fallback' : `${packageName} app`, pending: false}))
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const text = node => typeof node === 'string' ? [node] : Array.isArray(node) ? node.flatMap(text) : node?.props ? text(node.props.children) : []
  const tree = ui.render()
  const visible = text(tree)
  for (const pkg of ['safe', 'advanced']) assert.equal(visible.includes(pkg), false)
  for (const pkg of ['expert', 'unsafe', 'unknown', 'first', 'second']) assert.equal(visible.includes(pkg), true)
  assert.equal(visible.filter(value => value === 'fallback').length, 1)
  all(tree, 'li')[0].props.children.props.children.find(child => child?.type === 'md-icon-button').props.onClick({preventDefault() {}, stopPropagation() {}})
  assert.equal(ui.render().props.children.at(-1).props.app.packageName, 'safe')
})

test('risk acknowledgement survives exclusions but resets for added apps and reopening', async () => {
  const ui = reviewFixture()
  ui.props.apps.push({packageName: 'com.other', appLabel: 'Other', pending: false})
  ui.props.selectedPackages = ['com.android.settings', 'com.other']
  ui.render()
  let review = await ui.settle()
  review.props.beforeActions.props.children[0].props.onChange()
  assert.equal(ui.render().props.actions.props.children[1].props.disabled, false)
  ui.props.selectedPackages = ['com.android.settings']
  ui.render()
  review = ui.render()
  assert.equal(review.props.actions.props.children[1].props.disabled, false)
  ui.props.selectedPackages = ['com.android.settings', 'com.other']
  assert.equal(ui.render().props.actions.props.children[1].props.disabled, true)
  ui.render().props.beforeActions.props.children[0].props.onChange()
  assert.equal(ui.render().props.actions.props.children[1].props.disabled, false)
  ui.props.open = false
  ui.render()
  ui.props.open = true
  assert.equal(ui.render().props.actions.props.children[1].props.disabled, true)
})

test('removal waits for known settings and can retry a failed mode read', async () => {
  let failed = true
  const ui = reviewFixture({read: async () => { if (failed) throw new Error('root unavailable') }})
  let review = ui.render()
  assert.equal(review.props.actions.props.children[1].props.disabled, true)
  review = await ui.settle()
  assert.equal(review.props.children[0].props.role, 'alert')
  review.props.beforeActions.props.children[0].props.onChange()
  review = ui.render()
  assert.equal(review.props.actions.props.children[1].props.disabled, true)
  failed = false
  review.props.children[0].props.children[1].props.onClick()
  ui.render()
  review = await ui.settle()
  assert.equal(review.props.actions.props.children[1].props.disabled, false)
})

test('restoring apps remains available when removal settings cannot be read', async () => {
  let reads = 0
  const ui = reviewFixture({operation: 'restore', read: async () => { reads++; throw new Error('root unavailable') }})
  ui.render()
  const review = await ui.settle()
  assert.equal(reads, 0)
  assert.equal(review.props.actions.props.children[1].props.disabled, false)
})

test('reviews name cancellation of a pending action and do not read an irrelevant removal method', async () => {
  for (const operation of ['remove', 'restore']) {
    let reads = 0
    const ui = reviewFixture({operation, pending: true, read: async () => { reads++ }})
    ui.render()
    const review = await ui.settle()
    const action = operation === 'remove' ? 'cancel_restore' : 'cancel_remove'
    assert.equal(review.props.title, `review.${action}_title`)
    assert.equal(review.props.actions.props.children[1].props.children, `review.${action}_confirm`)
    assert.equal(reads, 0)
  }
})

test('closing a picker waits for the complete history event before opening its review', async () => {
  const listeners = new Map()
  const order = []
  const fakeWindow = {
    addEventListener: (name, callback, options) => {
      const handlers = listeners.get(name) ?? []
      handlers.push({callback, once: options?.once})
      listeners.set(name, handlers)
    },
    removeEventListener: () => {},
    history: {pushState: () => {}, back: () => order.push('back requested')},
  }
  const {useHistory} = load('src/hooks/useHistory.ts', {
    react: {useRef: value => ({current: value}), useCallback: callback => callback, useEffect: effect => effect()},
  }, {window: fakeWindow})
  const history = useHistory()
  history.push('picker', () => {})
  history.consume('picker', () => order.push('review ready'))
  assert.deepEqual(order, ['back requested'])
  for (const handler of listeners.get('popstate')) handler.callback({state: {}})
  assert.deepEqual(order, ['back requested'])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(order, ['back requested', 'review ready'])
})

for (const page of ['Home', 'Restore']) {
  test(`${page} keeps pending actions in the global review instead of the new-action list`, async () => {
    const manager = await appsFixture()
    const states = []
    const effects = []
    let busy = false
    let stateCursor = 0
    let effectCursor = 0
    const jsx = (type, props) => ({type, props})
    const noop = () => {}
    let operation
    const cli = {}
    const imports = {
      react: {
        useState: initial => { const i = stateCursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
        useEffect: (effect, deps) => { const i = effectCursor++; const previous = effects[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) { previous?.cleanup?.(); effects[i] = {deps, cleanup: effect()} } },
        useCallback: fn => fn, useRef: () => ({current: null}),
      },
      'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
      'react-i18next': {useTranslation: () => ({t: key => key})},
      '../lib/AppListContext': {useAppList: () => manager},
      '../lib/uad': {removalCounts: apps => ({unknown: apps.length})},
      '../components/SnackBar': {default: 'SnackBar', useSnackBar: () => ({state: {}, show: noop, hide: noop})},
      '../lib/refreshLists': load('src/lib/refreshLists.ts', {'./Whiteout': {whiteoutManager: {refresh: async () => {}}}}), '../lib/Cli': {Cli: cli},
      '../lib/mutationLock': {runMutation: task => { operation = task(); return operation.then(() => true) }}, '../lib/iconCache': {saveIcons: noop},
      '../hooks/useMutationBusy': {useMutationBusy: () => busy},
      '../lib/Config': {__esModule: true, default: class {
        config = [{key: 'nuke_mode', value: 'whiteout_uninstall'}]
        async read() {}
      }},
    }
    for (const component of ['Header', 'SelectAll', 'SearchBar', 'AppList', 'Fab', 'LoadError', 'dialog/AppReviewDialog']) imports[`../components/${component}`] = {__esModule: true, default: component}
    const Component = load(`src/pages/${page}.tsx`, imports).default
    const render = () => { stateCursor = 0; effectCursor = 0; return Component() }
    if (page === 'Restore') {
      manager.setNuke('com.restore', true)
      await manager.write()
    }
    render()
    await new Promise(resolve => setTimeout(resolve, 0))
    const initial = render()
    const initialList = initial.props.children.find(child => child?.type === 'AppList')
    if (page === 'Home') assert.equal(initial.props.children.find(child => child?.type === 'Header').props.title, 'nav.home')
    const initialSearch = initial.props.children.find(child => child?.type === 'Header').props.bottomContent.props.children[0]
    assert.equal(initialSearch.props.filter.counts.unknown, initialList.props.apps.length)
    assert.equal(initialSearch.props.filter.pendingCounts.unknown, manager.pendingApps.length)
    assert.equal(initialList?.props.apps.some(app => app.pending) ?? false, false)
    const target = page === 'Home' ? 'com.installed' : 'com.restore'
    assert.equal(initialList.props.apps.some(app => app.packageName === target), true)
    initialList.props.onSelectionChange([target], 0, 1)
    const selectedTree = render()
    const bulk = selectedTree.props.children.find(child => child?.type === 'Header').props.action
    assert.equal(bulk.type, 'SelectAll')
    assert.equal(bulk.props.checked, true)
    const clear = selectedTree.props.children.find(child => child?.type === 'Fab').props.secondaryAction
    assert.ok(clear)
    let cleared = false
    selectedTree.props.children.find(child => child?.type === 'AppList').props.ref.current = {clearSelection: () => { cleared = true }}
    clear.props.onClick()
    assert.equal(cleared, true)
    busy = true
    if (page === 'Home') manager.setNuke(target, true)
    else manager.setRestore(target, true)
    await manager.write()
    render()
    await new Promise(resolve => setTimeout(resolve, 0))
    const inProgress = render().props.children.find(child => child?.type === 'AppList')
    assert.ok(inProgress)
    assert.equal(inProgress.props.apps.some(app => app.packageName === target), true)
    assert.equal(inProgress.props.disabled, true)
    busy = false
    render()
    await new Promise(resolve => setTimeout(resolve, 0))
    const tree = render()
    const list = tree.props.children.find(child => child?.type === 'AppList')
    assert.ok(list)
    list.props.onSelectionChange([], 0, 0)
    assert.equal(render().props.children.find(child => child?.type === 'Header').props.action, undefined)
    assert.equal(list?.props.apps.some(app => app.packageName === target) ?? false, false)
    assert.equal(manager.pendingApps.some(app => app.packageName === target), true)

    const selectionKey = page === 'Home' ? 'remove' : 'restore'
    const reset = async () => {
      if (page === 'Home') manager.setNuke(target, false)
      else manager.setRestore(target, false)
      await manager.write()
    }
    for (const success of [false, true]) {
      await reset()
      manager.setSelection(selectionKey, [target, 'com.unrelated'])
      render()
      await new Promise(resolve => setTimeout(resolve, 0))
      const review = render().props.children
      review.find(child => child?.type === 'AppList').props.ref.current = {getSelectedPackages: () => [target]}
      cli.nuke = async () => { if (!success) await reset(); return success }
      review.find(child => child?.type === 'dialog/AppReviewDialog').props.onConfirm()
      await operation
      assert.deepEqual(manager.getSelection(selectionKey), success ? ['com.unrelated'] : [target, 'com.unrelated'])
    }
  })
}

test('tab navigation restores the saved scroll after the destination finishes loading', () => {
  const refs = []
  const effects = []
  const observers = new Set()
  const frames = new Map()
  let nextFrame = 0
  let refCursor = 0
  let effectCursor = 0
  let pendingEffects = []
  const main = {
    position: 0, maximum: 1000, loading: false,
    get scrollTop() { return this.position },
    set scrollTop(value) { this.position = Math.min(value, this.maximum) },
    querySelector: () => main.loading ? {} : null,
  }
  const jsx = (type, props) => ({type, props})
  const {default: Layout} = load('src/components/Layout.tsx', {
    react: {
      useRef: initial => refs[refCursor++] ?? (refs[refCursor - 1] = {current: initial}),
      useLayoutEffect: (effect, deps) => {
        const index = effectCursor++
        const previous = effects[index]
        if (!previous || deps.some((value, i) => value !== previous.deps[i])) pendingEffects.push(() => {
          previous?.cleanup?.()
          effects[index] = {deps, cleanup: effect()}
        })
      },
    },
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    './BottomBar': {default: 'BottomBar'}, './PendingChanges': {default: 'PendingChanges'},
  }, {requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame }, cancelAnimationFrame: id => frames.delete(id), MutationObserver: class {
    constructor(callback) { this.callback = callback }
    observe() { observers.add(this) }
    disconnect() { observers.delete(this) }
  }})
  const render = activeTab => {
    refCursor = 0; effectCursor = 0; pendingEffects = []
    const tree = Layout({activeTab, onTabChange: () => {}, onReboot: () => {}, children: null})
    const element = tree.props.children[0].props.children.find(child => child?.type === 'main')
    element.props.ref.current = main
    pendingEffects.forEach(effect => effect())
    for (const [id, frame] of [...frames]) { frames.delete(id); frame() }
    return element.props
  }
  const settings = render('/settings')
  main.scrollTop = 565
  settings.onScroll?.({currentTarget: main})
  main.maximum = 0
  main.scrollTop = 0
  render('/')
  main.loading = true
  render('/settings')
  assert.equal(main.scrollTop, 0)
  main.maximum = 1000
  main.loading = false
  for (const observer of [...observers]) observer.callback()
  for (const frame of frames.values()) frame()
  assert.equal(main.scrollTop, 565)
})

for (const [name, file, props] of [
  ['app', 'src/components/AppList.tsx', {apps: [{packageName: 'com.selected', appLabel: 'Selected', nuked: false, pending: false}], searchQuery: '', selectedCategories: [], selectionKey: 'remove', emptyMessage: ''}],
  ['path', 'src/components/WhiteoutList.tsx', {whiteouts: ['/system/etc/selected.xml'], pendingChanges: [], initialSelection: ['/system/etc/selected.xml'], searchQuery: '', emptyMessage: ''}],
]) {
  test(`${name} selection reserves action space before scroll restoration`, () => {
    const layoutEffects = []
    const passiveEffects = []
    const jsx = (type, props) => ({type, props})
    const {default: List} = load(file, {
      react: {
        useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
        useCallback: fn => fn, useMemo: fn => fn(), useImperativeHandle() {}, forwardRef: fn => props => fn(props, null),
        useLayoutEffect: effect => layoutEffects.push(effect), useEffect: effect => passiveEffects.push(effect),
      },
      'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
      'react-i18next': {useTranslation: () => ({t: key => key})},
      '../lib/AppListContext': {useAppList: () => ({getSelection: () => ['com.selected'], setSelection() {}, pendingApps: []})},
      '../lib/uad': {getUad: () => ({removal: 'recommended', description: null}), removalLevels: [{id: 'recommended', color: 'green'}]},
      '../hooks/useIconObserver': {useIconObserver: () => ({current: null})},
      '../assets/android.svg?react': {}, './dialog/AppInfoDialog': {}, './SegmentedList': {}, './PendingMatches': {},
    })
    let maximum = 36
    List({...props, onSelectionChange: selected => { if (selected.length > 0) maximum = 92 }})
    layoutEffects.forEach(effect => effect())
    const restored = Math.min(92, maximum)
    passiveEffects.forEach(effect => effect())
    assert.equal(restored, 92)
  })
}

test('recovery excludes exact app and path choices while preserving saved lists and unrelated backups', async t => {
  const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'san-recovery-selection-'))
  t.after(() => fs.rmSync(persist, {recursive: true, force: true}))
  const files = {
    'nuke_list.txt': 'com.bad /system/app/Bad/Bad.apk Bad\ncom.bad.extra /system/app/Extra/Extra.apk Extra\ncom.good /system/app/Good/Good.apk Good',
    'raw_whiteouts.txt': '/system/etc/bad file.xml\n/system/etc/good.xml',
    'config.sh': 'mounting_mode=2',
  }
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(persist, `${name}.bak`), content)
    fs.writeFileSync(path.join(persist, name), 'current')
  }
  let failMove = true
  const {Cli} = load('src/lib/Cli.ts', {
    'kernelsu-alt': {exec: async command => {
      const result = spawnSync('/bin/sh', ['-c', `${failMove ? 'mv() { return 1; }\n' : ''}${command}`], {encoding: 'utf8'})
      return {errno: result.status, stdout: result.stdout, stderr: result.stderr}
    }},
    './File': {File: {}}, './shell': load('src/lib/shell.ts', {}),
    i18next: {t: key => key}, '../constant': {MOD_DIR: '/module', PERSIST_DIR: persist},
  })
  const excluded = {packages: ['com.bad'], paths: ['/system/etc/bad file.xml']}
  assert.equal(await Cli.restore(true, excluded), false)
  for (const name of Object.keys(files)) assert.equal(fs.readFileSync(path.join(persist, name), 'utf8'), 'current')
  failMove = false
  assert.equal(await Cli.restore(true, excluded), true)
  assert.equal(fs.readFileSync(path.join(persist, 'nuke_list.txt'), 'utf8'), files['nuke_list.txt'].split('\n').slice(1).join('\n') + '\n')
  assert.equal(fs.readFileSync(path.join(persist, 'raw_whiteouts.txt'), 'utf8'), '/system/etc/good.xml\n')
  assert.equal(fs.readFileSync(path.join(persist, 'config.sh'), 'utf8'), files['config.sh'])
  for (const [name, content] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(persist, `${name}.bak`), 'utf8'), content)
  assert.equal(fs.readdirSync(persist).some(name => name.includes('.restore.')), false)
})

test('recovery review resets acknowledgement after exclusions and submits only omitted identities', async () => {
  const state = []
  const effects = []
  let cursor = 0
  let effectCursor = 0
  let submitted
  const jsx = (type, props) => ({type, props})
  const dialog = {open: false, addEventListener() {}, removeEventListener() {}}
  const {default: BackupRestoreDialog} = load('src/components/dialog/BackupRestoreDialog.tsx', {
    react: {
      useRef: () => ({current: dialog}),
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useEffect: (effect, deps) => { const i = effectCursor++; if (!effects[i] || deps.some((value, index) => value !== effects[i][index])) { effects[i] = deps; effect() } },
    },
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-dom': {},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    '../../hooks/useDialogAnimation': {customizeDialogAnimation() {}},
    '../../hooks/useHistory': {useHistory: () => ({push() {}, consume() {}})},
    '../../lib/File': {File: {readIfExists: async file => file.endsWith('nuke_list.txt.bak') ? 'com.bad /system/app/Bad/Bad.apk Bad\ncom.good /system/app/Good/Good.apk Good' : '/system/etc/test.xml'}},
    '../../constant': {PERSIST_DIR: '/persist'}, '../../lib/nukeList': load('src/lib/nukeList.ts', {}),
    './AppInfoDialog': {__esModule: true, default: 'AppInfoDialog'}, '../../lib/uad': {getUad: () => ({removal: 'unsafe'})},
  }, {document: {getElementById: () => null}})
  const props = {open: true, onDismiss() {}, onDontRestore() {}, onRestore: value => { submitted = value }}
  const render = () => { cursor = 0; effectCursor = 0; return BackupRestoreDialog(props) }
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const confirm = tree => all(tree, 'md-outlined-button').find(button => button.props.children === 'backup.restore_selected')
  render()
  await new Promise(resolve => setTimeout(resolve, 0))
  let tree = render()
  assert.equal(confirm(tree).props.disabled, true)
  all(tree, 'md-text-button').find(button => button.props['aria-label'] === 'app_info.open').props.onClick()
  tree = render()
  assert.deepEqual(all(tree, 'AppInfoDialog')[0].props.app, {packageName: 'com.bad', appLabel: 'Bad'})
  all(tree, 'md-checkbox')[0].props.onChange()
  tree = render()
  assert.equal(confirm(tree).props.disabled, false)
  all(tree, 'md-checkbox')[1].props.onChange()
  tree = render()
  assert.equal(confirm(tree).props.disabled, true)
  all(tree, 'md-checkbox')[0].props.onChange()
  tree = render()
  confirm(tree).props.onClick()
  assert.deepEqual(submitted, {packages: ['com.bad'], paths: []})
  all(tree, 'md-checkbox')[2].props.onChange()
  tree = render()
  all(tree, 'md-checkbox')[3].props.onChange()
  tree = render()
  all(tree, 'md-checkbox')[0].props.onChange()
  tree = render()
  assert.equal(confirm(tree).props.disabled, true)
})

test('segmented lists expose list items while preserving button and hidden-row behavior', () => {
  const jsx = (type, props) => ({type, props})
  const {default: SegmentedList} = load('src/components/SegmentedList.tsx', {'react/jsx-runtime': {jsx, jsxs: jsx}})
  const tree = SegmentedList({items: [{key: 'hidden', hidden: true, content: 'Hidden'}, {key: 'button', content: 'Action', onClick() {}}, {key: 'select', noRipple: true, labelFor: 'app-checkbox', content: 'Selectable'}]})
  assert.equal(tree.type, 'ul')
  const rows = tree.props.children
  assert.equal(rows[0].type, 'li')
  assert.equal(rows[0].props.hidden, true)
  assert.equal(rows[1].props.children.type, 'button')
  assert.equal(rows[1].props.children.props.type, 'button')
  assert.equal(rows[2].props.children.type, 'label')
  assert.equal(rows[2].props.children.props.htmlFor, 'app-checkbox')
})

test('filter counts follow case-insensitive app-name and package searches', () => {
  const {removalCounts} = load('src/lib/uad.ts', {
    'kernelsu-alt': {}, '../constant': {PERSIST_DIR: '/persist'}, './File': {File: {}}, './shell': {},
  })
  const apps = [{packageName: 'com.music.player', appLabel: 'Spotify'}, {packageName: 'com.android.settings', appLabel: 'Settings'}]
  assert.deepEqual(removalCounts(apps, 'SPOT'), {unknown: 1})
  assert.deepEqual(removalCounts(apps, 'ANDROID'), {unknown: 1})
  assert.deepEqual(removalCounts(apps, 'missing'), {})
  assert.deepEqual(removalCounts(apps, ''), {unknown: 2})
})

test('native filter-menu closure updates expanded state and consumes its history entry', () => {
  const events = new Map()
  const menu = {addEventListener: (name, callback) => events.set(name, callback), removeEventListener() {}}
  let open = false
  let refCursor = 0
  let consumed = 0
  const jsx = (type, props) => ({type, props})
  const {default: SearchBar} = load('src/components/SearchBar.tsx', {
    react: {
      useState: () => [open, next => { open = next }], useCallback: callback => callback,
      useRef: () => ({current: refCursor++ === 0 ? null : menu}), useEffect: effect => effect(),
    },
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/uad': {removalLevels: []}, '../hooks/useHistory': {useHistory: () => ({push() {}, consume: () => { consumed++ }})},
  })
  const props = {value: '', onChange() {}, filter: {selected: [], onToggle() {}, counts: {}}}
  const render = () => { refCursor = 0; return SearchBar(props) }
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const button = tree => all(tree, 'md-icon-button').find(item => item.props.id === 'removal-filter-anchor')
  let tree = render()
  assert.equal(button(tree).props['aria-expanded'], 'false')
  button(tree).props.onClick()
  tree = render()
  assert.equal(button(tree).props['aria-expanded'], 'true')
  assert.equal(typeof events.get('closed'), 'function')
  events.get('closed')()
  tree = render()
  assert.equal(button(tree).props['aria-expanded'], 'false')
  assert.equal(consumed, 1)
})

test('the operation log can retry a failed read without closing the dialog', async () => {
  const state = []
  const effects = []
  let cursor = 0
  let effectCursor = 0
  let attempts = 0
  const t = key => key
  const jsx = (type, props) => ({type, props})
  const {default: OperationLogDialog} = load('src/components/dialog/OperationLogDialog.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useEffect: (effect, deps) => { const i = effectCursor++; if (!effects[i] || deps.some((value, index) => value !== effects[i][index])) { effects[i] = deps; effect() } },
    },
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t})},
    '../../lib/Cli': {Cli: {readOperationLog: async () => { if (++attempts === 1) throw new Error('host unavailable'); return 'installer output' }}},
    '../../lib/File': {File: {}}, './ReviewDialog': {default: 'review'},
  })
  const render = () => { cursor = 0; effectCursor = 0; return OperationLogDialog({open: true, onClose() {}}) }
  render()
  await new Promise(resolve => setTimeout(resolve, 0))
  let tree = render()
  const retry = tree.props.children.find(child => child?.type === 'md-text-button' && child.props.children === 'global.retry')
  assert.equal(tree.props.children.some(child => child?.props?.children === 'diagnostics.message'), false)
  assert.ok(retry)
  retry.props.onClick()
  render()
  await new Promise(resolve => setTimeout(resolve, 0))
  tree = render()
  assert.equal(attempts, 2)
  assert.equal(tree.props.children.find(child => child?.type === 'pre').props.children, 'installer output')
  assert.equal(tree.props.children.some(child => child?.props?.children === 'diagnostics.message'), true)
})

test('an empty restore list links queued restores to the shared review and keeps search matching both directions', () => {
  const jsx = (type, props) => ({type, props})
  const manager = {getSelection: () => [], setSelection() {}, pendingApps: [
    {packageName: 'com.restore', appLabel: 'Pending restore', nuked: true},
    {packageName: 'com.remove', appLabel: 'Pending removal', nuked: false},
  ]}
  let dispatched
  const {default: PendingMatches} = load('src/components/PendingMatches.tsx', {
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
  }, {window: {dispatchEvent: event => { dispatched = event }}, CustomEvent: class {constructor(type, init) {this.type = type; this.detail = init.detail}}})
  const {default: AppList} = load('src/components/AppList.tsx', {
    react: {
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useCallback: fn => fn,
      useImperativeHandle() {}, forwardRef: fn => props => fn(props, null), useEffect() {}, useLayoutEffect() {},
    },
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/uad': {getUad: () => ({removal: 'recommended'}), removalLevels: []},
    '../hooks/useIconObserver': {useIconObserver: () => ({current: null})}, '../assets/android.svg?react': {},
    './dialog/AppInfoDialog': {}, './SegmentedList': {}, './PendingMatches': {__esModule: true, default: PendingMatches},
    '../lib/AppListContext': {useAppList: () => manager},
  })
  const props = {apps: [], searchQuery: '', selectedCategories: [], emptyMessage: 'Nothing removed', selectionKey: 'restore', onSelectionChange() {}}
  let tree = AppList(props)
  let link = tree.props.children.find(node => node?.type === PendingMatches)
  assert.ok(link, 'queued restores must be reachable from the empty restore list')
  assert.deepEqual(link.props.changes, [{kind: 'app', packageName: 'com.restore'}])
  const button = PendingMatches(link.props).props.children
  assert.equal(button.props.children[0], 'restore.pending')
  button.props.onClick()
  assert.equal(dispatched.type, 'san-review-pending')
  assert.deepEqual(dispatched.detail, [{kind: 'app', packageName: 'com.restore'}])
  tree = AppList({...props, searchQuery: 'Pending'})
  link = tree.props.children.find(node => node?.type === PendingMatches)
  assert.deepEqual(link.props.changes.map(change => change.packageName), ['com.restore', 'com.remove'])
})

test('path restore reviews can exclude and reinclude paths without changing the page selection before confirmation', async () => {
  const original = ['/system/etc/one.xml', '/system/etc/two.xml', '/system/etc/unrelated.xml']
  const files = new Map([['/persist/raw_whiteouts.txt', original.join('\n')], ['/persist/raw_whiteouts.txt.old', original.join('\n')]])
  const {Whiteout} = load('src/lib/Whiteout.ts', {
    './File': {File: {readIfExists: async file => files.get(file) ?? '', write: async (file, content) => files.set(file, content)}},
    '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
  })
  const paths = new Whiteout()
  await paths.waitForReady()
  paths.setView({selection: original.slice(0, 2)})
  let cursor = 0
  let refCursor = 0
  let effectCursor = 0
  let pendingEffects = []
  let applies = 0
  const state = []
  const refs = []
  const effects = []
  const jsx = (type, props) => ({type, props})
  const lock = load('src/lib/mutationLock.ts', {})
  const imports = {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => {state[i] = typeof next === 'function' ? next(state[i]) : next}] },
      useRef: initial => refs[refCursor++] ?? (refs[refCursor - 1] = {current: initial}),
      useEffect: (effect, deps) => { const i = effectCursor++; const previous = effects[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) pendingEffects.push(() => { previous?.cleanup?.(); effects[i] = {deps, cleanup: effect()} }) },
      useCallback: callback => callback, useSyncExternalStore: (_, getVersion) => getVersion(),
    },
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    'react-i18next': {useTranslation: () => ({t: (key, values) => values?.count === undefined ? key : `${key}:${values.count}`})},
    '../components/SnackBar': {default: 'SnackBar', useSnackBar: () => ({state: {}, show() {}, hide() {}})},
    '../lib/Whiteout': {whiteoutManager: paths}, '../lib/AppListContext': {useAppList: () => ({})},
    '../lib/Cli': {Cli: {nuke: async () => { applies++; return true }}},
    '../lib/refreshLists': {refreshLists: () => paths.refresh()}, '../lib/mutationLock': lock,
    '../hooks/useMutationBusy': {useMutationBusy: lock.mutationBusy},
    '../lib/FileSelector': {default: 'FileSelector'},
  }
  for (const name of ['Header', 'SelectAll', 'SearchBar', 'Fab', 'WhiteoutList', 'LoadError', 'dialog/ReviewDialog']) imports[`../components/${name}`] = {__esModule: true, default: name}
  const {default: WhiteoutPage} = load('src/pages/Whiteout.tsx', imports)
  const render = () => { cursor = 0; refCursor = 0; effectCursor = 0; pendingEffects = []; const tree = WhiteoutPage(); pendingEffects.forEach(effect => effect()); return tree }
  const all = (node, type) => Array.isArray(node) ? node.flatMap(child => all(child, type)) : node?.props ? [...(node.type === type ? [node] : []), ...all(node.props.children, type)] : []
  const settle = async () => { render(); await new Promise(resolve => setImmediate(resolve)); return render() }
  const review = () => all(render(), 'dialog/ReviewDialog').find(node => node.props.open)
  const confirm = () => all(review().props.actions, 'md-filled-button')[0]
  await settle()
  all(render(), 'WhiteoutList')[0].props.ref.current = {getSelectedWhiteouts: () => paths.getView().selection}
  all(render(), 'WhiteoutList')[0].props.onSelectionChange(original.slice(0, 2), 0, 3)
  all(render(), 'Fab')[0].props.onClick()
  assert.equal(all(review(), 'md-checkbox').length, 2)
  all(review(), 'md-checkbox')[0].props.onChange()
  assert.equal(review().props.title, 'whiteout.delete_title:1')
  assert.equal(confirm().props.children, 'whiteout.restore_confirm:1')
  assert.deepEqual(paths.getView().selection, original.slice(0, 2))
  review().props.onClose()
  assert.equal(applies, 0)
  assert.equal(files.get('/persist/raw_whiteouts.txt'), original.join('\n'))
  all(render(), 'Fab')[0].props.onClick()
  assert.equal(all(review(), 'md-checkbox').every(node => node.props.checked), true)
  all(review(), 'md-checkbox')[0].props.onChange()
  all(review(), 'md-checkbox')[1].props.onChange()
  assert.equal(review().props.title, 'whiteout.none_selected')
  assert.equal(confirm().props.disabled, true)
  await confirm().props.onClick()
  assert.equal(applies, 0)
  all(review(), 'md-checkbox')[1].props.onChange()
  await confirm().props.onClick()
  assert.equal(applies, 1)
  assert.equal(files.get('/persist/raw_whiteouts.txt'), '/system/etc/one.xml\n/system/etc/unrelated.xml')
  assert.deepEqual(paths.getView().selection, ['/system/etc/one.xml'])
})

test('description links show short destinations while preserving full urls and punctuation', () => {
  const opened = []
  const longUrl = 'https://example.org/' + 'long'.repeat(40)
  const description = 'Store (https://play.google.com/store/apps/details?id=com.example&hl=en). See https://en.wikipedia.org/wiki/Example_(topic). More ' + longUrl + '. Broken https://%.' + ' Longer app description.'.repeat(30)
  let stateIndex = 0
  const jsx = (type, props) => ({type, props})
  const {default: AppInfoDialog} = load('src/components/dialog/AppInfoDialog.tsx', {
    react: {useId: () => 'details-select', useRef: () => ({current: null}), useEffect: () => {}, useState: initial => [stateIndex++ === 0 ? {packageName: 'com.example', appLabel: 'Example', nuked: false, pending: true, uid: 10001} : initial, () => {}]},
    'react/jsx-runtime': {jsx, jsxs: jsx}, 'react-dom': {createPortal: node => node},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    '../../hooks/useDialogAnimation': {}, '../../hooks/useHistory': {useHistory: () => ({})},
    '../../assets/android.svg?react': {}, 'kernelsu-alt': {},
    '../../lib/uad': {getUad: () => ({removal: 'recommended', description}), UAD_REPO: 'https://example.org'},
    '../../lib/iconCache': {}, '../../lib/Cli': {Cli: {openLink: url => opened.push(url)}},
  }, {document: {getElementById: () => null}})
  const tree = AppInfoDialog({app: null, onClose: () => {}})
  const links = []
  let descriptionDetails
  let technicalDetails
  let identityHeading
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node?.props) return
    if (node.type === 'a') links.push(node.props)
    if (node.type === 'h2') identityHeading = node.props.children
    if (node.type === 'details' && node.props.children[0]?.props.children === 'app_info.full_description') descriptionDetails = node.props
    if (node.type === 'details' && node.props.children[0]?.props.children === 'app_info.technical') technicalDetails = node.props
    walk(node.props.children)
  }
  walk(tree)
  assert.equal(tree.props.children.some(child => child?.props?.slot === 'headline'), false)
  assert.equal(tree.props['aria-label'], 'Example (com.example)')
  assert.equal(identityHeading, 'Example')
  assert.ok(technicalDetails)
  assert.notEqual(technicalDetails.open, true)
  assert.doesNotMatch(JSON.stringify(technicalDetails.children), /app_info.status/)
  assert.match(JSON.stringify(technicalDetails.children), /app_info.uid/)
  assert.ok(descriptionDetails)
  assert.notEqual(descriptionDetails.open, true)
  const content = tree.props.children.find(child => child?.props?.slot === 'content')
  assert.match(JSON.stringify(content.props.children[1].props.children.filter(child => child?.type !== 'details')), /Store/)
  assert.deepEqual(links.map(link => link.children), ['play.google.com', 'en.wikipedia.org', 'example.org'])
  assert.deepEqual(links.map(link => link.href), ['https://play.google.com/store/apps/details?id=com.example&hl=en', 'https://en.wikipedia.org/wiki/Example_(topic)', longUrl])
  links.forEach(link => link.onClick({preventDefault() {}, stopPropagation() {}}))
  assert.deepEqual(opened, links.map(link => link.href))
  assert.deepEqual(links.map(link => link.title), opened)
})
