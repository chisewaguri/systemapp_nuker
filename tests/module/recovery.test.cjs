const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

for (const bootBaseline of [null, '', 'com.old /system/app/Old/Old.apk Old']) {
test(`a bootloop rolls back then wipes on another loop, with ${bootBaseline === null ? 'legacy' : bootBaseline ? 'distinct' : 'empty'} baseline`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-loop-test-')).replace(/\\/g, '/')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const persist = `${dir}/data/adb/system_app_nuker`
  const mod = `${dir}/data/adb/modules/system_app_nuker`
  for (const d of [`${dir}/bin`, persist, `${mod}/system/app/Old`, `${mod}/system/app/New`, `${mod}/system/product/overlay`]) fs.mkdirSync(d, { recursive: true })
  fs.copyFileSync(path.join(root, '../module/post-fs-data.sh'), `${mod}/post-fs-data.sh`)
  fs.writeFileSync(`${mod}/module.prop`, 'description=x\n')
  fs.writeFileSync(`${persist}/nuke_list.txt.old`, 'com.old /system/app/Old/Old.apk Old\n')
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.old /system/app/Old/Old.apk Old\ncom.new /system/app/New/New.apk New\ncom.ov /product/overlay/Ov.apk Ov\n')
  if (bootBaseline !== null) {
    fs.writeFileSync(`${persist}/nuke_list.txt.boot`, bootBaseline)
    fs.writeFileSync(`${persist}/raw_whiteouts.txt.boot`, '')
    fs.copyFileSync(`${persist}/nuke_list.txt`, `${persist}/nuke_list.txt.old`)
  }
  fs.writeFileSync(`${persist}/raw_whiteouts.txt`, '/system/media/bootanim.zip\n')
  // char devices cant be made here, so find reports marked files as whiteouts
  for (const w of ['system/app/Old/Old.apk.w', 'system/app/New/New.apk.w', 'system/product/overlay/Ov.apk.w']) fs.writeFileSync(`${mod}/${w}`, '')
  fs.writeFileSync(`${dir}/bin/find`, '#!/bin/sh\n/usr/bin/find "$1" -name "*.w" | sed "s/\\.w$//; s|/[^/]*\\.apk$||; s|/Ov$|/Ov.apk|"\n')
  fs.writeFileSync(`${dir}/bin/rm`, `#!/bin/sh\nfor a; do case "$a" in -*) ;; *) /usr/bin/rm -rf "$a" "$a".w "$a"/*.apk.w ;; esac; done\n`)
  for (const name of ['stop', 'reboot']) fs.writeFileSync(`${dir}/bin/${name}`, `#!/bin/sh\necho ${name} >> "${dir}/calls"\n`)
  for (const name of ['find', 'rm', 'stop', 'reboot']) fs.chmodSync(`${dir}/bin/${name}`, 0o755)
  const bin = process.platform === 'win32' ? `$(cygpath -u '${dir}/bin')` : `${dir}/bin`
  const boot = () => {
    const result = spawnSync(shell, ['-c', `PATH="${bin}:$PATH" SAN_TEST_ROOT="${dir}" sh "${mod}/post-fs-data.sh"`], { encoding: 'utf8' })
    if (result.error) throw result.error
    return result
  }

  fs.writeFileSync(`${persist}/count.sh`, 'BOOTCOUNT=1\n')
  boot()
  assert.equal(fs.existsSync(`${mod}/system/app/Old/Old.apk.w`), bootBaseline !== '', 'only last good whiteouts kept')
  assert.ok(!fs.existsSync(`${mod}/system/app/New/New.apk.w`), 'new app whiteout dropped')
  assert.ok(!fs.existsSync(`${mod}/system/product/overlay/Ov.apk.w`), 'new overlay whiteout dropped')
  assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), bootBaseline ?? 'com.old /system/app/Old/Old.apk Old\n')
  assert.ok(fs.readFileSync(`${persist}/nuke_list.txt.bak`, 'utf8').includes('com.new'))
  assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt`, 'utf8'), '')
  assert.equal(fs.readFileSync(`${persist}/count.sh`, 'utf8').trim(), 'BOOTCOUNT=0')
  assert.ok(!fs.existsSync(`${mod}/disable`))

  fs.writeFileSync(`${persist}/count.sh`, 'BOOTCOUNT=1\n')
  boot()
  assert.ok(!fs.existsSync(`${mod}/system`), 'second loop wipes every whiteout')
  assert.ok(fs.existsSync(`${mod}/disable`))
  assert.equal(fs.readFileSync(`${persist}/count.sh`, 'utf8').trim(), 'BOOTCOUNT=-1')
  assert.equal(fs.readFileSync(`${dir}/calls`, 'utf8'), 'stop\nreboot\nstop\nreboot\n')
})
}

test('successful boot refreshes rollback snapshots without recording visible whiteout-only apps', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-service-')).replaceAll(String.fromCharCode(92), '/')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const persist = `${dir}/persist`
  const mod = `${dir}/module`
  for (const d of [persist, mod, `${dir}/bin`]) fs.mkdirSync(d)
  fs.writeFileSync(`${mod}/module.prop`, 'description=test')
  fs.writeFileSync(`${persist}/config.sh`, 'nuke_mode=whiteout_only')
  fs.writeFileSync(`${persist}/nuke_list.txt`, `com.hidden /system/app/Hidden/Hidden.apk Hidden
com.updated /system/app/Updated/Updated.apk Updated
com.pathless  Pathless
`)
  fs.writeFileSync(`${persist}/nuke_list.txt.old`, '')
  fs.writeFileSync(`${persist}/raw_whiteouts.txt`, '/system/media/test')
  fs.writeFileSync(`${dir}/bin/getprop`, `#!/bin/sh
echo 1`)
  fs.writeFileSync(`${dir}/bin/pm`, `#!/bin/sh
case "$1 $2" in
  "list packages") printf 'package:com.updated\npackage:com.pathless\n' ;;
  *) echo "$*" >> "${dir}/mutations" ;;
esac
`)
  for (const f of ['pm', 'getprop']) fs.chmodSync(`${dir}/bin/${f}`, 0o755)
  const source = fs.readFileSync(path.join(root, '../module/service.sh'), 'utf8')
    .replace('MODDIR="/data/adb/modules/system_app_nuker"', `MODDIR="${mod}"`)
    .replace('PERSIST_DIR="/data/adb/system_app_nuker"', `PERSIST_DIR="${persist}"`)
    .replace('update_description' + String.fromCharCode(10), '')
  fs.writeFileSync(`${dir}/service.sh`, source)
  const bin = process.platform === 'win32' ? `$(cygpath -u '${dir}/bin')` : `${dir}/bin`
  const result = spawnSync(shell, ['-c', `PATH="${bin}:$PATH" sh "${dir}/service.sh"`], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(!fs.existsSync(`${dir}/mutations`))
  for (const suffix of ['old', 'boot', 'last']) {
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.${suffix}`, 'utf8'), `com.hidden /system/app/Hidden/Hidden.apk Hidden
`)
    assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt.${suffix}`, 'utf8'), '/system/media/test')
  }
})
