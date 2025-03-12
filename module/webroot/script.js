// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { toast, setupSearch, setupScrollEvent, checkMMRL, fetchAppList, updateAppList, appList, applyRippleEffect } from "./util.js";

function setupDropdownMenu() {
    const menuButton = document.getElementById('menu-button');
    const menuDropdown = document.getElementById('menu-dropdown');

    // Open menu or close if already open
    menuButton.addEventListener('click', () => {
        if (menuDropdown.style.display === 'flex') {
            menuDropdown.style.opacity = 0;
            menuDropdown.style.transform = 'scale(0)';
            setTimeout(() => {
                menuDropdown.style.display = 'none';
            }, 300);
        } else {
            menuDropdown.style.display = 'flex';
            menuDropdown.style.transform = 'scale(0)';
            setTimeout(() => {
                menuDropdown.style.opacity = 1;
                menuDropdown.style.transform = 'scale(1)';
            }, 10);
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!menuButton.contains(event.target)) {
            menuDropdown.style.opacity = 0;
            menuDropdown.style.transform = 'scale(0)';
            setTimeout(() => {
                menuDropdown.style.display = 'none';
            }, 300);
        }
    });

    // Close menu when scrolling
    window.addEventListener('scroll', () => {
        menuDropdown.style.opacity = 0;
        menuDropdown.style.transform = 'scale(0)';
        setTimeout(() => {
            menuDropdown.style.display = 'none';
        }, 300);
    });

    document.getElementById('import-option').addEventListener('click', () => {
        importModalMenu();
    });
}

// Import modal menu
function importModalMenu() {
    const importModalMenu = document.getElementById('import-modal');
    const importModalMenuContent = document.querySelector('.modal-content');
    const packageListInput = document.getElementById('package-list-input');

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

// Nuke button
document.getElementById("nuke-button").addEventListener("click", async () => {
    await updateAppList();
});

document.addEventListener("DOMContentLoaded", () => {
    fetchAppList("app_list.json", true);
    fetchAppList("nuke_list.json");
    checkMMRL();
    setupSearch();
    setupScrollEvent();
    setupDropdownMenu();
    applyRippleEffect();
});
