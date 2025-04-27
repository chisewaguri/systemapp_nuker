import { ksuExec, setupSearch, setupScrollEvent, setupDropdownMenu, checkMMRL, fetchAppList, updateAppList, nukeList, toast, applyRippleEffect, initialTransition } from "./util.js";

// Function to handle the export of package list
export async function exportPackageList() {
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
        
        toast(`Package list exported to Download/${filename}`);
    } catch (error) {
        console.error("Export error:", error);
        toast("Error exporting package list");
    }
}

/**
 * Restore button
 * Use availability of restore button to check if we need to initialize
 */
const restoreButton = document.getElementById('restore-button');
if (restoreButton) {
    restoreButton.addEventListener('click', async () => {
        await updateAppList(true);
    });

    document.addEventListener('DOMContentLoaded', async () => {
        initialTransition();
        setTimeout(async () => {
            await fetchAppList("link/nuke_list.json", true);
            await fetchAppList("link/app_list.json");
            checkMMRL();
        }, 10);
        setupSearch();
        setupScrollEvent();
        setupDropdownMenu();
        applyRippleEffect();
    });
}