SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# check for mounting system
if [ -n "$MAGISK_VER_CODE" ] || [ -n "$KSU_MAGIC_MOUNT" ] || [ -n "$APATCH_BIND_MOUNT" ]; then
    echo "MAGIC_MOUNT=true" > $PERSIST_DIR/module_system.sh
else
    echo "MAGIC_MOUNT=false" > $PERSIST_DIR/module_system.sh
fi

set_perm "$PERSIST_DIR/module_system.sh" 0 2000 0755

mkdir -p "$MODPATH/common"
mv "$MODPATH/bin/$(getprop ro.product.cpu.abi)/aapt" "$MODPATH/common/aapt"
set_perm $MODPATH/common/aapt 0 2000 0755
set_perm $MODPATH/nuke.sh 0 2000 0755
rm -rf "$MODPATH/bin"

[ -z "$MAGISK_VER_CODE" ] && rm -rf $MODPATH/action.sh || set_perm $MODPATH/action.sh 0 2000 0755

# Migrate old config
[ -f "$PERSIST_DIR/nuke_list.json" ] && sh "$MODPATH/nuke.sh" skip_symlink &>/dev/null

# EOF
