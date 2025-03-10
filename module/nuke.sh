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

# import mounting system config
MAGIC_MOUNT=true
[ -f "$PERSIST_DIR/module_system.sh" ] && . "$PERSIST_DIR/module_system.sh"

# special dirs
# handle this properly so this script can be used standalone
# so yeah, symlinks.
IFS="
"
targets="odm
product
system_ext
vendor"

handle_symlink() {
    if [ "$MAGIC_MOUNT" = true ]; then
        # handle magic mount
        if [ -d /$1 ] && [ ! -L /$1 ] && [ -d "$MODULES_UPDATE_DIR/system/$1" ]; then
            if [ -L "$MODULES_UPDATE_DIR/$1" ]; then
                # Check if the symlink points to the correct location
                if [ $(readlink -f $MODULES_UPDATE_DIR/$1) != $(realpath $MODULES_UPDATE_DIR/system/$1) ]; then
                    echo "[!] Incorrect symlink for /$1, fixing..."
                    rm -f $MODULES_UPDATE_DIR/$1
                    ln -sf ./system/$1 $MODULES_UPDATE_DIR/$1
                else
                    echo "[+] Symlink for /$1 is correct, skipping..."
                fi
            else
                echo "[+] Creating symlink for /$1"
                ln -sf ./system/$1 $MODULES_UPDATE_DIR/$1
            fi
        fi
    else
        # handle overlayfs
        if [ ! -d "$MODULES_UPDATE_DIR/system/$1" ]; then
            # No partition found in the module update directory
            return
        fi

        if [ -L "/system/$1" ] && [ "$(readlink -f /system/$1)" = "/$1" ]; then
            echo "[*] Handling partition /$1"

            # Move out of system/ to avoid being overlaid
            [ -e "$MODULES_UPDATE_DIR/$1" ] && rm -rf "$MODULES_UPDATE_DIR/$1"
            mv -f "$MODULES_UPDATE_DIR/system/$1" "$MODULES_UPDATE_DIR/$1"

            # Create a relative symlink
            ln -sf ../$1 "$MODULES_UPDATE_DIR/system/$1"
        fi
    fi
}

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
    for apk_path in $(grep -E '"app_path":' "$REMOVE_LIST" | sed 's/.*"app_path": "\(.*\)",/\1/'); do
        # Create whiteout for apk_path
        whiteout_create_systemapp "$(dirname $apk_path)" > /dev/null 2>&1
        ls "$MODULES_UPDATE_DIR$apk_path" 2>/dev/null
    done
}

# skip symlink on installation
[ "$1" = "skip_symlink" ] && skip_symlink=true || skip_symlink=false

# revamped routine
# here we copy over all the module files to modules_update folder.
# this is better than deleting system over and over
# also this way manager handles the update.
# this can avoid persistence issues too

# flag module for update
# check if module already flagged for update
if [ ! -f "$MODDIR/update" ]; then
    echo "[+] Flagging module for update..."
    if [ "$MAGIC_MOUNT" = true ]; then
        touch "$MODDIR/update"
    elif [ -n $KSU ]; then
        ksud module install "$MODDIR/dummy.zip"
    elif [ -n "$APATCH" ]; then
        apd module install "$MODDIR/dummy.zip"
    fi
else
    echo "[-] Module already flagged for update, skipping..."
fi

# create folder if it doesnt exist
[ ! -d "$MODULES_UPDATE_DIR" ] && mkdir -p "$MODULES_UPDATE_DIR"
busybox chcon --reference="/system" "$MODULES_UPDATE_DIR"
cp -Lrf "$MODDIR"/* "$MODULES_UPDATE_DIR"

# cleanup all old setup
for dir in system system_ext vendor product; do
    rm -rf "$MODULES_UPDATE_DIR/$dir"
done
nuke_system_apps

# handle symlink and hierarchy
if [ ! "$skip_symlink" = true ]; then
    for dir in $targets; do
        handle_symlink "$dir"
    done
fi

# no need check before touch and rm, no stderr
rm "$MODULES_UPDATE_DIR/update"

# EOF
