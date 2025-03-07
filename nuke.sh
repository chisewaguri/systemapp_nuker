#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.

PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
MODULE_UPDATES_DIR="/data/adb/modules_update/nuke"
MODULE_DIR="/data/adb/modules/nuke"
TEXTFILE="$MODDIR/nuke_list.txt"

# check for module dir
if [ -d "$MODULE_DIR" ]; then
	cp "$MODULE_DIR" "$MODULE_UPDATE_DIR"
else
	mkdir -p $MODULE_DIR
fi

# mark module for update
touch $MODULE_DIR/update
# create 
mkdir -p $MODULE_UPDATES_DIR ; cd $MODULE_UPDATES_DIR
busybox chcon --reference="/system" "$MODULE_UPDATES_DIR"

whiteout_create_systemapp() {
	echo "$MODULE_UPDATES_DIR${1%/*}"
	echo "$MODULE_UPDATES_DIR$1" 
	mkdir -p "$MODULE_UPDATES_DIR${1%/*}"
	rm -rf "$MODULE_UPDATES_DIR${1%/*}"
  	busybox mknod "$MODULE_UPDATES_DIR${1%/*}" c 0 0
  	busybox chcon --reference="/system" "$MODULE_UPDATES_DIR$1"  
  	# not really required, mountify() does NOT even copy the attribute but ok
  	busybox setfattr -n trusted.overlay.whiteout -v y "$MODULE_UPDATES_DIR$1"
  	chmod 644 "$MODULE_UPDATES_DIR$1"
}
for line in $( sed '/#/d' "$TEXTFILE" ); do
	apk_path=$(pm path "$line" 2>/dev/null | sed 's/package://')
	if echo "$apk_path" | grep -Eq "^/(product|vendor|odm|system_ext)/" && ! echo "$apk_path" | grep -q "^/system/"; then
		apk_path="/system$apk_path"
	elif ! echo "$apk_path" | grep -q "^/system/"; then
		echo "[!] Invalid input $apk_path. Skipping..."
		continue
	fi
	whiteout_create_systemapp "$apk_path" > /dev/null 2>&1
	ls "$MODULE_UPDATES_DIR$line" 2>/dev/null
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
for dir in $targets; do 
	if [ -d /$dir ] && [ ! -L /$dir ] && [ -d "$MODULE_UPDATES_DIR/system/$dir" ]; then
		if [ -L "$MODULE_UPDATES_DIR/$dir" ]; then
			# Check if the symlink points to the correct location
			if [ $(readlink -f $MODULE_UPDATES_DIR/$dir) != $(realpath $MODULE_UPDATES_DIR/system/$dir) ]; then
				echo "[!] Incorrect symlink for /$dir, fixing..."
				rm -f $MODULE_UPDATES_DIR/$dir
				ln -sf ./system/$dir $MODULE_UPDATES_DIR/$dir
			else
				echo "[+] Symlink for /$dir is correct, skipping..."
			fi
		else
			echo "[+] Creating symlink for /$dir"
			ln -sf ./system/$dir $MODULE_UPDATES_DIR/$dir
		fi
	fi
done

# import resources for whiteout module
cat "$MODDIR/whiteout/module.prop" > "$MODULE_UPDATES_DIR/module.prop"
cat "$MODDIR/whiteout/action.sh" > "$MODULE_UPDATES_DIR/action.sh"

# EOF
