const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

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
