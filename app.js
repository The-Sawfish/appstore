// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews, Firestore
// Author: Eric Zhu / Sawfish Developer Group
// Date: January 6, 2026
// ============================================================

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyB5JaGq3ezv1ghif7ggRr8_jxuq7ZGw4Bo",
    authDomain: "appstore-cb2fa.firebaseapp.com",
    projectId: "appstore-cb2fa",
    storageBucket: "appstore-cb2fa.firebasestorage.app",
    messagingSenderId: "122307463006",
    appId: "1:122307463006:web:25993ed888531908fbb1cf"
};

// Initialize Firebase
let db;
let app;

try {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('Firebase initialized successfully');
    } else {
        console.warn('Firebase SDK not loaded - ratings will use local storage fallback');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

// ============================================================
// FIRESTORE COMMENTS MODULE
// Handles cloud-synced ratings and reviews
// ============================================================
const FirestoreComments = {
    // Save a review to Firestore
    saveReview: async function(appId, rating, comment, userName, isDeveloper = false) {
        if (!db) {
            console.warn('Firestore not available, using local storage fallback');
            return RatingsLocalStorage.saveRating(appId, rating, comment, userName);
        }
        
        try {
            const review = {
                appId: appId,
                rating: rating,
                comment: comment,
                user: userName || 'Anonymous',
                isDeveloper: isDeveloper,
                timestamp: new Date().toISOString()
            };
            
            await db.collection('reviews').add(review);
            console.log('Review saved to Firestore:', review);
            return review;
        } catch (error) {
            console.error('Error saving to Firestore:', error);
            // Fallback to local storage
            return RatingsLocalStorage.saveRating(appId, rating, comment, userName);
        }
    },
    
    // Get all reviews for an app from Firestore
    getReviews: async function(appId) {
        if (!db) {
            return RatingsLocalStorage.getAppRatings(appId);
        }
        
        try {
            const snapshot = await db.collection('reviews')
                .where('appId', '==', appId)
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching from Firestore:', error);
            return RatingsLocalStorage.getAppRatings(appId);
        }
    },
    
    // Subscribe to real-time updates for an app's reviews
    subscribeToReviews: function(appId, callback) {
        if (!db) {
            // Use local storage polling as fallback
            const localReviews = RatingsLocalStorage.getAppRatings(appId);
            callback(localReviews);
            return () => {};
        }
        
        try {
            const unsubscribe = db.collection('reviews')
                .where('appId', '==', appId)
                .orderBy('timestamp', 'desc')
                .onSnapshot(
                    (snapshot) => {
                        const reviews = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        callback(reviews);
                    },
                    (error) => {
                        console.error('Firestore subscription error:', error);
                        // Fallback to local storage on error
                        callback(RatingsLocalStorage.getAppRatings(appId));
                    }
                );
            
            return unsubscribe;
        } catch (error) {
            console.error('Error setting up Firestore subscription:', error);
            return () => {};
        }
    },
    
    // Calculate average rating for an app
    getAverageRating: async function(appId) {
        if (!db) {
            return RatingsLocalStorage.getAverageRating(appId);
        }
        
        try {
            const snapshot = await db.collection('reviews')
                .where('appId', '==', appId)
                .get();
            
            if (snapshot.empty) {
                return 0;
            }
            
            let sum = 0;
            let count = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (typeof data.rating === 'number') {
                    sum += data.rating;
                    count++;
                }
            });
            
            return count > 0 ? sum / count : 0;
        } catch (error) {
            console.error('Error calculating average:', error);
            return RatingsLocalStorage.getAverageRating(appId);
        }
    },
    
    // Get rating distribution for an app
    getRatingDistribution: async function(appId) {
        if (!db) {
            return RatingsLocalStorage.getRatingDistribution(appId);
        }
        
        try {
            const snapshot = await db.collection('reviews')
                .where('appId', '==', appId)
                .get();
            
            const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (distribution[data.rating] !== undefined) {
                    distribution[data.rating]++;
                }
            });
            
            return distribution;
        } catch (error) {
            console.error('Error getting distribution:', error);
            return RatingsLocalStorage.getRatingDistribution(appId);
        }
    },
    
    // Get total review count for an app
    getTotalReviews: async function(appId) {
        if (!db) {
            return RatingsLocalStorage.getTotalReviews(appId);
        }
        
        try {
            const snapshot = await db.collection('reviews')
                .where('appId', '==', appId)
                .get();
            
            return snapshot.size;
        } catch (error) {
            console.error('Error getting count:', error);
            return RatingsLocalStorage.getTotalReviews(appId);
        }
    }
};

// ============================================================
// DEVELOPER MODE MODULE
// Handles developer authentication and responses
// ============================================================
const DeveloperMode = {
    isLoggedIn: false,
    DEVELOPER_PASSWORD: '120622',
    
    // Initialize developer mode
    init: function() {
        // Check if already logged in from previous session
        if (sessionStorage.getItem('developer_logged_in') === 'true') {
            this.isLoggedIn = true;
            this.updateLoginButton();
        }
        
        // Set up login button listener
        const loginBtn = document.getElementById('developer-login-button');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.toggleLogin());
        }
    },
    
    // Toggle login/logout
    toggleLogin: function() {
        if (this.isLoggedIn) {
            this.logout();
        } else {
            this.login();
        }
    },
    
    // Attempt to log in
    login: function() {
        const password = prompt('Enter developer password:');
        
        if (password === null) {
            // User cancelled
            return;
        }
        
        if (password === this.DEVELOPER_PASSWORD) {
            this.isLoggedIn = true;
            sessionStorage.setItem('developer_logged_in', 'true');
            this.updateLoginButton();
            showNotification('Developer mode activated');
            console.log('Developer logged in successfully');
        } else if (password !== '') {
            alert('Incorrect password. Please try again.');
        }
    },
    
    // Log out
    logout: function() {
        this.isLoggedIn = false;
        sessionStorage.removeItem('developer_logged_in');
        this.updateLoginButton();
        showNotification('Developer mode deactivated');
        console.log('Developer logged out');
    },
    
    // Update the login button UI
    updateLoginButton: function() {
        const btn = document.getElementById('developer-login-button');
        if (!btn) return;
        
        const statusText = btn.querySelector('.developer-status-text');
        const icon = btn.querySelector('svg');
        
        if (this.isLoggedIn) {
            btn.classList.add('logged-in');
            if (statusText) {
                statusText.textContent = 'Logout';
            }
            // Update icon to indicate logged in state
            if (icon) {
                icon.innerHTML = `
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                `;
            }
        } else {
            btn.classList.remove('logged-in');
            if (statusText) {
                statusText.textContent = 'Developer';
            }
            // Reset icon
            if (icon) {
                icon.innerHTML = `
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                `;
            }
        }
    },
    
    // Check if current review is from developer
    isDeveloperReview: function(review) {
        return review.isDeveloper === true;
    }
};

// ============================================================
// LOCAL STORAGE FALLBACK FOR RATINGS
// ============================================================
const RatingsLocalStorage = {
    STORAGE_KEY: 'sawfish_app_ratings',
    
    getAllRatings: function() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error reading ratings from localStorage:', e);
            return {};
        }
    },
    
    saveRating: function(appId, rating, comment, userName) {
        try {
            const ratings = this.getAllRatings();
            if (!ratings[appId]) {
                ratings[appId] = [];
            }
            
            const newReview = {
                id: Date.now().toString(),
                rating: rating,
                comment: comment,
                user: userName || 'Anonymous',
                isDeveloper: false,
                timestamp: new Date().toISOString()
            };
            
            ratings[appId].unshift(newReview);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ratings));
            return newReview;
        } catch (e) {
            console.error('Error saving rating to localStorage:', e);
            return null;
        }
    },
    
    getAppRatings: function(appId) {
        const ratings = this.getAllRatings();
        return ratings[appId] || [];
    },
    
    getAverageRating: function(appId) {
        const ratings = this.getAppRatings(appId);
        if (ratings.length === 0) return 0;
        
        const sum = ratings.reduce((acc, review) => acc + review.rating, 0);
        return sum / ratings.length;
    },
    
    getRatingDistribution: function(appId) {
        const ratings = this.getAppRatings(appId);
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        
        ratings.forEach(review => {
            if (distribution[review.rating] !== undefined) {
                distribution[review.rating]++;
            }
        });
        
        return distribution;
    },
    
    getTotalReviews: function(appId) {
        return this.getAppRatings(appId).length;
    }
};

// ============================================================
// APPLICATION STATE
// ============================================================
const AppState = {
    isPWA: false,
    isFirstVisit: true,
    currentPage: 'home',
    expandedApp: null,
    sidebarOpen: false,
    reviewSubscriptions: {} // Store active subscriptions
};

// ============================================================
// DOM ELEMENTS
// ============================================================
const elements = {
    // Screens
    installScreen: null,
    appScreen: null,
    
    // Navigation
    tabButtons: null,
    navItems: null,
    sidebar: null,
    
    // Pages
    pages: null,
    
    // Expanded Overlay
    expandedOverlay: null,
    expandedContentWrapper: null,
    expandedCloseBtn: null,
    
    // Welcome Modal
    welcomeModal: null,
    welcomeScrollContent: null,
    welcomeReturningContent: null,
    welcomeAck: null,
    welcomeAckRow: null,
    welcomeContinue: null,
    
    // PWA Banner
    pwaBanner: null,
    updateStatus: null,
    updateAction: null,
    
    // Ratings display elements
    ratingDisplays: null
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    detectPWA();
    setupEventListeners();
    loadAllRatings();
    checkFirstVisit();
    removeLoadingClass();
    
    // Initialize developer mode
    DeveloperMode.init();
    
    console.log('Sawfish App Store initialized');
});

function initializeElements() {
    elements.installScreen = document.querySelector('[data-screen="install"]');
    elements.appScreen = document.querySelector('[data-screen="app"]');
    elements.tabButtons = document.querySelectorAll('[data-tab]');
    elements.navItems = document.querySelectorAll('.nav-item');
    elements.sidebar = document.getElementById('sidebar-nav');
    elements.pages = document.querySelectorAll('.page');
    elements.expandedOverlay = document.getElementById('expanded-overlay');
    elements.expandedContentWrapper = document.getElementById('expanded-content-wrapper');
    elements.expandedCloseBtn = document.querySelector('.expanded-close-btn');
    elements.welcomeModal = document.getElementById('welcome-modal');
    elements.welcomeScrollContent = document.getElementById('modal-scroll-content');
    elements.welcomeReturningContent = document.getElementById('modal-returning-content');
    elements.welcomeAck = document.getElementById('welcome-ack');
    elements.welcomeAckRow = document.getElementById('ack-checkbox-row');
    elements.welcomeContinue = document.getElementById('welcome-continue');
    elements.pwaBanner = document.getElementById('pwa-banner');
    elements.updateStatus = document.getElementById('update-status');
    elements.updateAction = document.getElementById('update-action');
    elements.ratingDisplays = document.querySelectorAll('[data-avg-rating]');
}

function detectPWA() {
    // Check if running as PWA
    AppState.isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    document.referrer.includes('android-app://');
    
    // Update UI based on PWA status
    if (AppState.isPWA) {
        elements.installScreen?.classList.add('hidden');
        elements.installScreen?.classList.remove('visible');
        elements.appScreen?.classList.remove('hidden');
        elements.appScreen?.classList.add('visible');
        elements.pwaBanner?.removeAttribute('aria-hidden');
    } else {
        elements.installScreen?.classList.add('visible');
        elements.installScreen?.classList.remove('hidden');
        elements.appScreen?.classList.add('hidden');
        elements.appScreen?.classList.remove('visible');
        elements.pwaBanner?.setAttribute('aria-hidden', 'true');
    }
    
    console.log('PWA Mode:', AppState.isPWA);
}

function removeLoadingClass() {
    document.documentElement.classList.remove('loading');
    document.documentElement.classList.add('loaded');
}

function checkFirstVisit() {
    const hasVisited = localStorage.getItem('sawfish_visited');
    
    if (hasVisited) {
        AppState.isFirstVisit = false;
    } else {
        AppState.isFirstVisit = true;
        localStorage.setItem('sawfish_visited', 'true');
        
        // Show welcome modal after a short delay
        setTimeout(() => {
            showWelcomeModal(true);
        }, 1000);
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Navigation
    setupNavigationListeners();
    
    // App Cards
    setupCardListeners();
    
    // Expanded View
    setupExpandedViewListeners();
    
    // Welcome Modal
    setupWelcomeModalListeners();
    
    // PWA Banner
    setupPWABannerListeners();
    
    // Category Tabs
    setupCategoryTabListeners();
    
    // Service Worker Updates
    setupServiceWorkerListeners();
    
    // Media Query for PWA detection
    window.matchMedia('(display-mode: standalone)').addEventListener('change', function(e) {
        AppState.isPWA = e.matches;
        location.reload();
    });
}

function setupNavigationListeners() {
    // Tab buttons
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Nav items
    elements.navItems.forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
}

function setupCardListeners() {
    const cards = document.querySelectorAll('.app-card');
    const featuredCards = document.querySelectorAll('.featured-card');
    
    // Regular app cards
    cards.forEach(card => {
        card.addEventListener('click', function() {
            const appId = this.dataset.app;
            if (appId) {
                openExpandedApp(appId);
            }
        });
        
        // Keyboard support
        card.setAttribute('tabindex', '0');
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const appId = this.dataset.app;
                if (appId) {
                    openExpandedApp(appId);
                }
            }
        });
    });
    
    // Featured cards
    featuredCards.forEach(card => {
        card.addEventListener('click', function() {
            const appId = this.dataset.app;
            if (appId) {
                openExpandedApp(appId);
            }
        });
        
        card.setAttribute('tabindex', '0');
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const appId = this.dataset.app;
                if (appId) {
                    openExpandedApp(appId);
                }
            }
        });
    });
}

function setupExpandedViewListeners() {
    // Close button
    elements.expandedCloseBtn?.addEventListener('click', closeExpandedApp);
    
    // Backdrop click
    const backdrop = elements.expandedOverlay?.querySelector('.expanded-backdrop');
    backdrop?.addEventListener('click', closeExpandedApp);
    
    // Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !elements.expandedOverlay.classList.contains('hidden')) {
            closeExpandedApp();
        }
    });
}

function setupWelcomeModalListeners() {
    // Scroll detection
    const scrollContent = elements.welcomeScrollContent;
    if (scrollContent) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    // User has scrolled past the scroll indicator
                    const continueBtn = elements.welcomeContinue;
                    if (continueBtn) {
                        continueBtn.disabled = false;
                    }
                }
            });
        }, { threshold: 0.1 });
        
        const scrollIndicator = scrollContent.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            observer.observe(scrollIndicator);
        }
    }
    
    // Ack checkbox
    elements.welcomeAck?.addEventListener('change', function() {
        elements.welcomeContinue.disabled = !this.checked;
    });
    
    // Continue button
    elements.welcomeContinue?.addEventListener('click', function() {
        closeWelcomeModal();
    });
}

function setupPWABannerListeners() {
    elements.updateAction?.addEventListener('click', function() {
        updateApp();
    });
}

function setupCategoryTabListeners() {
    const categoryTabs = document.querySelectorAll('.category-tab');
    
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.dataset.category;
            
            // Update active state
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Filter cards
            filterGameCards(category);
        });
    });
}

function setupServiceWorkerListeners() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(registration) {
            updateAppStatus('ready');
            
            registration.addEventListener('updatefound', function() {
                updateAppStatus('update');
            });
        });
    }
}

// ============================================================
// NAVIGATION FUNCTIONS
// ============================================================
function switchTab(tabName) {
    // Update nav items
    elements.navItems.forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update tab buttons if they exist
    elements.tabButtons.forEach(button => {
        if (button.dataset.tab === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Update pages
    elements.pages.forEach(page => {
        if (page.dataset.page === tabName) {
            page.classList.add('visible');
        } else {
            page.classList.remove('visible');
        }
    });
    
    AppState.currentPage = tabName;
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        elements.sidebar?.classList.remove('open');
    }
}

function scrollToSection(sectionId) {
    const section = document.querySelector(`[data-page="${sectionId}"]`);
    if (section) {
        switchTab(sectionId);
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================================
// EXPANDED APP VIEW
// ============================================================
const appData = {
    hack: {
        name: "Hack Stuff",
        developer: "Sawfish Developer Group",
        icon: "icons/hack.png",
        category: "Utilities / Experimental",
        description: "Hack Stuff is a collection of advanced utilities and experimental tools designed specifically for students and developers who need access to low-level functionality within their browser environment. This powerful toolkit provides sandboxed access to various development and debugging tools that would typically require elevated system permissions.",
        features: "The Hack Stuff suite includes HTML and CSS inspectors, JavaScript consoles, network request monitors, and various debugging utilities. Each tool has been carefully implemented to work within browser security constraints while still providing genuine utility.",
        additional: "Please note that access to certain advanced features may be restricted based on school network policies or device management configurations. The tool is designed to work within these constraints while still providing as much functionality as possible.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Stuff+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Development+Tools"]
    },
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish Developer Group",
        icon: "icons/game-portal.png",
        category: "Games Hub",
        description: "The Sawfish Game Portal serves as a unified launcher and collection point for all approved browser-based games available through the Sawfish ecosystem.",
        features: "The portal features a sophisticated categorization system that organizes games by genre, difficulty, and playtime. Games can be filtered by category including puzzle games, platformers, simulation games, arcade classics, and educational content.",
        additional: "All games available through the portal have been vetted for age-appropriate content, no excessive advertising, and reasonable system requirements. New games are added regularly after going through the approval process.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal+Home", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Categories"]
    },
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish Developer Group",
        icon: "icons/circle.png",
        category: "Games / Skill",
        description: "Draw a Circle is a deceptively simple yet endlessly engaging reflex and precision challenge that tests your ability to create the most perfect circle possible using only your finger or mouse.",
        features: "The game employs sophisticated geometric analysis algorithms that measure circularity from multiple angles, scoring your drawing on precision, consistency, and smoothness.",
        additional: "The game is particularly popular as a quick break activity during study sessions, as it requires only a few seconds to play but provides immediate feedback.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Precision+Scoring"]
    },
    "2048": {
        name: "2048",
        developer: "Sawfish Developer Group",
        icon: "icons/2048.png",
        category: "Games / Puzzle",
        description: "2048 is the iconic sliding tile puzzle game that took the world by storm, and now it's available optimized for school browsers and touch devices.",
        features: "This implementation features touch-optimized controls that make swiping on tablets and touchscreens feel natural and responsive. Multiple board sizes available.",
        additional: "The game has been optimized for school networks, with no external dependencies and minimal data usage.",
        link: "https://the-sawfish.github.io/2048/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Game+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tile+Merging"]
    },
    minecraft: {
        name: "Minecraft Web (Beta)",
        developer: "Zardoy",
        icon: "icons/minecraft.png",
        category: "Games / Sandbox",
        description: "Experience the boundless creativity of the world's best-selling game directly in your browser with Minecraft Web (Beta).",
        features: "The Beta version introduces optimized rendering engines specifically tuned for web performance, ensuring smooth frame rates even on Chromebooks.",
        additional: "IMPORTANT: In this web version, single player mode does not include crafting functionality. You MUST use a multiplayer server to access full crafting features.",
        link: "https://zardoy.github.io/minecraft-web-client/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Minecraft+Web+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Multiplayer+Servers"]
    },
    blockblast: {
        name: "Block Blast",
        developer: "AAPPQQ",
        icon: "icons/blockblast.png",
        category: "Games / Puzzle",
        description: "Block Blast is a fast-paced, addictive puzzle game that challenges your spatial reasoning and strategic planning skills.",
        features: "Block Blast features multiple game modes including classic endless play, timed challenges, and daily puzzle modes.",
        additional: "The game has been optimized to run smoothly on school devices with minimal performance requirements.",
        link: "https://aappqq.github.io/BlockBlast/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Combo+System"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "R74n",
        icon: "icons/sandboxels.png",
        category: "Games / Simulation",
        description: "Sandboxels is an extraordinary physics-based falling sand simulation that offers an almost endless sandbox for creativity and experimentation.",
        features: "The simulation includes elements in multiple categories: basic materials, liquids, gases, fire, electrical components, plants, and creatures.",
        additional: "Sandboxels is particularly valuable as an educational tool, allowing students to experiment with scientific concepts in a safe environment.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Simulation", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Element+Interactions"]
    },
    run3: {
        name: "Run 3",
        developer: "Joseph Cloutier",
        icon: "icons/run3.png",
        category: "Games / Platformer",
        description: "Run 3 is an incredibly addictive endless runner that takes place in the unique environment of procedurally generated space tunnels.",
        features: "The game features multiple game modes including the classic endless run, the challenging tunnel run mode with a finish line, and the time attack mode.",
        additional: "As you progress, the game introduces new challenges including crumbling tiles, portals, and sections where the tunnel rotates.",
        link: "https://the-sawfish.github.io/Run3Final/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Run+3+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Space+Tunnels"]
    },
    chat: {
        name: "Chat App",
        developer: "Jimeneutron",
        icon: "icons/chat.png",
        category: "Social / Messaging",
        description: "Chat App provides a clean, efficient platform for real-time messaging designed specifically for student communication needs.",
        features: "The app features topic-based rooms where students can join discussions relevant to their classes, projects, or interests.",
        additional: "The Chat App is designed to work within school network restrictions while still providing effective real-time communication.",
        link: "https://jimeneutron.github.io/chatapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+Rooms"]
    },
    call: {
        name: "Call App",
        developer: "Sawfish Developer Group",
        icon: "icons/call.png",
        category: "Social / Communication",
        description: "Call App offers a fast, minimal browser-based voice calling interface that enables quick communication between students.",
        features: "The calling system supports direct calls between users who share a room code. Call quality adapts to network conditions.",
        additional: "The Call App is intended for quick, efficient communication rather than extended calls. All calls are peer-to-peer where possible.",
        link: "https://the-sawfish.github.io/call-app/?from=sawfish",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Controls"]
    },
    novaos: {
        name: "NovaOS",
        developer: "RunNova",
        icon: "icons/novaos.png",
        category: "Operating System",
        description: "NovaOS is a full-featured browser-based desktop operating system environment that brings the concept of a web OS to life.",
        features: "The OS features a customizable desktop, window management, file manager, text editor, calculator, and app store.",
        additional: "For the full NovaOS experience, we recommend opening the OS directly in a new tab or installing the Sawfish App Store.",
        link: "https://runnova.github.io/NovaOS/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Apps"]
    },
    winripen: {
        name: "WinRipen",
        developer: "Ripenos",
        icon: "icons/winripen.png",
        category: "Operating System",
        description: "WinRipen is a web-based operating system that recreates the familiar look and feel of classic Windows operating systems.",
        features: "The OS features authentic-looking windows with title bars, minimize/maximize/close buttons, and resizing handles.",
        additional: "Due to browser security restrictions, full interaction with WinRipen requires opening it directly.",
        link: "https://ripenos.web.app/WinRipen/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=WinRipen+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Windows+Apps"]
    },
    plutoos: {
        name: "PlutoOS",
        developer: "Zeon",
        icon: "icons/plutoos.png",
        category: "Operating System",
        description: "PlutoOS represents a futuristic vision of what a web-based operating system could be, with a focus on modern design aesthetics.",
        features: "The OS features a modular design with glass-morphism effects, smooth gradients, and subtle shadows.",
        additional: "PlutoOS is an experimental project that demonstrates the cutting edge of browser-based computing.",
        link: "https://pluto-app.zeon.dev",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=PlutoOS+Modern+UI", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Fluid+Animations"]
    },
    ripenos: {
        name: "Ripenos",
        developer: "Ripenos",
        icon: "icons/ripenos.png",
        category: "Operating System",
        description: "Ripenos is a lightweight, modular web-based operating system framework designed for speed and efficiency.",
        features: "The core OS provides essential desktop functionality including window management, app launching, and system settings.",
        additional: "Ripenos is particularly suitable for educational environments where performance on varied hardware is important.",
        link: "https://ripenos.web.app/Ripenos/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ripenos+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Modular+Apps"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Jimeneutron",
        icon: "icons/syrup.png",
        category: "Games / Launcher",
        description: "Syrup Games is an alternative game launcher that provides access to a curated collection of unique browser-based games.",
        features: "The launcher features a clean, modern interface that makes it easy to browse and discover new games.",
        additional: "Syrup Games complements the main Sawfish Game Portal by offering a different selection of titles.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Collection"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "GameDevelop",
        icon: "icons/bobtherobber.png",
        category: "Games / Stealth",
        description: "Bob The Robber is a stealth puzzle game series that challenges players to infiltrate various locations and avoid detection.",
        features: "Each level presents a unique location with different security systems, guard placements, and objectives.",
        additional: "The Bob The Robber series has multiple installments, each with increasing complexity and new mechanics.",
        link: "https://bobtherobberunblocked.github.io/2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Puzzles"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Coloso",
        icon: "icons/retrobowl.png",
        category: "Games / Sports",
        description: "Retro Bowl brings the classic American football video game experience to your browser with charming pixel-art graphics.",
        features: "The gameplay combines strategy and action with management elements including player contracts and draft systems.",
        additional: "Retro Bowl has been optimized for browser play, with controls that work well on both desktop and touch devices.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Football+Action"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Voodoo",
        icon: "icons/paperio2.png",
        category: "Games / Arcade",
        description: "Paper Io 2 is an addictive territory conquest game where you control a character to capture territory.",
        features: "The game features both single-player mode against AI opponents and multiplayer mode against real players.",
        additional: "Paper Io 2 is designed for quick, exciting matches that can be completed in a few minutes.",
        link: "https://the-sawfish.github.io/seraph/games/paperio2/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Paper+Io+2+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territory+Capture"]
    }
};

function openExpandedApp(appId) {
    const app = appData[appId];
    if (!app) {
        console.error('App not found:', appId);
        return;
    }
    
    AppState.expandedApp = appId;
    
    // Build expanded content with loading state
    const content = buildExpandedContent(app, appId, 0, 0, {5:0,4:0,3:0,2:0,1:0});
    elements.expandedContentWrapper.innerHTML = content;
    
    // Show overlay
    elements.expandedOverlay.classList.remove('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'false');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Load ratings and reviews asynchronously
    loadAppRatings(appId);
    
    // Setup rating form
    setupRatingForm(appId);
    
    // Subscribe to real-time updates
    subscribeToAppReviews(appId);
}

async function loadAppRatings(appId) {
    try {
        const [avgRating, distribution, totalReviews] = await Promise.all([
            FirestoreComments.getAverageRating(appId),
            FirestoreComments.getRatingDistribution(appId),
            FirestoreComments.getTotalReviews(appId)
        ]);
        
        // Update the display
        updateRatingDisplay(appId, avgRating, distribution, totalReviews);
        
        // Load reviews
        loadReviews(appId);
        
        // Update the main card grid ratings
        const displayElement = document.querySelector(`[data-avg-rating="${appId}"]`);
        if (displayElement) {
            displayElement.textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
    }
}

function updateRatingDisplay(appId, avgRating, distribution, totalReviews) {
    // Update the big rating display
    const bigRating = document.querySelector(`#expanded-overlay .rating-big`);
    const ratingCount = document.querySelector(`#expanded-overlay .rating-count`);
    const ratingStars = document.querySelector(`#expanded-overlay .rating-stars`);
    
    if (bigRating) {
        bigRating.textContent = avgRating.toFixed(1);
    }
    
    if (ratingCount) {
        ratingCount.textContent = `${totalReviews} reviews`;
    }
    
    if (ratingStars) {
        ratingStars.textContent = getStarDisplay(avgRating);
    }
    
    // Update rating bars
    const ratingBarsContainer = document.querySelector(`#expanded-overlay .rating-bars`);
    if (ratingBarsContainer) {
        ratingBarsContainer.innerHTML = buildRatingBars(distribution, totalReviews);
    }
}

function buildExpandedContent(app, appId, avgRating, totalReviews, distribution) {
    const ratingStars = getStarDisplay(avgRating);
    
    return `
        <article class="expanded-app" data-app="${appId}">
            <header class="expanded-app-header">
                <div class="expanded-app-icon">
                    <img src="${app.icon}" alt="${app.name} Icon">
                </div>
                <div class="expanded-app-info">
                    <h2>${app.name}</h2>
                    <p class="expanded-developer">By ${app.developer}</p>
                    <div class="expanded-app-meta">
                        <span class="app-category">${app.category}</span>
                    </div>
                </div>
            </header>
            
            <section class="expanded-summary">
                <p>${app.description}</p>
            </section>
            
            <section class="expanded-description">
                <h3>About This App</h3>
                <p>${app.features}</p>
                <p>${app.additional}</p>
            </section>
            
            <section class="expanded-screenshots">
                <h3>Screenshots</h3>
                <div class="screenshot-gallery">
                    <div class="screenshot-item">
                        <img src="${app.screenshots[0]}" alt="${app.name} Screenshot 1" loading="lazy">
                    </div>
                    <div class="screenshot-item">
                        <img src="${app.screenshots[1]}" alt="${app.name} Screenshot 2" loading="lazy">
                    </div>
                </div>
            </section>
            
            <section class="expanded-actions">
                <a href="${app.link}" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open App
                </a>
            </section>
            
            <section class="expanded-ratings">
                <div class="ratings-header">
                    <h3>Ratings & Reviews</h3>
                </div>
                <div class="rating-stats">
                    <div class="rating-big">${avgRating.toFixed(1)}</div>
                    <div class="rating-details">
                        <div class="rating-stars">${ratingStars}</div>
                        <div class="rating-count">${totalReviews} reviews</div>
                    </div>
                </div>
                <div class="rating-bars">
                    ${buildRatingBars(distribution, totalReviews)}
                </div>
            </section>
            
            <section class="expanded-comments">
                <h3>User Reviews</h3>
                <div class="comment-list" id="comment-list-${appId}">
                    <p class="muted">Loading reviews...</p>
                </div>
                
                <form class="comment-form" id="comment-form-${appId}">
                    <h4>Write a Review</h4>
                    <div class="form-group">
                        <label>Your Rating</label>
                        <div class="rating-input" id="rating-input-${appId}">
                            <button type="button" class="rating-star-btn" data-value="1">★</button>
                            <button type="button" class="rating-star-btn" data-value="2">★</button>
                            <button type="button" class="rating-star-btn" data-value="3">★</button>
                            <button type="button" class="rating-star-btn" data-value="4">★</button>
                            <button type="button" class="rating-star-btn" data-value="5">★</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="comment-input-${appId}">Your Review</label>
                        <textarea id="comment-input-${appId}" placeholder="Share your experience with this app..."></textarea>
                    </div>
                    <button type="submit" id="submit-review-${appId}">Submit Review</button>
                </form>
            </section>
        </article>
    `;
}

function getStarDisplay(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '½';
    stars += '☆'.repeat(emptyStars);
    
    return stars;
}

function buildRatingBars(distribution, total) {
    let bars = '';
    for (let i = 5; i >= 1; i--) {
        const count = distribution[i] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        bars += `
            <div class="rating-bar-row">
                <span class="rating-bar-label">${i}</span>
                <div class="rating-bar-track">
                    <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="rating-bar-count">${count}</span>
            </div>
        `;
    }
    return bars;
}

function closeExpandedApp() {
    // Unsubscribe from real-time updates
    if (AppState.expandedApp && AppState.reviewSubscriptions[AppState.expandedApp]) {
        AppState.reviewSubscriptions[AppState.expandedApp]();
        delete AppState.reviewSubscriptions[AppState.expandedApp];
    }
    
    elements.expandedOverlay.classList.add('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'true');
    AppState.expandedApp = null;
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// ============================================================
// RATINGS AND REVIEWS
// ============================================================
function setupRatingForm(appId) {
    const form = document.getElementById(`comment-form-${appId}`);
    const ratingBtns = form?.querySelectorAll('.rating-star-btn');
    let selectedRating = 0;
    
    // Rating star buttons
    ratingBtns?.forEach(btn => {
        btn.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.value);
            updateRatingDisplayStars(form, selectedRating);
        });
        
        btn.addEventListener('mouseenter', function() {
            const value = parseInt(this.dataset.value);
            highlightStars(form, value);
        });
    });
    
    form?.addEventListener('mouseleave', function() {
        if (selectedRating > 0) {
            updateRatingDisplayStars(form, selectedRating);
        } else {
            clearStars(form);
        }
    });
    
    // Form submission
    form?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const textarea = document.getElementById(`comment-input-${appId}`);
        const comment = textarea?.value.trim();
        
        if (selectedRating === 0) {
            alert('Please select a rating');
            return;
        }
        
        if (!comment) {
            alert('Please write a review');
            return;
        }
        
        submitReview(appId, selectedRating, comment);
    });
}

function updateRatingDisplayStars(form, rating) {
    const btns = form.querySelectorAll('.rating-star-btn');
    btns.forEach(btn => {
        const value = parseInt(btn.dataset.value);
        if (value <= rating) {
            btn.classList.add('active');
            btn.textContent = '★';
        } else {
            btn.classList.remove('active');
            btn.textContent = '☆';
        }
    });
}

function highlightStars(form, rating) {
    const btns = form.querySelectorAll('.rating-star-btn');
    btns.forEach(btn => {
        const value = parseInt(btn.dataset.value);
        if (value <= rating) {
            btn.classList.add('active');
            btn.textContent = '★';
        } else {
            btn.classList.remove('active');
            btn.textContent = '☆';
        }
    });
}

function clearStars(form) {
    const btns = form.querySelectorAll('.rating-star-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.textContent = '☆';
    });
}

async function submitReview(appId, rating, comment) {
    // Check if developer mode is active
    const isDeveloper = DeveloperMode.isLoggedIn;
    const userName = isDeveloper ? 'Developer' : 'Anonymous';
    
    // Save to Firestore (with local storage fallback)
    const review = await FirestoreComments.saveReview(appId, rating, comment, userName, isDeveloper);
    
    if (review) {
        showNotification(isDeveloper ? 'Developer response submitted!' : 'Review submitted successfully!');
        
        // Reload ratings and reviews
        await loadAppRatings(appId);
        
        // Clear the form
        const textarea = document.getElementById(`comment-input-${appId}`);
        if (textarea) textarea.value = '';
        clearStars(document.getElementById(`comment-form-${appId}`));
    } else {
        alert('Failed to submit review. Please try again.');
    }
}

function subscribeToAppReviews(appId) {
    // Unsubscribe from previous subscription if exists
    if (AppState.reviewSubscriptions[appId]) {
        AppState.reviewSubscriptions[appId]();
    }
    
    // Subscribe to real-time updates
    const unsubscribe = FirestoreComments.subscribeToReviews(appId, (reviews) => {
        displayReviews(appId, reviews);
    });
    
    AppState.reviewSubscriptions[appId] = unsubscribe;
}

function loadReviews(appId) {
    FirestoreComments.getReviews(appId).then(reviews => {
        displayReviews(appId, reviews);
    });
}

function displayReviews(appId, reviews) {
    const container = document.getElementById(`comment-list-${appId}`);
    
    if (!container) return;
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p class="muted">No reviews yet. Be the first to leave a review!</p>';
        return;
    }
    
    container.innerHTML = reviews.map(review => {
        const isDeveloperReview = DeveloperMode.isDeveloperReview(review);
        const reviewClass = isDeveloperReview ? 'comment-item developer-response' : 'comment-item';
        
        return `
            <div class="${reviewClass}">
                <div class="comment-header">
                    <div class="comment-author">
                        <div class="comment-avatar">${escapeHtml(review.user.charAt(0).toUpperCase())}</div>
                        <span class="comment-name">${escapeHtml(review.user)}</span>
                        ${isDeveloperReview ? '<span class="developer-badge">Developer</span>' : ''}
                    </div>
                    <div>
                        <span class="comment-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                        <span class="comment-date">${formatDate(review.timestamp)}</span>
                    </div>
                </div>
                <div class="comment-body">${escapeHtml(review.comment)}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// LOAD ALL RATINGS
// ============================================================
async function loadAllRatings() {
    const apps = Object.keys(appData);
    
    for (const appId of apps) {
        try {
            const avgRating = await FirestoreComments.getAverageRating(appId);
            const displayElement = document.querySelector(`[data-avg-rating="${appId}"]`);
            
            if (displayElement) {
                displayElement.textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';
            }
        } catch (error) {
            console.error('Error loading rating for', appId, ':', error);
        }
    }
    
    console.log('All ratings loaded');
}

// ============================================================
// FILTER GAME CARDS
// ============================================================
function filterGameCards(category) {
    const cards = document.querySelectorAll('.page[data-page="games"] .app-card');
    
    cards.forEach(card => {
        if (category === 'all') {
            card.style.display = '';
        } else {
            // For now, show all cards (can be enhanced with category data attributes)
            card.style.display = '';
        }
    });
}

// ============================================================
// WELCOME MODAL
// ============================================================
function showWelcomeModal(isFirstVisit) {
    if (!elements.welcomeModal) return;
    
    if (isFirstVisit) {
        elements.welcomeScrollContent.classList.remove('hidden');
        elements.welcomeReturningContent.classList.add('hidden');
        elements.welcomeAckRow.classList.remove('hidden');
        elements.welcomeContinue.disabled = true;
    } else {
        elements.welcomeScrollContent.classList.add('hidden');
        elements.welcomeReturningContent.classList.remove('hidden');
        elements.welcomeAckRow.classList.add('hidden');
        elements.welcomeContinue.disabled = false;
    }
    
    elements.welcomeModal.classList.remove('hidden');
    elements.welcomeModal.setAttribute('aria-hidden', 'false');
}

function closeWelcomeModal() {
    if (!elements.welcomeModal) return;
    
    elements.welcomeModal.classList.add('hidden');
    elements.welcomeModal.setAttribute('aria-hidden', 'true');
    
    // Store that user has acknowledged the welcome
    localStorage.setItem('sawfish_welcome_acknowledged', 'true');
}

// ============================================================
// PWA UPDATE FUNCTIONS
// ============================================================
function updateAppStatus(status) {
    if (!elements.updateStatus || !elements.updateAction) return;
    
    switch (status) {
        case 'checking':
            elements.updateStatus.textContent = 'Checking for updates...';
            break;
        case 'ready':
            elements.updateStatus.textContent = 'Up to date';
            elements.updateAction.innerHTML = '<span class="btn-text">Up to date</span>';
            break;
        case 'update':
            elements.updateStatus.textContent = 'Update available!';
            elements.updateAction.innerHTML = '<span class="btn-text">Update</span><span class="btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>';
            break;
    }
}

function updateApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            updateAppStatus('updating');
        });
        
        // Reload the page after update
        window.addEventListener('swUpdated', () => {
            location.reload(true);
        });
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (e) {
        return 'Unknown date';
    }
}

function showNotification(message) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--accent-primary);
        color: var(--text-inverse);
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 2000;
        animation: slideUp 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================
// GLOBAL FUNCTIONS (for inline HTML calls)
// ============================================================
window.scrollToSection = scrollToSection;

// ============================================================
// END OF JAVASCRIPT
// ============================================================
console.log('Sawfish App Store JavaScript loaded successfully');
