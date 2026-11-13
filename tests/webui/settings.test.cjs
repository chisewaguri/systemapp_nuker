const {load} = require('../helpers/runtime.cjs')
const {test} = require('node:test')
const assert = require('node:assert/strict')

function nodes(value, type) {
  if (!value || typeof value !== 'object') return []
  return [...(value.type === type ? [value] : []), ...Object.values(value).flatMap(child => nodes(child, type))]
}

function settingsFixture({lateLoaded = false, failWrite = false, failScope = false, applySuccess = true} = {}) {
  const original = 'nuke_mode=whiteout_only\nmounting_mode=2\nmagic_mount=true\ncurrent_manager=KSU'
  let content = original
  let writes = 0
  let applies = 0
  let refreshes = 0
  let stateCursor = 0
  let effectCursor = 0
  let pendingEffects = []
  const states = []
  const effects = []
  const messages = []
  const lock = load('src/lib/mutationLock.ts', {})
  const {default: Config} = load('src/lib/Config.ts', {
    '../constant': {PERSIST_DIR: '/persist'}, './utils': {isDev: () => false},
    '../data/config': load('src/data/config.ts', {}),
    './File': {File: {
      read: async () => content, readIfExists: async () => original,
      write: async (_, value) => { if (failWrite) throw new Error('denied'); writes++; content = value },
    }},
  })
  const manager = {
    waitForReady: async () => { if (failScope) throw new Error('root unavailable') },
    nukingAppList: [{packageName: 'com.example.music', appLabel: 'Music'}],
  }
  const jsx = (type, props) => ({type, props})
  const imports = {
    react: {
      useState: initial => { const i = stateCursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] },
      useEffect: (effect, deps) => { const i = effectCursor++; const previous = effects[i]; if (!previous || deps.some((value, index) => value !== previous.deps[index])) pendingEffects.push(() => { previous?.cleanup?.(); effects[i] = {deps, cleanup: effect()} }) },
      useCallback: fn => fn,
    },
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    'react-i18next': {useTranslation: () => ({t: key => key})},
    '../lib/Config': {__esModule: true, default: Config}, '../lib/NukeConfig': {},
    '../lib/AppListContext': {useAppList: () => manager},
    '../components/SnackBar': {default: 'SnackBar', useSnackBar: () => ({state: {}, show: (...args) => messages.push(args), hide() {}})},
    '../lib/Cli': {Cli: {isLateLoaded: async () => { if (lateLoaded === null) throw new Error('unknown'); return lateLoaded }, nuke: async () => { applies++; return applySuccess }}},
    '../constant': {LOCAL_STORAGE_KEY: 'san-'},
    '../assets/telegram.svg?react': {}, '../assets/folder_off.svg?react': {},
    '../lib/mutationLock': lock, '../lib/utils': {isDev: () => false},
    '../lib/uad': {uadSource: {kind: 'none'}, uadReady: async () => ({kind: 'none'})},
    '../hooks/useMutationBusy': {useMutationBusy: lock.mutationBusy},
    '../lib/refreshLists': {refreshLists: async () => { refreshes++ }},
    '../lib/Whiteout': {whiteoutManager: {waitForReady: async () => {}, whiteouts: ['/system/etc/example.xml']}},
  }
  for (const name of ['Header', 'Config', 'SegmentedList', 'LoadError', 'dialog/CreditsDialog', 'dialog/AppReviewDialog', 'dialog/ReviewDialog']) imports[`../components/${name}`] = {__esModule: true, default: name}
  imports['../lib/FileSelector'] = {__esModule: true, default: 'FileSelector'}
  const {default: Settings} = load('src/pages/Settings.tsx', imports, {localStorage: {getItem: () => null}})
  const render = () => {
    stateCursor = 0
    effectCursor = 0
    pendingEffects = []
    const tree = Settings()
    pendingEffects.forEach(effect => effect())
    return tree
  }
  const settle = async () => { render(); await new Promise(resolve => setImmediate(resolve)); render(); await new Promise(resolve => setImmediate(resolve)); return render() }
  const field = key => nodes(render(), 'Config').find(node => node.props.items.some(item => item.key === key))
  const edit = (key, value) => field(key).props.onSave(key, value)
  const review = () => nodes(render(), 'dialog/ReviewDialog').find(node => node.props.title === 'settings.apply_title')
  const openReview = async () => {
    const button = nodes(render(), 'md-filled-button').find(node => node.props.children === 'settings.save_apply')
    assert.ok(button, 'one Save and apply entry point must be available')
    button.props.onClick()
    await settle()
    return review()
  }
  return {render, settle, field, edit, review, openReview, lock, messages, get content() {return content}, get writes() {return writes}, get applies() {return applies}, get refreshes() {return refreshes}}
}

test('settings edits stay unsaved through review cancellation, then save and apply together', async () => {
  const ui = settingsFixture()
  await ui.settle()
  ui.edit('nuke_mode', 'uninstall_only')
  ui.edit('mounting_mode', 1)
  await ui.settle()
  assert.equal(ui.writes, 0)
  assert.equal(ui.applies, 0)
  assert.equal(ui.field('nuke_mode').props.items.find(item => item.key === 'nuke_mode').value, 'uninstall_only')
  let review = await ui.openReview()
  assert.equal(review.props.open, true)
  const values = JSON.stringify(review.props.children)
  assert.match(values, /Music/)
  assert.match(values, /com.example.music/)
  assert.match(values, /\/system\/etc\/example.xml/)
  assert.match(values, /review.mode_uninstall_summary/)
  review.props.onClose()
  await ui.settle()
  assert.equal(ui.writes, 0)
  assert.equal(ui.applies, 0)
  review = await ui.openReview()
  await nodes(review.props.actions, 'md-filled-button')[0].props.onClick()
  await ui.settle()
  assert.equal(ui.writes, 1)
  assert.equal(ui.applies, 1)
  assert.equal(ui.refreshes, 1)
  assert.match(ui.content, /nuke_mode=uninstall_only\nmounting_mode=1/)
})

for (const failWrite of [true, false]) {
  test(`settings ${failWrite ? 'write' : 'apply'} failure leaves the form available for retry`, async () => {
    const ui = settingsFixture({failWrite, applySuccess: false})
    await ui.settle()
    ui.edit('nuke_mode', 'uninstall_only')
    const review = await ui.openReview()
    await nodes(review.props.actions, 'md-filled-button')[0].props.onClick()
    await ui.settle()
    assert.equal(ui.writes, failWrite ? 0 : 1)
    assert.equal(ui.applies, failWrite ? 0 : 1)
    if (failWrite) assert.equal(ui.messages.at(-1)[0], 'global.write_error')
    assert.equal(ui.lock.mutationBusy(), false)
    assert.equal(ui.field('nuke_mode').props.items.find(item => item.key === 'nuke_mode').value, 'uninstall_only')
    assert.equal(nodes((await ui.openReview()).props.actions, 'md-filled-button')[0].props.disabled, false)
  })
}

for (const lateLoaded of [true, null]) {
  test(`settings review warns before applying uninstalls with late-load state ${lateLoaded}`, async () => {
    const ui = settingsFixture({lateLoaded})
    await ui.settle()
    ui.edit('nuke_mode', 'whiteout_uninstall')
    await ui.settle()
    assert.equal(ui.writes, 0)
    const review = await ui.openReview()
    assert.match(JSON.stringify(review.props.children), new RegExp(lateLoaded ? 'config.late_load_warning' : 'config.late_load_unknown'))
    assert.equal(ui.applies, 0)
  })
}

test('settings review cannot apply when affected lists cannot be read', async () => {
  const ui = settingsFixture({failScope: true})
  await ui.settle()
  const review = await ui.openReview()
  assert.equal(nodes(review, 'LoadError')[0].props.message, 'settings.scope_error')
  assert.equal(nodes(review.props.actions, 'md-filled-button')[0].props.disabled, true)
  assert.equal(ui.writes, 0)
  assert.equal(ui.applies, 0)
})

test('settings apply respects another active mutation', async () => {
  const ui = settingsFixture()
  await ui.settle()
  const review = await ui.openReview()
  let release
  const active = ui.lock.runMutation(() => new Promise(resolve => {release = resolve}))
  assert.equal(nodes(ui.review().props.actions, 'md-filled-button')[0].props.disabled, true)
  await nodes(review.props.actions, 'md-filled-button')[0].props.onClick()
  assert.equal(ui.writes, 0)
  assert.equal(ui.applies, 0)
  release()
  await active
})
