MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
REMOVE_LIST="$PERSIST_DIR/nuke_list.json"

aapt() { 
    [ -f "$MODDIR/common/aapt" ] && "$MODDIR/common/aapt" "$@"
    [ -f "$MODPATH/common/aapt" ] && "$MODPATH/common/aapt" "$@"
}

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

# reset bootcount
echo "BOOTCOUNT=0" > "$MODDIR/count.sh"

create_applist() {
    echo "[" > "$PERSIST_DIR/app_list.json"

    system_app_path="/system/app /system/priv-app /vendor/app /product/app /product/priv-app /system_ext/app /system_ext/priv-app"
    for path in $system_app_path; do
        find "$path" -maxdepth 2 -type f -name "*.apk" | while read APK_PATH; do
            [ -z "$PKG_LIST" ] && PKG_LIST=$(pm list packages -f)
            PACKAGE_NAME=$(echo "$PKG_LIST" | grep "$APK_PATH" | awk -F= '{print $2}')
            [ -z "$PACKAGE_NAME" ] && PACKAGE_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "package:" | awk -F' ' '{print $2}' | sed "s/^name='\([^']*\)'.*/\1/")
            [ -z "$PACKAGE_NAME" ] && continue

            APP_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "application-label:" | sed "s/application-label://g; s/'//g")
            [ -z "$APP_NAME" ] && APP_NAME="$PACKAGE_NAME"

            echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$PACKAGE_NAME\", \"app_path\": \"$APK_PATH\"}," >> "$PERSIST_DIR/app_list.json"
        done
    done

    # Fallback for no package name found
    for package_name in $(pm list packages -s | sed 's/package://g'); do
        if grep -q "\"$package_name\"" "$PERSIST_DIR/app_list.json"; then
            continue
        fi
        APP_NAME=$(aapt dump badging "$package_name" 2>/dev/null | grep "application-label:" | sed "s/application-label://g; s/'//g")
        [ -z "$APP_NAME" ] && APP_NAME="$package_name"
        
        APK_PATH=$(pm path $package_name | sed 's/package://g')
        echo "$APK_PATH" | grep -qE "/system/app|/system/priv-app|/vendor/app|/product/app|/product/priv-app|/system_ext/app|/system_ext/priv-app" || continue
        echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$package_name\", \"app_path\": \"$APK_PATH\"}, " >> "$PERSIST_DIR/app_list.json"
    done
 

    sed -i '$ s/,$//' "$PERSIST_DIR/app_list.json"
    echo "]" >> "$PERSIST_DIR/app_list.json"
}

[ ! -d "$PERSIST_DIR" ] && mkdir -p "$PERSIST_DIR"
[ ! -f "$PERSIST_DIR/app_list.json" ] && create_applist

# remove system apps if they still exist
for package_name in $(grep -E '"package_name":' "$REMOVE_LIST" | sed 's/.*"package_name": "\(.*\)",/\1/'); do
    if pm list packages | grep -qx "package:$package_name"; then
        pm uninstall -k --user 0 "$package_name" 2>/dev/null
    fi
done
