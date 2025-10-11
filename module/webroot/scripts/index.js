// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { toast, setupSearch, setupScrollEvent, setupDropdownMenu, checkMMRL, fetchAppList, displayAppList, updateAppList, appList, applyRippleEffect, initialTransition } from "./util.js";
import { initFileSelector, openFileSelector } from "./file_selector.js";

// Triple click handler for developer mode
let headerClickCount = 0;
let headerClickTimer;

// Import modal menu
export function importModalMenu() {
    const importModalMenu = document.getElementById('import-modal');
    const importModalMenuContent = document.querySelector('.modal-content');
    const packageListInput = document.getElementById('package-list-input');
    const fileImportBtn = document.getElementById('file-import-btn');

    // Open import modal
    importModalMenu.style.display = 'flex';
    document.body.classList.add('no-scroll');
    setTimeout(() => {
        importModalMenu.style.opacity = 1;
    }, 10);

    function closeImportModal() {
        document.body.classList.remove('no-scroll');
        importModalMenu.style.opacity = 0;
        setTimeout(() => {
            importModalMenu.style.display = 'none';
        }, 300);
        packageListInput.value = '';
    }

    // Keyboard friendly
    packageListInput.addEventListener('focus', () => {
        importModalMenuContent.style.transform = 'translateY(-20vh)';
    });
    packageListInput.addEventListener('blur', () => {
        importModalMenuContent.style.transform = 'translateY(0)';
    });
    packageListInput.focus();

    fileImportBtn.addEventListener('click', () => openFileSelector());

    // Close import modal when clicking outside
    importModalMenu.addEventListener('click', (event) => {
        if (!importModalMenuContent.contains(event.target)) {
            closeImportModal();
        }
    });

    // Close import modal when clicking cancel or close button
    document.querySelectorAll('.close-modal, #cancel-import').forEach(button => {
        button.addEventListener('click', () => {
            closeImportModal();
        });
    });

    document.getElementById('confirm-import').addEventListener('click', async() => {
        const inputValue = packageListInput.value.trim();
        if (inputValue.length === 0) {
            toast("Please enter valid package names");
            closeImportModal();
            return;
        }

        let packages = [];
        
        // Check if input looks like JSON (starts with { and ends with })
        if (inputValue.startsWith('{') && inputValue.endsWith('}')) {
            try {
                const jsonData = JSON.parse(inputValue);
                
                // Check if it has the expected structure with apps array
                if (jsonData.apps && Array.isArray(jsonData.apps)) {
                    packages = jsonData.apps
                        .filter(app => app.packageName)
                        .map(app => app.packageName.trim())
                        .filter(Boolean);
                } else {
                    toast("Invalid JSON format - expected 'apps' array with 'packageName' properties");
                    closeImportModal();
                    return;
                }
            } catch (jsonError) {
                toast("Error parsing JSON - please check format");
                console.error('JSON parsing error:', jsonError);
                closeImportModal();
                return;
            }
        } else {
            // Handle text format (original behavior)
            packages = inputValue.split('\n').map(pkg => pkg.trim()).filter(Boolean);
        }
        
        if (packages.length === 0) {
            toast("No package names found");
            closeImportModal();
            return;
        }

        // Filter apps from appList that match the package names
        const filteredApps = appList.filter(app => packages.includes(app.package_name));
        const foundCount = filteredApps.length;
        const notFoundCount = packages.length - foundCount;

        if (foundCount > 0) {
            // Display entire appList
            await displayAppList(appList, undefined, true);

            // Click matching apps to trigger move checked app to top
            filteredApps.forEach(app => {
                const appDiv = document.querySelector(`.app[data-package-name="${app.package_name}"]`);
                if (appDiv) appDiv.click();
            });
        }

        // Show appropriate toast message
        if (foundCount === 0) {
            toast(`None of the ${packages.length} package(s) found in system apps`);
        } else if (notFoundCount > 0) {
            toast(`${foundCount} package(s) found, ${notFoundCount} not found`);
        } else {
            toast(`${foundCount} package(s) found and selected`);
        }

        closeImportModal();
    });
}

// Initialize dev mode triple-click handler
function initDevModeHandler() {
    const header = document.querySelector('.header h1');
    if (header) {
        header.addEventListener('click', () => {
            headerClickCount++;
            
            // Reset counter after 1 second
            clearTimeout(headerClickTimer);
            headerClickTimer = setTimeout(() => {
                headerClickCount = 0;
            }, 1000);
            
            // If triple clicked, navigate to raw whiteout page
            if (headerClickCount === 3) {
                headerClickCount = 0;
                window.location.href = 'raw_whiteout.html';
            }
        });
    }
}

/**
 * Nuke button
 * Use availability of nuke button to check if we need to initialize
 */
const nukeButton = document.getElementById("nuke-button");
if (nukeButton) {
    nukeButton.addEventListener("click", async () => {
        await updateAppList();
    });

    document.addEventListener("DOMContentLoaded", () => {
        initialTransition();
        setTimeout(() => {
            fetchAppList("link/app_list.json", true);
            fetchAppList("link/nuke_list.json");
            checkMMRL();
        }, 10);
        setupSearch();
        setupScrollEvent();
        setupDropdownMenu();
        applyRippleEffect();
        initFileSelector();
        initDevModeHandler();
    });
}
