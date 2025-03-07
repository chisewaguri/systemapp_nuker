#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.
PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
MODULES_UPDATE_DIR="/data/adb/modules_update/system_app_nuker"
TEXTFILE="$MODDIR/nuke_list.txt"

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
  	chmod 644 "$MODULES_UPDATE_DIR$1"
}

for line in $( sed '/#/d' "$TEXTFILE" ); do
	apk_path=$(pm path "$line" 2>/dev/null | sed 's/package://')

	# if the APK is in /data/app/, uninstall first
	# this might be better flagged later.
	if echo "$apk_path" | grep -q "^/data/app/"; then
		echo "[*] Detected updated system app for $line in /data/app/, uninstalling update..."
		pm uninstall -k --user 0 "$line"
		apk_path=$(pm path "$line" 2>/dev/null | sed 's/package://')  # Re-fetch path after uninstall
	fi

	pm clear "$line" 2>/dev/null
	# validate APK path
	if echo "$apk_path" | grep -Eq "^/(product|vendor|odm|system_ext)/" && ! echo "$apk_path" | grep -q "^/system/"; then
		apk_path="/system$apk_path"
	elif ! echo "$apk_path" | grep -q "^/system/"; then
		echo "[!] Invalid input $apk_path. Skipping..."
		continue
	fi

	# Create whiteout for apk_path
	whiteout_create_systemapp "$apk_path" > /dev/null 2>&1
	ls "$MODULES_UPDATE_DIR$line" 2>/dev/null
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

# remove contents of system folder
rm -rf "$MODDIR/system"

# now we copy over everything from MODDIR to MODULES_UPDATE_DIR
# the asterisk is important!!
cp -rf "$MODDIR"/* "$MODULES_UPDATE_DIR"

# now we flag old module for update
touch "$MODDIR/update"

# EOF
