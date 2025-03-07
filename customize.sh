SKIPUNZIP=0

mkdir -p "$MODPATH/common"
mv "$MODPATH/bin/$(getprop ro.product.cpu.abi)/aapt" "$MODPATH/common/aapt"
set_perm $MODPATH/common/aapt 0 2000 0755
rm -rf "$MODPATH/bin"
