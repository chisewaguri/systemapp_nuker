# System App Nuker

A simple and efficient module that allows you to remove pre-installed system apps from your Android device.
Because stock firmware thinks it knows best, and we disagree.

## Features
- **Web-Based Interface** – Manage app removal through an intuitive WebUI.
- **Non-Destructive Removal** – Disables system apps without touching system partitions.
- **Compatibility** – Compatible with Magisk, KernelSU, and Apatch.
- **Failsafe Mechanism** – Prevents accidental removal of critical apps.

## Installation
1. Download the latest release module.
2. Install the module.
3. Reboot your device.

## WebUI Instructions

### KernelSU & Apatch
- **KSU WebUI** – A dedicated interface for managing system app removal.

### Magisk
- **Action Button** – Open WebUI directly from the Magisk app.
- **Third-Party Support:**
  - [KSUWebUIStandalone](https://github.com/5ec1cff/KsuWebUIStandalone)
  - [MMRL](https://github.com/MMRLApp/MMRL)
- **Automatic Installation** – If no WebUI is found, KSUWebUIStandalone will be installed automatically.

## Acknowledgements
- Special thanks to all contributors who helped refine and improve this module.
- Inspired by [backslashxx/mountify](https://github.com/backslashxx/mountify), which provided the foundation for the whiteout generator.
- Borrowed app handling ideas from [j-hc/zygisk-detach](https://github.com/j-hc/zygisk-detach) and [KOWX712/Tricky-Addon-Update-Target-List](https://github.com/KOWX712/Tricky-Addon-Update-Target-List).

## Disclaimer
This module is powerful. Use it wisely. Removing critical system apps may break functionality, cause boot loops, and make you rethink your life choices.

