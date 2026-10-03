## App Nuker  
Simple debloater and whiteout maker with WebUI support.

### Changelog

### v2.2.6

> You no longer need to reboot before opening the WebUI. Installing or updating the module refreshes the WebUI right away, and nuked apps still disappear after the next reboot.

#### Scripts
- install the new WebUI and scripts into the running module, and leave its whiteouts for the reboot
- keep the running module as it was if that copy fails
- remove the update flag after an install or a nuke, so KernelSU opens the WebUI before the reboot

#### WebUI
- soft reboot when KernelSU was loaded after boot, so root survives the reboot

---

### v2.2.5

> Adds app descriptions and removal levels from UAD-ng (#60).

#### WebUI
- show what each app is and how risky it is to remove, from a UAD-ng list bundled with every release
- update that list from Settings. Nothing is downloaded unless you tap it
- filter apps by removal level from a button in the search bar
- keep icons for nuked apps on the Restore page
- add a Credits dialog under About

#### Workflows
- bundle the latest UAD-ng list into each build

---

### v2.2.4

> v2.0.x users should update. Updating from 2.0 could fail with "cant find system apk" when a nuked app had a Play Store update (#63).

#### Scripts
- keep updating when a nuked app only shows its Play Store copy, and uninstall that copy for user 0
- recover the APK path of apps nuked before 2.1, so they can be restored one at a time
- uninstall an app for user 0 when its old path cannot be recovered, so it stays hidden

---

### v2.2.3

> Magisk and Magisk Alpha users should update. The WebUI could not save any change there and showed "Failed to save changes" (#62).

#### Scripts
- restore apps removed in uninstall-only mode when bootloop protection triggers, and retry until it works
- restore every uninstalled app when the module is removed
- only show apps as nuked once they are actually hidden
- report failed mountify mounts in the module description instead of showing apps as nuked

#### WebUI
- save changes without busybox, which Magisk does not put on the WebUI's PATH
- reload the app lists after a failed nuke or a backup restore, so rejected changes are not sent again
- keep the original file when a save fails partway
- stop hanging when the manager cannot start the nuke script
- add empty states, a retry button, screen reader labels, and back navigation between tabs
- confirm before deleting whiteouts

#### Workflows
- run lint and tests before building, and pin actions to commits

---

### v2.2.2

> v2.2.1 users should update. Package-manager calls can miss APK paths while processing the nuke list, leaving apps visible after reboot.

#### Scripts
- keep package-manager commands from inheriting the nuke list as stdin
- rebuild missing APK paths and whiteouts during module update

---

### v2.2.1

> v2.2.0 users must update. v2.2.0 can fail to nuke apps with package-manager errors or installed system updates.

#### Scripts
- filter pm path errors before creating whiteouts
- cache factory apk paths before removing system updates
- fall back to uninstall for user 0 when no system apk path is available

#### WebUI
- move pending nukes to Restore and pending restores to Home before reboot

---

### v2.2.0

#### Scripts
- keep nuked apps hidden when updating from v1 or any v2 release
- cache and validate apk paths before whiteouts hide the apps
- keep current whiteouts and restore lists when an update fails
- retry failed restores and handle updated system apps safely
- write state, config, migrations, and backups atomically
- reject unsafe whiteout paths and clean custom partition leftovers

#### WebUI
- stop overlapping nuke, restore, settings, whiteout, and backup changes
- keep loaded state when device reads or writes fail
- apply imported configs and show unknown apps in filters

#### Workflows
- check release tag, version, version code, and zip name before release

---

Older versions are on the [releases page](https://github.com/chisewaguri/systemapp_nuker/releases).
