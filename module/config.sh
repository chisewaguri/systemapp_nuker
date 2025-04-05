# uninstall fallback if app ain't nuked on late service
# this executes: pm uninstall -k --user 0
# only runs if the app still exists after on late-service
# default is false
uninstall_fallback=false

# mount the module globally with mountify standalone script
# requires **TMPFS_XATTR** or **OverlayFS manager**
# this is auto-enabled during install if the environment supports it
# DO NOT enable this manually unless you're sure the enviromentment is supported
use_mountify_script=false

# ----
# ⚠️ DO NOT EDIT BELOW THIS LINE
# configuration(s) after this are env-specific nor not meant to be edited
# these values are auto-set and may break things if changed manually
# ----

# mounting system (true = manager is magic mount)
magic_mount=true

# EOF