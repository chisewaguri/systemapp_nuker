#!/bin/sh
MODULE_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
REMOVE_LIST="$PERSIST_DIR/nuke_list.txt.old"

# Install apps that are uninstalled
restore_success=true
for pkg in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
    if ! pm path "$pkg" </dev/null >/dev/null 2>&1; then
        pm install-existing "$pkg" </dev/null >/dev/null 2>&1 || restore_success=false
    fi
    pm enable "$pkg" </dev/null >/dev/null 2>&1 || restore_success=false
done

if [ "$restore_success" = true ]; then
    [ -d "$PERSIST_DIR" ] && rm -rf "$PERSIST_DIR"
else
    echo "some apps could not be restored, keeping $PERSIST_DIR" >&2
fi
[ -d "$MODULE_UPDATE_DIR" ] && rm -rf "$MODULE_UPDATE_DIR"

# EOF
