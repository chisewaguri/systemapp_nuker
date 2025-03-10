import { setupSearch, setupScrollEvent, checkMMRL, fetchAppList, updateAppList } from "./util.js";

document.getElementById('restore-button').addEventListener('click', async () => {
    await updateAppList(true);
});

document.addEventListener('DOMContentLoaded', () => {
    fetchAppList("nuke_list.json", true);
    fetchAppList("app_list.json");
    setupSearch();
    setupScrollEvent();
    checkMMRL();
});