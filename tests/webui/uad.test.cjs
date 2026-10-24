const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

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
