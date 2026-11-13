# System App Nuker

Hides preinstalled system apps on Magisk, KernelSU, and APatch without touching the system partition.

[![Release](https://img.shields.io/github/v/release/chisewaguri/systemapp_nuker?logo=github&label=Release)](https://github.com/chisewaguri/systemapp_nuker/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/chisewaguri/systemapp_nuker/total?logo=github&label=Downloads)](https://github.com/chisewaguri/systemapp_nuker/releases)
[![Telegram](https://img.shields.io/badge/Telegram-group-26A5E4?logo=telegram&logoColor=fff)](https://t.me/systemapp_nuker)

> [!WARNING]
> Each app shows a removal level from UAD-ng. Treat it as advice. Removing an app marked Unsafe can stop your phone from booting.

## Requirements

One of these:

- [Magisk](https://github.com/topjohnwu/Magisk)
- [KernelSU](https://github.com/tiann/KernelSU). Newer builds also need a metamodule such as [mountify](https://github.com/backslashxx/mountify).
- [APatch](https://github.com/bmax121/APatch)

## Usage

On KernelSU and APatch, open the WebUI from the module page.

On Magisk, press the module action button. It opens [KSUWebUIStandalone](https://github.com/KOWX712/KsuWebUIStandalone) or [WebUI X](https://github.com/MMRLApp/WebUI-X-Portable). If neither is installed, it installs KSUWebUIStandalone first.

To remove apps, select their checkboxes on **Remove apps**, press **Review removals**, and confirm the list. Reboot when prompted. To bring apps back, select them on **Restore apps** and confirm the restores. Tap an app name to read its description and removal rating.

App selections, searches and filters stay in place when you switch tabs. Review the full list before applying it. You can deselect apps inside the review. A notice stays visible while changes need a reboot.

Tap the pending count in that notice to undo individual app or path changes, or select several to undo together.

Importing a removal list opens a review before applying it. Exports contain app package names only. They do not include settings or hidden paths.

If applying changes fails, open **Details** on the error message or **Settings → Last operation log**. Copy the log or save it to Downloads when reporting a problem.

After bootloop protection runs, the saved recovery list contains the setup that was rolled back. Review it carefully before reapplying it.

## Features

- Hides apps with overlay whiteouts. The APKs stay on the system partition, so restoring an app only needs a reboot.
- Shows a description and removal level for each app, taken from [UAD-ng](https://github.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation).
- Uninstall Only Mode runs `pm uninstall --user 0` instead of creating whiteouts.
- Imports and exports nuke lists.
- If two boots in a row fail, the module disables itself and removes its whiteouts.

## Credits

- [mountify](https://github.com/backslashxx/mountify) for the mounting scripts and whiteout work.
- [UAD-ng](https://github.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation) for app descriptions and removal levels, licensed GPL-3.0.
- [Tricky Addon](https://github.com/KOWX712/Tricky-Addon-Update-Target-List) for the WebUI it inspired.
- [zygisk-detach](https://github.com/j-hc/zygisk-detach) for the earlier app list handling.
- Everyone who sent code, logs, or bug reports.

Build instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Links

[![Download](https://custom-icon-badges.demolab.com/badge/-Download-F25278?style=for-the-badge&logo=download&logoColor=white)](https://github.com/chisewaguri/systemapp_nuker/releases/latest)
[![Issue](https://custom-icon-badges.demolab.com/badge/-Open%20Issue-palegreen?style=for-the-badge&logoColor=black&logo=issue-opened)](https://github.com/chisewaguri/systemapp_nuker/issues)
[![Changelog](https://custom-icon-badges.demolab.com/badge/-Changelog-orange?style=for-the-badge&logo=history&logoColor=white)](CHANGELOG.md)
[![Telegram](https://custom-icon-badges.demolab.com/badge/-Telegram-blue?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/systemapp_nuker)

Licensed under [GPL-3.0](LICENSE).
