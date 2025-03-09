#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

BOOTCOUNT=0
[ -f "$MODDIR/count.sh" ] && . "$MODDIR/count.sh"

BOOTCOUNT=$(( BOOTCOUNT + 1))

if [ $BOOTCOUNT -gt 1 ]; then
    touch $MODDIR/disable
    rm "$MODDIR/count.sh"
    stop; reboot
else
    echo "BOOTCOUNT=1" > "$MODDIR/count.sh"
    chmod 755 "$MODDIR/count.sh"
fi

# EOF
