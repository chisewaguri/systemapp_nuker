// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { toast, setupSearch, setupScrollEvent, setupDropdownMenu, checkMMRL, fetchAppList, updateAppList, appList, applyRippleEffect, initialTransition } from "./util.js";
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

    fileImportBtn.addEventListener('click', () => {
        closeImportModal();
        setTimeout(() => {
            openFileSelector();
        }, 300);
    });

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

    document.getElementById('confirm-import').addEventListener('click', () => {
        const packages = packageListInput.value.trim().split('\n').map(pkg => pkg.trim());
        if (packages.length === 0) {
            toast("Please enter valid package names");
            closeImportModal();
            return;
        }

        let foundCount = 0, notFoundCount = 0, firstFoundApp = null;

        // Select app if found
        packages.forEach(packageName => {
            if (appList.some(app => app.package_name === packageName)) {
                const appDiv = document.querySelector(`.app[data-package-name="${packageName}"]`);
                if (appDiv) {
                    const checkbox = appDiv.querySelector('.app-selector');
                    if (checkbox) {
                        if (checkbox.checked) return;
                        checkbox.checked = true;
                        foundCount++;
                        // Store the first found app div for scrolling
                        if (!firstFoundApp) firstFoundApp = appDiv;
                    }
                }
            } else {
                notFoundCount++;
            }
        });

        // Show appropriate toast message
        if (foundCount === 0) {
            toast(`None of the ${packages.length} package(s) found in system apps`);
        } else if (notFoundCount > 0) {
            toast(`${foundCount} package(s) found, ${notFoundCount} not found`);
        } else {
            toast(`${foundCount} package(s) found and selected`);
        }

        closeImportModal();

        // Scroll to first found app with 80px offset
        if (firstFoundApp) {
            setTimeout(() => {
                const rect = firstFoundApp.getBoundingClientRect();
                const scrollTop = window.scrollY;
                window.scrollTo({
                    top: rect.top + scrollTop - 80,
                    behavior: 'smooth'
                });
            }, 300);
        }
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
