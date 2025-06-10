# uninstall fallback if app ain't nuked on late service
# this runs: pm uninstall -k --user 0
# only triggers if the app still exists after late-service
# default is false
uninstall_fallback=false

# mount the module globally using the standalone mountify script
# needs either **TMPFS_XATTR** support or the OverlayFS manager
# auto-enabled during install if the env can handle it
# if mountify's already installed and will mount this module, this gets auto-disabled
# DO NOT flip this manually unless you're sure the env supports it
use_mountify_script=false

# refresh (regenerate) the app list cache every boot
# default is true to make sure app list stays accurate when things change
refresh_applist=true

# ----
# ⚠️ DO NOT EDIT BELOW THIS LINE
# config(s) below are env-specific or not meant to be touched
# these are auto-set and might break stuff if changed manually
# ----

# mounting system
# (true = manager is magic mount)
# (false = manager is overlayfs)
magic_mount=true

# EOF
