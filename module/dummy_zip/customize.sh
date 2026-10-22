#!/bin/sh
# customize.sh
# this is part of system app nuker

# this is checked by nuke.sh
# flipping this to true will stop a possible deadlock
# of repeatedly looping customize -> nuke.sh -> customize
export DUMMYZIP=true

# we have to call nuke.sh from customize.sh of dummy.zip
# since atleast on ksu, kernelsu creates a new namespace for it it seems
sh /data/adb/modules/system_app_nuker/nuke.sh || abort "Failed to rebuild module whiteouts"

# let kernelsu swap the rebuilt module in without an update flag. older mountify
# metainstall.sh does its own swap whenever it sees the request, so only ask ksud.
[ "$KSU_HAS_HOT_INSTALL" = true ] && export MODULE_HOT_INSTALL_REQUEST=true

# EOF
