#!/bin/sh
# customize.sh
# this is part of system app nuker

SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
uninstall_fallback=false
refresh_applist=true
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

# === FUNCTIONS ===

# set config.sh value
set_config() {
    sed -i "s/$1=.*/$1=$2/" "$PERSIST_DIR/config.sh"
}

# check for overlayfs support
check_overlayfs() {
    if grep -q "overlay" /proc/filesystems > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# check if tmpfs xattr is supported
check_tmpfs_xattr() {
    MNT_FOLDER=""
    [ -w /mnt ] && MNT_FOLDER=/mnt
    [ -w /mnt/vendor ] && MNT_FOLDER=/mnt/vendor
    testfile="$MNT_FOLDER/tmpfs_xattr_testfile"
    rm $testfile > /dev/null 2>&1
    busybox mknod "$testfile" c 0 0 > /dev/null 2>&1
    if busybox setfattr -n trusted.overlay.whiteout -v y "$testfile" > /dev/null 2>&1 ; then
        rm $testfile > /dev/null 2>&1
        return 0
    else
        rm $testfile > /dev/null 2>&1
        return 1
    fi
}

# check mounting system
check_magic_mount() {
    if { [ "$KSU" = true ] && [ ! "$KSU_MAGIC_MOUNT" = true ]; } || { [ "$APATCH" = true ] && [ ! "$APATCH_BIND_MOUNT" = true ]; }; then
        return 1 # overlayfs manager detected
    else
        return 0 # magic mount manager detected
    fi
}

# === MAIN SCRIPT ===

# exit when MODPATH is undefined
[ -z "$MODPATH" ] && { echo "[ERROR] MODPATH is undefined. Exiting setup."; exit 1; }

# create persistent directory if it doesn't exist
mkdir -p "$PERSIST_DIR"

# move config to persist dir
mv "$MODPATH/config.sh" "$PERSIST_DIR/"

# set permissions for config
set_perm "$PERSIST_DIR/config.sh" 0 2000 0755

# display loading animation for compatible environments
if [ "$MMRL" = "true" ] || { [ "$KSU" = "true" ] && [ "$KSU_VER_CODE" -ge 11998 ]; } ||
    { [ "$KSU_NEXT" = "true" ] && [ "$KSU_VER_CODE" -ge 12144 ]; } ||
    { [ "$APATCH" = "true" ] && [ "$APATCH_VER_CODE" -ge 11022 ]; }; then
        clear
        echo "[*] Installing System App Nuker... Please wait."
        sleep 0.5
        
        for _ in $(seq 1 3); do
            for symbol in '-' '\' '|' '/'; do
                echo "[$symbol] Setting things up..."
                sleep 0.1
                clear
            done
        done
else
    echo "[*] Installing System App Nuker..."
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

# remove action.sh on webui-supported env
if [ -n "$KSU" ] || [ -n "$APATCH" ]; then
    rm -f "$MODPATH/action.sh"
fi

# --- check for mountify requirements ---

# check for overlayfs
if check_overlayfs; then
    overlay_supported=true
else
    overlay_supported=false
fi

# check if tmpfs xattr is supported
if check_tmpfs_xattr; then
    tmpfs_xattr_supported=true
else
    tmpfs_xattr_supported=false
fi

# check mounting system
if check_magic_mount; then
    magic_mount=true
    echo "[+] Magic Mount manager detected."
else
    magic_mount=false
    echo "[+] Detected an overlayfs-based root manager."
fi
# set_config magic_mount $magic_mount

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
        echo "[!] This module will be mounted by the mountify module."
        rm -f "$MODPATH/skip_mountify"
    else
        echo "[!] This module will NOT be mounted by the mountify module."
    fi
fi

# fallback path
# if mountify will not mount us but standalone script is supported
if { [ "$mountify_active" = false ] || [ "$mountify_mounted" = false ]; } && \
   { { [ "$overlay_supported" = true ] && [ "$tmpfs_xattr_supported" = true ]; } || [ "$magic_mount" = false ]; }; then
    echo "[+] Requirements met. Enabling standalone mountify script."

    # skip mount (cuz standalone script will mount us)
    touch "$MODPATH/skip_mount"
    # skip mountify (just in case)
    touch "$MODPATH/skip_mountify"
    # config
    use_mountify_script=true
    # set_config use_mountify_script $use_mountify_script
fi

echo ""

# migrate old things
[ -f "$PERSIST_DIR/nuke_list.json" ] && {
    echo "[*] Migrating previous configuration..."
    sh "$MODPATH/nuke.sh" update
}

# migrate config (in case when it has a new value)
# variable of the config is defined by sourcing the old config.sh and the script
# value like uninstall_fallback would be persist, but mounting stuff would not.
while IFS='=' read key _; do
    # skip empty, commented, or lines with spaces
    [ -z "$key" ] && continue
    echo "$key" | grep -q '^[[:space:]]*#' && continue
    echo "$key" | grep -Eq '^[a-zA-Z_][a-zA-Z0-9_]*$' || continue

    # trim whitespace
    key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # get current value of the variable
    eval val="\$$key"

    # call set_config with the key and its current value
    set_config "$key" "$val"
    echo "config: $key: $val"
done < "$PERSIST_DIR/config.sh"
echo "[*] Tip: You could edit config.sh in /data/adb/system_app_nuker/config.sh"
echo ""
echo "[✓] System App Nuker has been set up successfully."

# warn KSU or APatch user if module would not be mounted globally
if { [ -n "$KSU" ] || [ -n "$APATCH" ]; } && \
   [ "$use_mountify_script" != true ] && [ "$mountify_mounted" != true ]; then
    echo "[!] Notice: KernelSU or APatch detected. Module will not be mounted globally."
    echo "[!] Tip: Disable 'unmount modules by default' to avoid problems."
fi

# give space before post-customize.sh manager thing
echo ""

# EOF
