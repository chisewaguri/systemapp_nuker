let appList = [], nukeList = [], isShellRunning = false;

async function ksuExec(command) {
    return new Promise((resolve) => {
        let callbackName = `exec_callback_${Date.now()}`;
        window[callbackName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            delete window[callbackName];
        };
        ksu.exec(command, "{}", callbackName);
    });
}

export function setupSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        window.scrollTo(0, 0);
        const searchValue = e.target.value.toLowerCase();
        const apps = document.querySelectorAll('.app, .removed-app');
        apps.forEach(app => {
            const appName = app.querySelector('span.app-name').textContent.toLowerCase();
            const appPackage = app.querySelector('span.app-package').textContent.toLowerCase();
            if (appName.includes(searchValue) || appPackage.includes(searchValue)) {
                app.style.display = 'flex';
            } else {
                app.style.display = 'none';
            }
        });

        if (document.getElementById('search-input').value.length > 0) {
            document.getElementById('clear-btn').style.display = 'block';
        } else {
            document.getElementById('clear-btn').style.display = 'none';
        }
    });
    document.getElementById('clear-btn').addEventListener('click', () => {
        window.scrollTo(0, 0);
        document.getElementById('search-input').value = '';
        const apps = document.querySelectorAll('.app, .removed-app');
        apps.forEach(app => {
            app.style.display = 'flex';
        });
        document.getElementById('clear-btn').style.display = 'none';
    });
}

// Fetch system apps
export async function fetchAppList(file, display = false) {
    fetch(file)
        .then(response => response.json())
        .then(data => {
            data.sort((a, b) => a.app_name.localeCompare(b.app_name));
            if (file === "app_list.json") {
                appList = data;
            } else {
                nukeList = data;
            }
            if (display) {
                displayAppList(data);
                applyRippleEffect();
            }
        })
        .catch(error => {
            console.error("Failed to fetch system apps:", error);
        });
}

// Display app list
async function displayAppList(data) {
    const appListDiv = document.getElementById("app-list");
    appListDiv.innerHTML = "";

    const htmlContent = data.map((pkg) => `
        <div class="app ripple-element" data-package-name="${pkg.package_name}" data-app-path="${pkg.app_path}">
            <div class="app-info">
                <img class="app-icon" src="icons/${pkg.package_name}.png" onerror="this.src='default.png'" alt="Icon">
                <div class="app-details">
                    <span class="app-name"><span>${pkg.app_name}</span></span>  
                    <span class="app-package"><span>${pkg.package_name}</span></span>  
                    <span class="app-path"><span>${pkg.app_path}</span></span>  
                </div>
            </div>
            <input class="app-selector" type="checkbox">
        </div>
    `).join("");
    
    appListDiv.innerHTML = htmlContent;

    // Add click handlers to all app divs
    document.querySelectorAll('.app').forEach(appDiv => {
        appDiv.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
        });

        appDiv.querySelectorAll(".app-name span, .app-package span, .app-path span").forEach(el => {
            const parent = el.parentElement;
            const scrollAmount = el.scrollWidth - parent.clientWidth;
        
            if (scrollAmount > 0) {
                el.classList.add("scroll");
        
                // Ensure the full text scrolls by adding a small buffer (+10px)
                const adjustedScroll = scrollAmount + 10;
                
                // Adjust animation speed based on text length (longer text = slower scrolling)
                const scrollTime = Math.max(3, adjustedScroll / 15); // Min 3s, longer for large text
                
                el.style.setProperty('--scroll-distance', `-${adjustedScroll}px`);
                el.style.setProperty('--scroll-time', `${scrollTime}s`);
            }
        });
    });
}

// Funtion to update app list
export async function updateAppList(isNuke = false) {
    let targetFrom, targetTo, listFrom, listTo;
    if (isShellRunning) return;
    if (isNuke) {
        targetFrom = "app_list.json";
        targetTo = "nuke_list.json";
        listFrom = appList;
        listTo = nukeList;
    } else {
        targetFrom = "nuke_list.json";
        targetTo = "app_list.json";
        listFrom = nukeList;
        listTo = appList;
    }

    // Get selected apps
    let selectedPackages = Array.from(document.querySelectorAll(".app-selector:checked"))
        .map(checkbox => {
            const appDiv = checkbox.closest('.app');
            return {
                package_name: appDiv.dataset.packageName,
                app_path: appDiv.dataset.appPath,
                app_name: appDiv.querySelector('.app-name').textContent
            };
        });

    // Skip if none selected
    if (selectedPackages.length === 0) {
        ksu.toast("No apps selected");
        return;
    }

    try {
        // Add apps to targetFrom
        const uniqueNewPackages = selectedPackages.filter(app => 
            !listFrom.some(existingApp => existingApp.package_name === app.package_name)
        );
        listFrom.push(...uniqueNewPackages);
        await ksuExec(`echo '${JSON.stringify(listFrom, null, 2)}' > /data/adb/system_app_nuker/${targetFrom}`);

        // Remove apps from targetTo
        listTo = listTo.filter(app => 
            !selectedPackages.some(selectedApp => selectedApp.package_name === app.package_name)
        );
        await ksuExec(`echo '${JSON.stringify(listTo, null, 2)}' > /data/adb/system_app_nuker/${targetTo}`);

        // Refresh app list
        displayAppList(listTo);

        // Update global variables
        if (isNuke) {
            appList = listFrom;
            nukeList = listTo;
        } else {
            appList = listTo;
            nukeList = listFrom;
        }

        // Nuke script
        isShellRunning = true;
        await ksuExec(`
            PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
            busybox nsenter -t1 -m /data/adb/modules/system_app_nuker/nuke.sh
        `);
        isShellRunning = false;
        ksu.toast("Done! Reboot your device!");
    } catch (error) {
        ksu.toast("Error updating removed apps list");
        console.error("Error:", error);
    }
}

export function setupMenuAndImport() {
    const menuButton = document.getElementById('menu-button');
    const menuDropdown = document.getElementById('menu-dropdown');
    const importOption = document.getElementById('import-option');
    const modal = document.getElementById('import-modal');
    const closeButton = document.querySelector('.close-modal');
    const cancelButton = document.getElementById('cancel-import');
    const confirmButton = document.getElementById('confirm-import');
    const packageListInput = document.getElementById('package-list-input');
    
    // Toggle menu dropdown
    menuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        menuDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
        menuDropdown.classList.remove('show');
    });
    
    // Import option click
    importOption.addEventListener('click', () => {
        menuDropdown.classList.remove('show');
        modal.style.display = 'block';
        packageListInput.focus();
    });
    
    // Close modal functions
    const closeModal = () => {
        modal.style.display = 'none';
        packageListInput.value = '';
    };
    
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    
    // Close when clicking outside the modal
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Process import
    confirmButton.addEventListener('click', async () => {
        const packageText = packageListInput.value.trim();
        if (!packageText) {
            ksu.toast("No packages to import");
            return;
        }
        
        // Parse package names (one per line)
        const packageNames = packageText.split('\n')
            .map(pkg => pkg.trim())
            .filter(pkg => pkg && /^[a-zA-Z0-9_.]+$/.test(pkg)); // Basic validation
        
        if (packageNames.length === 0) {
            ksu.toast("No valid package names found");
            return;
        }
        
        // Find these packages in the app list
        const packagesToNuke = appList.filter(app => 
            packageNames.includes(app.package_name)
        );
        
        // If no packages found
        if (packagesToNuke.length === 0) {
            ksu.toast(`None of the ${packageNames.length} package(s) found in system apps`);
            closeModal();
            return;
        }
        
        // Packages that weren't found
        const notFound = packageNames.filter(pkg => 
            !appList.some(app => app.package_name === pkg)
        );
        
        if (notFound.length > 0) {
            ksu.toast(`${packagesToNuke.length} package(s) found, ${notFound.length} not found`);
        } else {
            ksu.toast(`${packagesToNuke.length} package(s) found and selected`);
        }
        
        // Update UI to select these apps
        document.querySelectorAll('.app').forEach(appDiv => {
            const packageName = appDiv.dataset.packageName;
            const checkbox = appDiv.querySelector('.app-selector');
            
            if (packageNames.includes(packageName)) {
                checkbox.checked = true;
                // Scroll to first selected app
                if (packageName === packagesToNuke[0].package_name) {
                    setTimeout(() => appDiv.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }
            }
        });
        
        closeModal();
    });
}

// Function to apply ripple effect
function applyRippleEffect() {
    document.querySelectorAll('.ripple-element').forEach(element => {
        if (element.dataset.rippleListener !== "true") {
            element.addEventListener("pointerdown", function (event) {
                if (isScrolling) return;
                const ripple = document.createElement("span");
                ripple.classList.add("ripple");

                // Calculate ripple size and position
                const rect = element.getBoundingClientRect();
                const width = rect.width;
                const size = Math.max(rect.width, rect.height);
                const x = event.clientX - rect.left - size / 2;
                const y = event.clientY - rect.top - size / 2;

                // Determine animation duration
                let duration = 0.2 + (width / 800) * 0.4;
                duration = Math.min(0.8, Math.max(0.2, duration));

                // Set ripple styles
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                ripple.style.animationDuration = `${duration}s`;
                ripple.style.transition = `opacity ${duration}s ease`;

                // Adaptive color
                const computedStyle = window.getComputedStyle(element);
                const bgColor = computedStyle.backgroundColor || "rgba(0, 0, 0, 0)";
                const textColor = computedStyle.color;
                const isDarkColor = (color) => {
                    const rgb = color.match(/\d+/g);
                    if (!rgb) return false;
                    const [r, g, b] = rgb.map(Number);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 96; // Luma formula
                };
                ripple.style.backgroundColor = isDarkColor(bgColor) ? "rgba(255, 255, 255, 0.2)" : "";

                // Append ripple and handle cleanup
                element.appendChild(ripple);
                const handlePointerUp = () => {
                    ripple.classList.add("end");
                    setTimeout(() => {
                        ripple.classList.remove("end");
                        ripple.remove();
                    }, duration * 1000);
                    element.removeEventListener("pointerup", handlePointerUp);
                    element.removeEventListener("pointercancel", handlePointerUp);
                };
                element.addEventListener("pointerup", handlePointerUp);
                element.addEventListener("pointercancel", handlePointerUp);
            });
            element.dataset.rippleListener = "true";
        }
    });
}

// Function to check if running in MMRL
export async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Adjust elements position for MMRL
        document.querySelector('.header').style.top = 'var(--window-inset-top)';
        document.querySelector('.search-container').style.top = 'calc(var(--window-inset-top) + 80px)';
        document.querySelector('.floating-button-container').style.bottom = 'calc(var(--window-inset-bottom) + 95px)';
        document.querySelector('.footer-btn').style.paddingBottom = 'calc(var(--window-inset-bottom) + 15px)';

        // Set status bars theme based on device theme
        try {
            $system_app_nuker.setLightStatusBars(!window.matchMedia('(prefers-color-scheme: dark)').matches)
        } catch (error) {
            console.log("Error setting status bars theme:", error)
        }

        // Request API permission, supported version: 33045+
        try {
            $system_app_nuker.requestAdvancedKernelSUAPI();
        } catch (error) {
            console.log("Error requesting API:", error);
        }
    }
}

// Hide or show floating button
function hideFloatingButton(hide = true) {
    const floatingButton = document.querySelector(".floating-button-container");
    if (!hide) {
        floatingButton.style.transform = 'translateY(0)';
    } else {
        floatingButton.style.transform = 'translateY(90px)';
    }
}

let isScrolling = false;
export function setupScrollEvent() {
    let lastScrollY = window.scrollY;
    let scrollTimeout;
    const scrollThreshold = 40;
    window.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        if (window.scrollY > lastScrollY && window.scrollY > scrollThreshold) {
            hideFloatingButton(true);
        } else if (window.scrollY < lastScrollY) {
            hideFloatingButton(false);
        }

        // header opacity and scale
        const scrollRange = 65;
        const scrollPosition = Math.min(Math.max(window.scrollY, 0), scrollRange);
        const opacity = 1 - (scrollPosition / scrollRange);
        const scale = 0.5 + (opacity * 0.5);
        const translateY = scrollPosition / 2;
        document.querySelector('.header').style.opacity = opacity.toString();
        document.querySelector('.header').style.transform = `scale(${scale}) translateY(-${translateY}px)`;
        document.querySelector('.search-container').style.transform = `translateY(-${scrollPosition}px)`;
        lastScrollY = window.scrollY;
        isScrolling = false;
    });
}
