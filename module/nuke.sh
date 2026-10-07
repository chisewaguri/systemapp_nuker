#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
MODULE_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
# nuke_list.txt is "<pkg> <path> <label>". pm path cant see nuked apps
# (theyre hidden by whiteouts), so the saved path is reused when pm fails
REMOVE_LIST="${REMOVE_LIST:-$PERSIST_DIR/nuke_list.txt}"
PM_UNINSTALLED="$PERSIST_DIR/pm_uninstalled.txt"

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
odm
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
    case "$path" in
        /data|/data/*|/system/data|/system/data/*)
            echo "whiteouts cannot target /data: $path" >&2
            return 1
            ;;
    esac
    case "/$path/" in
        */../*|*/./*)
            echo "invalid whiteout path: $path" >&2
            return 1
            ;;
    esac
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

is_apk_path() {
    case "$1" in
        /data/app/*) return 1 ;;
        /*.apk) return 0 ;;
        *) return 1 ;;
    esac
}

# sets package_name, saved_path and label from a "<pkg> <path> <label>" line.
# lines from before 2.1 have no path column, so everything after pkg is label.
# old versions could save a bad path, keep it out of the label.
parse_list_line() {
    package_name=$(echo "$1" | awk '{print $1}')
    saved_path=$(echo "$1" | awk '{print $2}')
    if is_apk_path "$saved_path"; then
        label=$(echo "$1" | sed 's/^[^ ]* [^ ]* *//')
    elif echo "$saved_path" | grep -q '^/'; then
        label=$(echo "$1" | sed 's/^[^ ]* [^ ]* *//')
        saved_path=""
    else
        label=$(echo "$1" | sed 's/^[^ ]* *//')
        saved_path=""
    fi
}

get_apk_path() {
    pm path "$1" </dev/null 2>/dev/null |
        sed -n 's|^package:\(/.*\.apk\)$|\1|p' |
        head -n1
}

get_factory_apk_path() {
    pm list packages -f -s -u --factory-only "$1" </dev/null 2>/dev/null |
        awk -F= -v pkg="$1" '$NF == pkg {
            sub(/^package:/, "", $1)
            if ($1 ~ /^\/.*\.apk$/) {
                print $1
                exit
            }
        }'
}

# a restore drops the line, so re-nuking before the reboot needs the path
# from the boot snapshot, since the old whiteout still hides the app from pm
old_apk_path() {
    [ -f "$REMOVE_LIST.old" ] || return 0
    awk -v pkg="$1" '$1 == pkg && $2 ~ /^\/.*\.apk$/ && $2 !~ /^\/data\// { print $2; exit }' "$REMOVE_LIST.old"
}

uninstall_for_user() {
    package_name="$1"
    pm list packages "$package_name" </dev/null 2>/dev/null | grep -qx "package:$package_name" || return 0
    pm uninstall --user 0 "$package_name" </dev/null >/dev/null 2>&1
}

# reinstall apps pm uninstalled earlier that are no longer in the list. they are not in
# .old yet, so the usual restore skips them.
reinstall_unlisted() {
    [ -f "$PM_UNINSTALLED" ] || return 0
    for pkg in $(cat "$PM_UNINSTALLED"); do
        awk -v pkg="$pkg" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null && continue
        pm install-existing "$pkg" </dev/null >/dev/null 2>&1
    done
}

# uninstall listed apps for user 0 so they disappear before the reboot. -k keeps their
# data, like a whiteout does. the whiteout takes over at boot.
pm_uninstall_listed() {
    for pkg in $(grep -Ev "^$|^#" "$REMOVE_LIST" 2>/dev/null | awk '{print $1}'); do
        pm list packages "$pkg" </dev/null 2>/dev/null | grep -qx "package:$pkg" || continue
        pm uninstall -k --user 0 "$pkg" </dev/null >/dev/null 2>&1 && echo "$pkg" >> "$PM_UNINSTALLED"
    done
}

replace_file() {
    source_file="$1"
    target_file="$2"
    temp_file="$target_file.tmp.$$"
    if [ -f "$source_file" ]; then
        cp -f "$source_file" "$temp_file" || { rm -f "$temp_file"; return 1; }
    else
        : > "$temp_file" || return 1
    fi
    mv -f "$temp_file" "$target_file" || { rm -f "$temp_file"; return 1; }
}

whiteout_has_saved_path() {
    target="$1"
    [ -f "$REMOVE_LIST" ] || return 1
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        saved_path=$(echo "$line" | awk '{print $2}')
        is_apk_path "$saved_path" || continue
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

raw_whiteout_was_restored() {
    restore_target="$1"
    [ -f "$PERSIST_DIR/raw_whiteouts.txt.old" ] || return 1
    while IFS= read -r old_raw_path || [ -n "$old_raw_path" ]; do
        case "$old_raw_path" in
            ""|\#*) continue ;;
        esac
        [ "$(normalize_whiteout_path "$old_raw_path")" = "$restore_target" ] || continue
        whiteout_is_raw "$restore_target" && return 1
        return 0
    done < "$PERSIST_DIR/raw_whiteouts.txt.old"
    return 1
}

whiteout_was_restored() {
    restore_target="$1"
    [ -f "$REMOVE_LIST.old" ] || return 1
    while IFS= read -r old_line || [ -n "$old_line" ]; do
        case "$old_line" in
            ""|\#*) continue ;;
        esac
        old_package_name=$(echo "$old_line" | awk '{print $1}')
        old_saved_path=$(echo "$old_line" | awk '{print $2}')
        is_apk_path "$old_saved_path" || continue
        [ "$(normalize_whiteout_path "$(dirname "$old_saved_path")")" = "$restore_target" ] || continue
        awk -v pkg="$old_package_name" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null || return 0
    done < "$REMOVE_LIST.old"
    return 1
}

# a whiteout with no owner hid a pre-2.1 app whose path couldnt be recovered.
# dropping it lets service.sh uninstall that app for user 0 at boot.
preserve_whiteouts() {
    for old_whiteout in $(find "$MODDIR" -type c 2>/dev/null); do
        whiteout=$(normalize_whiteout_path "${old_whiteout#"$MODDIR"}")
        raw_whiteout_was_restored "$whiteout" && continue
        whiteout_was_restored "$whiteout" && continue
        whiteout_has_saved_path "$whiteout" || whiteout_is_raw "$whiteout" || continue
        whiteout_create "$whiteout" > /dev/null || return 1
    done
}

# update from saved paths without asking pm about apps it cant see
nuke_saved_apps() {
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) continue ;;
        esac
        package_name=$(echo "$line" | awk '{print $1}')
        saved_path=$(echo "$line" | awk '{print $2}')
        is_apk_path "$saved_path" && { whiteout_create "$(dirname "$saved_path")" > /dev/null || return 1; }
        # with the system apk hidden, a /data/app update is a plain user app
        if ! is_apk_path "$saved_path" || get_apk_path "$package_name" | grep -q '^/data/app'; then
            uninstall_for_user "$package_name" || return 1
        fi
    done < "$REMOVE_LIST"
}

# android drops a hidden system app from packages.xml, but its package parser
# cache entry stays. it holds the package name, then the apk path prefixed by
# its length, and that length shows up as one printable char when it falls in
# range. the format is internal and an OTA can wipe it, so a package found
# nowhere or at two system paths gets no path.
# reading every cache file takes about 20s for 660 apps, and only runs on update
cached_apk_paths() {
    for cache in /data/system/package_cache/*/*; do
        [ -f "$cache" ] || continue
        tr -d '\000' < "$cache" | tr -c 'A-Za-z0-9._/-' '\n' |
            awk -v want="$1" '
                BEGIN {
                    n = split(want, w, " "); for (i = 1; i <= n; i++) wanted[w[i]] = 1
                    for (i = 32; i < 127; i++) chr[i] = sprintf("%c", i)
                }
                /\/[A-Za-z0-9._\/-]*\.apk$/ {
                    i = index($0, "/")
                    head = substr($0, 1, i - 1)
                    apk = substr($0, i)
                    # a 47 char path has "/" as its length char, so it looks like "//..."
                    if (substr(apk, 2, 1) == "/") apk = substr(apk, 2)
                    else if (head != "" && substr(head, length(head)) == chr[length(apk)]) head = substr(head, 1, length(head) - 1)
                    if (head == "") head = prev
                    if (head in wanted) print head " " apk
                    exit
                }
                NF { prev = $0 }'
    done | sort -u | awk '$2 !~ /^\/data\// { n[$1]++; path[$1] = $2 } END { for (p in n) if (n[p] == 1) print p " " path[p] }'
}

# pre-2.1 lists have no apk path, and pm cant report it once a whiteout hides
# the app. without one, the app can only be uninstalled for user 0.
recover_legacy_paths() {
    pathless=$(cat "$REMOVE_LIST" "$REMOVE_LIST.old" 2>/dev/null | grep -Ev '^$|^#' |
        awk '$2 !~ /^\/.*\.apk$/ || $2 ~ /^\/data\// { print $1 }' | sort -u | tr '\n' ' ')
    [ -n "$pathless" ] || return 0
    found=$(cached_apk_paths "$pathless" | tr '\n' ' ')
    [ -n "$found" ] || return 0
    for list in "$REMOVE_LIST" "$REMOVE_LIST.old"; do
        [ -f "$list" ] || continue
        list_tmp="$list.recover.$$"
        awk -v found="$found" '
            BEGIN { n = split(found, f, " "); for (i = 1; i < n; i += 2) path[f[i]] = f[i + 1] }
            /^$/ || /^#/ || !($1 in path) || ($2 ~ /^\/.*\.apk$/ && $2 !~ /^\/data\//) { print; next }
            {
                label = $0
                sub(/^[^ ]* */, "", label)
                if ($2 ~ /^\//) sub(/^[^ ]* */, "", label)
                print $1 " " path[$1] " " label
            }' "$list" > "$list_tmp" || { rm -f "$list_tmp"; return 1; }
        mv -f "$list_tmp" "$list" || { rm -f "$list_tmp"; return 1; }
    done
}

# fill missing paths while newly selected apps are still visible
prepare_nuke_list() {
    [ -s "$REMOVE_LIST" ] || return 0
    list_tmp="$REMOVE_LIST.tmp.$$"

    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ""|\#*) echo "$line" || { rm -f "$list_tmp"; return 1; }; continue ;;
        esac

        parse_list_line "$line"
        [ -n "$saved_path" ] || saved_path=$(old_apk_path "$package_name")
        apk_path=$(get_apk_path "$package_name")
        factory_path=""
        if echo "$apk_path" | grep -q '^/data/app' || [ -z "$saved_path" ]; then
            factory_path=$(get_factory_apk_path "$package_name")
            is_apk_path "$factory_path" && saved_path="$factory_path"
        fi
        if echo "$apk_path" | grep -q '^/data/app' && pm list packages -s </dev/null | grep -qx "package:$package_name"; then
            if [ "$update" = true ]; then
                pm uninstall-system-updates "$package_name" </dev/null >/dev/null 2>&1 || true
                apk_path=$(get_apk_path "$package_name")
                if echo "$apk_path" | grep -q '^/data/app'; then
                    uninstall_for_user "$package_name" || { rm -f "$list_tmp"; return 1; }
                    apk_path=""
                fi
                [ -n "$apk_path" ] || apk_path="$saved_path"
            else
                if [ -n "$saved_path" ]; then
                    echo "$package_name $saved_path $label" || { rm -f "$list_tmp"; return 1; }
                else
                    echo "$package_name  $label" || { rm -f "$list_tmp"; return 1; }
                fi
                continue
            fi
        fi

        if [ -z "$apk_path" ]; then
            if [ -n "$saved_path" ]; then
                echo "$package_name $saved_path $label" || { rm -f "$list_tmp"; return 1; }
                continue
            fi
            if [ -f "$REMOVE_LIST.old" ] && awk -v pkg="$package_name" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST.old"; then
                echo "$package_name  $label" || { rm -f "$list_tmp"; return 1; }
                continue
            fi
            if [ "$update" = true ] && find "$MODDIR" -type c 2>/dev/null | grep -q .; then
                echo "$package_name  $label" || { rm -f "$list_tmp"; return 1; }
                continue
            fi
            echo "$package_name  $label" || { rm -f "$list_tmp"; return 1; }
            continue
        fi
        # the old whiteout hides the system apk, so pm only sees the /data/app update
        if echo "$apk_path" | grep -q '^/data/app'; then
            echo "$package_name $saved_path $label" || { rm -f "$list_tmp"; return 1; }
            continue
        fi

        echo "$package_name $apk_path $label" || { rm -f "$list_tmp"; return 1; }
    done < "$REMOVE_LIST" > "$list_tmp" || { rm -f "$list_tmp"; return 1; }

    mv -f "$list_tmp" "$REMOVE_LIST" || { rm -f "$list_tmp"; return 1; }
}

# nuke app from REMOVE_LIST
nuke_system_apps() {
    restore_success="true"
    total=$(grep -Ev "^$|^#" "$REMOVE_LIST" | wc -l)
    list_tmp="$REMOVE_LIST.tmp.$$"

    # remove any updates for the apps being nuked
    for package_name in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
        # check if it's a system app that has been updated
        if pm list packages -s </dev/null | grep -qx "package:$package_name" && get_apk_path "$package_name" | grep -q "/data/app"; then
            pm uninstall-system-updates "$package_name" </dev/null >/dev/null 2>&1 || true
        fi
    done

    if [ "$uninstall_only_mode" = "true" ]; then
        for package_name in $(grep -Ev "^$|^#" "$REMOVE_LIST" | awk '{print $1}'); do
            pm uninstall --user 0 "$package_name" </dev/null >/dev/null 2>&1
            # already uninstalled apps fail too, so check the result instead
            if pm list packages "$package_name" </dev/null 2>/dev/null | grep -qx "package:$package_name"; then
                echo "cant uninstall $package_name" >&2
                restore_success="false"
            fi
        done
    else
        # whiteout creation. the list is "<pkg> <path> <label>" — rewrite it
        # with fresh paths when pm can see the app, keep the saved path
        # otherwise (nuked apps are hidden by whiteouts so pm fails)
        # webui writes the list without a trailing newline, append one or the
        # last app never gets processed
        while IFS= read -r line || [ -n "$line" ]; do
            case "$line" in
                ""|\#*) echo "$line" || { rm -f "$list_tmp"; return 1; }; continue ;;
            esac
            parse_list_line "$line"
            apk_path=$(get_apk_path "$package_name")
            if echo "$apk_path" | grep -q '^/data/app'; then
                factory_path=$(get_factory_apk_path "$package_name")
                is_apk_path "$factory_path" && saved_path="$factory_path"
                uninstall_for_user "$package_name" || { rm -f "$list_tmp"; return 1; }
                apk_path=""
            fi
            [ -n "$apk_path" ] || apk_path="$saved_path"
            if [ "$apk_path" != "" ]; then
                if ! whiteout_create "$(dirname "$apk_path")" > /dev/null; then
                    rm -f "$list_tmp"
                    return 1
                fi
                ls "$MODULE_UPDATE_DIR$apk_path" 2>/dev/null
            elif ! uninstall_for_user "$package_name"; then
                echo "cant uninstall $package_name" >&2
                rm -f "$list_tmp"
                return 1
            fi
            echo "$package_name $apk_path $label" || { rm -f "$list_tmp"; return 1; }
        done < "$REMOVE_LIST" > "$list_tmp" || { rm -f "$list_tmp"; return 1; }
        mv -f "$list_tmp" "$REMOVE_LIST" || { rm -f "$list_tmp"; return 1; }
    fi

    # when uninstall_only_mode=true and restore_success=false means user has enabled uninstall only mode
    #but the last nuked app doens't exist yet
    # this means a reboot is required to restore first then only pm install-existing can work immediately
    # showing "Uninstall only mode detected" to stdout allows webui to skip the reboot button
    if [ -f "$REMOVE_LIST.old" ]; then
        for pkg in $(grep -Ev "^$|^#" "$REMOVE_LIST.old" | awk '{print $1}'); do
            awk -v pkg="$pkg" '$1 == pkg { found=1 } END { exit !found }' "$REMOVE_LIST" 2>/dev/null && continue
            pm install-existing "$pkg" </dev/null >/dev/null 2>&1 || restore_success="false"
            pm enable "$pkg" </dev/null >/dev/null 2>&1 || restore_success="false"
        done
    fi
    if [ "$uninstall_only_mode" = "true" ] && [ "$restore_success" = "true" ]; then
        echo "[-] Uninstall only mode detected"
        [ ! -f "$REMOVE_LIST" ] || replace_file "$REMOVE_LIST" "$REMOVE_LIST.old" || return 1
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
        # managers apply modules_update at boot without the update flag, and kernelsu
        # will not open the webui while it exists
        rm -f "$MODDIR/update"
        return 0
    else
        echo "dummy installation failed" >&2
        return 1
    fi
}

# ----- if called from webui -----

# lets have customize.sh of dummy.zip call us.
if [ ! "$DUMMYZIP" = "true" ] && [ ! "$update" = true ]; then
    if prepare_nuke_list && install_dummy; then
        exit 0
    fi
    replace_file "$REMOVE_LIST.old" "$REMOVE_LIST" || exit 1
    replace_file "$PERSIST_DIR/raw_whiteouts.txt.old" "$PERSIST_DIR/raw_whiteouts.txt" || exit 1
    reinstall_unlisted
    exit 1
fi

if [ "$update" = true ]; then
    recover_legacy_paths || exit 1
    prepare_nuke_list || exit 1
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
for item in system system_ext vendor product update $targets; do
    rm -rf "$MODULE_UPDATE_DIR/$item"
done

if [ "$DUMMYZIP" = true ] && [ "$uninstall_only_mode" != "true" ]; then
    preserve_whiteouts || exit 1
fi
if [ "$update" = true ] && [ "$uninstall_only_mode" != "true" ]; then
    preserve_whiteouts || exit 1
    if [ -s "$REMOVE_LIST" ]; then
        nuke_saved_apps || exit 1
    fi
elif [ -s "$REMOVE_LIST" ]; then
    nuke_system_apps || exit 1
fi
if [ "$DUMMYZIP" = true ] && [ "$uninstall_only_mode" != "true" ]; then
    reinstall_unlisted
    pm_uninstall_listed
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
