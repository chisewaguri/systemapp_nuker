# uninstall only mode
# if this is enabled, whiteouts for apps would not be created
# do pm uninstall --user 0 only without creating whiteouts
uninstall_only_mode=false

# --- mounting mode ---
# 0 = default/legacy; manager will handle this module's mounting
#     ⚠️  on KSU >22098 manager mounting is no longer supported by default by the KSU manager
# 1 = mountify standalone script; this module mounts itself using the bundled mountify script
#     requires either **TMPFS_XATTR** support or an OverlayFS manager
# 2 = metamodule/mountify module; mounting handled by KSU metamodule system or the mountify module
#     (these are treated identically)
# priority (auto-detected, highest to lowest): metamodule/mountify module (2) → mountify standalone (1) → legacy/default (0)
# DO NOT flip this manually unless you're sure the env supports it
mounting_mode=0

# ----
# ⚠️ DO NOT EDIT BELOW THIS LINE
# config(s) below are env-specific or not meant to be touched
# these are auto-set and might break stuff if changed manually
# ----

# legacy mounting system
# (true = manager is magic mount)
# (false = manager is overlayfs)
magic_mount=true

# Current active root manager
current_manager=MAGISK

# EOF
