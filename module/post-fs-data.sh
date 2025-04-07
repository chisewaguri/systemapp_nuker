#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
use_mountify_script=false
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . "$PERSIST_DIR/config.sh"

BOOTCOUNT=0
[ -f "$PERSIST_DIR/count.sh" ] && . "$PERSIST_DIR/count.sh"

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

    # remove nuke list
    rm -rf "$PERSIST_DIR"/nuke_list.json
    rm -rf "$PERSIST_DIR"/raw_whiteouts.txt


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

# --- mountify script ---

if [ "$use_mountify_script" = true ]; then
    # skip mount because we mount it ourselves
    touch "$MODPATH/skip_mount"
    touch "$MODPATH/skip_mountify"

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
    echo "app_nuker_debug: post-fs-data: default mounting mode..." >> /dev/kmsg
    rm -f "$MODPATH/skip_mount"
    rm -f "$MODPATH/skip_mountify"

fi

# EOF
