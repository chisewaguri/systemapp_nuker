#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
use_mountify_script=false
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

# if overlayfs
# mount on post-mount
if [ "$use_mountify_script" = true ] && [ "$magic_mount" = false ]; then
    . $MODDIR/mountify.sh
fi

# EOF
