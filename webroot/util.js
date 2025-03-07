export async function ksuExec(command) {
    return new Promise((resolve) => {
        let callbackName = `exec_callback_${Date.now()}`;
        window[callbackName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            delete window[callbackName];
        };
        ksu.exec(command, "{}", callbackName);
    });
}

export function setupSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => {
        const searchValue = e.target.value.toLowerCase();
        const apps = document.querySelectorAll('.app, .removed-app');
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
        const apps = document.querySelectorAll('.app, .removed-app');
        apps.forEach(app => {
            app.style.display = 'flex';
        });
        document.getElementById('clear-btn').style.display = 'none';
    });
}

// Function to check if running in MMRL
export async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Adjust elements position for MMRL
        document.querySelector('.header').style.top = 'var(--window-inset-top)';
        document.querySelector('.search-container').style.top = 'calc(var(--window-inset-top) + 80px)';
        document.querySelector('.floating-button-container').style.bottom = 'calc(var(--window-inset-bottom) + 95px)';
        document.querySelector('.footer-btn').style.paddingBottom = 'calc(var(--window-inset-bottom) + 30px)';

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

// Hide or show floating button
function hideFloatingButton(hide = true) {
    const floatingButton = document.querySelector(".floating-button-container");
    if (!hide) {
        floatingButton.style.transform = 'translateY(0)';
    } else {
        floatingButton.style.transform = 'translateY(80px)';
    }
}

export function setupScrollEvent() {
    let lastScrollY = window.scrollY;
    let scrollTimeout;
    const scrollThreshold = 40;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        if (window.scrollY > lastScrollY && window.scrollY > scrollThreshold) {
            hideFloatingButton(true);
        } else if (window.scrollY < lastScrollY) {
            hideFloatingButton(false);
        }

        // header opacity
        const scrollRange = 65;
        const scrollPosition = Math.min(Math.max(window.scrollY, 0), scrollRange);
        const opacity = 1 - (scrollPosition / scrollRange);
        document.querySelector('.header').style.opacity = opacity.toString();
        document.querySelector('.search-container').style.transform = `translateY(-${scrollPosition}px)`;
        lastScrollY = window.scrollY;
    });
}
