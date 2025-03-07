// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

async function ksuExec(command) {
    return new Promise((resolve) => {
        let callbackName = `exec_callback_${Date.now()}`;
        window[callbackName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            delete window[callbackName];
        };
        ksu.exec(command, "{}", callbackName);
    });
}

// Fetch system apps
async function fetchSystemApps() {
    fetch("assets/app_list.json")
        .then(response => response.json())
        .then(data => {
            displayAppList(data);
            ksu.toast("System apps loaded");
        })
        .catch(error => {
            console.error("Failed to fetch system apps:", error);
        });
}

// Display app list
async function displayAppList(data) {
    const appListDiv = document.getElementById("app-list");
    appListDiv.innerHTML = "";
    const htmlContent = data.map((pkg) => `
        <div class="app">
            <div class="app-info">
                <span class="app-name">${pkg.app_name}</span>
                <span class="app-package">${pkg.package_name}</span>
                <span class="app-path">${pkg.app_path}</span>
            </div>
            <input class="app-selector" type="checkbox" value="${pkg.package_name}">
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
    });
}

// Nuke button
document.getElementById("nuke-button").addEventListener("click", async () => {
    let selectedPackages = Array.from(document.querySelectorAll(".app-selector:checked"))
        .map(checkbox => checkbox.value)
        .join("\n");

    if (!selectedPackages) {
        ksu.toast("No apps selected");
        return;
    }
    
    let nukeListPath = "/data/adb/modules/system_app_nuker/nuke_list.txt";
    let writeResult = await ksuExec(`echo \"${selectedPackages}\" > ${nukeListPath}`);
    if (writeResult.errno !== 0) {
        console.error("Failed to update nuke list:", writeResult.stderr);
        return;
    }
    
    await ksuExec(`su -c sh /data/adb/modules/system_app_nuker/nuke.sh`);
    ksu.toast("Done! Reboot your device!");
});

// Function to check if running in MMRL
async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Adjust elements position for MMRL
        document.querySelector('.header').style.top = 'var(--window-inset-top)';
        document.querySelector('.search-container').style.top = 'calc(var(--window-inset-top) + 80px)';
        document.getElementById("nuke-button-container").style.bottom = 'calc(var(--window-inset-bottom) + 50px)';

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

// Hide or show nuke button
function hideNukeButton(hide = true) {
    const nukeButton = document.getElementById("nuke-button-container");
    if (!hide) {
        nukeButton.style.transform = 'translateY(0)';
    } else if (typeof ksu !== 'undefined' && ksu.mmrl) {
        nukeButton.style.transform = 'translateY(calc(var(--window-inset-bottom) + 120px))';
    } else {
        nukeButton.style.transform = 'translateY(120px)';
    }
}

// Search functionality
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchValue = e.target.value.toLowerCase();
    const apps = document.querySelectorAll('.app');
    apps.forEach(app => {
        const appName = app.querySelector('span.app-name').textContent.toLowerCase();
        const appPackage = app.querySelector('span.app-package').textContent.toLowerCase();
        if (appName.includes(searchValue) || appPackage.includes(searchValue)) {
            app.style.display = 'flex';
        } else {
            app.style.display = 'none';
        }
    });

    if (document.getElementById('search-input').value.length > 0) {
        document.getElementById('clear-btn').style.display = 'block';
    } else {
        document.getElementById('clear-btn').style.display = 'none';
    }
});
document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    const apps = document.querySelectorAll('.app');
    apps.forEach(app => {
        app.style.display = 'flex';
    });
    document.getElementById('clear-btn').style.display = 'none';
});

// Scroll event
let lastScrollY = window.scrollY;
let scrollTimeout;
const scrollThreshold = 40;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    if (window.scrollY > lastScrollY && window.scrollY > scrollThreshold) {
        hideNukeButton(true);
    } else if (window.scrollY < lastScrollY) {
        hideNukeButton(false);
    }

    // header opacity
    const scrollRange = 65;
    const scrollPosition = Math.min(Math.max(window.scrollY, 0), scrollRange);
    const opacity = 1 - (scrollPosition / scrollRange);
    document.querySelector('.header').style.opacity = opacity.toString();
    document.querySelector('.search-container').style.transform = `translateY(-${scrollPosition}px)`;
    lastScrollY = window.scrollY;
});

document.addEventListener("DOMContentLoaded", () => {
    fetchSystemApps();
    checkMMRL();
});
