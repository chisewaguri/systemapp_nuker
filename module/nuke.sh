#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${MODDIR:-/data/adb/modules/system_app_nuker}"
MODULE_UPDATE_DIR="${MODULE_UPDATE_DIR:-/data/adb/modules_update/system_app_nuker}"
PERSIST_DIR="${PERSIST_DIR:-/data/adb/system_app_nuker}"
# nuke_list.txt is "<pkg> <path> <label>". pm path cant see nuked apps
# (theyre hidden by whiteouts), so the saved path is reused when pm fails
REMOVE_LIST="${REMOVE_LIST:-$PERSIST_DIR/nuke_list.txt}"

# import config
uninstall_only_mode="false"
CONFIG_FILE="${CONFIG_FILE:-$PERSIST_DIR/config.sh}"
[ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE"

# special dirs
# handle this properly so this script can be used standalone
# so yeah, symlinks.
IFS="
"
# vendor partitions
targets="
mi_ext
my_bigball
my_carrier
my_company
my_engineering
my_heytap
my_manifest
my_preload
my_product
my_region
my_reserve
my_stock"

# args handling
[ "$1" = "update" ] && update=true || update=false

# ----- functions -----

# whiteout creator
whiteout_create() {
    path="$1"
    echo "$path" | grep -q "^/system/" || path="/system$1"
    target="$MODULE_UPDATE_DIR$path"
    mkdir -p "${target%/*}" || return 1
    chmod 755 "${target%/*}" || return 1
    rm -f "$target"
    if ! busybox mknod "$target" c 0 0; then
        echo "failed to create whiteout: $path" >&2
        return 1
    fi
    busybox chcon --reference="/system" "$target" || true
    # not really required, mountify() does NOT even copy the attribute but ok
    busybox setfattr -n trusted.overlay.whiteout -v y "$target" || true
    chmod 644 "$target" || return 1
}

normalize_whiteout_path() {
    case "$1" in
        /system/*) echo "$1" ;;
        /*) echo "/system$1" ;;
        *) echo "/system/$1" ;;
    esac
}

append_line() {
    file="$1"
    line="$2"
    [ -s "$file" ] && [ "$(tail -c 1 "$file" | wc -l)" -eq 0 ] && echo >> "$file"
    echo "$line" >> "$file"
}

whiteout_has_saved_path() {
    target="$1"
    [ -f "$REMOVE_LIST" ] || return 1
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        saved_path=$(echo "$line" | awk '{print $2}')
        echo "$saved_path" | grep -q '^/' || continue
        [ "$(normalize_whiteout_path "$(dirname "$saved_path")")" = "$target" ] && return 0
    done < "$REMOVE_LIST"
    return 1
}

whiteout_is_raw() {
    target="$1"
    [ -f "$PERSIST_DIR/raw_whiteouts.txt" ] || return 1
    while IFS= read -r raw_path || [ -n "$raw_path" ]; do
        case "$raw_path" in
            ""|\#*) continue ;;
        esac
        [ "$(normalize_whiteout_path "$raw_path")" = "$target" ] && return 0
    done < "$PERSIST_DIR/raw_whiteouts.txt"
    return 1
}

# keep the whiteouts that are already active during a module update
preserve_whiteouts() {
    for old_whiteout in $(find "$MODDIR" -type c 2>/dev/null); do
        whiteout=$(normalize_whiteout_path "${old_whiteout#"$MODDIR"}")
        whiteout_create "$whiteout" > /dev/null || return 1
        if ! whiteout_has_saved_path "$whiteout" && ! whiteout_is_raw "$whiteout" && ! grep -Fqx "# legacy-whiteout $whiteout" "$REMOVE_LIST" 2>/dev/null; then
            append_line "$REMOVE_LIST" "# legacy-whiteout $whiteout"
        fi
    done
}

# update from saved paths without asking pm about apps it cant see
nuke_saved_apps() {
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        saved_path=$(echo "$line" | awk '{print $2}')
        echo "$saved_path" | grep -q "^/" || continue
        whiteout_create "$(dirname "$saved_path")" > /dev/null || return 1
    done < "$REMOVE_LIST"
}

nuke_legacy_whiteouts() {
    [ -f "$REMOVE_LIST" ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            "# legacy-whiteout "*)
                whiteout_create "${line#\# legacy-whiteout }" > /dev/null || return 1
                ;;
        esac
    done < "$REMOVE_LIST"
}

check_legacy_restores() {
    [ -f "$REMOVE_LIST.old" ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        package_name=$(echo "$line" | awk '{print $1}')
        saved_path=$(echo "$line" | awk '{print $2}')
        echo "$saved_path" | grep -q '^/' && continue
        if ! awk -v pkg="$package_name" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null; then
            echo "cant restore $package_name because its old path wasnt saved" >&2
            return 1
        fi
    done < "$REMOVE_LIST.old"
}

# fill missing paths while newly selected apps are still visible
prepare_nuke_list() {
    check_legacy_restores || return 1
    [ -s "$REMOVE_LIST" ] || return 0

    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) echo "$line"; continue ;;
        esac

        package_name=$(echo "$line" | awk '{print $1}')
        saved_path=$(echo "$line" | awk '{print $2}')
        echo "$saved_path" | grep -q "^/" && { echo "$line"; continue; }

        label=$(echo "$line" | sed 's/^[^ ]* *//')
        apk_path=$(pm path "$package_name" | head -n1 | sed 's/package://')
        if echo "$apk_path" | grep -q '^/data/app' && pm list packages -s | grep -qx "package:$package_name"; then
            pm uninstall-system-updates "$package_name" >/dev/null 2>&1 || true
            apk_path=$(pm path "$package_name" | head -n1 | sed 's/package://')
        fi

        if [ -z "$apk_path" ]; then
            if [ -f "$REMOVE_LIST.old" ] && awk -v pkg="$package_name" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST.old"; then
                echo "$package_name  $label"
                continue
            fi
            echo "cant find apk path for $package_name" >&2
            rm -f "$REMOVE_LIST.tmp"
            return 1
        fi
        if echo "$apk_path" | grep -q '^/data/app'; then
            echo "cant find system apk for $package_name" >&2
            rm -f "$REMOVE_LIST.tmp"
            return 1
        fi

        echo "$package_name $apk_path $label"
    done < "$REMOVE_LIST" > "$REMOVE_LIST.tmp" || return 1

    if [ -f "$REMOVE_LIST.old" ]; then
        while IFS= read -r metadata || [ -n "$metadata" ]; do
            case "$metadata" in
                "# legacy-whiteout "*) grep -Fqx "$metadata" "$REMOVE_LIST.tmp" || echo "$metadata" >> "$REMOVE_LIST.tmp" ;;
            esac
        done < "$REMOVE_LIST.old"
    fi

    mv -f "$REMOVE_LIST.tmp" "$REMOVE_LIST"
}

# nuke app from REMOVE_LIST
nuke_system_apps() {
    total=$(grep -Ev "^$|^#" "$REMOVE_LIST" | wc -l)

    # remove any updates for the apps being nuked
    for package_name in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
        # check if it's a system app that has been updated
        if pm list packages -s | grep -qx "package:$package_name" && pm path "$package_name" | grep -q "/data/app"; then
            pm uninstall-system-updates "$package_name" >/dev/null 2>&1 || true
        fi
    done

    if [ "$uninstall_only_mode" = "true" ]; then
        for package_name in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
            pm uninstall --user 0 "$package_name" >/dev/null 2>&1 || true
        done
    else
        # whiteout creation. the list is "<pkg> <path> <label>" — rewrite it
        # with fresh paths when pm can see the app, keep the saved path
        # otherwise (nuked apps are hidden by whiteouts so pm fails)
        # webui writes the list without a trailing newline, append one or the
        # last app never gets processed
        while IFS= read -r line || [ -n "$line" ]; do
            case "$line" in
                ""|\#*) echo "$line"; continue ;;
            esac
            package_name=$(echo "$line" | awk '{print $1}')
            saved_path=$(echo "$line" | awk '{print $2}')
            if echo "$saved_path" | grep -q "^/"; then
                # drop pkg and path, the rest is label
                label=$(echo "$line" | sed 's/^[^ ]* [^ ]* *//')
            else
                # no path column yet, everything after pkg is label
                label=$(echo "$line" | sed 's/^[^ ]* *//')
                saved_path=""
            fi
            apk_path=$(pm path "$package_name" | head -n1 | sed "s/package://")
            [ "$apk_path" = "" ] && apk_path="$saved_path"
            if [ "$apk_path" != "" ]; then
                if ! whiteout_create "$(dirname "$apk_path")" > /dev/null; then
                    rm -f "$REMOVE_LIST.tmp"
                    return 1
                fi
                ls "$MODULE_UPDATE_DIR$apk_path" 2>/dev/null
            fi
            echo "$package_name $apk_path $label"
        done < "$REMOVE_LIST" > "$REMOVE_LIST.tmp"
        mv -f "$REMOVE_LIST.tmp" "$REMOVE_LIST"
    fi

    # when uninstall_only_mode=true and restore_success=false means user has enabled uninstall only mode
    #but the last nuked app doens't exist yet
    # this means a reboot is required to restore first then only pm install-existing can work immediately
    # showing "Uninstall only mode detected" to stdout allows webui to skip the reboot button
    restore_success="true"
    if [ -f "$REMOVE_LIST.old" ]; then
        for pkg in $(grep -Ev "^$|^#" "$REMOVE_LIST.old" | awk '{print $1}'); do
            awk -v pkg="$pkg" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null && continue
            pm install-existing "$pkg" >/dev/null 2>&1 || restore_success="false"
            pm enable "$pkg" >/dev/null 2>&1 || restore_success="false"
        done
    fi
    if [ "$uninstall_only_mode" = "true" ] && [ "$restore_success" = "true" ]; then
        echo "[-] Uninstall only mode detected"
        [ -f "$REMOVE_LIST" ] && cp -f "$REMOVE_LIST" "$REMOVE_LIST".old
    fi

    echo "[-] Nuking complete: $total apps processed"
}

# this function install dummy.zip
# dummy.zip would call this script again
install_dummy() {
    case $current_manager in
        APATCH)
            apd module install "$MODDIR/dummy.zip" && installed=true
            ;;
        KSU)
            ksud module install "$MODDIR/dummy.zip" && installed=true
            ;;
        MAGISK)
            magisk --install-module "$MODDIR/dummy.zip" && installed=true
            ;;
        *)
            echo "am I trippin or you are using some unknown root manager?"
            return 1
            ;;
    esac

    # verify installation
    if [ "$installed" = true ]; then
        return 0
    else
        echo "dummy installation failed" >&2
        return 1
    fi
}

# ----- if called from webui -----

# lets have customize.sh of dummy.zip call us.
if [ ! "$DUMMYZIP" = "true" ] && [ ! "$update" = true ]; then
    prepare_nuke_list || exit 1
    # install dummy.zip
    install_dummy
    exit $?
fi

# ----- main script -----
# revamped routine
# here we copy over all the module files to modules_update folder.
# this is better than deleting system over and over
# also this way manager handles the update.
# this can avoid persistence issues too

# create folder if it doesnt exist and copy selinux context
if [ ! -d "$MODULE_UPDATE_DIR" ]; then
    mkdir -p "$MODULE_UPDATE_DIR" || exit 1
fi
busybox chcon --reference="/system" "$MODULE_UPDATE_DIR" || true

# if not update
if [ "$update" != true ]; then
    # copy module content, this also copy all scripts and module.prop
    # only copy content if module files was not copied yet
    # this ensure updated files are not overwritten
    if [ ! -f "$MODULE_UPDATE_DIR/nuke.sh" ]; then
        cp -Lrf "$MODDIR"/* "$MODULE_UPDATE_DIR" || exit 1
    fi

    # flag module for update
    # check if module already flagged for update
    [ ! -f "$MODDIR/update" ] && touch "$MODDIR/update"
fi

# cleanup all old setup
for item in system system_ext vendor product update; do
    rm -rf "$MODULE_UPDATE_DIR/$item"
done

# manager updates keep the active whiteouts as-is. package manager cant see
# the apps anymore and old 2.0 lists dont have their paths
if [ "$update" = true ] && [ "$uninstall_only_mode" != "true" ]; then
    preserve_whiteouts || exit 1
    if [ -s "$REMOVE_LIST" ]; then
        nuke_saved_apps || exit 1
    fi
elif [ -s "$REMOVE_LIST" ]; then
    nuke_system_apps || exit 1
fi
if [ "$uninstall_only_mode" != "true" ]; then
    nuke_legacy_whiteouts || exit 1
fi

# handle raw whiteout
if [ -f "$PERSIST_DIR/raw_whiteouts.txt" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        whiteout_create "$line" > /dev/null || exit 1
        ls "$MODULE_UPDATE_DIR$line" 2>/dev/null
    done < "$PERSIST_DIR/raw_whiteouts.txt"
fi

# handle vendor partitions
for part in $targets; do
    if [ -d "$MODULE_UPDATE_DIR/system/$part" ] && [ ! -L "/$part" ]; then
        echo "[-] Handling partition /$part"
        mv -f "$MODULE_UPDATE_DIR/system/$part" "$MODULE_UPDATE_DIR/$part" || exit 1
        ln -sf "../$part" "$MODULE_UPDATE_DIR/system/$part" || exit 1
    fi
done

# EOF
