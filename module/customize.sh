#!/bin/sh
# customize.sh
# this is part of system app nuker

SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# exit when MODPATH is undefined
[ -z "$MODPATH" ] && { echo "[ERROR] MODPATH is undefined. Exiting setup."; exit 1; }

# create persistent directory if it doesn't exist
mkdir -p "$PERSIST_DIR"

# move config and uad list to persist dir
[ -f "$PERSIST_DIR/config.sh" ] && rm -f "$MODPATH/config.sh" || mv "$MODPATH/config.sh" "$PERSIST_DIR/"
mv -f "$MODPATH/uad_lists.json" "$PERSIST_DIR/"

# mark uad list as ancient to make it to appear outdated
if touch --help 2>&1 | grep -q '\-t'; then
    touch -m -t 197001010000.00 "$PERSIST_DIR/uad_lists.json"
elif busybox touch --help 2>&1 | grep -q '\-t'; then
    busybox touch -m -t 197001010000.00 "$PERSIST_DIR/uad_lists.json"
else
    echo "touch does not support -t; skipping time modification"
    rm -f "$PERSIST_DIR/uad_lists.json"
fi

# set permissions for config
set_perm "$PERSIST_DIR/config.sh" 0 2000 0755

# display loading animation for compatible environments
if [ "$MMRL" = "true" ] || { [ "$KSU" = "true" ] && [ "$KSU_VER_CODE" -ge 11998 ]; } ||
    { [ "$KSU_NEXT" = "true" ] && [ "$KSU_VER_CODE" -ge 12144 ]; } ||
    { [ "$APATCH" = "true" ] && [ "$APATCH_VER_CODE" -ge 11022 ]; }; then
        clear
        echo "[*] Initializing System App Nuker... Please wait."
        sleep 0.5
        
        for _ in $(seq 1 3); do
            for symbol in '-' '\' '|' '/'; do
                echo "[$symbol] Setting things up..."
                sleep 0.1
                clear
            done
        done
else
    echo "[*] Initializing System App Nuker..."
    sleep 1.5 # sleep a bit to make it look like something is happening!!
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
    echo "[*] Migrating previous configuration..."
    sh "$MODPATH/nuke.sh" update
}

# remove action.sh on webui-supported env
if [ -n "$KSU" ] || [ -n "$APATCH" ]; then
    rm -f "$MODPATH/action.sh"
fi

# --- check for mountify requirements ---

# check for overlayfs
if grep -q "overlay" /proc/filesystems > /dev/null 2>&1; then
    overlay_supported=true
else
    overlay_supported=false
fi

# check if tmpfs xattr is supported
MNT_FOLDER=""
[ -w /mnt ] && MNT_FOLDER=/mnt
[ -w /mnt/vendor ] && MNT_FOLDER=/mnt/vendor
testfile="$MNT_FOLDER/tmpfs_xattr_testfile"
rm $testfile > /dev/null 2>&1
busybox mknod "$testfile" c 0 0 > /dev/null 2>&1
if busybox setfattr -n trusted.overlay.whiteout -v y "$testfile" > /dev/null 2>&1 ; then
    tmpfs_xattr_supported=true
    rm $testfile > /dev/null 2>&1
else
    tmpfs_xattr_supported=false
    rm $testfile > /dev/null 2>&1
fi

# check mounting system
if { [ "$KSU" = true ] && [ ! "$KSU_MAGIC_MOUNT" = true ]; } || { [ "$APATCH" = true ] && [ ! "$APATCH_BIND_MOUNT" = true ]; }; then
    magic_mount=false
    echo "[+] Config: OverlayFS manager detected"
else
    magic_mount=true
    echo "[+] Config: Magic Mount manager detected"
fi
sed -i "s/magic_mount=.*/magic_mount=$magic_mount/" "$PERSIST_DIR/config.sh"

# --- check mountify ---
use_mountify_script=false

mountify_active=false
mountify_mounted=false

# if mountify module is active
if [ -f "/data/adb/modules/mountify/config.sh" ] && \
   [ ! -f "/data/adb/modules/mountify/disable" ] && \
   [ ! -f "/data/adb/modules/mountify/remove" ]; then
    mountify_active=true
    mountify_mounts=$(grep -o 'mountify_mounts=[0-9]' /data/adb/modules/mountify/config.sh | cut -d= -f2)

    # if mountify module will mount this module
    if [ "$mountify_mounts" = "2" ] || \
       { [ "$mountify_mounts" = "1" ] && grep -q "system_app_nuker" /data/adb/modules/mountify/modules.txt; }; then
        mountify_mounted=true
        echo "[!] mountify will handle mounting this module."
        rm -f "$MODPATH/skip_mountify"
    fi
fi

# fallback path
# if mountify won't mount us but standalone script is supported
if { [ "$mountify_active" = false ] || [ "$mountify_mounted" = false ]; } && \
   { { [ "$overlay_supported" = true ] && [ "$tmpfs_xattr_supported" = true ]; } || [ "$magic_mount" = false ]; }; then
    echo "[+] Conditions met. Activating mountify standalone script."

    # skip mount (cuz standalone script will mount us)
    touch "$MODPATH/skip_mount"
    # skip mountify (just in case)
    touch "$MODPATH/skip_mountify"
    # config
    use_mountify_script=true
    sed -i "s/^use_mountify_script=.*/use_mountify_script=true/" "$PERSIST_DIR/config.sh"
fi

echo "[✓] System App Nuker setup completed successfully"

# warn KSU or APatch user if module would not be mounted globally
if [ "$use_mountify_script" != true ] && { [ -n "$KSU" ] || [ -n "$APATCH" ]; }; then
    echo "[!] Notice: KernelSU or APatch detected. Module will not be mounted globally"
    echo "[!] Tip: Disable 'unmount modules by default' to avoid problems"
fi

# give space before post-customize.sh manager thing
echo ""

# EOF
