# System App Nuker
### Take Back Control – Because Your Device Should Work for You, Not the Other Way Around

A simple yet powerful module that lets you reclaim control over your device by disabling pre-installed system apps.  
Because stock firmware thinks it knows best — and we respectfully, *aggressively*, disagree.

---

## 🧩 Features
- **Web-Based Interface** – Manage app nuking through a user-friendly WebUI
- **App Categorization System** – Know what’s safe, what’s risky, and what might summon a bootloop demon
- **Compatibility** – Plays nice with **Magisk**, **KernelSU**, and **Apatch**
- **Bootloop Recovery** – If you break something vital, the module politely disables itself so you (hopefully) live to nuke another day
- **Package List Management** – Import/export app lists for backups or trading war stories
- **Developer Mode** – Manually create whiteouts if you're into that kind of power

---

## 🌐 WebUI Usage

### On KernelSU & Apatch
- Both come with a **built-in WebUI** for managing system app removal
- No setup, no fuss — it's already there, waiting for you to make some chaos

### On Magisk
- **Action Button** – Launch the WebUI directly from the Magisk app
- **Third-Party Integrations**:
  - [KSUWebUIStandalone](https://github.com/5ec1cff/KsuWebUIStandalone)
  - [MMRL](https://github.com/MMRLApp/MMRL)
- **Auto Installation** – Don’t have a WebUI? We’ll handle it. KSUWebUIStandalone gets installed automatically

---

## ⚙️ Advanced Features

### 📦 Package List Management 
- **Import**
  - Paste in package names manually
  - Or load from a text file on your device 
- **Export**
  - Save your nuked apps as a list
  - Share it, back it up, frame it on your wall, your call

### ♻️ Restore Functionality
- Accidentally killed something important?
  - Use the **Restore** page to bring it back from the dead

### 🧑‍💻 Developer Mode
For when you want *total* control:
- Triple-tap the “System App Nuker” title to unlock Developer Mode
- Manually create whiteouts and nuke anything in `/system`

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

Yes, this is powerful. No, it does not come with training wheels.   
Disabling critical system apps can:
- Break your phone
- Trigger boot loops
- Make you question all your life decisions 

Maybe don’t go nuking half your system unless you’re absolutely sure it won’t end in regret and recovery mode.  
You’ve been warned.
