import { ksuExec, setupSearch, setupScrollEvent, checkMMRL } from "./util.js";

function displayRemovedApps(apps) {
    const removedAppsDiv = document.getElementById('removed-list');
    removedAppsDiv.innerHTML = "";
    removedAppsDiv.innerHTML = apps.map(app => `
        <div class="removed-app" data-package-name="${app.package_name}" data-app-path="${app.app_path}">
            <div class="app-info">
                <span class="app-name">${app.app_name}</span>
                <span class="app-package">${app.package_name}</span>
                <span class="app-path">${app.app_path}</span>
            </div>
            <input class="app-selector" type="checkbox">
        </div>
    `).join("");

    // Add event listeners after creating elements
    document.querySelectorAll('.removed-app').forEach(appDiv => {
        appDiv.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
        });
    });
}

function getRemovedApps() {
    ksuExec('cat /data/adb/modules/system_app_nuker/nuke_list.json')
        .then(result => {
            const removedApps = JSON.parse(result.stdout);
            removedApps.sort((a, b) => a.package_name.localeCompare(b.package_name));
            displayRemovedApps(removedApps);
        })
        .catch(error => {
            console.error("Failed to get removed apps:", error);
        });
}

document.getElementById('restore-button').addEventListener('click', async () => {
    let selectedPackages = Array.from(document.querySelectorAll(".app-selector:checked"))
        .map(checkbox => {
            const appDiv = checkbox.closest('.removed-app');
            return {
                package_name: appDiv.dataset.packageName,
                app_path: appDiv.dataset.appPath,
                app_name: appDiv.querySelector('.app-name').textContent
            };
        });

    if (selectedPackages.length === 0) {
        ksu.toast("No apps selected");
        return;
    }

    try {
        const { stdout: existingContent } = await ksuExec('cat /data/adb/modules/system_app_nuker/nuke_list.json');
        let existingApps = [];
        try {
            existingApps = JSON.parse(existingContent || '[]');
        } catch (e) {
            console.log("No existing apps or invalid JSON, starting fresh");
            ksu.toast("Error reading existing apps list");
            return;
        }

        const selectedPackageNames = selectedPackages.map(app => app.package_name);
        const remainingApps = existingApps.filter(app => 
            !selectedPackageNames.includes(app.package_name)
        );

        const removedApps = JSON.stringify(remainingApps, null, 2);
        await ksuExec(`echo '${removedApps}' > /data/adb/modules/system_app_nuker/nuke_list.json`);

        // Get the current app list
        fetch("assets/app_list.json")
            .then(response => response.json())
            .then(data => {
                const updatedData = [...data, ...selectedPackages];
                const uniqueData = updatedData.filter((app, index, self) =>
                    index === self.findIndex(a => a.package_name === app.package_name)
                );
                ksuExec(`echo '${JSON.stringify(uniqueData, null, 2)}' > /data/adb/modules/system_app_nuker/webroot/assets/app_list.json`);
            });
        getRemovedApps();
        await ksuExec(`su -c sh /data/adb/modules/system_app_nuker/nuke.sh restore`);
        ksu.toast("Done! Reboot your device!");
    } catch (error) {
        ksu.toast("Error updating removed apps list");
        console.error("Error:", error);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    getRemovedApps();
    setupSearch();
    setupScrollEvent();
    checkMMRL();
});