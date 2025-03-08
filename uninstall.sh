#!/bin/sh
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"

[ -d "$PERSIST_DIR" ] && rm -rf "$PERSIST_DIR"
[ -d "$MODULES_UPDATE_DIR" ] && rm -rf "$MODULES_UPDATE_DIR"

# EOF
