#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
PERSIST_DIR="/data/adb/system_app_nuker"
REMOVE_LIST="$PERSIST_DIR/nuke_list.json"

# special dirs
# handle this properly so this script can be used standalone
# so yeah, symlinks.
IFS="
"
targets="odm
product
system_ext
vendor"

# args handling
[ "$1" = "update" ] && update=true || update=false

# lets have customize.sh of dummy.zip call us.
if [ ! "$DUMMYZIP" = "true" ] && [ ! "$update" = true ]; then
    if command -v apd; then
        apd module install "$MODDIR/dummy.zip"
    elif command -v ksud; then
        ksud module install "$MODDIR/dummy.zip"
    elif command -v magisk; then
        magisk --install-module "$MODDIR/dummy.zip"
    else
        echo "am I trippin or you are using some unknown root manager?"
    fi
    exit 0
fi

whiteout_create_systemapp() {
    path="$1"
    echo "$path" | grep -q "/system/" || path="/system$1"
    mkdir -p "$MODULES_UPDATE_DIR${path%/*}"
    chmod 755 "$MODULES_UPDATE_DIR${path%/*}"
    busybox mknod "$MODULES_UPDATE_DIR$path" c 0 0
    busybox chcon --reference="/system" "$MODULES_UPDATE_DIR$path"
    # not really required, mountify() does NOT even copy the attribute but ok
    busybox setfattr -n trusted.overlay.whiteout -v y "$MODULES_UPDATE_DIR$path"
    chmod 644 "$MODULES_UPDATE_DIR$path"
}

nuke_system_apps() {
    # first, remove any updates for the apps being nuked
    for package_name in $(grep -E '"package_name":' "$REMOVE_LIST" | sed 's/.*"package_name": "\(.*\)",/\1/'); do
        if pm list packages | grep -qx "package:$package_name"; then
            pm uninstall-system-updates "$package_name" >/dev/null 2>&1 || true
        fi
    done

    for apk_path in $(grep -E '"app_path":' "$REMOVE_LIST" | sed 's/.*"app_path": "\(.*\)",/\1/'); do
        # Create whiteout for apk_path
        whiteout_create_systemapp "$(dirname $apk_path)" > /dev/null 2>&1
        ls "$MODULES_UPDATE_DIR$apk_path" 2>/dev/null
    done
}

# revamped routine
# here we copy over all the module files to modules_update folder.
# this is better than deleting system over and over
# also this way manager handles the update.
# this can avoid persistence issues too

# create folder if it doesnt exist and copy selinux context
[ ! -d "$MODULES_UPDATE_DIR" ] && mkdir -p "$MODULES_UPDATE_DIR"
busybox chcon --reference="/system" "$MODULES_UPDATE_DIR"

# if not update
if [ "$update" != true ]; then
    # copy module content
    cp -Lrf "$MODDIR"/* "$MODULES_UPDATE_DIR"
    # flag module for update
    # check if module already flagged for update
    [ ! -f "$MODDIR/update" ] && touch "$MODDIR/update"
fi

# cleanup all old setup
for item in system system_ext vendor product update; do
    rm -rf "$MODULES_UPDATE_DIR/$item"
done

nuke_system_apps

# EOF
