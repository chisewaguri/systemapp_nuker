#!/bin/sh
# customize.sh
# this is part of system app nuker

SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# exit when MODPATH is undefined
[ -z "$MODPATH" ] && { echo "ERROR: MODPATH is undefined"; exit 1; }

# create persistent directory if it doesn't exist
mkdir -p "$PERSIST_DIR"

# remove applist if icons directory doesn't exist
[ ! -d "$PERSIST_DIR/icons" ] && [ -f "$PERSIST_DIR/app_list.json" ] && rm -f "$PERSIST_DIR/app_list.json"

# display loading animation for compatible environments
if [ "$MMRL" = "true" ] || { [ "$KSU" = "true" ] && [ "$KSU_VER_CODE" -ge 11998 ]; } ||
    { [ "$KSU_NEXT" = "true" ] && [ "$KSU_VER_CODE" -ge 12144 ]; } ||
    { [ "$APATCH" = "true" ] && [ "$APATCH_VER_CODE" -ge 11022 ]; }; then
        clear
        echo "[*] Initializing System App Nuker..."
        
        for _ in $(seq 1 3); do
            for symbol in '-' '\' '|' '/'; do
                echo "[$symbol] Initializing System App Nuker..."
                sleep 0.1
                clear
            done
        done
else
    echo "[*] Initializing System App Nuker..."
    sleep 1 # sleep a bit to make it look like something is happening!!
fi

# set up aapt binary
mkdir -p "$MODPATH/common"
CPU_ABI=$(getprop ro.product.cpu.abi)
AAPT_PATH="$MODPATH/bin/$CPU_ABI/aapt"
mv "$AAPT_PATH" "$MODPATH/common/aapt"
set_perm "$MODPATH/common/aapt" 0 2000 0755

# set permissions for nuke script
set_perm "$MODPATH/nuke.sh" 0 2000 0755

# clean up bin directory
rm -rf "$MODPATH/bin"

# migrate old config
[ -f "$PERSIST_DIR/nuke_list.json" ] && {
    echo "[*] Migrating old configuration..."
    sh "$MODPATH/nuke.sh" update
}

# remove action.sh on webui-supported env
if [ -n "$KSU" ] || [ -n "$APATCH" ]; then
    rm -f "$MODPATH/action.sh"
fi

echo "[+] System App Nuker setup completed successfully"
echo ""

# EOF
