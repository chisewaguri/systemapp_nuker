import { importModalMenu } from "./index.js";
import { exportPackageList } from "./restore.js";

export let appList = [], 
           nukeList = [], 
           isShellRunning = false, 
           initialized = false, 
           categoriesData = null,
           currentSearchTerm = '',
           activeCategory = 'all';

export  async function ksuExec(command) {
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
    // Load categories if not already loaded
    if (!categoriesData) {
        await loadCategories();
    }
    
    const appListDiv = document.getElementById("app-list");
    appListDiv.innerHTML = "";

    const htmlContent = data.map((pkg) => {
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
                    ${categoryBadgeHtml}
                </div>
            </div>
            <input class="app-selector" type="checkbox">
        </div>
    `}).join("");

    appListDiv.innerHTML = htmlContent;

    // Rest of the function remains the same...
    // Add click handlers to all app divs
    document.querySelectorAll('.app').forEach(appDiv => {
        // Check checkbox on whole app card
        appDiv.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                const wasChecked = checkbox.checked;
                checkbox.checked = !wasChecked;
                
                // Call the function to move checked apps to top
                setTimeout(moveCheckedAppsToTop, 100);
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
    
    // Create category filters
    createCategoryFilters();
    
    applyRippleEffect();
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
        if (!menuButton.contains(event.target)) {
            closeDropdownMenu();
        }
    });

    // Close menu when scrolling
    window.addEventListener('scroll', () => {
        closeDropdownMenu();
    });

    const importOption = document.getElementById('import-option');
    if (importOption) {
        importOption.addEventListener('click', () => {
            importModalMenu();
        });
    }

    const exportOption = document.getElementById('export-option');
    if (exportOption) {
        exportOption.addEventListener('click', () => {
            exportPackageList();
        });
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
        
        // Apply to header
        document.querySelector('.header').style.opacity = opacity.toString();
        document.querySelector('.header').style.transform = `scale(${scale}) translateY(-${translateY}px)`;
        
        // IMPORTANT: Apply EXACT same transform to both elements
        // Using a variable to ensure they're exactly the same
        const offset = scrollPosition;
        
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.style.transform = `translateY(-${offset}px)`;
        }

        const categoryFilters = document.querySelector('.category-filters');
        if (categoryFilters) {
            const categoryFiltersHeight = categoryFilters.offsetHeight;
            const progress = Math.min(Math.max(window.scrollY / (categoryFiltersHeight + 10), 0), 1);
            const translateYPosition = progress * (categoryFiltersHeight + offset + 10);
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
    appInfoModal.querySelector('#app-icon').src = `icons/${app.package_name}.png`;
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

    // Move checked apps to top
    moveCheckedAppsToTop();
}

// Fuzzy search function
function fuzzyMatch(text, search) {
    // If no search term, everything matches
    if (!search) return true;
    
    search = search.toLowerCase();
    text = text.toLowerCase();
    
    // Exact substring match
    if (text.includes(search)) {
        return true;
    }
    
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
