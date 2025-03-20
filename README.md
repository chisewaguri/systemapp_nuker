# System App Nuker  
### Take Back Control – Because Your Device Should Work for You, Not the Other Way Around  

A simple yet powerful module that lets you reclaim control over your device by disabling pre-installed system apps. Because stock firmware thinks it knows best—and we respectfully disagree.  

## 🧩 Features  
- **Web-Based Interface** – Manage app removal through a user-friendly WebUI
- **App Categorization System** – Helps users distinguish between safe and critical apps 
- **Compatibility** – Works seamlessly with Magisk, KernelSU, and Apatch
- **Bootloop Recovery** – If something breaks, the module auto-disables itself so you (hopefully) get another chance
- **Package List Management** – Import/export package lists for easy backups and sharing
- **Developer Mode** – Manually create whiteouts for advanced customization

---

## 🌐 WebUI Usage  
### KernelSU & Apatch  
- KSU WebUI – A dedicated interface for managing system app removal

### Magisk  
- Action Button – Launch WebUI directly from the Magisk app
- Third-Party Support:  
  - [KSUWebUIStandalone](https://github.com/5ec1cff/KsuWebUIStandalone)  
  - [MMRL](https://github.com/MMRLApp/MMRL)  
- Automatic Installation – If no WebUI is found, KSUWebUIStandalone will be installed automatically

---

## ⚙️ Advanced Features  
### Package List Management  
- **Import Packages** – Load a list of package names from:  
  - Manual text input (copy/paste)  
  - Text files stored on your device  
- **Export Packages** – Save your nuked app list as a text file for backup or sharing

### Restore Functionality  
- Easily re-enable previously nuked system apps via the Restore page 

### Developer Mode  
For advanced users who want complete control, Developer Mode allows manual whiteout creation:  
- Access it with tapping the "System App Nuker" title three times

---

## 💡 Acknowledgements  
Huge thanks to everyone who contributed through code, feedback, and suggestions!  

This project is inspired by:  
- [backslashxx/mountify](https://github.com/backslashxx/mountify) – The foundation for the whiteout generator.  
- [j-hc/zygisk-detach](https://github.com/j-hc/zygisk-detach) & [KOWX712/Tricky-Addon-Update-Target-List](https://github.com/KOWX712/Tricky-Addon-Update-Target-List) – Their app-handling techniques shaped the module’s functionality.  

Your contributions, ideas, and support are always appreciated!  

---

## ⚠️ Disclaimer  
This module is incredibly powerful! Use it wisely. Disabling critical system apps can break functionality, trigger boot loops, and make you question all your life decisions. Proceed with caution.
