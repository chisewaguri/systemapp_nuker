export let appList = [], nukeList = [], isShellRunning = false;

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

export function toast(message) {
    try {
        ksu.toast(message);
    } catch (error) {
        console.log("Error showing toast:", error);
    }
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
                <div class="app-icon-container">
                    <div class="icon-loading">Loading...</div>
                    <img class="app-icon" 
                        src="icons/${pkg.package_name}.png" 
                        style="opacity: 0;" 
                        onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" 
                        onerror="this.src='default.png'; this.style.opacity='1'; this.previousElementSibling.style.display='none';" 
                        alt="Icon">
                </div>
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
        toast("No apps selected");
        return;
    }

    // Show confirmation dialog if nuke apps
    if (!isNuke) {
        // Return a new Promise that resolves when user makes a choice
        const confirmed = await new Promise((resolve, reject) => {
            // Populate the confirmation dialog
            const confirmationModal = document.getElementById("confirmation-modal");
            const modalContent = confirmationModal.querySelector(".modal-content");
            const selectedAppsList = document.getElementById("selected-apps-confirm");
            selectedAppsList.innerHTML = selectedPackages.map(app => 
                `<li><strong>${app.app_name}</strong> <small>(${app.package_name})</small></li>`
            ).join("");
        
            // Show the confirmation dialog
            confirmationModal.style.display = "flex";
            document.body.classList.add("no-scroll");
            setTimeout(() => {
                confirmationModal.style.opacity = "1";
            }, 10);

            function closeModal(confirmed = false) {
                document.body.classList.remove("no-scroll");
                confirmationModal.style.opacity = "0";
                setTimeout(() => {
                    confirmationModal.style.display = "none";
                    resolve(confirmed); // Resolve the promise with user's choice
                }, 300);
            }

            // Cancel buttons
            document.querySelectorAll('.close-modal, #cancel-action').forEach(button => {
                button.addEventListener('click', () => closeModal(false));
            });

            // Click outside
            confirmationModal.addEventListener('click', (event) => {
                if (!modalContent.contains(event.target)) {
                    closeModal(false);
                }
            });

            // Confirm button
            document.getElementById('confirm-action').addEventListener('click', () => {
                closeModal(true);
            });
        });

        // If user cancelled, return early
        if (!confirmed) return;
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
        toast("Done! Reboot your device!");
    } catch (error) {
        toast("Error updating removed apps list");
        console.error("Error:", error);
    }
}

// Function to apply ripple effect
export function applyRippleEffect() {
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

/**
 * Gets detailed information about a specific app
 * @param {string} packageName - The package name of the app
 * @returns {Promise<object>} - App information
 */
async function getAppInfo(packageName) {
    try {
        // Execute command to get app info
        const result = await ksuExec(`
            # Get basic app info
            VERSION=$(dumpsys package ${packageName} | grep versionName | head -1 | cut -d= -f2)
            IS_SYSTEM=$(dumpsys package ${packageName} | grep -q "system app" && echo "true" || echo "false")
            
            # Format output for parsing
            echo "VERSION:$VERSION"
            echo "IS_SYSTEM:$IS_SYSTEM"
        `);
        
        if (result.errno !== 0) {
            throw new Error(`Command failed with error: ${result.stderr}`);
        }
        
        // Parse the output into an object
        const lines = result.stdout.split('\n');
        const info = {};
        
        lines.forEach(line => {
            const [key, value] = line.split(':', 2);
            if (key && value) {
                info[key.trim()] = value.trim();
            }
        });
        
        return info;
    } catch (error) {
        console.error("Error getting app info:", error);
        return { error: error.message };
    }
}

/**
 * Shows app info modal with details
 * @param {string} packageName - The package name of the app
 */
function showAppInfoModal(packageName) {
    // First try to find the app in our list
    const app = appList.find(a => a.package_name === packageName);
    if (!app) {
        toast("App not found");
        return;
    }
    
    // Create the modal first with loading state
    const infoModal = document.createElement('div');
    infoModal.className = 'modal';
    infoModal.id = 'app-info-modal';
    
    infoModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${app.app_name}</h2>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="app-info-container">
                    <div class="app-icon-container" style="width: 64px; height: 64px; margin-bottom: 16px;">
                        <img src="icons/${app.package_name}.png" 
                            onerror="this.src='default.png'" 
                            alt="${app.app_name} icon"
                            style="width: 100%; height: 100%; border-radius: 12px;">
                    </div>
                    
                    <p><strong>Package Name:</strong> ${app.package_name}</p>
                    <p><strong>Path:</strong> ${app.app_path}</p>
                    <p id="app-version"><strong>Version:</strong> <span>Loading...</span></p>
                    <p id="app-system"><strong>System App:</strong> <span>Loading...</span></p>
                </div>
                
                <div class="modal-actions">
                    <button id="close-info" class="modal-btn ripple-element">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(infoModal);
    
    // Show the modal
    infoModal.style.display = 'flex';
    document.body.classList.add('no-scroll');
    setTimeout(() => {
        infoModal.style.opacity = 1;
    }, 10);
    
    // Add close functionality
    const closeModal = () => {
        document.body.classList.remove('no-scroll');
        infoModal.style.opacity = 0;
        setTimeout(() => {
            infoModal.remove();
        }, 300);
    };
    
    infoModal.querySelector('.close-modal').addEventListener('click', closeModal);
    infoModal.querySelector('#close-info').addEventListener('click', closeModal);
    infoModal.addEventListener('click', (event) => {
        if (event.target === infoModal) {
            closeModal();
        }
    });
    
    // Fetch detailed app info
    getAppInfo(packageName).then(info => {
        // Format the size in a human-readable format
        const formatSize = (sizeInKb) => {
            if (!sizeInKb) return 'Unknown';
            const kb = parseInt(sizeInKb);
            if (isNaN(kb)) return 'Unknown';
            
            if (kb < 1024) return `${kb} KB`;
            const mb = kb / 1024;
            if (mb < 1024) return `${mb.toFixed(2)} MB`;
            const gb = mb / 1024;
            return `${gb.toFixed(2)} GB`;
        };
        
        // Format date string
        const formatDate = (dateStr) => {
            if (!dateStr) return 'Unknown';
            try {
                const date = new Date(dateStr);
                return date.toLocaleString();
            } catch (e) {
                return dateStr;
            }
        };
        
        // Update the elements with actual data
        document.getElementById('app-version').querySelector('span').textContent = 
            info.VERSION || 'Not available';
            
        document.getElementById('app-system').querySelector('span').textContent = 
            info.IS_SYSTEM === 'true' ? 'Yes' : 'No';
    }).catch(error => {
        console.error("Failed to get app info:", error);
        // Update UI to show error
        document.querySelectorAll('#app-info-modal .modal-body p span').forEach(span => {
            span.textContent = 'Unable to fetch';
        });
    });
}

export function setupLongPressForAppInfo() {
    const appList = document.getElementById('app-list');
    
    // Using a MutationObserver to handle dynamically added apps
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('app')) {
                        setupLongPressForAppItem(node);
                    }
                });
            }
        });
    });
    
    // Start observing the app list for changes
    observer.observe(appList, { childList: true });
    
    // Setup for existing apps
    document.querySelectorAll('.app').forEach(app => {
        setupLongPressForAppItem(app);
    });
}

/**
 * Set up long press detection for a single app item
 * @param {HTMLElement} appElement - The app element to set up
 */
function setupLongPressForAppItem(appElement) {
    let longPressTimer;
    let isLongPress = false;
    const longPressDuration = 500; // milliseconds for long press
    
    appElement.addEventListener('pointerdown', (e) => {
        isLongPress = false;
        
        // Don't trigger if we're clicking on the checkbox
        if (e.target.type === 'checkbox') return;
        
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            // Visual feedback
            appElement.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
            
            // Get package name and show info
            const packageName = appElement.dataset.packageName;
            if (packageName) {
                showAppInfoModal(packageName);
            }
            
            // Reset visual feedback after a short delay
            setTimeout(() => {
                appElement.style.backgroundColor = '';
            }, 300);
        }, longPressDuration);
    });
    
    // Clear timer if pointer is moved significantly
    appElement.addEventListener('pointermove', (e) => {
        if (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5) {
            clearTimeout(longPressTimer);
        }
    });
    
    // Clear timer on pointer up
    appElement.addEventListener('pointerup', (e) => {
        clearTimeout(longPressTimer);
        
        // If this was a long press, prevent the normal click action
        if (isLongPress) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // Also clear on pointer cancel/leave
    appElement.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
    appElement.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
}
