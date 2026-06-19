#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
mounting_mode=0
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . "$PERSIST_DIR/config.sh"

BOOTCOUNT=0
[ -f "$PERSIST_DIR/count.sh" ] && . "$PERSIST_DIR/count.sh"

# set config.sh value
set_config() {
    sed -i "s/$1=.*/$1=$2/" "$PERSIST_DIR/config.sh"
}

# after bootloop
# code is no longer used but still here for testing purposes
if [ $BOOTCOUNT -lt 0 ]; then
    BOOTCOUNT=0
fi

BOOTCOUNT=$(( BOOTCOUNT + 1))

if [ $BOOTCOUNT -gt 1 ]; then # on 2nd post-fs-data without reaching service
    touch $MODDIR/disable

    # remove whiteouts
    for dir in system system_ext vendor product; do
        rm -rf "$MODDIR/$dir"
    done

    # backup nuke list
    [ -f "$PERSIST_DIR"/nuke_list.txt ] && mv -f "$PERSIST_DIR"/nuke_list.txt "$PERSIST_DIR"/nuke_list.txt.bak
    [ -f "$PERSIST_DIR"/raw_whiteouts.txt ] && mv -f "$PERSIST_DIR"/raw_whiteouts.txt "$PERSIST_DIR"/raw_whiteouts.txt.bak

    # tell user to re-enable module
    string="description=bootloop protection triggered. whiteouts deleted. enable module to re-activate."
    sed -i "s/^description=.*/$string/g" $MODDIR/module.prop

    # set bootcount and reboot
    echo "BOOTCOUNT=-1" > "$PERSIST_DIR/count.sh"
    stop; reboot

else # on post-fs-data
    # service will reset this count
    echo "BOOTCOUNT=1" > "$PERSIST_DIR/count.sh"
    chmod 755 "$PERSIST_DIR/count.sh"
fi

# --- mount thing ---
# mode 2: metamodule or mountify module handles mounting — nothing to do here
# mode 1: standalone mountify script handles mounting
# mode 0: legacy/default — manager mounts (or falls through for old KSU; warn in log)
if [ "$mounting_mode" = "2" ]; then
    echo "app_nuker_debug: post-fs-data: metamodule/mountify module mounting mode..." >> /dev/kmsg
elif [ "$mounting_mode" = "1" ]; then
    # ensure manager/mountify module won't also try to mount us
    touch "$MODDIR/skip_mount"
    touch "$MODDIR/skip_mountify"

    # mount
    echo "app_nuker_debug: post-fs-data: mounting with mountify standalone script..." >> /dev/kmsg
    if [ "$magic_mount" = true ]; then
        # if magic mount manager
        . $MODDIR/mountify.sh
    elif [ "$magic_mount" = false ]; then
        # if overlayfs manager
        . $MODDIR/mountify-symlink.sh
    fi
else
    echo "app_nuker_debug: post-fs-data: default/legacy mounting mode..." >> /dev/kmsg
    rm -f "$MODDIR/skip_mount"
    rm -f "$MODDIR/skip_mountify"
fi

# Detect current manager
[ ! "$APATCH" = "true" ] && [ ! "$KSU" = "true" ] && MANAGER="MAGISK"
[ "$KSU" = "true" ] && MANAGER="KSU"
[ "$APATCH" = "true" ] && MANAGER="APATCH"
set_config current_manager $MANAGER

# EOF
