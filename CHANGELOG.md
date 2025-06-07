## App Nuker  
Simple debloater and whiteout maker with WebUI support.

### Changelog

### v1.1.6

#### WebUI  
- Revert to the old categorization system (Revert #38)

#### Scripts  
- Update WebUI X package name (@KOWX712)
- Make regenerating app list every reboot optional
- Skip icon extraction if icon file exist
- Fix mountify checking and skip standalone script if mountify module will mount this
- Code refactor

### v1.1.5

#### WebUI  
- Add support for Universal Android Debloater (UAD) lists (@Dwtexe #38, @KOWX712)
- Drop MMRL version check (@KOWX712)

#### Scripts  
- Add WebUI X redirect support (@KOWX712)

---

### v1.1.4

#### WebUI  
- Enhance ripple animation's scroll detection (@KOWX712, #34)
- Drop support for MMRL version < 33329 (@KOWX712, #34)
- Optimize UI animation (@KOWX712, #35, #36)

#### Scripts  
- Initial /my_bigball partition support (on mountify-supported env)
- Add dynamic module desc
- Improved bootloop protection and nuking logic

---

### v1.1.3

#### WebUI  
- Fixed partial loading issue when importing a package list 
  Thanks to @KOWX712 (#32)

#### Scripts  
- Mount module globally using `mountify` standalone scripts  
  (only supports env with tmpfs xattrs enabled or overlayfs-based manager)
  Scripts are imported from [@backslashxx/mountify](https://github.com/backslashxx/mountify), massive thanks for standalone mounting scripts

---

### v1.1.2

#### WebUI  
- Fixed category badge on confirmation modal
- Always display whiteout in footer after adding a path (**#28**, @KOWX712)  
- Used `fetch` for file reading and fixed extra `end` statement (**#28**, @KOWX712)  
- Optimized footer layout (**#31**, @KOWX712)  
- Enhanced UI interactions: optimized app list, added page switching animation, prevented redundant calls, and improved tablet UI (**#27**, **#28**, **#29**, @KOWX712)  
- Improved color management (**#27**, @KOWX712)  
- **MMRL:** Added Monet theme support (**#27**, **#29**, @KOWX712)  

#### Scripts  
- Optimized bootloop protection

---

Full changelog: [GitHub Commits](https://github.com/ChiseWaguri/systemapp_nuker/commits/master/)
