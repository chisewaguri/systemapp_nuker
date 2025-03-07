#!/bin/sh
# nuke.sh
# this is part of system app nuker
# system app nuker whiteout module creator
# this is modified from mountify's whiteout creator
# No warranty.

PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="/data/adb/modules/system_app_nuker"
TEXTFILE="$MODDIR/nuke_list.txt"

# straight up use moddir
[ -d "$MODDIR/system" ] && rm -rf "$MODDIR/system"
mkdir -p "$MODDIR/system"
busybox chcon --reference="/system" "$MODDIR/system"

whiteout_create_systemapp() {
	echo "$MODDIR${1%/*}"
	echo "$MODDIR$1" 
	mkdir -p "$MODDIR${1%/*}"
	rm -rf "$MODDIR${1%/*}"
  	busybox mknod "$MODDIR${1%/*}" c 0 0
  	busybox chcon --reference="/system" "$MODDIR$1"  
  	# not really required, mountify() does NOT even copy the attribute but ok
  	busybox setfattr -n trusted.overlay.whiteout -v y "$MODDIR$1"
  	chmod 644 "$MODDIR$1"
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
	ls "$MODDIR$line" 2>/dev/null
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
	if [ -d /$dir ] && [ ! -L /$dir ] && [ -d "$MODDIR/system/$dir" ]; then
		if [ -L "$MODDIR/$dir" ]; then
			# Check if the symlink points to the correct location
			if [ $(readlink -f $MODDIR/$dir) != $(realpath $MODDIR/system/$dir) ]; then
				echo "[!] Incorrect symlink for /$dir, fixing..."
				rm -f $MODDIR/$dir
				ln -sf ./system/$dir $MODDIR/$dir
			else
				echo "[+] Symlink for /$dir is correct, skipping..."
			fi
		else
			echo "[+] Creating symlink for /$dir"
			ln -sf ./system/$dir $MODDIR/$dir
		fi
	fi
done

# EOF
