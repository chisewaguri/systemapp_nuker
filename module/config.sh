# uninstall fallback if app aint nuked on late service
# this execute pm uninstall -k --user 0 on late service if app still exist
uninstall_fallback=false

# mount the module globally with mountify standalone script
# need TMPFS_XATTR
# this was set to true on install if your env supports it
# DO NOT enable if you dont have TMPFS_XATTR enabled or not sure what does this do
use_mountify_script=false

# ----
# configuration(s) after this are env-specific nor not meant to be edited
# do not edit
# ----

# mounting system
magic_mount=true

# EOF