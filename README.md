# System App Nuker
### Take back control. Your device, your rules

Bloatware sucks. This module lets you disable pre-installed system apps and services that don’t serve you.

---

## Features
- **Web-Based Interface** – Manage apps through an intuitive WebUI
- **Smart Categorization** – See what's safe to remove and what's risky
- **Universal Compatibility** – Works with Magisk, KernelSU, and Apatch
- **Bootloop Protection** – Auto-disables before breaking your device
- **Backup & Restore** – Import/export app lists and restore removed apps
- **Developer Mode** – Advanced manual control for power users

---

## Getting Started

### WebUI Access
**KernelSU & Apatch:** Built-in WebUI ready to use  
**Magisk:** Use third-party apps like [WebUI X](https://github.com/MMRLApp/WebUI-X-Portable) or [KSUWebUIStandalone](https://github.com/5ec1cff/KsuWebUIStandalone) (auto-installed if needed). Launch it from the action button

### Key Functions
- **Package Management** – Import lists manually or from files, export for backup
- **Restore Page** – Bring back removed apps
- **Developer Mode** – Triple-tap the title for advanced whiteout creation (nuke *almost* anything in /system)

---

## Acknowledgements

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

Yes, this is powerful. No, it does not come with training wheels.   
Disabling critical system apps can:
- Break your phone
- Trigger boot loops
- Make you question all your life decisions 

Maybe don’t go nuking half your system unless you’re absolutely sure it won’t end in regret and recovery mode.  
You’ve been warned.
