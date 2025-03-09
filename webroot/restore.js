import { ksuExec, setupSearch, setupScrollEvent, checkMMRL, applyRippleEffect } from "./util.js";

let nukeList = [], isShellRunning = false;

function displayRemovedApps(apps) {
    const removedAppsDiv = document.getElementById('removed-list');
    removedAppsDiv.innerHTML = "";
    removedAppsDiv.innerHTML = apps.map(app => `
        <div class="removed-app ripple-element" data-package-name="${app.package_name}" data-app-path="${app.app_path}">
            <div class="app-info">
                <img class="app-icon" src="icons/${app.package_name}.png" onerror="this.src='default.png'" alt="Icon">
                <div class="app-details">
                    <span class="app-name"><span>${app.app_name}</span></span>  
                    <span class="app-package"><span>${app.package_name}</span></span>  
                    <span class="app-path"><span>${app.app_path}</span></span>  
                </div>
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

function getRemovedApps() {
    fetch("nuke_list.json")
        .then(response => response.json())
        .then(data => {
            data.sort((a, b) => a.app_name.localeCompare(b.app_name));
            nukeList = data;
            displayRemovedApps(data);
            applyRippleEffect();
        })
        .catch(error => {
            console.error("Failed to get removed apps:", error);
        });
}

document.getElementById('restore-button').addEventListener('click', async () => {
    if (isShellRunning) return;

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
        const selectedPackageNames = selectedPackages.map(app => app.package_name);
        const remainingApps = nukeList.filter(app => !selectedPackageNames.includes(app.package_name));
        const removedApps = JSON.stringify(remainingApps, null, 2);
        await ksuExec(`echo '${removedApps}' > /data/adb/system_app_nuker/nuke_list.json`);

        // Get the current app list
        fetch("app_list.json")
            .then(response => response.json())
            .then(data => {
                const updatedData = [...data, ...selectedPackages];
                const uniqueData = updatedData.filter((app, index, self) =>
                    index === self.findIndex(a => a.package_name === app.package_name)
                );
                ksuExec(`echo '${JSON.stringify(uniqueData, null, 2)}' > /data/adb/system_app_nuker/app_list.json`);
            });
        getRemovedApps();
        isShellRunning = true;
        await ksuExec(`
            PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
            busybox nsenter -t1 -m /data/adb/modules/system_app_nuker/nuke.sh
        `);
        isShellRunning = false;
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