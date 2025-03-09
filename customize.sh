#!/bin/sh
# customize.sh
# this is part of system app nuker

SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# remove applist if icons dir doesnt exit
[ ! -d "$PERSIST_DIR/icons" ] && [ -f "$PERSIST_DIR/app_list.json" ] && rm -rf "$PERSIST_DIR/app_list.json"

# some bullshit just to use clear
if [ "$MMRL" = "true" ] || { [ "$KSU" = "true" ] && [ "$KSU_VER_CODE" -ge 11998 ]; } ||
    { [ "$KSU_NEXT" = "true" ] && [ "$KSU_VER_CODE" -ge 12144 ]; } ||
    { [ "$APATCH" = "true" ] && [ "$APATCH_VER_CODE" -ge 11022 ]; }; then
        clear
        loops=20
        while [ $loops -gt 1 ]; do
            for i in '[-]' '[\]' '[|]' '[/]'; do
                echo "$i Checking mounting system..."
                sleep 0.1
                clear
                loops=$((loops - 1))
            done
        done
else
    # sleep a bit to make it look like something is happening!!
    sleep 2
fi
# check for mounting system
if { [ "$KSU" = true ] && [ ! "$KSU_MAGIC_MOUNT" = true ]; } || { [ "$APATCH" = true ] && [ ! "$APATCH_BIND_MOUNT" = true ]; }; then
    echo "MAGIC_MOUNT=false" > "$PERSIST_DIR/module_system.sh"
    echo "[+] No magic mount detected, using overlayfs configuration..."
    sleep 1
else
    echo "MAGIC_MOUNT=true" > "$PERSIST_DIR/module_system.sh"
    echo "[+] Magic mount detected, using magic mount configuration..."
    sleep 1
fi
echo ""

set_perm "$PERSIST_DIR/module_system.sh" 0 2000 0755

mkdir -p "$MODPATH/common"
mv "$MODPATH/bin/$(getprop ro.product.cpu.abi)/aapt" "$MODPATH/common/aapt"
set_perm $MODPATH/common/aapt 0 2000 0755
set_perm $MODPATH/nuke.sh 0 2000 0755
rm -rf "$MODPATH/bin"

# generate dummy.zip for triggering module update
zip -j "$MODPATH/dummy.zip" "$MODPATH/module.prop"

# Migrate old config
[ -f "$PERSIST_DIR/nuke_list.json" ] && sh "$MODPATH/nuke.sh" skip_symlink &>/dev/null

# removes action.sh on non-magisk env
if [ -n "$KSU" ] || [ -n "$APATCH" ]; then
    rm -rf $MODPATH/action.sh
fi

# EOF
