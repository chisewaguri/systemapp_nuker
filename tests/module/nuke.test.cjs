const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { root, load, shell } = require('../helpers/runtime.cjs')

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
for (const mode of ['whiteout_only', 'whiteout_uninstall', 'uninstall_only']) {
test(`a webui nuke applies ${mode} without crossing mode boundaries`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-flow-test-')).replace(/\\/g, '/')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const persist = `${dir}/data/adb/system_app_nuker`
  fs.mkdirSync(`${dir}/bin`)
  fs.mkdirSync(persist, { recursive: true })
  fs.mkdirSync(`${dir}/data/adb/modules/system_app_nuker`, { recursive: true })
  fs.writeFileSync(`${dir}/data/adb/modules/system_app_nuker/nuke.sh`, '')
  fs.writeFileSync(`${persist}/config.sh`, `nuke_mode=${mode}\n`)
  fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.a  App A\ncom.ov  Overlay')
  fs.writeFileSync(`${dir}/bin/pm`, `#!/bin/sh
case "$1 $2" in
  "list packages") case "$*" in *factory-only*) ;; *-s*) printf 'package:com.a\\npackage:com.ov\\n' ;; *) if [ ! -f "${dir}/uninstalled" ] || ! grep -qx "$3" "${dir}/uninstalled"; then echo "package:$3"; fi ;; esac ;;
  "path com.a") echo package:/system/app/A/A.apk ;;
  "path com.ov") echo package:/product/overlay/Ov.apk ;;
  "uninstall -k") echo "$5" >> "${dir}/uninstalled" ;;
  "uninstall --user") echo "$4" >> "${dir}/uninstalled" ;;
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
  if (mode !== 'uninstall_only') {
    assert.ok(fs.statSync(`${update}/system/app/A`).isFile())
    assert.ok(fs.statSync(`${update}/system/product/overlay/Ov.apk`).isFile())
    assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), 'com.a /system/app/A/A.apk App A\ncom.ov /product/overlay/Ov.apk Overlay\n')
  } else {
    assert.ok(!fs.existsSync(`${update}/system/app/A`))
  }
  if (mode === 'whiteout_only') assert.ok(!fs.existsSync(`${dir}/uninstalled`))
  else assert.equal(fs.readFileSync(`${dir}/uninstalled`, 'utf8'), 'com.a\ncom.ov\n')
})
}

for (const baseline of ['', 'com.boot /system/app/Boot/Boot.apk Boot\n']) {
  test(`failed repeated webui nukes restore successful state with ${baseline ? 'populated' : 'empty'} boot baseline`, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-transaction-')).replace(/\\/g, '/')
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const source = fs.readFileSync(path.join(root, '../module/nuke.sh'), 'utf8')
    const replace = source.match(/replace_file\(\) \{[\s\S]*?\n\}/)[0]
    const transaction = source.split('# lets have customize.sh of dummy.zip call us.')[1].split('\nif [ "$update" = true ]; then')[0]
    const persist = `${dir}/persist`
    const staged = `${dir}/modules_update/module`
    fs.mkdirSync(persist)
    fs.writeFileSync(`${persist}/nuke_list.txt.old`, baseline)
    fs.writeFileSync(`${persist}/raw_whiteouts.txt.old`, '')
    const run = fail => {
      const result = spawnSync(shell, ['-c', `
PERSIST_DIR='${persist}'
REMOVE_LIST="$PERSIST_DIR/nuke_list.txt"
MODULE_UPDATE_DIR='${staged}'
update=false
${replace}
prepare_nuke_list() { return 0; }
reinstall_unlisted() { return 0; }
install_dummy() {
  [ "$(cat "$REMOVE_LIST.last")" = "$(cat "$REMOVE_LIST")" ] || exit 99
  rm -rf "$MODULE_UPDATE_DIR"
  ${fail ? 'return 1' : 'mkdir -p "$MODULE_UPDATE_DIR/system/app"; echo staged > "$MODULE_UPDATE_DIR/system/app/whiteout"'}
}
${transaction}`], { encoding: 'utf8' })
      if (result.error) throw result.error
      assert.equal(result.status, fail ? 1 : 0, result.stderr)
    }
    for (const selected of ['first', 'second']) {
      fs.writeFileSync(`${persist}/nuke_list.txt`, selected)
      fs.writeFileSync(`${persist}/raw_whiteouts.txt`, `/system/${selected}`)
      run(false)
      fs.writeFileSync(`${persist}/nuke_list.txt.old`, 'UI applied state')
      for (let attempt = 0; attempt < 2; attempt++) {
        fs.writeFileSync(`${persist}/nuke_list.txt`, 'pending user edits')
        fs.writeFileSync(`${persist}/raw_whiteouts.txt`, '/system/pending')
        run(true)
        assert.equal(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), selected)
        assert.equal(fs.readFileSync(`${persist}/raw_whiteouts.txt`, 'utf8'), `/system/${selected}`)
        assert.equal(fs.readFileSync(`${staged}/system/app/whiteout`, 'utf8'), 'staged\n')
        assert.equal(fs.readFileSync(`${persist}/nuke_list.txt.boot`, 'utf8'), baseline)
      }
    }
  })
}

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

for (const context of ['dummy', 'update']) {
  test(`whiteout only leaves updated and pathless apps untouched during ${context}`, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-mode-')).replace(/\\/g, '/')
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const persist = `${dir}/data/adb/system_app_nuker`
    const mod = `${dir}/data/adb/modules/system_app_nuker`
    for (const d of [`${dir}/bin`, persist, mod]) fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(`${mod}/nuke.sh`, '')
    fs.writeFileSync(`${persist}/config.sh`, 'nuke_mode=whiteout_only\n')
    fs.writeFileSync(`${persist}/nuke_list.txt`, 'com.updated  Updated\ncom.legacy  Legacy')
    fs.writeFileSync(`${dir}/bin/pm`, `#!/bin/sh
case "$1 $2" in
  "list packages") case "$*" in *factory-only*) echo 'package:/system/app/Updated/Updated.apk=com.updated' ;; *) echo package:com.updated ;; esac ;;
  "path com.updated") echo package:/data/app/updated/base.apk ;;
  uninstall*|enable*|install-existing*) echo "$*" >> "${dir}/mutations"; exit 1 ;;
esac
`)
    fs.writeFileSync(`${dir}/bin/busybox`, '#!/bin/sh\n[ "$1" = mknod ] && : > "$2"\nexit 0\n')
    for (const f of ['pm', 'busybox']) fs.chmodSync(`${dir}/bin/${f}`, 0o755)
    const bin = process.platform === 'win32' ? `$(cygpath -u '${dir}/bin')` : `${dir}/bin`
    const script = path.join(root, '../module/nuke.sh').replace(/\\/g, '/')
    const result = spawnSync(shell, ['-c', `PATH="${bin}:$PATH" SAN_TEST_ROOT="${dir}" ${context === 'dummy' ? 'DUMMYZIP=true' : ''} sh "${script}" ${context === 'update' ? 'update' : ''}`], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(!fs.existsSync(`${dir}/mutations`))
    assert.ok(fs.existsSync(`${dir}/data/adb/modules_update/system_app_nuker/system/app/Updated`))
    assert.match(fs.readFileSync(`${persist}/nuke_list.txt`, 'utf8'), /com.updated \/system\/app\/Updated\/Updated.apk Updated/)
  })
}
