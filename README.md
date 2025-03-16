# System App Nuker

A simple yet powerful module that lets you reclaim control over your device by removing pre-installed system apps.  
Because stock firmware thinks it knows best, and we disagree.

## **Features**  
- **Web-Based Interface** – Manage app removal through a user-friendly WebUI.  
- **Non-Destructive Removal** – Disables system apps without modifying system partitions.  
- **Compatibility** – Works seamlessly with Magisk, KernelSU, and Apatch.  
- **Bootloop Recovery** – If you break something, the module disables itself so you ~~hopefully~~ get another chance.
- **Package List Management** – Import/export package lists for easy backups and sharing.  

## **Installation**  
1. Download the latest release.  
2. Install the module.  
3. Reboot your device.  

## WebUI Usage

### KernelSU & Apatch
- **KSU WebUI** – A dedicated interface for managing system app removal.  

### Magisk
- **Action Button** – Launch WebUI directly from the Magisk app.  
- **Third-Party Support:**  
  - [KSUWebUIStandalone](https://github.com/5ec1cff/KsuWebUIStandalone)  
  - [MMRL](https://github.com/MMRLApp/MMRL)  
- **Automatic Installation** – If no WebUI is found, KSUWebUIStandalone will be installed automatically.  


## Advanced Features

### Package List Management
- **Import Packages** – Load a list of package names from:  
  - Manual text input (copy/paste)  
  - Text files stored on your device  
- **Export Packages** – Save your nuked app list as a text file for backup or sharing.  

### Restore Functionality
- Easily re-enable previously nuked system apps via the Restore page.  

## Acknowledgements
A huge thank you to everyone who contributed to improving this module, whether through direct code contributions or feedback and suggestions.

- This project draws inspiration from [backslashxx/mountify](https://github.com/backslashxx/mountify), which provided the foundation for the whiteout generator.
- App handling techniques were adapted from [j-hc/zygisk-detach](https://github.com/j-hc/zygisk-detach) and [KOWX712/Tricky-Addon-Update-Target-List](https://github.com/KOWX712/Tricky-Addon-Update-Target-List). Their approaches helped shape the logic behind the module’s functionality.

Your contributions, ideas, and support are greatly appreciated!

## Disclaimer  
This module is super powerful! use it wisely. Removing critical system apps can break functionality, trigger boot loops, and make you question all your life decisions. Proceed with caution.
