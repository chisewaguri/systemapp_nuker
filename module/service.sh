#!/bin/sh

# ===== configuration =====
MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
APP_LIST="$PERSIST_DIR/app_list.json"
REMOVE_LIST="$PERSIST_DIR/nuke_list.json"
ICON_DIR="$PERSIST_DIR/icons"
TEMP_DIR="$PERSIST_DIR/tmp"

[ -w "/dev" ] && TEMP_DIR="/dev/app_nuker_tmp"

# uninstall fallback for apps thats still installed after nuking
uninstall=false

# ===== utility functions =====

# wrapper for aapt command
aapt() { 
    "$MODDIR/common/aapt" "$@"; 
}

# clean up any previous temporary files
cleanup_temp() {
    [ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
    mkdir -p "$TEMP_DIR"
}

# extract icon from APK file
extract_icon() {
    local APK_PATH="$1"
    local PACKAGE_NAME="$2"
    
    # skip if icon already exists and is not empty
    if [ -s "$ICON_DIR/$PACKAGE_NAME.png" ]; then
        return
    fi
    
    ICON_PATH=$(grep "application:" "$TEMP_DIR/dump_$PACKAGE_NAME" 2>/dev/null | awk -F "icon=" '{print $2}' | sed "s/'//g")
    if [ -n "$ICON_PATH" ]; then
        unzip -p "$APK_PATH" "$ICON_PATH" > "$ICON_DIR/$PACKAGE_NAME.png" 2>/dev/null
    fi
}

# reset boot count (used for bootloop protection)
reset_bootcount() {
    echo "BOOTCOUNT=0" > "$MODDIR/count.sh"
    chmod 755 "$MODDIR/count.sh"
}

# create app list with all system apps
create_applist() {
    # check if applist is recent (less than 7 day old)
    if [ -f "$APP_LIST" ]; then
        LAST_SCAN=$(stat -c %Y "$APP_LIST" 2>/dev/null || echo 0)
        CURRENT_TIME=$(date +%s)
        
        if [ $((CURRENT_TIME - LAST_SCAN)) -lt 604800 ]; then
            return
        fi
    fi

    # initialize app list file
    echo "[" > "$APP_LIST"
    
    # clean up and create temp directory
    cleanup_temp
    
    # get package lists
    PKG_LIST=$(pm list packages -f)
    
    # scan APK files found in system directories
    scan_system_apks
    
    # scan system packages not found by path scan
    scan_remaining_system_packages
    
    # clean up temp files
    cleanup_temp

    # finalize JSON format
    sed -i '$ s/,$//' "$APP_LIST"
    echo "]" >> "$APP_LIST"
}

# scan APK files found in system directories
scan_system_apks() {
    find /system/app /system/priv-app /vendor/app /product/app /product/priv-app /system_ext/app /system_ext/priv-app \
        -maxdepth 2 -type f -name "*.apk" | sort | while read APK_PATH; do
        
        if grep -q "\"$APK_PATH\"" "$APP_LIST" 2>/dev/null; then
            continue
        fi
        
        # get package name
        PACKAGE_NAME=$(echo "$PKG_LIST" | grep "$APK_PATH" | awk -F= '{print $2}')
        
        if [ -z "$PACKAGE_NAME" ]; then
            # dump app info to temp file for faster parsing
            aapt dump badging "$APK_PATH" > "$TEMP_DIR/dump_$(basename "$APK_PATH")" 2>/dev/null
            PACKAGE_NAME=$(grep "package:" "$TEMP_DIR/dump_$(basename "$APK_PATH")" 2>/dev/null | awk -F' ' '{print $2}' | sed "s/^name='\([^']*\)'.*/\1/")
            
            # rename temp file if package name was found
            if [ -n "$PACKAGE_NAME" ]; then
                mv "$TEMP_DIR/dump_$(basename "$APK_PATH")" "$TEMP_DIR/dump_$PACKAGE_NAME" 2>/dev/null
            else
                continue
            fi
        else
            # still dump for app name and icon extraction
            aapt dump badging "$APK_PATH" > "$TEMP_DIR/dump_$PACKAGE_NAME" 2>/dev/null
        fi

        APP_NAME=$(grep "application-label:" "$TEMP_DIR/dump_$PACKAGE_NAME" 2>/dev/null | sed "s/application-label://g; s/'//g")
        [ -z "$APP_NAME" ] && APP_NAME="$PACKAGE_NAME"

        echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$PACKAGE_NAME\", \"app_path\": \"$APK_PATH\"}," >> "$APP_LIST"
        
        # extract icon in background
        extract_icon "$APK_PATH" "$PACKAGE_NAME" &
        
        # limit concurrent icon extractions
        while [ "$(jobs | wc -l)" -ge 4 ]; do
            sleep 0.5
        done
    done
    
    # wait for all icon extractions to finish
    wait
}

# scan system packages not found by path scan
scan_remaining_system_packages() {
    pm list packages -s | sed 's/package://g' | while read package_name; do
        if grep -q "\"$package_name\"" "$APP_LIST" 2>/dev/null; then
            continue
        fi
        
        APK_PATH=$(pm path $package_name | grep -m 1 "^package:" | sed 's/package://g')
        echo "$APK_PATH" | grep -qE "/system/|/vendor/|/product/|/system_ext/" || continue
        
        aapt dump badging "$APK_PATH" > "$TEMP_DIR/dump_$package_name" 2>/dev/null
        APP_NAME=$(grep "application-label:" "$TEMP_DIR/dump_$package_name" 2>/dev/null | sed "s/application-label://g; s/'//g")
        [ -z "$APP_NAME" ] && APP_NAME="$package_name"
        
        echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$package_name\", \"app_path\": \"$APK_PATH\"}, " >> "$APP_LIST"
        
        # Extract icon in background
        extract_icon "$APK_PATH" "$package_name" &
        
        # Limit concurrent icon extractions
        while [ "$(jobs | wc -l)" -ge 4 ]; do
            sleep 0.5
        done
    done
    
    # Wait for all icon extractions to finish
    wait
}

# setup file symlinks for WebUI
setup_symlinks() {
    [ ! -L "$MODDIR/webroot/icons" ] && ln -sf "$ICON_DIR" "$MODDIR/webroot/icons"
    [ ! -L "$MODDIR/webroot/app_list.json" ] && ln -sf "$APP_LIST" "$MODDIR/webroot/app_list.json"
    [ ! -L "$MODDIR/webroot/nuke_list.json" ] && ln -sf "$REMOVE_LIST" "$MODDIR/webroot/nuke_list.json"
}

# reinstall previously removed apps
reinstall_apps() {
    grep -o "\"package_name\":.*" "$APP_LIST" | awk -F"\"" '{print $4}' | while read pkg; do
        if ! pm path "$pkg" >/dev/null 2>&1; then
            pm install-existing "$pkg" >/dev/null 2>&1
        fi
    done
}

# uninstall nuked apps that are still installed
uninstall_apps() {
    grep -o "\"package_name\":.*" "$REMOVE_LIST" | awk -F"\"" '{print $4}' | while read package_name; do
        if pm list packages | grep -qx "package:$package_name"; then
            pm uninstall -k --user 0 "$package_name" 2>/dev/null
        fi
    done
}

# check if app list needs refresh
check_applist_refresh() {
    if [ ! -f "$APP_LIST" ]; then
        create_applist
    else
        # check if app list is older than 7 days, if so, trigger a refresh
        LAST_SCAN=$(stat -c %Y "$APP_LIST" 2>/dev/null || echo 0)
        CURRENT_TIME=$(date +%s)
        if [ $((CURRENT_TIME - LAST_SCAN)) -gt 604800 ]; then
            create_applist
        fi
    fi
}

# ===== main script =====

# wait for boot completed
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

# initialize directories
[ ! -d "$PERSIST_DIR" ] && mkdir -p "$PERSIST_DIR"

# reset bootcount for bootloop protection
reset_bootcount

# ensure the remove list exists
[ -s "$REMOVE_LIST" ] || echo "[]" > "$REMOVE_LIST"

# ensure the icon directory exists
[ ! -d "$ICON_DIR" ] && mkdir -p "$ICON_DIR"

# check and refresh app list if needed
check_applist_refresh

# setup symlinks for WebUI
setup_symlinks

# reinstall apps
reinstall_apps

# fallback if nuked apps is still installed
$uninstall && uninstall_apps

# remove tmp dir
rm -rf $TEMP_DIR

# exit successfully
exit 0