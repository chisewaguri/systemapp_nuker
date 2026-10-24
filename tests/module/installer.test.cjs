const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

test('installer migrates old modes and defaults late-load to whiteout only with a metamodule', () => {
  const source = fs.readFileSync(path.join(root, '../module/customize.sh'), 'utf8')
  const migration = source.slice(source.indexOf('if [ -z "$nuke_mode" ]'), source.indexOf('set_config nuke_mode'))
  for (const [env, expected] of [
    ['', 'whiteout_uninstall'],
    ['mounting_mode=2;', 'whiteout_uninstall'],
    ['uninstall_only_mode=true;', 'uninstall_only'],
    ['disable_only_mode=true;', 'uninstall_only'],
    ['KSU_LATE_LOAD=1; mounting_mode=2;', 'whiteout_only'],
    [`OLD_CONFIG='${root}/../module/config.sh'; KSU_LATE_LOAD=1; mounting_mode=2; uninstall_only_mode=true;`, 'uninstall_only'],
    [`OLD_CONFIG='${root}/../module/config.sh'; KSU_LATE_LOAD=1; mounting_mode=2; uninstall_only_mode=false;`, 'whiteout_uninstall'],
    [`OLD_CONFIG='${root}/../module/config.sh'; KSU_LATE_LOAD=1; mounting_mode=2; disable_only_mode=true;`, 'uninstall_only'],
    ['KSU_LATE_LOAD=1; mounting_mode=2; nuke_mode=uninstall_only;', 'uninstall_only'],
    ['KSU_LATE_LOAD=1; mounting_mode=1;', 'whiteout_uninstall'],
    ['KSU_LATE_LOAD=1; mounting_mode=0; uninstall_only_mode=true;', 'uninstall_only'],
    ...['whiteout_only', 'whiteout_uninstall', 'uninstall_only'].flatMap(mode =>
      [0, 1, 2].flatMap(mounting => [0, 1].map(late => [
        `nuke_mode=${mode}; mounting_mode=${mounting}; KSU_LATE_LOAD=${late};`, mode,
      ]))),
  ]) {
    const result = spawnSync(shell, ['-c', `${env} ${migration}
echo "$nuke_mode"`], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), expected)
  }
})

test('installer upgrades legacy configs and lists without losing saved state', async t => {
  const installer = fs.readFileSync(path.join(root, '../module/customize.sh'), 'utf8')
  const template = fs.readFileSync(path.join(root, '../module/config.sh'), 'utf8')
  for (const [oldConfig, late, metamodule, expected, fail] of [
    ['', false, false, 'whiteout_uninstall', false],
    ['uninstall_only_mode=false', false, false, 'whiteout_uninstall', false],
    ['uninstall_only_mode=true', false, false, 'uninstall_only', false],
    ['disable_only_mode=true', false, false, 'uninstall_only', false],
    [null, true, true, 'whiteout_only', false],
    ['', true, true, 'whiteout_uninstall', false],
    ['uninstall_only_mode=false', true, true, 'whiteout_uninstall', false],
    ['uninstall_only_mode=true', true, true, 'uninstall_only', false],
    ['disable_only_mode=true', true, true, 'uninstall_only', false],
    ['uninstall_only_mode=true', true, false, 'uninstall_only', false],
    ...['whiteout_only', 'whiteout_uninstall', 'uninstall_only'].map(mode =>
      [`nuke_mode=${mode}`, true, true, mode, false]),
    ['uninstall_only_mode=true', false, false, 'uninstall_only', true],
  ]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-upgrade-')).replaceAll(String.fromCharCode(92), '/')
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const persist = `${dir}/data/adb/system_app_nuker`
    const mod = `${dir}/module`
    for (const d of [persist, mod, `${dir}/bin`, `${dir}/mnt`, `${dir}/tmp`]) fs.mkdirSync(d, { recursive: true })
    if (metamodule) {
      fs.mkdirSync(`${dir}/data/adb/metamodule`)
      fs.writeFileSync(`${dir}/data/adb/metamodule/module.prop`, 'id=test')
    }
    const json = JSON.stringify([{ package_name: 'com.saved', app_path: '/system/app/Saved/Saved.apk', app_name: 'Saved app' }], null, 2)
    fs.writeFileSync(`${persist}/nuke_list.json`, json)
    if (oldConfig !== null) fs.writeFileSync(`${persist}/config.sh`, oldConfig)
    fs.writeFileSync(`${persist}/nuke_list.txt.boot`, 'known good')
    fs.writeFileSync(`${mod}/nuke.sh`, `#!/bin/sh
cat "$CONFIG_FILE" > "${dir}/seen-config"
cat "$REMOVE_LIST" > "${dir}/seen-list"
exit ${fail ? 1 : 0}
`)
    for (const command of ['busybox', 'sleep', 'clear']) {
      fs.writeFileSync(`${dir}/bin/${command}`, '#!/bin/sh\nexit 0\n')
      fs.chmodSync(`${dir}/bin/${command}`, 0o755)
    }
    fs.writeFileSync(`${dir}/installer.sh`, installer.replaceAll('/data/adb', `${dir}/data/adb`).replaceAll('/mnt', `${dir}/mnt`))
    const bin = process.platform === 'win32' ? `$(cygpath -u '${dir}/bin')` : `${dir}/bin`
    const run = () => {
      fs.writeFileSync(`${mod}/config.sh`, template)
      return spawnSync(shell, ['-c', `
PATH="${bin}:$PATH"
export PATH TMPDIR='${dir}/tmp' MODPATH='${mod}' KSU=true KSU_VER_CODE=30000 KSU_LATE_LOAD=${late ? 1 : 0} KSU_HAS_HOT_INSTALL=true
abort() { echo "$*" >&2; exit 1; }
set_perm() { return 0; }
. '${dir}/installer.sh'
`], { encoding: 'utf8' })
    }
    const result = run()
    assert.equal(result.status, fail ? 1 : 0, result.stderr)
    assert.match(fs.readFileSync(`${dir}/seen-config`, 'utf8'), new RegExp(`^nuke_mode=${expected}$`, 'm'))
    assert.equal(fs.readFileSync(`${dir}/seen-list`, 'utf8'), 'com.saved /system/app/Saved/Saved.apk Saved app\n')
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.boot`, 'utf8'), 'known good')
    if (fail) {
      assert.equal(fs.readFileSync(`${persist}/config.sh`, 'utf8'), oldConfig)
      assert.equal(fs.readFileSync(`${persist}/nuke_list.json`, 'utf8'), json)
      assert.ok(!fs.existsSync(`${persist}/nuke_list.txt`))
    } else {
      assert.ok(!fs.existsSync(`${persist}/nuke_list.json`))
      const saved = fs.readFileSync(`${persist}/config.sh`, 'utf8')
      const { default: Config } = load('src/lib/Config.ts', {
        '../constant': { PERSIST_DIR: persist },
        './File': { File: { read: async () => saved } },
        '../data/config': load('src/data/config.ts', {}),
        './utils': { isDev: () => false },
      })
      const config = new Config()
      await config.read()
      assert.equal(config.config.find(item => item.key === 'nuke_mode').value, expected)
      assert.equal(run().status, 0)
      assert.equal(fs.readFileSync(`${persist}/config.sh`, 'utf8'), saved)
      assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.saved /system/app/Saved/Saved.apk Saved app\n')
    }
  }
})
