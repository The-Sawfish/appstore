/* ==========================================================================
   SAWFISH APP STORE — APPLICATION CORE
   Clean, modular, Apple-style logic for page state, navigation, and UI.
   No frameworks. No service worker. Fully compatible with iPadOS Safari.
=========================================================================== */


/* -------------------------------------------------------------
   GLOBAL DOM REFERENCES
------------------------------------------------------------- */
const UI = {
    installScreen: document.querySelector("[data-screen='install']"),
    appScreen: document.querySelector("[data-screen='app']"),
    tabs: document.querySelectorAll("[data-tab]"),
    pages: document.querySelectorAll("[data-page]")
};


/* -------------------------------------------------------------
   1 — PWA DETECTION (iPadOS + iOS + Desktop)
------------------------------------------------------------- */

const PWA = {
    isStandalone() {
        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true
        );
    },

    updateVisibility() {
        if (PWA.isStandalone()) {
            UI.installScreen.classList.remove("visible");
            UI.appScreen.classList.add("visible");
        } else {
            UI.appScreen.classList.remove("visible");
            UI.installScreen.classList.add("visible");
        }
    }
};


/* -------------------------------------------------------------
   2 — TAB NAVIGATION SYSTEM
       Smooth, Apple-style switching
------------------------------------------------------------- */

const Navigation = {
    activePage: null,

    setActiveTab(tabName) {
        // Update tab visuals
        UI.tabs.forEach(tab => {
            tab.classList.toggle("active", tab.dataset.tab === tabName);
        });

        // Show the correct page with smooth fade
        UI.pages.forEach(page => {
            page.classList.toggle(
                "visible",
                page.dataset.page === tabName
            );
        });

        // Scroll the new page to top
        window.scrollTo({ top: 0, behavior: "smooth" });

        Navigation.activePage = tabName;
    },

    setupListeners() {
        UI.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                Navigation.setActiveTab(tab.dataset.tab);
            });
        });
    }
};


/* -------------------------------------------------------------
   3 — APP INITIALIZATION
------------------------------------------------------------- */

const App = {
    initialize() {
        PWA.updateVisibility();
        Navigation.setupListeners();

        // Set default active tab if installed
        if (PWA.isStandalone()) {
            Navigation.setActiveTab("home");
        }
    }
};


/* -------------------------------------------------------------
   4 — VISIBILITY HANDLER (when user returns to app)
------------------------------------------------------------- */

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        PWA.updateVisibility();
    }
});


/* -------------------------------------------------------------
   START APPLICATION
------------------------------------------------------------- */
window.addEventListener("load", App.initialize);
