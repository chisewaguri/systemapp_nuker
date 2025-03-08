SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

mkdir -p "$MODPATH/common"
mv "$MODPATH/bin/$(getprop ro.product.cpu.abi)/aapt" "$MODPATH/common/aapt"
set_perm $MODPATH/common/aapt 0 2000 0755
set_perm $MODPATH/nuke.sh 0 2000 0755
rm -rf "$MODPATH/bin"

# Migrate old config
if [ -d "$PERSIST_DIR" ]; then
    # Remove applist on installation
    # Add /my_bigball handling in the future(?)
    [ -f "$PERSIST_DIR/app_list.json" ] && rm -f "$PERSIST_DIR/app_list.json"
    # Make sure we don't overwrite previous setup
    [ -f "$PERSIST_DIR/nuke_list.json" ] && sh "$MODPATH/nuke.sh" skip_symlink &>/dev/null
fi

# EOF
