import { ksuExec, toast, applyRippleEffect } from "./util.js";

// File selector state
let fileSelector;
let currentPath = '/storage/emulated/0/Download';

// Function to update path display
function updateCurrentPath() {
    const currentPathElement = document.querySelector('.current-path');
    const segments = currentPath.split('/').filter(Boolean);
    
    // Create spans with data-path attribute for each segment
    const pathHTML = segments.map((segment, index) => {
        const fullPath = '/' + segments.slice(0, index + 1).join('/');
        return `<span class="path-segment" data-path="${fullPath}">${segment}</span>`;
    }).join('<span class="separator">›</span>');
    
    currentPathElement.innerHTML = pathHTML;
    currentPathElement.scrollTo({ 
        left: currentPathElement.scrollWidth,
        behavior: 'smooth'
    });
}

// Function to list files in directory
async function listFiles(path, skipAnimation = false) {
    const fileList = document.querySelector('.file-list');
    if (!skipAnimation) {
        fileList.classList.add('switching');
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    try {
        const result = await ksuExec(`find "${path}" -maxdepth 1 -type f -name "*.txt" -o -type d ! -name ".*" | sort`);
        const items = result.stdout.split('\n').filter(Boolean).map(item => ({
            path: item,
            name: item.split('/').pop(),
            isDirectory: !item.endsWith('.txt')
        }));
        
        fileList.innerHTML = '';

        // Add back button item if not in root directory
        if (currentPath !== '/storage/emulated/0') {
            const backItem = document.createElement('div');
            backItem.className = 'file-item ripple-element';
            backItem.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                    <path d="M141-160q-24 0-42-18.5T81-220v-520q0-23 18-41.5t42-18.5h280l60 60h340q23 0 41.5 18.5T881-680v460q0 23-18.5 41.5T821-160H141Z"/>
                </svg>
                <span>..</span>
            `;
            backItem.addEventListener('click', async () => {
                document.querySelector('.back-button').click();
            });
            fileList.appendChild(backItem);
        }
        
        items.forEach(item => {
            if (item.path === path) return;
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item ripple-element';
            itemElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                    ${item.isDirectory ? 
                        '<path d="M141-160q-24 0-42-18.5T81-220v-520q0-23 18-41.5t42-18.5h280l60 60h340q23 0 41.5 18.5T881-680v460q0 23-18.5 41.5T821-160H141Z"/>' :
                        '<path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>'}
                </svg>
                <span>${item.name}</span>
            `;
            
            itemElement.addEventListener('click', async () => {
                if (item.isDirectory) {
                    currentPath = item.path;
                    updateCurrentPath();
                    await listFiles(item.path);
                } else {
                    await importPackageList(item.path);
                }
            });
            
            fileList.appendChild(itemElement);
        });
        
        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    } catch (error) {
        console.error('Error listing files:', error);
        if (!skipAnimation) {
            fileList.classList.remove('switching');
        }
    }
    
    applyRippleEffect();
}

// Function to import package list from a file
async function importPackageList(filePath) {
    try {
        // Read file content
        const result = await ksuExec(`cat "${filePath}"`);
        if (result.errno !== 0) {
            toast("Error reading file");
            return;
        }
        
        // Split by new line and filter empty lines
        const packages = result.stdout.trim().split('\n').map(pkg => pkg.trim()).filter(Boolean);
        
        if (packages.length === 0) {
            toast("No package names found in file");
            closeFileSelector();
            return;
        }

        let foundCount = 0, notFoundCount = 0, firstFoundApp = null;

        // Select app if found
        packages.forEach(packageName => {
            const appDiv = document.querySelector(`.app[data-package-name="${packageName}"]`);
            if (appDiv) {
                const checkbox = appDiv.querySelector('.app-selector');
                if (checkbox) {
                    if (checkbox.checked) return;
                    checkbox.checked = true;
                    foundCount++;
                    // Store the first found app div for scrolling
                    if (!firstFoundApp) firstFoundApp = appDiv;
                }
            } else {
                notFoundCount++;
            }
        });

        // Show appropriate toast message
        if (foundCount === 0) {
            toast(`None of the ${packages.length} package(s) found in system apps`);
        } else if (notFoundCount > 0) {
            toast(`${foundCount} package(s) found, ${notFoundCount} not found`);
        } else {
            toast(`${foundCount} package(s) found and selected`);
        }

        closeFileSelector();

        // Scroll to first found app with 80px offset
        if (firstFoundApp) {
            setTimeout(() => {
                const rect = firstFoundApp.getBoundingClientRect();
                const scrollTop = window.scrollY;
                window.scrollTo({
                    top: rect.top + scrollTop - 80,
                    behavior: 'smooth'
                });
            }, 300);
        }
    } catch (error) {
        console.error('Error importing package list:', error);
        toast("Error importing package list");
    }
}

// Function to open file selector
export function openFileSelector() {
    fileSelector = document.querySelector('.file-selector-modal');
    fileSelector.style.display = 'flex';
    document.body.classList.add("no-scroll");
    setTimeout(() => {
        fileSelector.style.opacity = '1';
    }, 10);
    
    currentPath = '/storage/emulated/0/Download';
    updateCurrentPath();
    listFiles(currentPath, true);
}

// Function to close file selector
export function closeFileSelector() {
    fileSelector = document.querySelector('.file-selector-modal');
    fileSelector.style.opacity = '0';
    document.body.classList.remove("no-scroll");
    setTimeout(() => {
        fileSelector.style.display = 'none';
    }, 300);
}

// Initialize file selector
export function initFileSelector() {
    fileSelector = document.querySelector('.file-selector-modal');
    
    // Close selector when clicking outside
    fileSelector.addEventListener('click', (event) => {
        if (event.target === fileSelector) {
            closeFileSelector();
        }
    });
    
    // Setup close button
    document.querySelector('.close-selector').addEventListener('click', closeFileSelector);
    
    // Setup back button
    document.querySelector('.back-button').addEventListener('click', async () => {
        if (currentPath === '/storage/emulated/0') return;
        currentPath = currentPath.split('/').slice(0, -1).join('/');
        if (currentPath === '') currentPath = '/storage/emulated/0';
        updateCurrentPath();
        await listFiles(currentPath);
    });
    
    // Setup path segment navigation
    document.querySelector('.current-path').addEventListener('click', async (event) => {
        const segment = event.target.closest('.path-segment');
        if (!segment) return;
        
        const targetPath = segment.dataset.path;
        if (!targetPath || targetPath === currentPath) return;
        
        // Return if already at /storage/emulated/0
        const clickedSegment = segment.textContent;
        if ((clickedSegment === 'storage' || clickedSegment === 'emulated') && 
            currentPath === '/storage/emulated/0') {
            return;
        }

        // Always stay within /storage/emulated/0
        if (targetPath.split('/').length <= 3) {
            currentPath = '/storage/emulated/0';
        } else {
            currentPath = targetPath;
        }
        
        updateCurrentPath();
        await listFiles(currentPath);
    });
}
