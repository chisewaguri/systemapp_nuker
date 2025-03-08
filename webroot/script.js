// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { ksuExec, setupSearch, setupScrollEvent, checkMMRL, applyRippleEffect } from "./util.js";
// Fetch system apps
async function fetchSystemApps() {
    try {
        const response = await ksuExec("cat /data/adb/system_app_nuker/app_list.json");
        let data = [];
        try {
            data = JSON.parse(response.stdout);
        } catch (error) {
            console.warn("app_list.json is empty or invalid, using empty array.");
        }

        data.sort((a, b) => a.app_name.localeCompare(b.app_name));
        displayAppList(data);
        applyRippleEffect();
    } catch (error) {
        console.error("Failed to fetch system apps:", error);
    }
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
            if (el.scrollWidth > parent.clientWidth) {
                el.classList.add("scroll");
                const scrollDistance = el.scrollWidth - parent.clientWidth;
                el.style.setProperty('--scroll-distance', `${scrollDistance}px`);
            }
        });
    });
}



// Nuke button
document.getElementById("nuke-button").addEventListener("click", async () => {
    let selectedPackages = Array.from(document.querySelectorAll(".app-selector:checked"))
        .map(checkbox => {
            const appDiv = checkbox.closest('.app');
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

    // check is the app is already in the list
    for (const app of selectedPackages) {
        try {
            const { stdout: existingContent } = await ksuExec(`grep -q "${app.package_name}" /data/adb/system_app_nuker/nuke_list.json`);
            if (existingContent) {
                continue;
            }
        } catch (error) {
            console.error("App is not in the list:", error);
        }
    }

    try {
        const { stdout: existingContent } = await ksuExec('cat /data/adb/system_app_nuker/nuke_list.json');
        let existingApps = [];
        try {
            existingApps = JSON.parse(existingContent || '[]');
        } catch (e) {
            console.log("No existing apps or invalid JSON, starting fresh");
        }

        const allApps = [...existingApps, ...selectedPackages];
        const uniqueApps = allApps.filter((app, index, self) =>
            index === self.findIndex(a => a.package_name === app.package_name)
        );

        const removedApps = JSON.stringify(uniqueApps, null, 2);
        await ksuExec(`echo '${removedApps}' > /data/adb/system_app_nuker/nuke_list.json`);

        // remove apps from assets/app_list.json
        ksuExec("cat /data/adb/system_app_nuker/app_list.json")
            .then(response => {
                const data = JSON.parse(response.stdout);
                const filteredData = data.filter(app => !uniqueApps.some(uniqueApp => uniqueApp.package_name === app.package_name));
                displayAppList(filteredData);
                ksuExec(`echo '${JSON.stringify(filteredData, null, 2)}' > /data/adb/system_app_nuker/app_list.json`);
            });

        await ksuExec(`
            PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
            busybox nsenter -t1 -m /data/adb/modules/system_app_nuker/nuke.sh`);
        ksu.toast("Done! Reboot your device!");
    } catch (error) {
        ksu.toast("Error updating removed apps list");
        console.error("Error:", error);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    fetchSystemApps();
    checkMMRL();
    setupSearch();
    setupScrollEvent();
});
