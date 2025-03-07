#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
TEXTFILE="$MODDIR/nuke_list.json"

# revamped routine
# here we copy over all the module files to modules_update folder.
# this is better than deleting system over and over
# also this way manager handles the update.
# this can avoid persistence issues too

# create folder if it doesnt exist
[ ! -d "$MODULES_UPDATE_DIR" ] && mkdir -p "$MODULES_UPDATE_DIR"
busybox chcon --reference="/system" "$MODULES_UPDATE_DIR"

whiteout_create_systemapp() {
	mkdir -p "$MODULES_UPDATE_DIR${1%/*}"
	rm -rf "$MODULES_UPDATE_DIR${1%/*}"
  	busybox mknod "$MODULES_UPDATE_DIR${1%/*}" c 0 0
  	busybox chcon --reference="/system" "$MODULES_UPDATE_DIR$1"  
  	# not really required, mountify() does NOT even copy the attribute but ok
  	busybox setfattr -n trusted.overlay.whiteout -v y "$MODULES_UPDATE_DIR$1"
  	chmod 644 "$MODDIR$1"
}

for apk_path in $(grep -E '"app_path":' "$TEXTFILE" | sed 's/.*"app_path": "\(.*\)",/\1/'); do
	# Create whiteout for apk_path
	whiteout_create_systemapp "$(dirname $apk_path)" > /dev/null 2>&1
	ls "$MODULES_UPDATE_DIR$line" 2>/dev/null
done

for package_name in $(grep -E '"package_name":' "$TEXTFILE" | sed 's/.*"package_name": "\(.*\)",/\1/'); do
	if pm list packages | grep -qx "$package_name"; then
		pm uninstall -k --user 0 "$package_name" 2>/dev/null
	fi
done

# special dirs
# handle this properly so this script can be used standalone
# so yeah, symlinks.
IFS="
"
targets="odm
product
system_ext
vendor"

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

# now we copy over everything from MODDIR to MODULES_UPDATE_DIR
# the asterisk is important!!
cp -Lrf "$MODDIR"/* "$MODULES_UPDATE_DIR"

# now we flag old module for update
touch "$MODDIR/update"

# EOF
