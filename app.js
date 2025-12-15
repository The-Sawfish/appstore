/* ==========================================================================
   SAWFISH APP STORE — FULL APP LOGIC (CLEAN REWRITE)
   Safe rewrite:
     • PWA install detection
     • Install screen vs app screen
     • Tab navigation
     • OS iframe overlays
     • Visibility updates
     • Add-to-Home-Screen modal (NO WAIT TIME)
=========================================================================== */

/* -----------------------------
   GLOBAL REFERENCES
------------------------------ */
const Screens = {
    install: document.querySelector("[data-screen='install']"),
    app: document.querySelector("[data-screen='app']")
};

const Tabs = Array.from(document.querySelectorAll("[data-tab]"));
const Pages = Array.from(document.querySelectorAll("[data-page]"));
const OSContainers = Array.from(document.querySelectorAll(".os-container"));

const A2HSModal = document.getElementById("a2hs-modal");
const A2HSClose = document.getElementById("a2hs-close");

/* ==========================================================================
   1 — PWA DETECTION
=========================================================================== */
function isPWAInstalled() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

/* ==========================================================================
   2 — SCREEN CONTROL
=========================================================================== */
function showInstallScreen() {
    Screens.app.classList.remove("visible");
    Screens.install.classList.add("visible");
}

function showAppScreen() {
    Screens.install.classList.remove("visible");
    Screens.app.classList.add("visible");
    setActiveTab("home");
}

function updateScreenState() {
    if (isPWAInstalled()) {
        showAppScreen();
    } else {
        showInstallScreen();
    }
}

/* Prevent flash of wrong screen */
function enforceInitialView() {
    document.documentElement.style.visibility = "hidden";
    updateScreenState();
    document.documentElement.style.visibility = "visible";
}

/* ==========================================================================
   3 — TAB NAVIGATION
=========================================================================== */
function setActiveTab(tabName) {
    Tabs.forEach(tab =>
        tab.classList.toggle("active", tab.dataset.tab === tabName)
    );

    Pages.forEach(page =>
        page.classList.toggle("visible", page.dataset.page === tabName)
    );

    const activePage = document.querySelector(`[data-page="${tabName}"]`);
    if (activePage) activePage.scrollTop = 0;
}

function initializeTabs() {
    Tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            setActiveTab(tab.dataset.tab);
        });
    });
}

/* ==========================================================================
   4 — OS IFRAME OVERLAYS
=========================================================================== */
function initializeOSOverlays() {
    OSContainers.forEach(container => {
        const iframe = container.querySelector("iframe");
        const overlay = container.querySelector(".overlay");

        if (!iframe || !overlay) return;

        iframe.addEventListener("load", () => {
            overlay.classList.add("visible");
        });
    });
}

/* ==========================================================================
   5 — VISIBILITY / FOCUS HANDLING
=========================================================================== */
function initializeVisibilityHandler() {
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            updateScreenState();
        }
    });
}

/* ==========================================================================
   6 — ADD TO HOME SCREEN MODAL (NO TIMER)
=========================================================================== */
function initializeA2HSModal() {
    if (!A2HSModal || !A2HSClose) return;

    // Show ONLY when not installed
    if (isPWAInstalled()) {
        A2HSModal.classList.add("a2hs-hidden");
        return;
    }

    A2HSModal.classList.remove("a2hs-hidden");

    A2HSClose.addEventListener("click", () => {
        A2HSModal.classList.add("a2hs-hidden");
    });
}

/* ==========================================================================
   7 — INITIALIZATION
=========================================================================== */
function initializeApp() {
    enforceInitialView();
    initializeTabs();
    initializeOSOverlays();
    initializeVisibilityHandler();
    initializeA2HSModal();
}

/* ==========================================================================
   8 — START
=========================================================================== */
window.addEventListener("DOMContentLoaded", initializeApp);
