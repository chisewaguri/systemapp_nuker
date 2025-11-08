# uninstall fallback if app ain't nuked on late service
# this runs: pm uninstall -k --user 0
# only triggers if the app still exists after late-service
# default is false
uninstall_fallback=false

# disable only mode
# if this is enabled, whiteouts for apps would not be created
disable_only_mode=false

# --- mounting mode ---
# 0 = default; manager will handle this module's mounting
# 1 = mountify standalone script; this module will be mounted using mountify standalone script thats shipped with this module
# 2 = mountify module; the mountify module will handle this module's mounting
# mountify standalone script needs either **TMPFS_XATTR** support or the OverlayFS manager
# DO NOT flip this manually unless you're sure the env supports it
# prefered mounting mode is 2, 1, 0
mounting_mode=0

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
