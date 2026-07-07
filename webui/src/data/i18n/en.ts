/**
 * English translation strings.
 * Use {{variable}} for interpolation, e.g. t('example', { name: 'World' })
 */
const en = {
  nav: {
    home: "Home",
    restore: "Restore",
    whiteout: "Whiteout",
    settings: "Settings",
  },
  global: {
    close: "Close",
    search: "Search",
    write_error: "Failed to save changes",
    processing: "Processing...",
  },
  home: {
    title: "System App Nuker",
    empty_help: "Select apps below to remove on next reboot. Apps marked Safe can be removed without issues.",
  },
  restore: {
    title: "Restore",
    empty: "No apps to restore",
  },
  whiteout: {
    title: "Whiteout",
  },
  settings: {
    title: "Settings",
    config: "Configuration",
    backup_restore: "Backup & Restore",
    about: "About",
    import_config: "Import Config",
    import_config_desc: "Import SAN configs",
    export_config: "Export Config",
    export_config_desc: "Backup SAN configs",
    report_bug: "Report bug",
    report_bug_desc: "Report issues on GitHub",
    source_code: "View source code",
    source_code_desc: "View source code on GitHub",
    telegram: "Telegram support",
    telegram_desc: "Join Telegram group for support and discussion",
    version: "Version",
  },
  /** Category display names — used for filter chips */
  category: {
    essential: "Essential",
    caution: "Caution",
    safe: "Safe",
    google: "Google",
    unknown: "Unknown",
  },
  /** Category descriptions — shown in detail views */
  category_desc: {
    essential: "Critical system components. Removing these may break core functionality.",
    caution: "This might be used by other system components.",
    safe: "Non-essential apps that can be removed without affecting system stability.",
    google: "Google apps and services that may be required for the Play Store ecosystem.",
    unknown: "Apps with unknown classification.",
  },
  app_info: {
    version: "Version",
    uid: "UID",
    status: "Status",
    category: "Category",
    type: "Type",
    system_app: "System App",
    user_app: "User App",
    nuked: "Nuked",
    installed: "Installed",
    pending: "Pending",
  },
  nuke_config: {
    export_success: "Config exported to {{path}}",
    export_empty: "No packages to export",
    import_success: "Imported {{count}} packages from config",
    import_empty: "No packages found in config",
    import_invalid: "Invalid config file",
  },
  backup: {
    title: "Backup found",
    message: "You might recently ran into a bootloop, we have backed up your setup automatically. Would you like to restore your backup now?",
    dismiss: "Dismiss",
    delete_backup: "Delete backup",
    restore: "Restore",
    error: "Failed to process backup files",
  },
  config: {
    uninstall_only_mode: "Uninstall Only Mode",
    uninstall_only_mode_desc: "If enabled, whiteouts for apps will not be created. Only pm uninstall --user 0 will be executed.",
    mounting_mode: "Mounting Mode",
    mounting_mode_desc: "Controls how the module is mounted. Auto-detected based on your environment.",
    mounting_mode_0: "Default/Legacy - Manager",
    mounting_mode_1: "Mountify Standalone - Built-in",
    mounting_mode_2: "Metamodule - External",
  },
  nuke: {
    success: "Reboot to take effect",
    success_count: "{{count}} app(s) staged, reboot to apply",
    success_no_reboot: "Done",
    reboot: "Reboot",
    error: "Nuke failed: {{stderr}}",
    reboot_error: "Failed to reboot: {{stderr}}",
  },
  update: {
    available: "v{{version}} available, tap to download",
    installed: "Updated to v{{version}}",
    check_error: "Failed to check for updates",
    download: "Download",
  },
} as const

export default en
