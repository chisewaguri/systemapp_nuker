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

This module was built on top of hard work from some very cool people.

- **[@backslashxx](https://github.com/backslashxx)**  
Massive shoutout for more than just the standalone mounting scripts and whiteout logic from [`mountify`](https://github.com/backslashxx/mountify).  
A big chunk of the backend shell scripts in this module were either inspired by or directly adapted from his work.

- **[@KOWX712](https://github.com/KOWX712)**  
WebUI wizard. He made the frontend actually usable.  
Without this, you'd be staring at broken modals wondering why life suck.

- **[@KOWX712](https://github.com/KOWX712)** *(again!)*  
Also the author of [`Tricky-Addon-Update-Target-List`](https://github.com/KOWX712/Tricky-Addon-Update-Target-List), which inspired parts of the module's approach to package handling and list manipulation.

- **[@j-hc](https://github.com/j-hc)**  
Their work on [`zygisk-detach`](https://github.com/j-hc/zygisk-detach) helped shape how the module handles app list.

- **All other contributors**  
From code tweaks to bug reports to random late-night suggestions: thank you.  
You helped shape this into something that doesn’t suck to use.

Appreciate all of you. You made the thing not suck.

---

## ⚠️ Disclaimer  
This module is incredibly powerful! Use it wisely. Disabling critical system apps can break functionality, trigger boot loops, and make you question all your life decisions. Proceed with caution.
