// This is part of system app nuker
// Inspired by j-hc's zygisk detach that's licensed under Apache 2.0 and backslashxx's mountify.

import { setupSearch, setupScrollEvent, checkMMRL, fetchAppList, updateAppList, setupMenuAndImport } from "./util.js";

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
    setupMenuAndImport();
});
