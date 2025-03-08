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
        window.scrollTo(0, 0);
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
        window.scrollTo(0, 0);
        document.getElementById('search-input').value = '';
        const apps = document.querySelectorAll('.app, .removed-app');
        apps.forEach(app => {
            app.style.display = 'flex';
        });
        document.getElementById('clear-btn').style.display = 'none';
    });
}

// Function to apply ripple effect
export function applyRippleEffect() {
    document.querySelectorAll('.ripple-element').forEach(element => {
        if (element.dataset.rippleListener !== "true") {
            element.addEventListener("pointerdown", function (event) {
                if (isScrolling) return;
                const ripple = document.createElement("span");
                ripple.classList.add("ripple");

                // Calculate ripple size and position
                const rect = element.getBoundingClientRect();
                const width = rect.width;
                const size = Math.max(rect.width, rect.height);
                const x = event.clientX - rect.left - size / 2;
                const y = event.clientY - rect.top - size / 2;

                // Determine animation duration
                let duration = 0.2 + (width / 800) * 0.4;
                duration = Math.min(0.8, Math.max(0.2, duration));

                // Set ripple styles
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${x}px`;
                ripple.style.top = `${y}px`;
                ripple.style.animationDuration = `${duration}s`;
                ripple.style.transition = `opacity ${duration}s ease`;

                // Adaptive color
                const computedStyle = window.getComputedStyle(element);
                const bgColor = computedStyle.backgroundColor || "rgba(0, 0, 0, 0)";
                const textColor = computedStyle.color;
                const isDarkColor = (color) => {
                    const rgb = color.match(/\d+/g);
                    if (!rgb) return false;
                    const [r, g, b] = rgb.map(Number);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 96; // Luma formula
                };
                ripple.style.backgroundColor = isDarkColor(bgColor) ? "rgba(255, 255, 255, 0.2)" : "";

                // Append ripple and handle cleanup
                element.appendChild(ripple);
                const handlePointerUp = () => {
                    ripple.classList.add("end");
                    setTimeout(() => {
                        ripple.classList.remove("end");
                        ripple.remove();
                    }, duration * 1000);
                    element.removeEventListener("pointerup", handlePointerUp);
                    element.removeEventListener("pointercancel", handlePointerUp);
                };
                element.addEventListener("pointerup", handlePointerUp);
                element.addEventListener("pointercancel", handlePointerUp);
            });
            element.dataset.rippleListener = "true";
        }
    });
}

// Function to check if running in MMRL
export async function checkMMRL() {
    if (typeof ksu !== 'undefined' && ksu.mmrl) {
        // Adjust elements position for MMRL
        document.querySelector('.header').style.top = 'var(--window-inset-top)';
        document.querySelector('.search-container').style.top = 'calc(var(--window-inset-top) + 80px)';
        document.querySelector('.floating-button-container').style.bottom = 'calc(var(--window-inset-bottom) + 95px)';
        document.querySelector('.footer-btn').style.paddingBottom = 'calc(var(--window-inset-bottom) + 15px)';

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
        floatingButton.style.transform = 'translateY(90px)';
    }
}

let isScrolling = false;
export function setupScrollEvent() {
    let lastScrollY = window.scrollY;
    let scrollTimeout;
    const scrollThreshold = 40;
    window.addEventListener('scroll', () => {
        isScrolling = true;
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
        isScrolling = false;
    });
}
