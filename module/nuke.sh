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
REMOVE_LIST="$PERSIST_DIR/nuke_list.txt"

# import config
uninstall_only_mode="false"
[ -f "$PERSIST_DIR/config.sh" ] && . $PERSIST_DIR/config.sh

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
    mkdir -p "$MODULE_UPDATE_DIR${path%/*}"
    chmod 755 "$MODULE_UPDATE_DIR${path%/*}"
    busybox mknod "$MODULE_UPDATE_DIR$path" c 0 0
    busybox chcon --reference="/system" "$MODULE_UPDATE_DIR$path"
    # not really required, mountify() does NOT even copy the attribute but ok
    busybox setfattr -n trusted.overlay.whiteout -v y "$MODULE_UPDATE_DIR$path"
    chmod 644 "$MODULE_UPDATE_DIR$path"
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
        while IFS= read -r line; do
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
                whiteout_create "$(dirname $apk_path)" > /dev/null 2>&1
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
        for pkg in $(cat "$REMOVE_LIST.old" | grep -Fvxf "$REMOVE_LIST" | awk '{print $1}'); do
            pm install-existing "$pkg" >/dev/null 2>&1 || restore_success="false"
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
[ ! -d "$MODULE_UPDATE_DIR" ] && mkdir -p "$MODULE_UPDATE_DIR"
busybox chcon --reference="/system" "$MODULE_UPDATE_DIR"

# if not update
if [ "$update" != true ]; then
    # copy module content, this also copy all scripts and module.prop
    # only copy content if module files was not copied yet
    # this ensure updated files are not overwritten
    if [ ! -f "$MODULE_UPDATE_DIR/nuke.sh" ]; then
        cp -Lrf "$MODDIR"/* "$MODULE_UPDATE_DIR"
    fi

    # flag module for update
    # check if module already flagged for update
    [ ! -f "$MODDIR/update" ] && touch "$MODDIR/update"
fi

# cleanup all old setup
for item in system system_ext vendor product update; do
    rm -rf "$MODULE_UPDATE_DIR/$item"
done

# skip app whiteout creation when remove list is empty
if [ -s "$REMOVE_LIST" ]; then
    nuke_system_apps
fi

# handle raw whiteout
for line in $( sed '/#/d' "$PERSIST_DIR/raw_whiteouts.txt" ); do
	whiteout_create "$line" > /dev/null 2>&1 
	ls "$MODULE_UPDATE_DIR$line" 2>/dev/null
done

# handle vendor partitions
for part in $targets; do
    if [ -d "$MODULE_UPDATE_DIR/system/$part" ] && [ ! -L "/$part" ]; then
        echo "[-] Handling partition /$part"
        mv -f "$MODULE_UPDATE_DIR/system/$part" "$MODULE_UPDATE_DIR/$part"
        ln -sf "../$part" "$MODULE_UPDATE_DIR/system/$part"
    fi
done

# EOF
