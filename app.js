/* ==========================================================================
   SAWFISH APP STORE — FULL APP LOGIC
   Modernized UI additions WITHOUT breaking existing behavior
   ========================================================================== */

/* -----------------------------
   APP VERSION (update this each release)
------------------------------ */
const APP_VERSION = "1.1.0";

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

/* PWA banner UI */
const PWABanner = document.getElementById("pwa-banner");
const UpdateStatus = document.getElementById("update-status");
const UpdateAction = document.getElementById("update-action");

/* Version UI */
const InstallVersion = document.getElementById("install-version");
const AppVersionChip = document.getElementById("app-version-chip");
const LastCheckChip = document.getElementById("last-check-chip");

/* Welcome modal UI */
const WelcomeModal = document.getElementById("welcome-modal");
const WelcomeSubtitle = document.getElementById("welcome-subtitle");
const WelcomeScrollWrap = document.getElementById("welcome-scrollwrap");
const WelcomeReturning = document.getElementById("welcome-returning");
const WelcomeAckRow = document.getElementById("welcome-ack-row");
const WelcomeAck = document.getElementById("welcome-ack");
const WelcomeContinue = document.getElementById("welcome-continue");

/* Keys */
const KEY_ONBOARDING = "sawfish_onboarding_seen_v1";

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
    if (Screens.app) Screens.app.classList.remove("visible");
    if (Screens.install) Screens.install.classList.add("visible");
}

function showAppScreen() {
    if (Screens.install) Screens.install.classList.remove("visible");
    if (Screens.app) Screens.app.classList.add("visible");
    setActiveTab("home");
}

function updateScreenState() {
    const pwa = isPWAInstalled();
    document.body.classList.toggle("is-pwa", pwa);
    pwa ? showAppScreen() : showInstallScreen();
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
   6 — ADD TO HOME SCREEN MODAL (Safari preview only)
=========================================================================== */
function initializeA2HSModal() {
    if (!A2HSModal || !A2HSClose) return;

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
   7 — FIRST-TIME / RETURNING WELCOME MODAL (PWA only)
=========================================================================== */
function showWelcomeModalFirstTime() {
    if (!WelcomeModal) return;

    WelcomeModal.classList.remove("hidden");
    WelcomeSubtitle.textContent = "Please scroll to the bottom, then confirm you understand.";

    // First-time mode: scroll required + checkbox required
    WelcomeScrollWrap.classList.remove("hidden");
    WelcomeReturning.classList.add("hidden");
    WelcomeAckRow.classList.remove("hidden");

    WelcomeContinue.disabled = true;
    WelcomeAck.checked = false;

    // Require scroll to bottom
    const onScroll = () => {
        const el = WelcomeScrollWrap;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
        // Only allow checkbox row to function once they've scrolled
        WelcomeAck.disabled = !nearBottom;
        if (!nearBottom) {
            WelcomeAck.checked = false;
            WelcomeContinue.disabled = true;
        }
    };

    // Reset scroll position
    WelcomeScrollWrap.scrollTop = 0;
    WelcomeAck.disabled = true;

    WelcomeScrollWrap.addEventListener("scroll", onScroll, { passive: true });

    const onAckChange = () => {
        // Continue enabled only if they reached bottom (ack enabled) AND checked it
        WelcomeContinue.disabled = !(WelcomeAck.disabled === false && WelcomeAck.checked === true);
    };
    WelcomeAck.addEventListener("change", onAckChange);

    const onContinue = () => {
        localStorage.setItem(KEY_ONBOARDING, "seen");
        WelcomeModal.classList.add("hidden");

        // Cleanup listeners (avoid stacking)
        WelcomeScrollWrap.removeEventListener("scroll", onScroll);
        WelcomeAck.removeEventListener("change", onAckChange);
        WelcomeContinue.removeEventListener("click", onContinue);
    };

    WelcomeContinue.addEventListener("click", onContinue);
}

function showWelcomeModalReturning() {
    if (!WelcomeModal) return;

    WelcomeModal.classList.remove("hidden");
    WelcomeSubtitle.textContent = "Quick reminder";

    // Returning mode: NO scroll + NO checkbox
    WelcomeScrollWrap.classList.add("hidden");
    WelcomeReturning.classList.remove("hidden");
    WelcomeAckRow.classList.add("hidden");

    WelcomeContinue.disabled = false;

    const onContinue = () => {
        WelcomeModal.classList.add("hidden");
        WelcomeContinue.removeEventListener("click", onContinue);
    };
    WelcomeContinue.addEventListener("click", onContinue);
}

function initializeWelcomeModal() {
    // Only apply inside installed PWA
    if (!isPWAInstalled()) return;

    const seen = localStorage.getItem(KEY_ONBOARDING) === "seen";
    if (!seen) showWelcomeModalFirstTime();
    else showWelcomeModalReturning();
}

/* ==========================================================================
   8 — VERSION UI
=========================================================================== */
function initializeVersionUI() {
    if (InstallVersion) InstallVersion.textContent = `Version ${APP_VERSION}`;
    if (AppVersionChip) AppVersionChip.textContent = `Version ${APP_VERSION}`;
}

/* ==========================================================================
   9 — UPDATE / SERVICE WORKER UI
   - Shows banner only in PWA
   - Detects waiting SW and prompts update
=========================================================================== */
function setLastCheckLabel() {
    if (!LastCheckChip) return;
    const d = new Date();
    const t = d.toLocaleString();
    LastCheckChip.textContent = `Last check: ${t}`;
}

function setBannerState({ statusText, buttonText, buttonMode }) {
    if (UpdateStatus) UpdateStatus.textContent = statusText || "";
    if (!UpdateAction) return;

    UpdateAction.textContent = buttonText || "Up to date";
    UpdateAction.classList.toggle("update", buttonMode === "update");
    UpdateAction.disabled = buttonMode === "disabled";
}

async function checkForSWUpdate(reg) {
    try {
        setBannerState({ statusText: "Checking for updates…", buttonText: "Checking…", buttonMode: "disabled" });
        await reg.update();
        setLastCheckLabel();

        // If there's a waiting worker, update is available
        if (reg.waiting) {
            setBannerState({ statusText: "Update available. Tap to refresh.", buttonText: "Update", buttonMode: "update" });
            return;
        }

        setBannerState({ statusText: "Up to date.", buttonText: "Up to date", buttonMode: "normal" });
    } catch (e) {
        setLastCheckLabel();
        setBannerState({ statusText: "Could not check for updates.", buttonText: "Retry", buttonMode: "update" });
    }
}

function initializeUpdateBanner() {
    // Only show meaningful banner inside PWA
    if (!isPWAInstalled()) return;
    if (!PWABanner || !UpdateAction || !UpdateStatus) return;

    // Default state
    setBannerState({ statusText: "Up to date.", buttonText: "Up to date", buttonMode: "normal" });

    if (!("serviceWorker" in navigator)) {
        setBannerState({ statusText: "Service worker not supported.", buttonText: "—", buttonMode: "disabled" });
        return;
    }

    navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) {
            setBannerState({ statusText: "Offline caching not active.", buttonText: "—", buttonMode: "disabled" });
            return;
        }

        // If there is already a waiting SW
        if (reg.waiting) {
            setBannerState({ statusText: "Update available. Tap to refresh.", buttonText: "Update", buttonMode: "update" });
        }

        // Listen for updates found
        reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    setBannerState({ statusText: "Update available. Tap to refresh.", buttonText: "Update", buttonMode: "update" });
                }
            });
        });

        // Button action
        UpdateAction.addEventListener("click", async () => {
            const text = UpdateAction.textContent || "";
            if (text.toLowerCase().includes("update") || text.toLowerCase().includes("retry")) {
                // If we have a waiting SW, activate it
                const freshReg = await navigator.serviceWorker.getRegistration();
                if (freshReg && freshReg.waiting) {
                    freshReg.waiting.postMessage({ type: "SKIP_WAITING" });
                    setBannerState({ statusText: "Updating…", buttonText: "Updating…", buttonMode: "disabled" });
                    return;
                }
                // Otherwise try checking again
                if (freshReg) await checkForSWUpdate(freshReg);
            }
        });

        // When controller changes, reload to get the new cache
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
        });

        // Initial check
        checkForSWUpdate(reg);
    });
}

/* ==========================================================================
   10 — INITIALIZATION
=========================================================================== */
function initializeApp() {
    enforceInitialView();
    initializeTabs();
    initializeOSOverlays();
    initializeVisibilityHandler();
    initializeA2HSModal();

    initializeVersionUI();

    // Welcome modal should appear AFTER app screen is shown in PWA
    // Timeout avoids race with visibility toggles on some iOS builds
    setTimeout(() => {
        initializeWelcomeModal();
        initializeUpdateBanner();
    }, 50);
}

/* ==========================================================================
   11 — START
=========================================================================== */
window.addEventListener("DOMContentLoaded", initializeApp);

/* ==========================================================================
   12 — SERVICE WORKER REGISTRATION
=========================================================================== */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .catch(() => {});
    });
}
