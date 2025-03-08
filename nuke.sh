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

# revamped routine
# here we copy over all the module files to modules_update folder.
# this is better than deleting system over and over
# also this way manager handles the update.
# this can avoid persistence issues too

# create folder if it doesnt exist
[ ! -d "$MODULES_UPDATE_DIR" ] && mkdir -p "$MODULES_UPDATE_DIR"
busybox chcon --reference="/system" "$MODULES_UPDATE_DIR"

whiteout_create_systemapp() {
	path="$1"
	echo "$path" | grep -q "system" || path="/system$1"
	mkdir -p "$MODULES_UPDATE_DIR${path%/*}"
  	busybox mknod "$MODULES_UPDATE_DIR$path" c 0 0
  	busybox chcon --reference="/system" "$MODULES_UPDATE_DIR$path"
  	# not really required, mountify() does NOT even copy the attribute but ok
  	busybox setfattr -n trusted.overlay.whiteout -v y "$MODULES_UPDATE_DIR$path"
  	chmod 644 "$MODDIR$path"
}

nuke_system_apps() {
	for apk_path in $(grep -E '"app_path":' "$REMOVE_LIST" | sed 's/.*"app_path": "\(.*\)",/\1/'); do
		# Skip if the it already exists in modules_update
		if [ -e "$MODULES_UPDATE_DIR$apk_path" ] || [ -e "$MODULES_UPDATE_DIR/system$apk_path" ]; then
			continue
		fi
		# Create whiteout for apk_path
		whiteout_create_systemapp "$(dirname $apk_path)" > /dev/null 2>&1
		ls "$MODULES_UPDATE_DIR$apk_path" 2>/dev/null
	done

	# this assumes magic mount
	# handle overlayfs KSU later?
	for dir in $targets; do 
		if [ -d /$dir ] && [ ! -L /$dir ] && [ -d "$MODULES_UPDATE_DIR/system/$dir" ]; then
			if [ -L "$MODULES_UPDATE_DIR/$dir" ]; then
				# Check if the symlink points to the correct location
				if [ $(readlink -f $MODULES_UPDATE_DIR/$dir) != $(realpath $MODULES_UPDATE_DIR/system/$dir) ]; then
					echo "[!] Incorrect symlink for /$dir, fixing..."
					rm -f $MODULES_UPDATE_DIR/$dir
					ln -sf ./system/$dir $MODULES_UPDATE_DIR/$dir
				else
					echo "[+] Symlink for /$dir is correct, skipping..."
				fi
			else
				echo "[+] Creating symlink for /$dir"
				ln -sf ./system/$dir $MODULES_UPDATE_DIR/$dir
			fi
		fi
	done
}

restore_system_apps() {
	find "$MODULES_UPDATE_DIR/system" -type c -maxdepth 3 | while read -r nod; do
		nod_name=$(basename "$nod")
		if ! grep -q "/$nod_name/" "$REMOVE_LIST"; then
			rm -rf "$nod"
		fi
	done
	find $MODULES_UPDATE_DIR/system -type d -maxdepth 3 | while read -r dir; do
		if [ -z "$(ls -A "$dir")" ]; then
			rm -rf "$dir"
		fi
	done
	for dir in system_ext vendor odm product system; do
		[ -z "$(ls -A "$MODULES_UPDATE_DIR/$dir")" ] && rm -rf "$MODULES_UPDATE_DIR/$dir"
		[ -z "$(ls -A "$MODULES_UPDATE_DIR/system/$dir")" ] && rm -rf "$MODULES_UPDATE_DIR/system/$dir"
	done
}

touch "$MODDIR/update"

case "$1" in
	nuke)
		nuke_system_apps
		rm -rf "$MODDIR/system"
		cp -Lrf "$MODDIR"/* "$MODULES_UPDATE_DIR"
		;;
	restore)
		cp -Lrf "$MODDIR"/* "$MODULES_UPDATE_DIR"
		restore_system_apps
		rm -rf "$MODDIR/system"
		;;
esac

# EOF
