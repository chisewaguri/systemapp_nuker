#!/bin/sh
# customize.sh
# this is part of system app nuker

SKIPUNZIP=0
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
uninstall_fallback=false
refresh_applist=true
uninstall_only_mode=false
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

# === FUNCTIONS ===

# set config.sh value
set_config() {
    sed -i "s/$1=.*/$1=$2/" "$PERSIST_DIR/config.sh"
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
                echo "[$symbol] Initializing..."
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
    rm $testfile > /dev/null 2>&1
    tmpfs_xattr_supported=true
else
    rm $testfile > /dev/null 2>&1
    tmpfs_xattr_supported=false
fi

# check mounting system
# KSU >22098: manager no longer handles mounting.
ksu_is_metamodule=false
if [ "$KSU" = true ] && [ "$KSU_VER_CODE" -ge 22098 ]; then
    ksu_is_metamodule=true
    magic_mount=false
    echo "[i] KSU >22098 detected: using metamodule mounting mode."
elif { [ "$KSU" = true ] && [ ! "$KSU_MAGIC_MOUNT" = true ] && [ "$KSU_VER_CODE" -lt 22098 ]; } || \
     { [ "$APATCH" = true ] && [ ! "$APATCH_BIND_MOUNT" = true ]; }; then
    magic_mount=false
    echo "[i] No magic mount detected. Likely using overlayfs root manager."
else
    magic_mount=true
    echo "[i] Magic mount (e.g. Magisk) detected."
fi

# KSU old version warning
if [ "$KSU" = true ] && [ "$KSU_VER_CODE" -lt 22098 ]; then
    echo "[!] WARNING: Your KSU version is outdated (ver $KSU_VER_CODE < 22098)."
    echo "[!]          Manager-side mounting is legacy and may not work correctly."
    echo "[!]          Please update KernelSU for metamodule support."
fi

# --- check mountify / metamodule ---
# mode 2 now covers both: KSU metamodule AND the mountify module.
# they kinda behave identically, mountify as of now (in supported environments) is also works as a metamodule. 
mounting_mode=0

mountify_active=false
mountify_mounted=false

# mountify running as a metamodule is detected the same way as the standalone mountify module.
if [ "$ksu_is_metamodule" = true ] && \
     [ -f "/data/adb/metamodule/module.prop" ] && \
     [ ! -f "/data/adb/metamodule/disable" ] && \
     [ ! -f "/data/adb/metamodule/remove" ]; then
    rm -f "$MODPATH/skip_mount"
    rm -f "$MODPATH/skip_mountify"
    echo "[✓] Mounting will be handled by the KSU metamodule system."
    echo "[i] YOU MUST HAVE A METAMODULE INSTALLED FOR THIS TO WORK (e.g. mountify)."
    mountify_active=true
    mounting_mode=2
    mountify_mounted=true
# priority 2: mountify standalone module (non-metamodule KSU / Magisk / APatch)
elif [ -f "/data/adb/modules/mountify/module.prop" ] && \
     [ ! -f "/data/adb/modules/mountify/disable" ] && \
     [ ! -f "/data/adb/modules/mountify/remove" ]; then
    mountify_active=true
    mountify_mounts=$(grep -o 'mountify_mounts=[0-9]' /data/adb/mountify/config.sh | cut -d= -f2)

    if [ "$mountify_mounts" = "2" ] || \
       { [ "$mountify_mounts" = "1" ] && grep -q "system_app_nuker" /data/adb/mountify/modules.txt; }; then
        echo "[✓] Mounting will be handled by the mountify module."
        mountify_mounted=true
        mounting_mode=2
        rm -f "$MODPATH/skip_mountify"
    else
        echo "[x] mountify module won't mount this module."
    fi
fi

# priority 3: mountify standalone script (bundled)
# (since the manager and metamodule won't mount us anymore, we must self-mount if possible).
if { [ "$mountify_active" = false ] || [ "$mountify_mounted" = false ]; } && \
   { { [ "$overlay_supported" = true ] && [ "$tmpfs_xattr_supported" = true ]; } || [ "$magic_mount" = false ]; }; then
    echo "[+] Standalone mountify script enabled (requirements met)."

    # skip mount (manager won't / shouldn't mount us)
    touch "$MODPATH/skip_mount"
    # skip mountify module re-mount
    touch "$MODPATH/skip_mountify"
    mounting_mode=1
fi
# set mounting mode config
set_config mounting_mode $mounting_mode

echo ""

# migrate old things
[ -f "$PERSIST_DIR/nuke_list.json" ] && {
    echo "[*] nuke_list.json found. Migrating..."
    sh "$MODPATH/nuke.sh" update
}

# migrate config.sh (in case when it has a new value)
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
    echo "[~] config: $key=$val"
done < "$PERSIST_DIR/config.sh"
echo "[i] Edit config at: $PERSIST_DIR/config.sh"
echo ""

# warn KSU or APatch user if module would not be mounted globally
if { [ -n "$KSU" ] || [ -n "$APATCH" ]; } && \
   [ "$mounting_mode" = "0" ] && [ "$mountify_mounted" != true ]; then
    echo "[!] KSU/APatch detected. Module won't mount globally."
    echo "[i] Hint: Turn off 'unmount by default' to fix that."
fi

# extra warning: KSU >22098 landed in mode 0 manager mounting is gone and standalone wasn't eligible
if [ "$ksu_is_metamodule" = true ] && [ "$mounting_mode" = "0" ]; then
    echo "[!] KSU >22098: manager mounting is no longer available and standalone script"
    echo "[!]             requirements were not met (needs overlayfs + tmpfs xattr)."
    echo "[!]             Module WILL NOT be mounted. Please install a metamodule"
fi

# success message
echo "[✓] System App Nuker setup complete."

# give space before post-customize.sh manager thing
echo ""

# EOF
