/* ==========================================================================
   SAWFISH APP STORE — FULL APP LOGIC
   Handles:
     • PWA / home screen detection
     • Install screen vs app screen
     • Tab navigation (Home, Games, Social, OS)
     • Smooth page transitions
     • Visibility/focus updates
     • OS iframe overlays
=========================================================================== */

/* -----------------------------
   GLOBAL ELEMENT REFERENCES
------------------------------ */
const Screens = {
    install: document.querySelector("[data-screen='install']"),
    app: document.querySelector("[data-screen='app']")
};

const Tabs = Array.from(document.querySelectorAll("[data-tab]"));
const Pages = Array.from(document.querySelectorAll("[data-page]"));
const OSContainers = Array.from(document.querySelectorAll('.os-container'));

/* ==========================================================================
   1 — PWA / HOME SCREEN DETECTION
=========================================================================== */
function isPWAInstalled() {
    // Detect standard PWA or iOS standalone
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showAppScreen() {
    Screens.install.classList.remove('visible');
    Screens.app.classList.add('visible');

    // Set default tab to Home
    setActiveTab('home');
}

function showInstallScreen() {
    Screens.app.classList.remove('visible');
    Screens.install.classList.add('visible');
}

/* Immediate enforcement to prevent website flash */
function enforceAppView() {
    if (isPWAInstalled()) {
        document.documentElement.style.visibility = 'hidden';
        showAppScreen();
        document.documentElement.style.visibility = 'visible';
    }
}

/* ==========================================================================
   2 — SCREEN STATE CONTROL
=========================================================================== */
function updateScreenState() {
    if (isPWAInstalled()) {
        showAppScreen();
    } else {
        showInstallScreen();
    }
}

/* ==========================================================================
   3 — TAB NAVIGATION SYSTEM
=========================================================================== */
function setActiveTab(tabName) {
    // Highlight active tab
    Tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));

    // Show corresponding page
    Pages.forEach(page => page.classList.toggle('visible', page.dataset.page === tabName));

    // Scroll tab content to top
    const activePage = document.querySelector(`[data-page='${tabName}']`);
    if (activePage) activePage.scrollTop = 0;
}

function initializeTabs() {
    Tabs.forEach(tab => {
        tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
    });
}

/* ==========================================================================
   4 — OS IFRAME OVERLAYS
=========================================================================== */
function initializeOSOverlays() {
    OSContainers.forEach(container => {
        const iframe = container.querySelector('iframe');
        const overlay = container.querySelector('.overlay');
        if (iframe && overlay) {
            iframe.addEventListener('load', () => {
                overlay.classList.add('visible');
            });
        }
    });
}

/* ==========================================================================
   5 — VISIBILITY / FOCUS HANDLER
=========================================================================== */
function handleVisibilityChange() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateScreenState();
    });
}

/* ==========================================================================
   6 — INITIALIZATION
=========================================================================== */
function initializeApp() {
    enforceAppView();        // Immediate PWA enforcement
    initializeTabs();        // Enable tab switching
    handleVisibilityChange(); // Update screen on visibility change
    initializeOSOverlays();  // Activate overlays on OS iframes
}

/* ==========================================================================
   7 — START APPLICATION
=========================================================================== */
window.addEventListener('DOMContentLoaded', initializeApp);

(function () {
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    // ONLY show when running as installed PWA
    if (!isStandalone) return;

    const modal = document.getElementById('a2hs-modal');
    const closeBtn = document.getElementById('a2hs-close');
    const countdownEl = document.getElementById('countdown');

    modal.classList.remove('a2hs-hidden');

    let timeLeft = 5;
    countdownEl.textContent = timeLeft;

    const timer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timer);
            closeBtn.disabled = false;
            closeBtn.textContent = "Continue";
        }
    }, 1000);

    closeBtn.addEventListener('click', () => {
        modal.classList.add('a2hs-hidden');
    });
})();


