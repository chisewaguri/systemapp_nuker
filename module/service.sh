MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
APP_LIST="$PERSIST_DIR/app_list.json"
APP_LIST_TMP="$PERSIST_DIR/app_list.json.tmp"
REMOVE_LIST="$PERSIST_DIR/nuke_list.json"
ICON_DIR="$PERSIST_DIR/icons"

# import config
uninstall_fallback=false
mounting_mode=0
refresh_applist=true
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

# === FUNCTIONS ===

# appt binary
aapt() { "$MODDIR/common/aapt" "$@"; }

# update module description
update_description() {
    status="$1"
    
    if [ -z "$string" ]; then # if not exist yet
        # base description
        string="description=WebUI-based debloater and whiteout creator"
        
        # count nuked apps (fallback to 0 if file missing or grep fails)
        total=0
        if [ -f "$REMOVE_LIST" ]; then
            total=$(grep -c '"package_name":' "$REMOVE_LIST" 2>/dev/null)
            if [ $? -ne 0 ]; then
                total=0
            fi
        fi
        
        # fallback if grep somehow returns blank
        if [ -z "$total" ]; then
            total=0
        fi
        
        # pluralize
        suffix=""
        if [ "$total" -ne 1 ]; then
            suffix="s"
        fi
        
        # add nuked app count
        string="$string | 💥 nuked: $total app$suffix"
        
        # detect and validate mount mode
        if [ "$mounting_mode" = "0" ]; then
            if [ "$magic_mount" = "true" ]; then
                # check if manager mount is disabled
                if [ -f "/data/adb/ksu/.nomount" ]; then
                    string="[ERROR] Default mount mode requires manager mounting, but it's disabled (.nomount file exists)"
                fi
            fi
            string="$string | ⚙️ mount mode: default"
        elif [ "$mounting_mode" = "1" ]; then
            # check if tmpfs xattrs is available (only required when magic_mount is true)
            if [ "$magic_mount" = "true" ]; then
                MNT_FOLDER=""
                [ -w /mnt ] && MNT_FOLDER=/mnt
                [ -w /mnt/vendor ] && MNT_FOLDER=/mnt/vendor
                testfile="$MNT_FOLDER/tmpfs_xattr_testfile"
                rm $testfile > /dev/null 2>&1
                busybox mknod "$testfile" c 0 0 > /dev/null 2>&1
                if busybox setfattr -n trusted.overlay.whiteout -v y "$testfile" > /dev/null 2>&1 ; then
                    rm $testfile > /dev/null 2>&1
                    string="$string | 🧰 mount mode: mountify standalone script"
                else
                    rm $testfile > /dev/null 2>&1
                    string="[ERROR] mountify standalone mode requires tmpfs xattr support or overlayfs manager"
                fi
            else
                string="$string | 🧰 mount mode: mountify standalone script (overlayfs)"
            fi
        elif [ "$mounting_mode" = "2" ]; then
            if [ -f "/data/adb/modules/mountify/config.sh" ] && \
            [ ! -f "/data/adb/modules/mountify/disable" ] && \
            [ ! -f "/data/adb/modules/mountify/remove" ]; then
                mountify_mounts=$(grep -o 'mountify_mounts=[0-9]' /data/adb/modules/mountify/config.sh | cut -d= -f2)

                # if mountify module will mount this module
                if [ "$mountify_mounts" = "2" ] || \
                { [ "$mountify_mounts" = "1" ] && grep -q "system_app_nuker" /data/adb/modules/mountify/modules.txt; }; then
                    mountify_mounted=true
                    echo "[✓] Mounting will be handled by the mountify module."
                    mounting_mode=2
                    # set_config mounting_mode 2
                    string="$string | 🧰 mount mode: mountify module"
                else
                    string="[ERROR] mountify module mode is enabled but module won't mount this (check if mountify is enabled and this module is on the modules.txt)"
                fi
            fi
        fi
    fi
    
    # add status if provided
    if [ -n "$status" ]; then
        string="$string | $status"
    fi
    
    # set module description - escape special characters for sed
    escaped_string=$(echo "$string" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i "s/^description=.*/$escaped_string/g" "$MODDIR/module.prop"
}

# create applist cache
create_applist() {
    # Update description to show loading status
    update_description "📱 loading app list..."
    
    echo "[" > "$APP_LIST_TMP"

    # default system app path
    system_app_path="/system/app /system/priv-app /vendor/app /product/app /product/priv-app /system_ext/app /system_ext/priv-app"

    # append additional partition on mountify
    if [ "$mounting_mode" = "1" ] || [ "$mounting_mode" = "2" ]; then
        system_app_path="$system_app_path my_bigball mi_ext my_carrier my_company my_engineering my_heytap my_manifest my_preload my_product my_region my_reserve my_stock"
    fi
    for path in $system_app_path; do
        find "$path" -maxdepth 2 -type f -name "*.apk" | while read APK_PATH; do
            # skip if already on app list
            if grep -q "$APK_PATH" "$APP_LIST_TMP"; then
                continue
            fi
            
            # skip if path is in nuke list
            if echo "$NUKED_PATHS" | grep -q "$APK_PATH"; then
                continue
            fi

            [ -z "$PKG_LIST" ] && PKG_LIST=$(pm list packages -f)
            PACKAGE_NAME=$(echo "$PKG_LIST" | grep "$APK_PATH" | awk -F= '{print $2}')
            [ -z "$PACKAGE_NAME" ] && PACKAGE_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "package:" | awk -F' ' '{print $2}' | sed "s/^name='\([^']*\)'.*/\1/")
            [ -z "$PACKAGE_NAME" ] && continue

            APP_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "application-label:" | sed "s/application-label://g; s/'//g")
            [ -z "$APP_NAME" ] && APP_NAME="$PACKAGE_NAME"

            echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$PACKAGE_NAME\", \"app_path\": \"$APK_PATH\"}," >> "$APP_LIST_TMP"
            
            ICON_PATH=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "application:" | awk -F "icon=" '{print $2}' | sed "s/'//g")
            # Extract the icon if it exists
            ICON_FILE="$ICON_DIR/$PACKAGE_NAME.png"

            if [ -n "$ICON_PATH" ]; then
                [ ! -f "$ICON_FILE" ] && unzip -p "$APK_PATH" "$ICON_PATH" > "$ICON_FILE"
            fi
        done
    done

    # Fallback for no package name found
    for package_name in $(pm list packages -s | sed 's/package://g'); do
        if grep -q "\"$package_name\"" "$APP_LIST_TMP"; then
            continue
        fi
        APP_NAME=$(aapt dump badging "$package_name" 2>/dev/null | grep "application-label:" | sed "s/application-label://g; s/'//g")
        [ -z "$APP_NAME" ] && APP_NAME="$package_name"

        APK_PATH=$(pm path $package_name | sed 's/package://g')
        echo "$APK_PATH" | grep -qE "/system/app|/system/priv-app|/vendor/app|/product/app|/product/priv-app|/system_ext/app|/system_ext/priv-app" || continue
        echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$package_name\", \"app_path\": \"$APK_PATH\"}, " >> "$APP_LIST_TMP"
    done

    sed -i '$ s/,$//' "$APP_LIST_TMP"
    echo "]" >> "$APP_LIST_TMP"

    mv -f "$APP_LIST_TMP" "$APP_LIST"
    
    # Update description to show loaded status
    update_description "✅ app list loaded"
}

# === MAIN SCRIPT ===

# -- set module description --

# set initial description
update_description

# wait for boot completed
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

# make sure persist dir exist
[ ! -d "$PERSIST_DIR" ] && mkdir -p "$PERSIST_DIR"

# reset bootcount
echo "BOOTCOUNT=0" > "$PERSIST_DIR/count.sh"
chmod 755 "$PERSIST_DIR/count.sh"

# ensure the remove list exists
[ -s "$REMOVE_LIST" ] || echo "[]" > "$REMOVE_LIST"

# get list of app paths to be removed
NUKED_PATHS=$(grep -o "\"app_path\":.*" "$REMOVE_LIST" | awk -F"\"" '{print $4}')
# ensure the icon directory exists
[ ! -d "$ICON_DIR" ] && mkdir -p "$ICON_DIR"

# create or refresh app list
if [ ! -f "$APP_LIST" ] || [ "$refresh_applist" = true ]; then
    create_applist
else
    # Update description to indicate app list won't be reloaded
    update_description "📋 no reload applist"
fi

# create symlink for app icon
[ ! -L "$MODDIR/webroot/link" ] && ln -s $PERSIST_DIR $MODDIR/webroot/link

# this make sure that restored app is back
for pkg in $(grep -o "\"package_name\":.*" "$APP_LIST" | awk -F"\"" '{print $4}'); do
    if ! pm path "$pkg" >/dev/null 2>&1; then
        pm install-existing "$pkg" >/dev/null 2>&1
    fi
    disabled_list=$(pm list packages -d)
    if echo "$disabled_list" | grep -qx "package:$pkg"; then
        pm enable "$pkg" >/dev/null 2>&1 || true
    fi
done

# uninstall fallback if apps aint nuked at late service
# enable this on config.sh
$uninstall_fallback && {
    # remove system apps if they still exist
    for package_name in $(grep -o "\"package_name\":.*" "$REMOVE_LIST" | awk -F"\"" '{print $4}'); do
        if pm list packages | grep -qx "package:$package_name"; then
            pm uninstall -k --user 0 "$package_name" 2>/dev/null
        fi
    done
}

# EOF
