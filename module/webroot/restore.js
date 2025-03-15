import { ksuExec, setupSearch, setupScrollEvent, checkMMRL, fetchAppList, updateAppList, nukeList, toast, applyRippleEffect } from "./util.js";

// Function to handle the export of package list
async function exportPackageList() {
    try {
        // First check if there are any packages to export
        if (nukeList.length === 0) {
            toast("No packages to export");
            return;
        }
        
        // Create a text list of package names
        const packageList = nukeList.map(app => app.package_name).join('\n');
        
        // Create a file in the Download directory
        const filename = `app_nuker_packages_${new Date().toISOString().slice(0,10)}.txt`;
        const filePath = `/storage/emulated/0/Download/${filename}`;
        
        // Write the package list to the file
        const writeResult = await ksuExec(`echo '${packageList}' > "${filePath}"`);
        if (writeResult.errno !== 0) {
            toast("Error writing package list to file");
            return;
        }
        
        toast(`Package list exported to Downloads/${filename}`);
    } catch (error) {
        console.error("Export error:", error);
        toast("Error exporting package list");
    }
}

// Function to set up the dropdown menu
function setupDropdownMenu() {
    const menuButton = document.getElementById('menu-button');
    const menuDropdown = document.getElementById('menu-dropdown');
    
    if (!menuButton || !menuDropdown) return;

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

    // Set up export option
    const exportOption = document.getElementById('export-option');
    if (exportOption) {
        exportOption.addEventListener('click', () => {
            exportPackageList();
            closeDropdownMenu();
        });
    }
}

document.getElementById('restore-button').addEventListener('click', async () => {
    await updateAppList(true);
});

document.addEventListener('DOMContentLoaded', () => {
    fetchAppList("nuke_list.json", true);
    fetchAppList("app_list.json");
    setupSearch();
    setupScrollEvent();
    checkMMRL();
    setupDropdownMenu();
    applyRippleEffect();
});
