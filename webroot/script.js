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
async function fetchSystemApps() {
    let result = await ksuExec("pm list packages -s");
    if (result.errno !== 0) {
    	ksu.toast("Failed to fetch system apps");
        console.error("Failed to fetch system apps:", result.stderr);
        return;
    }
    let packages = result.stdout.split("\n").map(line => line.replace("package:", "").trim()).filter(pkg => pkg);
    displayAppList(packages);
    ksu.toast("System apps loaded");
}

function displayAppList(packages) {
    const appListDiv = document.getElementById("app-list");
    appListDiv.innerHTML = "";
    packages.forEach(pkg => {
        let label = document.createElement("label");
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = pkg;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(pkg));
        appListDiv.appendChild(label);
        appListDiv.appendChild(document.createElement("br"));
    });
}

async function submitSelection() {
    let selectedPackages = Array.from(document.querySelectorAll("#app-list input[type='checkbox']:checked"))
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
    
    await ksuExec(`sh /data/adb/modules/system_app_nuker/nuke.sh`);
    ksu.toast("Done! Reboot your device!");
}

document.addEventListener("DOMContentLoaded", fetchSystemApps);
