#!/bin/sh
# mountify-symlink.sh
# standalone global mounting script meant for KernelSU OverlayFS

PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
MODDIR="${0%/*}"

# fake mount name
FAKE_MOUNT_NAME="app_nuker"

[ ! -f $MODDIR/skip_mount ] && touch $MODDIR/skip_mount
[ ! -f $MODDIR/skip_mountify ] && touch $MODDIR/skip_mountify

# this is a fast lookup for a writable dir
# these tends to be always available
[ -w /mnt ] && basefolder=/mnt
[ -w /mnt/vendor ] && basefolder=/mnt/vendor

# here we create the symlink
busybox ln -sf "$MODDIR" "$basefolder/$FAKE_MOUNT_NAME"

# now we use the symlink as upperdir
cd "$basefolder/$FAKE_MOUNT_NAME"
for DIR in vendor/* product/* system_ext/* odm/* ; do
	busybox mount -t overlay -o "lowerdir=$basefolder/$FAKE_MOUNT_NAME/$DIR:/$DIR" overlay /$DIR
done

# handle system in a special way since ksu creates symlinks inside
cd "$basefolder/$FAKE_MOUNT_NAME/system"
for DIR in $( ls -d */ | sed 's/.$//'  | grep -vE "^(odm|product|system_ext|vendor)$" 2>/dev/null ); do
	busybox mount -t overlay -o "lowerdir=$basefolder/$FAKE_MOUNT_NAME/system/$DIR:/system/$DIR" overlay /system/$DIR
done

# EOF