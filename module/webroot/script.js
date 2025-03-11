// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { setupSearch, setupScrollEvent, checkMMRL, fetchAppList, updateAppList, setupMenuAndImport, setupConfirmationDialog } from "./util.js";

// Nuke button
document.getElementById("nuke-button").addEventListener("click", () => {
    // Get selected apps
    const selectedApps = Array.from(document.querySelectorAll(".app-selector:checked"))
        .map(checkbox => {
            const appDiv = checkbox.closest('.app');
            return {
                name: appDiv.querySelector('.app-name').textContent.trim(),
                package: appDiv.dataset.packageName
            };
        });
    
    if (selectedApps.length === 0) {
        ksu.toast("No apps selected");
        return;
    }
    
    // Populate the confirmation dialog
    const selectedAppsList = document.getElementById("selected-apps-confirm");
    selectedAppsList.innerHTML = selectedApps.map(app => 
        `<li><strong>${app.name}</strong> <small>(${app.package})</small></li>`
    ).join("");
    
    // Show the confirmation dialog
    document.getElementById("confirmation-modal").style.display = "block";
});

document.addEventListener("DOMContentLoaded", () => {
    fetchAppList("app_list.json", true);
    fetchAppList("nuke_list.json");
    checkMMRL();
    setupSearch();
    setupScrollEvent();
    setupMenuAndImport();
    setupConfirmationDialog();
});
