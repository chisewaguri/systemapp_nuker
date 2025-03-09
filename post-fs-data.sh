#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

BOOTCOUNT=0
[ -f "$MODDIR/count.sh" ] && . "$MODDIR/count.sh"

if [ $BOOTCOUNT -lt 0 ]; then
    unzip -o "$MODDIR/dummy.zip" module.prop -d "$MODDIR"
    BOOTCOUNT=0
fi

BOOTCOUNT=$(( BOOTCOUNT + 1))

if [ $BOOTCOUNT -gt 1 ]; then
    touch $MODDIR/disable
    # remove whiteouts
    for dir in system system_ext vendor product; do
        rm -rf "$MODULES_UPDATE_DIR/$dir"
    done
    # remove applist
    rm -rf "$PERSIST_DIR/*"
    string="description=bootloop protection triggered. whiteouts deleted. enable the module to activate."
    sed -i "s/^description=.*/$string/g" $MODDIR/module.prop
    echo "BOOTCOUNT=-1" > "$MODDIR/count.sh"
    stop; reboot
else
    echo "BOOTCOUNT=1" > "$MODDIR/count.sh"
    chmod 755 "$MODDIR/count.sh"
fi

# EOF
