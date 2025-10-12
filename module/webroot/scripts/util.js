import { importModalMenu } from "./index.js";
import { exportPackageList } from "./restore.js";

export let appList = [], 
           nukeList = [], 
           isShellRunning = false, 
           initialized = false, 
           categoriesData = null,
           currentSearchTerm = '',
           activeCategory = 'all';

// Loading screen management
let loadingInterval = null;
let loadingCheckInterval = null;

export function showLoadingScreen(status = "Initializing...") {
    const loadingScreen = document.getElementById('loading-screen');
    const appListContainer = document.getElementById('app-list');
    const loadingStatus = document.querySelector('.loading-status');
    
    if (loadingScreen && appListContainer) {
        loadingScreen.style.display = 'flex';
        if (loadingStatus) {
            loadingStatus.textContent = status;
        }
        
        // Hide the app list content
        const appItems = appListContainer.querySelectorAll('.app-item');
        appItems.forEach(item => item.style.display = 'none');
        
        // Start periodic app list checking if not already running
        if (!loadingCheckInterval) {
            startPeriodicAppListCheck();
        }
    }
}

export function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const appListContainer = document.getElementById('app-list');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Show the app list content
    if (appListContainer) {
        const appItems = appListContainer.querySelectorAll('.app-item');
        appItems.forEach(item => item.style.display = '');
    }
    
    // Stop periodic checking
    if (loadingCheckInterval) {
        clearInterval(loadingCheckInterval);
        loadingCheckInterval = null;
    }
}

function startPeriodicAppListCheck() {
    loadingCheckInterval = setInterval(async () => {
        try {
            // Check if app list file exists and is valid
            const response = await fetch("link/app_list.json");
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    // App list is ready, fetch it properly
                    await fetchAppList("link/app_list.json", true);
                    return; // fetchAppList will call hideLoadingScreen
                }
            }
            
            // Update loading status
            const loadingStatus = document.querySelector('.loading-status');
            if (loadingStatus) {
                const statuses = [
                    "Scanning system applications...",
                    "Processing app data...",
                    "Building app list...",
                    "Almost ready..."
                ];
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                loadingStatus.textContent = randomStatus;
            }
        } catch (error) {
            console.log("App list not ready yet, continuing to check...");
        }
    }, 1000); // Check every second
}

// Timer for delaying moveCheckedAppsToTop
let moveCheckedAppsTimer = null;

// Record footer click and href redirect event
let footerClick = false;

export  async function ksuExec(command) {
    return new Promise((resolve) => {
        let callbackName = `exec_callback_${Date.now()}`;
        window[callbackName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            delete window[callbackName];
        };
        try {
            ksu.exec(command, "{}", callbackName);
        } catch (error) {
            toast(`Error executing command: ${error.message}`);
            resolve({ errno: 1, stdout: '', stderr: error.message });
            delete window[callbackName];
        }
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
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-btn');
    
    searchInput.addEventListener('input', (e) => {
        window.scrollTo(0, 0);
        currentSearchTerm = e.target.value.toLowerCase();
        applyFilters();
        
        // Toggle clear button visibility
        clearBtn.style.display = currentSearchTerm.length > 0 ? 'block' : 'none';
    });
    
    clearBtn.addEventListener('click', () => {
        window.scrollTo(0, 0);
        searchInput.value = '';
        currentSearchTerm = '';
        applyFilters();
        clearBtn.style.display = 'none';
    });
}

// Handle link within webui
async function linkFile() {
    try {
        await ksuExec(`[ -L "/data/adb/modules/system_app_nuker/webroot/link" ] || ln -s /data/adb/system_app_nuker /data/adb/modules/system_app_nuker/webroot/link`);
    } catch (error) {
        console.error("Failed to link file:", error);
    }
}

// Fetch system apps
export async function fetchAppList(file, display = false) {
    try {
        const response = await fetch(file);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${file}`);
        }
        const data = await response.json();
        
        // Validate app list data
        if (!Array.isArray(data)) {
            throw new Error(`Invalid app list data from ${file}`);
        }
        
        // Handle empty data - still process it for display
        if (data.length === 0) {
            console.log(`Empty app list from ${file}`);
        }
        
        data.sort((a, b) => a.app_name.localeCompare(b.app_name));
        if (file === "link/app_list.json") {
            appList = data;
            // Hide loading screen when app list is successfully loaded
            hideLoadingScreen();
        } else {
            nukeList = data;
        }
        if (display) {
            displayAppList(data);
            applyRippleEffect();
        }
    } catch (error) {
        console.error("Failed to fetch system apps:", error);
        
        // Handle missing or invalid files
        if (file === "link/nuke_list.json" && display) {
            // For nuke list on restore page, show empty state
            nukeList = [];
            displayAppList([]);
            applyRippleEffect();
            return;
        }
        
        // Show loading screen if app list fails to load
        if (file === "link/app_list.json") {
            showLoadingScreen("App list not ready yet...");
        }
        
        await linkFile();
        // Don't reload immediately, let the periodic checker handle it
    }
}

// Display app list
let allAppsData = []; // Store all apps data
let currentlyLoadedApps = 0;
const APPS_PER_BATCH = 20;
let isLoadingMoreApps = false;

export async function displayAppList(data, reset = true, all = false) {
    // Load categories if not already loaded
    if (!categoriesData) await loadCategories();

    const appListDiv = document.getElementById("app-list");

    // Check if this is the restore page and nuke list is empty
    if (window.location.pathname.includes('restore.html') && data && data.length === 0) {
        appListDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-content">
                    <div class="empty-state-icon">🚀</div>
                    <h3>You didn't nuke anything, yet...</h3>
                    <p>Go nuuuuuke ><</p>
                    <a href="index.html" class="modal-btn">Start Nuking Apps</a>
                </div>
            </div>
        `;
        return;
    }

    // Reset or store all apps data
    if (reset) {
        appListDiv.innerHTML = "";
        allAppsData = [...data];
        currentlyLoadedApps = 0;
        // Remove scroll event listener if exists
        window.removeEventListener('scroll', handleLazyLoad);
        // Add scroll event listener for lazy loading if not displaying all
        if (!all) window.addEventListener('scroll', handleLazyLoad);
    }

    // Calculate batch size and apps to render
    const batchSize = all ? allAppsData.length : APPS_PER_BATCH;
    const nextBatchEnd = Math.min(currentlyLoadedApps + batchSize, allAppsData.length);
    const appsToRender = allAppsData.slice(currentlyLoadedApps, nextBatchEnd);

    if (appsToRender.length === 0) return; // No more apps to load

    // Generate HTML for the next batch
    const htmlContent = appsToRender.map((pkg) => {
        const category = getCategoryInfo(pkg.package_name);

        // Different approach for category display:
        // 1. For known categories: show a small colored dot with the category name
        // 2. For unknown category: show nothing
        const categoryBadgeHtml = category.id !== "unknown" ? 
            `<div class="app-category-container">
                <span class="category-dot" style="background-color: ${category.color}"></span>
                <span class="app-category">${category.name}</span>
             </div>` : '';
        
        return `
        <div class="app ripple-element" 
             data-package-name="${pkg.package_name}" 
             data-app-path="${pkg.app_path}" 
             data-app-name="${pkg.app_name}"
             data-category="${category.id}">
            <div class="app-info">
                <div class="app-icon-container">
                    <div class="icon-loading">Loading...</div>
                    <img class="app-icon" 
                        src="link/icons/${pkg.package_name}.png" 
                        style="opacity: 0;" 
                        onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" 
                        onerror="this.src='default.png'; this.style.opacity='1'; this.previousElementSibling.style.display='none';" 
                        alt="Icon">
                </div>
                <div class="app-details">
                    <span class="app-name"><span>${pkg.app_name}</span></span>
                    <span class="app-package"><span>${pkg.package_name}</span></span>
                    <span class="app-path"><span>${pkg.app_path}</span></span>
                    ${categoryBadgeHtml}
                </div>
            </div>
            <input class="app-selector" type="checkbox">
        </div>
    `}).join("");

    // Append the new batch to the existing content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Append each child individually
    while (tempDiv.firstChild) appListDiv.appendChild(tempDiv.firstChild);

    // Update the count of loaded apps
    currentlyLoadedApps = nextBatchEnd;

    // Add event handlers to newly added app divs
    setupAppDivEventHandlers(appListDiv.querySelectorAll('.app:nth-last-child(-n+' + appsToRender.length + ')'));

    // Create category filters - only on initial load
    if (reset) createCategoryFilters();
    applyRippleEffect();

    // If filter/search is active, apply it to newly loaded content
    if (currentSearchTerm || activeCategory !== 'all') applyFilters();
    isLoadingMoreApps = false;
}

// Set up event handlers for app divs
function setupAppDivEventHandlers(appDivs) {
    appDivs.forEach(appDiv => {
        // Check checkbox on whole app card
        appDiv.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                const wasChecked = checkbox.checked;
                checkbox.checked = !wasChecked;
                // Clear any existing timer
                if (moveCheckedAppsTimer) clearTimeout(moveCheckedAppsTimer);
                // Set a new timer to move checked apps after 1 second
                moveCheckedAppsTimer = setTimeout(() => {
                    moveCheckedAppsToTop();
                    moveCheckedAppsTimer = null;
                }, 1000);
            }
        });

        // Overflow scroll
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

        // Long press to show app info modal
        appDiv.addEventListener('pointerdown', () => {
            let holdTimeout;
            holdTimeout = setTimeout(() => {
                const appData = {
                    app_name: appDiv.dataset.appName,
                    package_name: appDiv.dataset.packageName,
                    app_path: appDiv.dataset.appPath,
                    category: appDiv.dataset.category
                };
                showAppInfoModal(appData);
            }, 300);
            appDiv.addEventListener('pointerup', () => {
                clearTimeout(holdTimeout);
            });
            appDiv.addEventListener('pointercancel', () => {
                clearTimeout(holdTimeout);
            });
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
                app_name: appDiv.dataset.appName
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

            // Check for critical apps
            const criticalApps = selectedPackages.filter(app => {
                const category = getCategoryInfo(app.package_name);
                return category.id === 'essential' || category.id === 'caution';
            });

            // Update warning text based on critical apps
            const warningText = document.querySelector(".warning-text");
            if (criticalApps.length > 0) {
                warningText.innerHTML = `
                    <strong>WARNING:</strong> You are about to remove ${criticalApps.length} critical system 
                    app(s) that may affect device functionality or cause stability issues!
                `;
                warningText.style.color = "#ff0000";
            } else {
                warningText.innerHTML = "This action may affect device functionality.";
                warningText.style.color = "#f44336";
            }

            // Update list with category indicators
            selectedAppsList.innerHTML = selectedPackages.map(app => {
                const category = getCategoryInfo(app.package_name);
                return `<li>
                    <strong>${app.app_name}</strong> 
                    <small>(${app.package_name})</small>
                    <span class="filter-btn" style="background-color: ${category.color}; color: white; 
                           padding: 2px 6px; font-size: 10px; border-radius: 4px; margin-left: 5px;">
                        ${category.name}
                    </span>
                </li>`;
            }).join("");
            
            // Show the confirmation dialog
            confirmationModal.style.display = "flex";
            document.body.classList.add("no-scroll");
            setTimeout(() => {
                confirmationModal.style.opacity = "1";
                modalContent.style.transform = "scale(1)";
            }, 10);
    
            function closeModal(confirmed = false) {
                document.body.classList.remove("no-scroll");
                confirmationModal.style.opacity = "0";
                modalContent.style.transform = "scale(0.8)";
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

// Function to setup dropdown menu
export function setupDropdownMenu() {
    const menuButton = document.getElementById('menu-button');
    const menuDropdown = document.getElementById('menu-dropdown');

    // Open menu or close if already open
    menuButton.addEventListener('click', () => {
        if (menuDropdown.style.display === 'flex') {
            closeDropdownMenu();
        } else {
            // Move the dropdown to the body element
            document.body.appendChild(menuDropdown);
            
            // Position it correctly
            const rect = menuButton.getBoundingClientRect();
            menuDropdown.style.top = (rect.bottom + 5) + 'px';
            menuDropdown.style.right = (window.innerWidth - rect.right) + 'px';
            menuDropdown.style.zIndex = '10';
            
            menuDropdown.style.display = 'flex';
            setTimeout(() => {
                menuDropdown.style.opacity = 1;
                menuDropdown.style.transform = 'scale(1)';
            }, 10);
        }
    });

    function closeDropdownMenu() {
        menuDropdown.style.opacity = 0;
        menuDropdown.style.transform = 'scale(0)';
        setTimeout(() => {
            menuDropdown.style.display = 'none';
        }, 300);
    }

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!menuButton.contains(event.target)) closeDropdownMenu();
    });

    // Close menu when scrolling
    window.addEventListener('scroll', () => closeDropdownMenu());

    const importOption = document.getElementById('import-option');
    if (importOption) importOption.addEventListener('click', () => importModalMenu());

    const exportOption = document.getElementById('export-option');
    if (exportOption) exportOption.addEventListener('click', () => exportPackageList());
}

/**
 * Simulate MD3 ripple animation
 * Usage: class="ripple-element" style="position: relative; overflow: hidden;"
 * Note: Require background-color to work properly
 * @return {void}
 */
export function applyRippleEffect() {
    document.querySelectorAll('.ripple-element').forEach(element => {
        if (element.dataset.rippleListener !== "true") {
            element.addEventListener("pointerdown", async (event) => {
                // Pointer up event
                const handlePointerUp = () => {
                    ripple.classList.add("end");
                    setTimeout(() => {
                        ripple.classList.remove("end");
                        ripple.remove();
                    }, duration * 1000);
                    element.removeEventListener("pointerup", handlePointerUp);
                    element.removeEventListener("pointercancel", handlePointerUp);
                };
                element.addEventListener("pointerup", () => setTimeout(handlePointerUp, 80));
                element.addEventListener("pointercancel", () => setTimeout(handlePointerUp, 80));

                // Return if scroll or footer click detected in 80ms
                await new Promise(resolve => setTimeout(resolve, 80));
                if (isScrolling || footerClick) return;
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
                const isDarkColor = (color) => {
                    const rgb = color.match(/\d+/g);
                    if (!rgb) return false;
                    const [r, g, b] = rgb.map(Number);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 96; // Luma formula
                };
                ripple.style.backgroundColor = isDarkColor(bgColor) ? "rgba(255, 255, 255, 0.2)" : "";

                // Append ripple
                element.appendChild(ripple);
            });
            element.dataset.rippleListener = "true";
        }
    });
}

// Function to check if running in MMRL
export async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Set status bars theme based on device theme
        try {
            $system_app_nuker.setLightStatusBars(!window.matchMedia('(prefers-color-scheme: dark)').matches)
        } catch (error) {
            console.log("Error setting status bars theme:", error)
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

        // Apply to header
        document.querySelector('.header').style.opacity = opacity.toString();
        document.querySelector('.header').style.transform = `scale(${scale}) translateY(-${translateY}px)`;

        // IMPORTANT: Apply EXACT same transform to both elements
        // Using a variable to ensure they're exactly the same
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.style.transform = `translateY(-${scrollPosition}px)`;
        }

        const categoryFilters = document.querySelector('.category-filters');
        if (categoryFilters) {
            const categoryFiltersScroll = scrollRange + categoryFilters.offsetHeight;
            const translateYPosition = Math.min(Math.max(window.scrollY, 0), categoryFiltersScroll);
            categoryFilters.style.transform = `translateY(-${translateYPosition}px)`;
        }

        lastScrollY = window.scrollY;
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 100);
    });
}

// App info modal
async function showAppInfoModal(app) {
    const appInfoModal = document.getElementById('app-info-modal');
    const appInfoModalContent = document.getElementById('app-info-modal-content');

    if (!appInfoModal) return;

    // Get category info
    const category = getCategoryInfo(app.package_name);

    // Update modal content using the app object
    appInfoModal.querySelector('#app-name').textContent = app.app_name;
    appInfoModal.querySelector('#app-icon').src = `link/icons/${app.package_name}.png`;
    appInfoModal.querySelector('#app-package').textContent = app.package_name;
    appInfoModal.querySelector('#app-path').textContent = app.app_path;

    // Set category display
    const categoryDisplay = appInfoModal.querySelector('#app-category');

    if (category.id === "unknown") {
        // For unknown category, only show the description without the badge
        categoryDisplay.innerHTML = `
            <span class="category-description">${category.description}</span>
        `;
    } else {
        // Stacked layout with description below the badge and name
        categoryDisplay.innerHTML = `
            <div class="category-container">
                <div class="category-header">
                    <span class="category-indicator-dot" style="background-color: ${category.color};"></span>
                    <span class="category-name">${category.name}</span>
                </div>
                <span class="category-description">${category.description}</span>
            </div>
        `;
    }

    // Show the modal
    appInfoModal.style.display = 'flex';
    document.body.classList.add('no-scroll');
     setTimeout(() => {
        appInfoModal.style.opacity = 1;
        appInfoModalContent.style.transform = 'scale(1)';
    }, 10);

    // Add close functionality
    const closeModal = () => {
        document.body.classList.remove('no-scroll');
        appInfoModal.style.opacity = 0;
        appInfoModalContent.style.transform = 'scale(0.8)';
        setTimeout(() => {
            appInfoModal.style.display = 'none';
        }, 300);
    };

    // Close modal
    appInfoModal.querySelector('.close-modal').addEventListener('click', closeModal);
    appInfoModal.querySelector('#close-info').addEventListener('click', closeModal);
    appInfoModal.addEventListener('click', (event) => {
        if (event.target === appInfoModal) closeModal();
    });

    try {
        const versionResult = await ksuExec(`dumpsys package ${app.package_name} | grep versionName | head -1 | cut -d= -f2`);

        // Update the version with actual data
        document.getElementById('app-version').textContent = versionResult.stdout.trim() || 'Not available';
    } catch (error) {
        console.error("Failed to get app info:", error);
        document.getElementById('app-version').textContent = 'Unable to fetch';
    }

    // Allow tap to copy
    document.querySelectorAll('.app-info-detail-text').forEach(el => {
        if (!el.dataset.listenerAdded) {
            el.addEventListener('click', () => {
                navigator.clipboard.writeText(el.innerText).then(() => {
                    toast("Text copied to clipboard: " + el.innerText);
                }).catch(err => {
                    console.error("Failed to copy text: ", err);
                });
            });
            el.dataset.listenerAdded = true;
        }
    });
}

async function loadCategories() {
    if (categoriesData) return categoriesData;

    try {
        const response = await fetch('categories.json');
        categoriesData = await response.json();
        return categoriesData;
    } catch (error) {
        console.error("Failed to load categories:", error);
        // Fallback to basic categories
        return {
            categories: [
                { id: "unknown", name: "Unknown", color: "#9e9e9e", icon: "help", description: "Uncategorized app" }
            ],
            apps: {}
        };
    }
}

// Function to get category info for a package
function getCategoryInfo(packageName) {
    if (!categoriesData) return { id: "unknown", name: "Unknown", color: "#9e9e9e", icon: "help", description: "Uncategorized app" };

    const categoryId = categoriesData.apps[packageName] || "unknown";
    const category = categoriesData.categories.find(c => c.id === categoryId) || 
                    { id: "unknown", name: "Unknown", color: "#9e9e9e", icon: "help", description: "Uncategorized app" };

    return category;
}

// Create category filters
function createCategoryFilters() {
    if (!categoriesData) return;

    const filterContainer = document.querySelector('.category-filters') || document.createElement('div');

    if (!document.querySelector('.category-filters')) {
        filterContainer.className = 'category-filters';
        const searchContainer = document.querySelector('.search-container');
        searchContainer.parentNode.insertBefore(filterContainer, searchContainer.nextSibling);
    }

    // Clear existing filters
    filterContainer.innerHTML = '';

    // Add "All" filter
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn filter-all active ripple-element';
    allBtn.dataset.category = 'all';
    allBtn.textContent = 'All';
    filterContainer.appendChild(allBtn);

    // Add filters for each category that has apps
    const usedCategories = new Set(Object.values(categoriesData.apps));

    categoriesData.categories.forEach(category => {
        // Skip the "unknown" category
        if (category.id === 'unknown') return;

        // Only add categories that are actually used by apps
        if (usedCategories.has(category.id)) {
            const btn = document.createElement('button');
            btn.className = `filter-btn filter-${category.id} ripple-element`;
            btn.dataset.category = category.id;
            btn.style.backgroundColor = category.color;
            btn.style.color = 'white';
            btn.textContent = category.name;
            filterContainer.appendChild(btn);
        }
    });

    // Add filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            activeCategory = this.dataset.category;
            applyFilters();
        });
    });

    applyRippleEffect();
}

// Function to apply both filters at once
function applyFilters() {
    const apps = document.querySelectorAll('.app, .removed-app');
    let visibleCount = 0;

    apps.forEach(app => {
        // Reset any previous highlighting
        const appNameEl = app.querySelector('span.app-name span');
        const appPackageEl = app.querySelector('span.app-package span');
        const appPathEl = app.querySelector('span.app-path span');

        if (appNameEl && appNameEl.innerHTML.includes('<mark>')) {
            appNameEl.innerHTML = appNameEl.textContent;
        }
        if (appPackageEl && appPackageEl.innerHTML.includes('<mark>')) {
            appPackageEl.innerHTML = appPackageEl.textContent;
        }
        if (appPathEl && appPathEl.innerHTML.includes('<mark>')) {
            appPathEl.innerHTML = appPathEl.textContent;
        }

        // Get app data for filtering
        const appName = app.querySelector('span.app-name').textContent.toLowerCase();
        const appPackage = app.querySelector('span.app-package').textContent.toLowerCase();
        const appPath = app.querySelector('span.app-path').textContent;
        const apkFilename = appPath.substring(appPath.lastIndexOf('/') + 1).toLowerCase();
        const appCategory = app.dataset.category;

        // Check if app passes both filters
        const matchesSearch = !currentSearchTerm || 
                              fuzzyMatch(appName, currentSearchTerm) || 
                              fuzzyMatch(appPackage, currentSearchTerm) ||
                              fuzzyMatch(apkFilename, currentSearchTerm);
                              
        const matchesCategory = activeCategory === 'all' || appCategory === activeCategory;

        // Only show the app if it matches both filters
        if (matchesSearch && matchesCategory) {
            app.style.display = 'flex';
            visibleCount++;

            // Apply highlighting for search matches
            if (currentSearchTerm) {
                if (appNameEl) {
                    appNameEl.innerHTML = highlightText(appNameEl.textContent, currentSearchTerm);
                }
                if (appPackageEl) {
                    appPackageEl.innerHTML = highlightText(appPackageEl.textContent, currentSearchTerm);
                }
                if (appPathEl) {
                    // Extract the filename for highlighting
                    const fullPath = appPathEl.textContent;
                    const lastSlashIndex = fullPath.lastIndexOf('/');
                    if (lastSlashIndex !== -1 && lastSlashIndex < fullPath.length - 1) {
                        const beforeFilename = fullPath.substring(0, lastSlashIndex + 1);
                        const filename = fullPath.substring(lastSlashIndex + 1);
                        // Only highlight the filename portion
                        appPathEl.innerHTML = beforeFilename + highlightText(filename, currentSearchTerm);
                    } else {
                        appPathEl.innerHTML = highlightText(fullPath, currentSearchTerm);
                    }
                }
            }
        } else {
            app.style.display = 'none';
        }
    });

    // If search/filter is active and not many results are visible, load more content
    if ((currentSearchTerm || activeCategory !== 'all') && 
        visibleCount < 10 && 
        currentlyLoadedApps < allAppsData.length) {
        
        isLoadingMoreApps = true;
        setTimeout(() => displayAppList(null, false), 100);
    }

    // Move checked apps to top after a delay if not already scheduled
    if (!moveCheckedAppsTimer) {
        moveCheckedAppsTimer = setTimeout(() => {
            moveCheckedAppsToTop();
            moveCheckedAppsTimer = null;
        }, 1000);
    }
}

// Fuzzy search function
function fuzzyMatch(text, search) {
    // If no search term, everything matches
    if (!search) return true;

    search = search.toLowerCase();
    text = text.toLowerCase();

    // Exact substring match
    if (text.includes(search)) return true;

    // Simple fuzzy logic - all search characters must be in order
    let textIndex = 0;
    for (let i = 0; i < search.length; i++) {
        const searchChar = search[i];
        // Skip spaces in search term
        if (searchChar === ' ') continue;

        let found = false;
        while (textIndex < text.length) {
            if (text[textIndex] === searchChar) {
                found = true;
                textIndex++;
                break;
            }
            textIndex++;
        }
        if (!found) return false;
    }
    return true;
}

// Highlight matching text function
function highlightText(text, query) {
    if (!query) return text;

    // For direct matches
    if (text.toLowerCase().includes(query.toLowerCase())) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // No highlighting for fuzzy matches that aren't direct substring matches
    return text;
}

// Handle lazy loading on scroll
function handleLazyLoad() {
    if (isLoadingMoreApps) return;
    const appListDiv = document.getElementById("app-list");
    const contentBottom = appListDiv.getBoundingClientRect().bottom;
    const screenHeight = window.innerHeight;

    // Load more apps when user scrolls to bottom of list
    if (contentBottom <= screenHeight + 100 && currentlyLoadedApps < allAppsData.length) {
        isLoadingMoreApps = true;
        setTimeout(() => displayAppList(null, false), 100);
    }
}

function moveCheckedAppsToTop() {
    const appListContainer = document.getElementById('app-list');
    const apps = Array.from(appListContainer.querySelectorAll('.app'));

    // Sort the apps: checked ones at top, then alphabetical for unchecked
    apps.sort((a, b) => {
        const aChecked = a.querySelector('.app-selector').checked;
        const bChecked = b.querySelector('.app-selector').checked;

        // If checked status is different, put checked ones first
        if (aChecked && !bChecked) return -1;
        if (!aChecked && bChecked) return 1;

        // If both are checked or both are unchecked, sort alphabetically by app name
        const aName = a.querySelector('.app-name').textContent.toLowerCase();
        const bName = b.querySelector('.app-name').textContent.toLowerCase();
        return aName.localeCompare(bName);
    });

    // Remove and re-add all apps in the new order
    apps.forEach(app => app.remove());
    apps.forEach(app => appListContainer.appendChild(app));
}

// Show raw whiteout button if found any path from raw_whiteouts.txt
fetch('link/raw_whiteouts.txt')
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch whiteout paths');
        return response.text();
    })
    .then(async text => {
        const paths = text
            .split('\n')
            .filter(path => path.trim() && !path.trim().startsWith('#'));
        const whiteoutBtn = document.getElementById('whiteout-btn');
        const currentDisplay = getComputedStyle(whiteoutBtn).display;
        const targetDisplay = paths.length > 0 ? 'flex' : 'none';
        if (currentDisplay !== targetDisplay) {
            whiteoutBtn.style.display = targetDisplay;
            try {
                await ksuExec(`sed -i "s|#whiteout-btn{display:[^}]*;}|#whiteout-btn{display:${targetDisplay};}|g" /data/adb/modules/system_app_nuker/webroot/styles/layout.css`);
            } catch (error) {
                console.log('Failed to change property in CSS:', error);
            }
        } 
    })
    .catch(error => {
        console.error('File not found:', error);
    });

// function to setup initial transition
export function initialTransition() {
    const content = document.querySelector('.content-list');
    const categoryFilter = document.querySelector('.category-filters');
    const floatingButton = document.querySelector('.floating-button-container');
    const focusButton = document.querySelector(".focus-btn");

    // Add loaded class after a short delay to trigger the animation
    setTimeout(() => {
        floatingButton.style.transform = 'translateY(0)';
        content.classList.add('loaded');
        focusButton.classList.add('loaded');
        if (categoryFilter) categoryFilter.classList.add('loaded');
    }, 10);

    // Quit transition on switching page
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.href && link.href.startsWith(window.location.origin)) {
                footerClick = true;
                e.preventDefault();
                content.classList.remove('loaded');
                floatingButton.style.transition = 'all 0.s ease';
                floatingButton.style.transform = 'translateY(90px)';
                focusButton.classList.remove('loaded');
                if (categoryFilter) categoryFilter.classList.remove('loaded');
                setTimeout(() => {
                    window.location.href = link.href;
                }, 100);
            }
        });
    });
}
