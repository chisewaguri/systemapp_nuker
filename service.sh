MODDIR="/data/adb/modules/system_app_nuker"
REMOVE_LIST="$MODDIR/nuke_list.json"

aapt() { "$MODDIR/common/aapt" "$@"; }

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

create_applist() {
    mkdir -p "$MODDIR/webroot/assets"
    echo "[" > "$MODDIR/webroot/assets/app_list.json"

    system_app_path="/system/app /system/priv-app /vendor/app /product/app /product/priv-app /system_ext/app /system_ext/priv-app"
    for path in $system_app_path; do
        find "$path" -maxdepth 2 -type f -name "*.apk" | while read APK_PATH; do
            APP_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "application-label:" | sed "s/application-label://g; s/'//g")
            [ -z "$APP_NAME" ] && APP_NAME=""

            PACKAGE_NAME=$(pm list packages -f | grep "$APK_PATH" | awk -F= '{print $2}')
            [ -z "$PACKAGE_NAME" ] && PACKAGE_NAME=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "package:" | awk -F' ' '{print $2}' | sed "s/^name='\([^']*\)'.*/\1/")
            [ -z "$PACKAGE_NAME" ] && continue

            echo "  {\"app_name\": \"$APP_NAME\", \"package_name\": \"$PACKAGE_NAME\", \"app_path\": \"$APK_PATH\"}," >> "$MODDIR/webroot/assets/app_list.json"
        done
    done

    sed -i '$ s/,$//' "$MODDIR/webroot/assets/app_list.json"
    echo "]" >> "$MODDIR/webroot/assets/app_list.json"
}

[ ! -f "$MODDIR/webroot/assets/app_list.json" ] && create_applist

# remove system apps if they still exist
for package_name in $(grep -E '"package_name":' "$REMOVE_LIST" | sed 's/.*"package_name": "\(.*\)",/\1/'); do
    if pm list packages | grep -qx "package:$package_name"; then
        pm uninstall -k --user 0 "$package_name" 2>/dev/null
    fi
done