#!/bin/sh
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
APP_LIST="$PERSIST_DIR/app_list.json"

# Install apps that are uninstalled
for pkg in $(grep "\"package_name\":" "$APP_LIST" | awk -F"\"" '{print $8}'); do
    if ! pm path "$pkg" >/dev/null 2>&1; then
        pm install-existing "$pkg" >/dev/null 2>&1
    fi
done

[ -d "$PERSIST_DIR" ] && rm -rf "$PERSIST_DIR"
[ -d "$MODULES_UPDATE_DIR" ] && rm -rf "$MODULES_UPDATE_DIR"

# EOF
