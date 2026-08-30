MODDIR="/data/adb/modules/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
REMOVE_LIST="$PERSIST_DIR/nuke_list.txt"
RAW_LIST="$PERSIST_DIR/raw_whiteouts.txt"

# import config
mounting_mode=0
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

# === FUNCTIONS ===

# update module description
update_description() {
    status="$1"
    
    if [ -z "$string" ]; then # if not exist yet
        # base description
        string="WebUI-based debloater and whiteout creator"
        
        # count nuked apps (fallback to 0 if file missing or grep fails)
        total=0
        if [ -f "$REMOVE_LIST" ]; then
            total=$(grep -cEv "^$|^#" "$REMOVE_LIST" 2>/dev/null) || total=0
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
            string="$string | ⚙️ mount mode: default"
            if [ "$magic_mount" = "true" ]; then
                # check if manager mount is disabled
                if { [ "$KSU_NEXT" = "true" ] && [ "$KSU_VER_CODE" -lt 22098 ] && [ -f "/data/adb/ksu/.nomount" ]; } || \
                    { [ "$APATCH" = "true" ] && [ -f "/data/adb/ap/.litemode_enable" ]; }; then
                    string="[ERROR] .nomount or .litemode_enable on magic mount"
                fi
            fi
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
            # mode 2 covers both: KSU metamodule and the mountify module — treated identically
            string="$string | 🧰 mount mode: metamodule or mountify module"
        fi
    fi
    
    # add status if provided
    if [ -n "$status" ]; then
        string="$string | $status"
    fi
    
    # set module description - escape special characters for sed
    escaped_string=$(echo "description=$string" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i "s/^description=.*/$escaped_string/g" "$MODDIR/module.prop"
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

# this make sure that restored app is back
FAILED_RESTORES="$PERSIST_DIR/restore_failed.tmp"
rm -f "$FAILED_RESTORES"
if [ -s "$REMOVE_LIST.old" ]; then
    while IFS= read -r old_line || [ -n "$old_line" ]; do
        case "$old_line" in
            ""|\#*) continue ;;
        esac
        pkg=$(echo "$old_line" | awk '{print $1}')
        awk -v pkg="$pkg" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null && continue
        restore_success=true
        pm install-existing "$pkg" </dev/null >/dev/null 2>&1 || restore_success=false
        pm enable "$pkg" </dev/null >/dev/null 2>&1 || restore_success=false
        [ "$restore_success" = true ] || echo "$old_line" >> "$FAILED_RESTORES" || exit 1
    done < "$REMOVE_LIST.old"
fi

# make sure app is uninstalled if user is switching to uninstall only mode
if [ -s "$REMOVE_LIST" ] && [ "$uninstall_only_mode" = "true" ]; then
    for pkg in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
        pm uninstall --user 0 "$pkg" </dev/null >/dev/null 2>&1 || true
    done
fi

# ensure the remove list exists and save nuked apps to old list
[ -f "$REMOVE_LIST" ] || touch "$REMOVE_LIST" || exit 1
SNAPSHOT="$REMOVE_LIST.old.new.$$"
cp -f "$REMOVE_LIST" "$SNAPSHOT" || { rm -f "$SNAPSHOT"; exit 1; }
if [ -s "$SNAPSHOT" ] && [ "$(tail -c 1 "$SNAPSHOT" | wc -l)" -eq 0 ]; then
    echo >> "$SNAPSHOT" || { rm -f "$SNAPSHOT"; exit 1; }
fi
[ ! -f "$FAILED_RESTORES" ] || cat "$FAILED_RESTORES" >> "$SNAPSHOT" || { rm -f "$SNAPSHOT"; exit 1; }
mv -f "$SNAPSHOT" "$REMOVE_LIST.old" || { rm -f "$SNAPSHOT"; exit 1; }
rm -f "$FAILED_RESTORES"
[ -f "$RAW_LIST" ] || touch "$RAW_LIST" || exit 1
RAW_SNAPSHOT="$RAW_LIST.old.new.$$"
cp -f "$RAW_LIST" "$RAW_SNAPSHOT" || { rm -f "$RAW_SNAPSHOT"; exit 1; }
mv -f "$RAW_SNAPSHOT" "$RAW_LIST.old" || { rm -f "$RAW_SNAPSHOT"; exit 1; }

# EOF
