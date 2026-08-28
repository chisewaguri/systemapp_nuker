# System App Nuker

A systemless debloater for Magisk, KernelSU, and APatch. Pick the apps. Nuke them.

## Why SAN?

Really, why not? Maybe for the sense of control over evil OEM ^^

[Download the latest release](https://github.com/chisewaguri/systemapp_nuker/releases/latest) · [Changelog](CHANGELOG.md) · [Telegram](https://t.me/systemapp_nuker) · [Report a bug](https://github.com/chisewaguri/systemapp_nuker/issues)

## What it does

- Lists installed system apps in a WebUI.
- Groups known packages by how bad an idea removing them might be.
- Hides selected apps with overlay whiteouts after a reboot.
- Restores apps by removing their whiteouts.
- Imports and exports nuke lists as JSON.
- Backs up its lists and disables itself if it detects a bootloop.

The category labels are advice, so do use your brain a little.

## Install

1. Download the module ZIP from the [latest release](https://github.com/chisewaguri/systemapp_nuker/releases/latest).
2. Install it through Magisk, KernelSU, or APatch.
3. Reboot. Yes, really.
4. Open the module WebUI.

KernelSU and APatch can open the WebUI from the module page. On Magisk, press the module action button. It opens KSUWebUIStandalone or WebUI X if either app is installed. If neither exists, it downloads and installs [KSUWebUIStandalone](https://github.com/KOWX712/KsuWebUIStandalone).

The installer figures out the available mount method. Newer KernelSU builds need a working metamodule such as [Mountify](https://github.com/backslashxx/mountify), or an environment where the bundled Mountify script can do its thing. If the installer complains about mounting, believe it. Optimism is not a mount method.

## Nuke an app

1. Open **Home**.
2. Pick your victims.
3. Press the nuke button.
4. Reboot when prompted.

Selected apps move to **Restore** immediately and stay marked as pending until reboot. The whiteouts become active during boot, so staring harder at the icon will not make it disappear sooner. I tried.

## Restore an app

Changed your mind? Fair enough.

1. Open **Restore**.
2. Select the apps you want back.
3. Press the restore button.
4. Reboot when prompted.

The module removes those apps from the next nuke list. Android sees them again after the new module state is mounted.

## How it works

The default mode creates overlay whiteouts at the directories that contain the selected APKs. Magisk, KernelSU, APatch, or Mountify mounts the module over the system partitions. Android then sees those directories as missing.

The APKs are still sitting safely on the original partitions. "Nuke" is branding. We are not drilling holes into `/product`, sadly.

System App Nuker saves each package's APK path before the whiteout hides it. That saved path lets module updates rebuild the same whiteouts even when `pm path` can no longer see the package.

If **Uninstall Only Mode** is enabled, the module skips whiteouts and runs `pm uninstall --user 0` instead.

## Settings worth knowing

- **Uninstall Only Mode** uses Android's per-user uninstall instead of whiteouts.
- **Mounting Mode** selects manager mounting, the bundled Mountify script, or an external metamodule. The installer picks this automatically. If you do not know what is mounting what, leave the poor setting alone.
- **Import Config** loads a saved package list.
- **Export Config** writes the current list to `/sdcard/Download/`.
- **Use whiteout feature** shows the raw whiteout page. Raw paths can hide almost anything under the system partitions, including things your phone was rather attached to.

## If something goes wrong

The bootloop guard watches whether Android reaches the module service after boot. If two early boots happen without that service, the module disables itself, removes its whiteouts, backs up the nuke lists, and reboots.

After the phone boots, re-enable the module and use the WebUI backup prompt to restore the saved lists. If Android cannot boot far enough for the guard to run, use your root manager's safe mode or recovery tools.

The guard is a seat belt, not a challenge. Nuking SystemUI to see what happens still counts as finding out. Please do not make me add another warning.

## Credits

- [@backslashxx](https://github.com/backslashxx) for [Mountify](https://github.com/backslashxx/mountify), its mounting scripts, and the whiteout work this module builds on.
- [@KOWX712](https://github.com/KOWX712) for the WebUI and [Tricky Addon Update Target List](https://github.com/KOWX712/Tricky-Addon-Update-Target-List), which inspired parts of the package-list handling.
- [@j-hc](https://github.com/j-hc) for [zygisk-detach](https://github.com/j-hc/zygisk-detach), which helped shape earlier app-list handling.
- Everyone who sent code, logs, bug reports, or one of those deeply suspicious "small suggestions."

## Contributing

Build commands and the other serious developer stuff live in [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, weird OEM behavior, and sane pull requests are welcome.

## License

System App Nuker is licensed under [GPL-3.0](LICENSE).
