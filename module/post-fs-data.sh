#!/bin/sh
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"
PERSIST_DIR="/data/adb/system_app_nuker"

# import config
mounting_mode=0
magic_mount=true
[ -f "$PERSIST_DIR/config.sh" ] && . "$PERSIST_DIR/config.sh"

BOOTCOUNT=0
[ -f "$PERSIST_DIR/count.sh" ] && . "$PERSIST_DIR/count.sh"

# set config.sh value
set_config() {
    sed -i "s/$1=.*/$1=$2/" "$PERSIST_DIR/config.sh"
}

# reset after bootloop protection
if [ $BOOTCOUNT -lt 0 ]; then
    BOOTCOUNT=0
fi

BOOTCOUNT=$(( BOOTCOUNT + 1))

# pm uninstall --user 0 only writes inst="false" into package-restrictions,
# and pm cant run while system_server is looping, so undo it in the file.
# .bak is read because a retry runs after the list was moved there.
reinstall_packages() {
    failed=0
    pkgs=$(cat "$PERSIST_DIR"/nuke_list.txt "$PERSIST_DIR"/nuke_list.txt.old "$PERSIST_DIR"/nuke_list.txt.bak 2>/dev/null |
        grep -Ev "^$|^#" | awk '{print $1}' | tr '\n' ' ')
    [ -n "$pkgs" ] || return 0
    for xml in "$@"; do
        [ -f "$xml" ] || continue
        text="$xml.san.xml"
        fixed="$xml.san.fixed"
        if [ "$(head -c 3 "$xml")" = ABX ]; then
            abx2xml "$xml" "$text" || { echo "app_nuker_debug: abx2xml failed for $xml" >> /dev/kmsg; rm -f "$text"; failed=1; continue; }
        else
            cp -f "$xml" "$text" || { failed=1; continue; }
        fi
        awk -v pkgs=" $pkgs" '
            /<pkg / && match($0, /name="[^"]*"/) {
                if (index(pkgs, " " substr($0, RSTART + 6, RLENGTH - 7) " ")) sub(/ inst="false"/, "")
            }
            { print }' "$text" > "$fixed" || { rm -f "$text" "$fixed"; failed=1; continue; }
        if ! cmp -s "$text" "$fixed"; then
            if [ "$(head -c 3 "$xml")" = ABX ]; then
                xml2abx "$fixed" "$text" || { echo "app_nuker_debug: xml2abx failed for $xml" >> /dev/kmsg; rm -f "$text" "$fixed"; failed=1; continue; }
            else
                mv -f "$fixed" "$text"
            fi
            # fs-verity makes the file read-only, so swap in a new file with the same attributes
            chown "$(stat -c %u:%g "$xml")" "$text" &&
                chmod "$(stat -c %a "$xml")" "$text" &&
                { chcon --reference="$xml" "$text" || /system/bin/chcon "$(/system/bin/stat -c %C "$xml")" "$text"; } &&
                mv -f "$text" "$xml" ||
                { echo "app_nuker_debug: cant replace $xml" >> /dev/kmsg; failed=1; }
        fi
        rm -f "$text" "$fixed"
    done
    return $failed
}

if [ $BOOTCOUNT -gt 1 ]; then # on 2nd post-fs-data without reaching service
    # system_server can read any of these copies. If the repair fails, keep
    # the module enabled so the next loop retries. With the whiteouts below
    # deleted, an enabled module hides nothing.
    xml=/data/system/users/0/package-restrictions
    reinstall_packages "$xml.xml" "$xml-backup.xml" "$xml.xml.fallback" "$xml.xml.reservecopy" && touch $MODDIR/disable

    # remove whiteouts
    for dir in system system_ext vendor product odm mi_ext \
        my_bigball my_carrier my_company my_engineering my_heytap \
        my_manifest my_preload my_product my_region my_reserve my_stock; do
        rm -rf "$MODDIR/$dir"
    done

    # backup nuke list
    [ -f "$PERSIST_DIR"/nuke_list.txt ] && mv -f "$PERSIST_DIR"/nuke_list.txt "$PERSIST_DIR"/nuke_list.txt.bak
    [ -f "$PERSIST_DIR"/raw_whiteouts.txt ] && mv -f "$PERSIST_DIR"/raw_whiteouts.txt "$PERSIST_DIR"/raw_whiteouts.txt.bak

    # tell user to re-enable module
    string="description=bootloop protection triggered. whiteouts deleted. enable module to re-activate."
    sed -i "s/^description=.*/$string/g" $MODDIR/module.prop

    # set bootcount and reboot
    echo "BOOTCOUNT=-1" > "$PERSIST_DIR/count.sh"
    stop; reboot

else # on post-fs-data
    # service will reset this count
    echo "BOOTCOUNT=1" > "$PERSIST_DIR/count.sh"
    chmod 755 "$PERSIST_DIR/count.sh"
fi

# --- mount thing ---
# the mountify scripts create this when a mount fails, service.sh checks it
MOUNT_FAILED="$PERSIST_DIR/mount_failed"
rm -f "$MOUNT_FAILED"
# mode 2: metamodule or mountify module handles mounting — nothing to do here
# mode 1: standalone mountify script handles mounting
# mode 0: legacy/default — manager mounts (or falls through for old KSU; warn in log)
if [ "$mounting_mode" = "2" ]; then
    echo "app_nuker_debug: post-fs-data: metamodule/mountify module mounting mode..." >> /dev/kmsg
elif [ "$mounting_mode" = "1" ]; then
    # ensure manager/mountify module won't also try to mount us
    touch "$MODDIR/skip_mount"
    touch "$MODDIR/skip_mountify"

    # mount
    echo "app_nuker_debug: post-fs-data: mounting with mountify standalone script..." >> /dev/kmsg
    if [ "$magic_mount" = true ]; then
        # if magic mount manager
        . $MODDIR/mountify.sh
    elif [ "$magic_mount" = false ]; then
        # if overlayfs manager
        . $MODDIR/mountify-symlink.sh
    fi
else
    echo "app_nuker_debug: post-fs-data: default/legacy mounting mode..." >> /dev/kmsg
    rm -f "$MODDIR/skip_mount"
    rm -f "$MODDIR/skip_mountify"
fi

# Detect current manager
[ ! "$APATCH" = "true" ] && [ ! "$KSU" = "true" ] && MANAGER="MAGISK"
[ "$KSU" = "true" ] && MANAGER="KSU"
[ "$APATCH" = "true" ] && MANAGER="APATCH"
set_config current_manager $MANAGER

# EOF
