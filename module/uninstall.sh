#!/bin/sh
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
APP_LIST="$PERSIST_DIR/app_list.json"
REMOVE_LIST="$PERSIST_DIR/nuke_list.json"

[ -d "$PERSIST_DIR" ] && rm -rf "$PERSIST_DIR"
[ -d "$MODULES_UPDATE_DIR" ] && rm -rf "$MODULES_UPDATE_DIR"

# Install apps that are uninstalled
for pkg in $(grep -E '"package_name":' "$REMOVE_LIST" | sed 's/.*"package_name": "\(.*\)",/\1/'); do
    if ! pm path "$pkg"; then
        pm install-existing "$pkg"
    fi
done

# EOF
