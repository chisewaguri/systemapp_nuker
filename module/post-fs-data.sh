#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

BOOTCOUNT=0
[ -f "$PERSIST_DIR/count.sh" ] && . "$PERSIST_DIR/count.sh"

# after bootloop
# code is no longer used but still here for testing purposes
if [ $BOOTCOUNT -lt 0 ]; then
    BOOTCOUNT=0
fi

BOOTCOUNT=$(( BOOTCOUNT + 1))

if [ $BOOTCOUNT -gt 1 ]; then # on bootloop (2nd boot)
    touch $MODDIR/disable

    # remove whiteouts
    for dir in system system_ext vendor product; do
        rm -rf "$MODDIR/$dir"
    done

    # remove persist dir content
    rm -rf "$PERSIST_DIR/*"

    # reset version code to 0
    string="versionCode=0"
    sed -i "s/^versionCode=.*/$string/g" $MODDIR/module.prop

    # tell user to reinstall module
    string="description=bootloop protection triggered. whiteouts deleted. update or reinstall the module to re-activate."
    sed -i "s/^description=.*/$string/g" $MODDIR/module.prop

    # set bootcount and reboot
    echo "BOOTCOUNT=-1" > "$PERSIST_DIR/count.sh"
    stop; reboot

else # on normal boot
    echo "BOOTCOUNT=1" > "$PERSIST_DIR/count.sh"
    chmod 755 "$PERSIST_DIR/count.sh"
fi

# EOF
