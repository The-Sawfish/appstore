// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews, Firestore
// Author: Sawfish Developer Group
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
// FIRESTORE COMMENTS SYSTEM
// ============================================================
const FirestoreComments = {
    COLLECTION: 'app_reviews',
    
    // Save a review to Firestore
    async saveReview(appId, rating, comment, userName, isDeveloperResponse = false, parentId = null) {
        if (!db) {
            console.warn('Firestore not available, using local storage fallback');
            return null;
        }
        
        try {
            const reviewData = {
                appId: appId,
                rating: rating,
                comment: comment,
                user: userName || 'Anonymous',
                isDeveloperResponse: isDeveloperResponse,
                parentId: parentId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString()
            };
            
            const docRef = await db.collection(this.COLLECTION).add(reviewData);
            console.log('Review saved to Firestore:', docRef.id);
            
            return {
                id: docRef.id,
                ...reviewData,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error saving review to Firestore:', error);
            return null;
        }
    },
    
    // Get all reviews for an app from Firestore
    async getReviews(appId) {
        if (!db) {
            console.warn('Firestore not available, using local storage fallback');
            return [];
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION)
                .where('appId', '==', appId)
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching reviews from Firestore:', error);
            return [];
        }
    },
    
    // Get all reviews (for admin/developer purposes)
    async getAllReviews() {
        if (!db) {
            return [];
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION)
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching all reviews:', error);
            return [];
        }
    },
    
    // Get average rating for an app
    async getAverageRating(appId) {
        if (!db) {
            return 0;
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION)
                .where('appId', '==', appId)
                .where('isDeveloperResponse', '==', false)
                .get();
            
            if (snapshot.empty) return 0;
            
            let sum = 0;
            let count = 0;
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.rating) {
                    sum += data.rating;
                    count++;
                }
            });
            
            return count > 0 ? sum / count : 0;
        } catch (error) {
            console.error('Error calculating average rating:', error);
            return 0;
        }
    },
    
    // Get rating distribution for an app
    async getRatingDistribution(appId) {
        if (!db) {
            return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION)
                .where('appId', '==', appId)
                .where('isDeveloperResponse', '==', false)
                .get();
            
            const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.rating && distribution[data.rating] !== undefined) {
                    distribution[data.rating]++;
                }
            });
            
            return distribution;
        } catch (error) {
            console.error('Error getting rating distribution:', error);
            return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        }
    },
    
    // Get total review count for an app
    async getTotalReviews(appId) {
        if (!db) {
            return 0;
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION)
                .where('appId', '==', appId)
                .where('isDeveloperResponse', '==', false)
                .get();
            
            return snapshot.size;
        } catch (error) {
            console.error('Error getting total reviews:', error);
            return 0;
        }
    },
    
    // Real-time subscription for reviews
    subscribeToReviews(appId, callback) {
        if (!db) {
            console.warn('Firestore not available');
            return () => {};
        }
        
        try {
            return db.collection(this.COLLECTION)
                .where('appId', '==', appId)
                .orderBy('timestamp', 'desc')
                .onSnapshot(snapshot => {
                    const reviews = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    callback(reviews);
                }, error => {
                    console.error('Error in reviews subscription:', error);
                });
        } catch (error) {
            console.error('Error setting up reviews subscription:', error);
            return () => {};
        }
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
// UNIFIED RATINGS SYSTEM (Firestore with Local Fallback)
// ============================================================
const RatingsSystem = {
    DEVELOPER_PASSWORD: '120622',
    isDeveloperMode: false,
    
    async getAverageRating(appId) {
        // Try Firestore first, fall back to local
        if (db) {
            return await FirestoreComments.getAverageRating(appId);
        }
        return RatingsLocalStorage.getAverageRating(appId);
    },
    
    async getRatingDistribution(appId) {
        if (db) {
            return await FirestoreComments.getRatingDistribution(appId);
        }
        return RatingsLocalStorage.getRatingDistribution(appId);
    },
    
    async getTotalReviews(appId) {
        if (db) {
            return await FirestoreComments.getTotalReviews(appId);
        }
        return RatingsLocalStorage.getTotalReviews(appId);
    },
    
    async getReviews(appId) {
        if (db) {
            return await FirestoreComments.getReviews(appId);
        }
        return RatingsLocalStorage.getAppRatings(appId);
    },
    
    async saveReview(appId, rating, comment, userName, isDeveloperResponse = false) {
        // If in developer mode, save as developer response to Firestore
        if (this.isDeveloperMode && db) {
            const result = await FirestoreComments.saveReview(appId, rating, comment, userName, true);
            if (result) return result;
        }
        
        // Fall back to local storage or regular Firestore save
        if (db) {
            const result = await FirestoreComments.saveReview(appId, rating, comment, userName, false);
            if (result) return result;
        }
        
        return RatingsLocalStorage.saveRating(appId, rating, comment, userName);
    },
    
    subscribeToReviews(appId, callback) {
        if (db) {
            return FirestoreComments.subscribeToReviews(appId, callback);
        }
        
        // For local storage, just return current reviews
        const reviews = RatingsLocalStorage.getAppRatings(appId);
        callback(reviews);
        return () => {};
    },
    
    // Developer mode functions
    loginDeveloper(password) {
        if (password === this.DEVELOPER_PASSWORD) {
            this.isDeveloperMode = true;
            localStorage.setItem('sawfish_developer_mode', 'true');
            return true;
        }
        return false;
    },
    
    logoutDeveloper() {
        this.isDeveloperMode = false;
        localStorage.removeItem('sawfish_developer_mode');
    },
    
    checkDeveloperStatus() {
        const stored = localStorage.getItem('sawfish_developer_mode');
        this.isDeveloperMode = stored === 'true';
        return this.isDeveloperMode;
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
    developerMode: false
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
    ratingDisplays: null,
    
    // Developer Login
    userStatus: null
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
    checkDeveloperStatus();
    removeLoadingClass();
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
    elements.userStatus = document.querySelector('.user-status');
}

function detectPWA() {
    AppState.isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    document.referrer.includes('android-app://');
    
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
        
        setTimeout(() => {
            showWelcomeModal(true);
        }, 1000);
    }
}

function checkDeveloperStatus() {
    AppState.developerMode = RatingsSystem.checkDeveloperStatus();
    updateDeveloperUI();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    setupNavigationListeners();
    setupCardListeners();
    setupExpandedViewListeners();
    setupWelcomeModalListeners();
    setupPWABannerListeners();
    setupCategoryTabListeners();
    setupOSPreviewListeners();
    setupServiceWorkerListeners();
    setupDeveloperLoginListeners();
    
    window.matchMedia('(display-mode: standalone)').addEventListener('change', function(e) {
        AppState.isPWA = e.matches;
        location.reload();
    });
}

function setupNavigationListeners() {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
    
    elements.navItems.forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
}

function setupCardListeners() {
    const cards = document.querySelectorAll('.app-card');
    
    cards.forEach(card => {
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
    elements.expandedCloseBtn?.addEventListener('click', closeExpandedApp);
    
    const backdrop = elements.expandedOverlay?.querySelector('.expanded-backdrop');
    backdrop?.addEventListener('click', closeExpandedApp);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !elements.expandedOverlay.classList.contains('hidden')) {
            closeExpandedApp();
        }
    });
}

function setupWelcomeModalListeners() {
    const scrollContent = elements.welcomeScrollContent;
    if (scrollContent) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
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
    
    elements.welcomeAck?.addEventListener('change', function() {
        elements.welcomeContinue.disabled = !this.checked;
    });
    
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
            
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            filterGameCards(category);
        });
    });
}

function setupOSPreviewListeners() {
    // OS previews have been removed, but keeping for potential future use
    const osContainers = document.querySelectorAll('.os-preview-container');
    
    osContainers.forEach(container => {
        const iframe = container.querySelector('iframe');
        const overlay = container.querySelector('.preview-overlay');
        
        if (iframe && overlay) {
            iframe.addEventListener('load', function() {
                overlay.classList.add('visible');
            });
        }
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

function setupDeveloperLoginListeners() {
    const userStatus = document.querySelector('.user-status');
    if (userStatus) {
        userStatus.style.cursor = 'pointer';
        userStatus.addEventListener('click', handleDeveloperLogin);
    }
}

// ============================================================
// DEVELOPER LOGIN HANDLER
// ============================================================
function handleDeveloperLogin() {
    if (AppState.developerMode) {
        // Logout
        RatingsSystem.logoutDeveloper();
        AppState.developerMode = false;
        updateDeveloperUI();
        showNotification('Developer mode disabled');
    } else {
        // Login
        const password = prompt('Enter developer password:');
        if (password) {
            if (RatingsSystem.loginDeveloper(password)) {
                AppState.developerMode = true;
                updateDeveloperUI();
                showNotification('Developer mode enabled - You can now respond to reviews');
            } else {
                showNotification('Incorrect password');
            }
        }
    }
}

function updateDeveloperUI() {
    const userStatus = document.querySelector('.user-status');
    if (userStatus) {
        if (AppState.developerMode) {
            userStatus.innerHTML = `
                <div class="status-dot online" style="background: #fbbf24; box-shadow: 0 0 8px #fbbf24;"></div>
                <span>Developer Mode</span>
            `;
        } else {
            userStatus.innerHTML = `
                <div class="status-dot online"></div>
                <span>Login</span>
            `;
        }
    }
}

// ============================================================
// NAVIGATION FUNCTIONS
// ============================================================
function switchTab(tabName) {
    elements.navItems.forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    elements.tabButtons.forEach(button => {
        if (button.dataset.tab === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    elements.pages.forEach(page => {
        if (page.dataset.page === tabName) {
            page.classList.add('visible');
        } else {
            page.classList.remove('visible');
        }
    });
    
    AppState.currentPage = tabName;
    
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
        features: "The Hack Stuff suite includes HTML and CSS inspectors, JavaScript consoles, network request monitors, and various debugging utilities. Each tool has been carefully implemented to work within browser security constraints while still providing genuine utility for educational and development purposes.",
        additional: "Please note that access to certain advanced features may be restricted based on school network policies or device management configurations.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Stuff+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Development+Tools"]
    },
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish Developer Group",
        icon: "icons/game-portal.png",
        category: "Games Hub",
        description: "The Sawfish Game Portal serves as a unified launcher and collection point for all approved browser-based games available through the Sawfish ecosystem. Instead of bookmarking dozens of individual game links, students can access everything from one beautifully designed, organized interface.",
        features: "The portal features a sophisticated categorization system that organizes games by genre, difficulty, and playtime. Games can be filtered by category including puzzle games, platformers, simulation games, arcade classics, and educational content.",
        additional: "All games available through the portal have been vetted for age-appropriate content, no excessive advertising, and reasonable system requirements.",
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
        description: "2048 is the iconic sliding tile puzzle game that took the world by storm, now available optimized for school browsers and touch devices. The goal is to combine matching numbered tiles to reach the 2048 tile.",
        features: "This implementation features touch-optimized controls, multiple board sizes, an undo feature, and daily challenges.",
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
        features: "The Beta version introduces optimized rendering engines, procedural terrain generation, and streamlined inventory systems.",
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
        features: "Block Blast features multiple game modes, touch-optimized controls, and visual feedback including satisfying particle effects.",
        additional: "The game has been optimized to run smoothly on school devices with minimal performance requirements.",
        link: "https://aappqq.github.io/BlockBlast/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Combo+System"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "R74n",
        icon: "icons/sandboxels.png",
        category: "Games / Simulation",
        description: "Sandboxels is an extraordinary physics-based falling sand simulation with over 500 unique elements.",
        features: "The simulation includes elements in multiple categories: basic materials, liquids, gases, fire, electrical components, plants, and creatures.",
        additional: "Sandboxels is particularly valuable as an educational tool, allowing students to experiment with scientific concepts.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Simulation", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Element+Interactions"]
    },
    run3: {
        name: "Run 3",
        developer: "Joseph Cloutier",
        icon: "icons/run3.png",
        category: "Games / Platformer",
        description: "Run 3 is an incredibly addictive endless runner that takes place in procedurally generated space tunnels.",
        features: "The game features multiple game modes, over 20 unique alien characters, and procedurally generated tunnels.",
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
        features: "The app features topic-based rooms, real-time messaging with delivery confirmations, and keyboard accessibility.",
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
        features: "The calling system supports direct calls between users who share a room code, with adaptive audio quality.",
        additional: "The Call App is intended for quick, efficient communication rather than extended calls.",
        link: "https://the-sawfish.github.io/call-app/?from=sawfish",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Controls"]
    },
    novaos: {
        name: "NovaOS",
        developer: "RunNova",
        icon: "icons/novaos.png",
        category: "Operating System",
        description: "NovaOS is a full-featured browser-based desktop operating system environment with remarkable completeness.",
        features: "The OS features a customizable desktop, window management, built-in apps including file manager and text editor.",
        additional: "For the full NovaOS experience, we recommend opening the OS directly in a new tab.",
        link: "https://runnova.github.io/NovaOS/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Apps"]
    },
    winripen: {
        name: "WinRipen",
        developer: "Ripenos",
        icon: "icons/winripen.png",
        category: "Operating System",
        description: "WinRipen is a web-based operating system that recreates the familiar look and feel of classic Windows.",
        features: "The OS features authentic-looking windows, a start menu, and various Windows-specific behaviors.",
        additional: "Due to browser security restrictions, full interaction requires opening it directly.",
        link: "https://ripenos.web.app/WinRipen/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=WinRipen+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Windows+Apps"]
    },
    plutoos: {
        name: "PlutoOS",
        developer: "Zeon",
        icon: "icons/plutoos.png",
        category: "Operating System",
        description: "PlutoOS represents a futuristic vision of what a web-based operating system could be.",
        features: "The OS features a modular design, modern visual design with glass-morphism effects, and fluid animations.",
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
        features: "The core OS provides essential desktop functionality, modular design, and a plugin system.",
        additional: "Ripenos is particularly suitable for educational environments where performance on varied hardware is important.",
        link: "https://ripenos.web.app/Ripenos/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ripenos+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Modular+Apps"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Jimeneutron",
        icon: "icons/syrup.png",
        category: "Games / Launcher",
        description: "Syrup Games is an alternative game launcher providing access to a curated collection of unique browser-based games.",
        features: "The launcher features a clean interface, game categorization, and progress tracking.",
        additional: "Syrup Games complements the main Sawfish Game Portal by offering a different selection of titles.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Collection"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "GameDevelop",
        icon: "icons/bobtherobber.png",
        category: "Games / Stealth",
        description: "Bob The Robber is a stealth puzzle game that challenges players to infiltrate various locations.",
        features: "Each level presents a unique location with different security systems and objectives.",
        additional: "The Bob The Robber series has multiple installments, each with increasing complexity.",
        link: "https://bobtherobberunblocked.github.io/2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Puzzles"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Coloso",
        icon: "icons/retrobowl.png",
        category: "Games / Sports",
        description: "Retro Bowl brings the classic American football video game experience to your browser.",
        features: "The gameplay combines strategy and action with management elements including player contracts.",
        additional: "Retro Bowl has been optimized for browser play, with controls that work well on both desktop and touch devices.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Football+Action"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Voodoo",
        icon: "icons/paperio2.png",
        category: "Games / Arcade",
        description: "Paper Io 2 is an addictive territory conquest game where you control a character that leaves a trail.",
        features: "The game features both single-player mode against AI opponents and multiplayer mode.",
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
    
    // Build expanded content
    const content = buildExpandedContent(app, appId);
    
    elements.expandedContentWrapper.innerHTML = content;
    
    elements.expandedOverlay.classList.remove('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'false');
    
    document.body.style.overflow = 'hidden';
    
    // Setup rating form and load reviews
    setupRatingForm(appId);
    loadReviews(appId);
}

function buildExpandedContent(app, appId) {
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
            
            <section class="expanded-ratings" id="ratings-section-${appId}">
                <div class="ratings-header">
                    <h3>Ratings & Reviews</h3>
                    <span class="loading-indicator">Loading...</span>
                </div>
                <div class="rating-stats" id="rating-stats-${appId}">
                    <div class="rating-big">—</div>
                    <div class="rating-details">
                        <div class="rating-stars">☆☆☆☆☆</div>
                        <div class="rating-count">0 reviews</div>
                    </div>
                </div>
                <div class="rating-bars" id="rating-bars-${appId}">
                    ${buildRatingBars({5:0,4:0,3:0,2:0,1:0}, 0)}
                </div>
            </section>
            
            <section class="expanded-comments">
                <h3>User Reviews</h3>
                <div class="comment-list" id="comment-list-${appId}">
                    <p class="muted">Loading reviews...</p>
                </div>
                
                <form class="comment-form" id="comment-form-${appId}">
                    <h4>${AppState.developerMode ? 'Developer Response' : 'Write a Review'}</h4>
                    ${AppState.developerMode ? '<p class="developer-note">Posting as a developer - your response will be marked as official.</p>' : ''}
                    <div class="form-group">
                        <label>Rating</label>
                        <div class="rating-input" id="rating-input-${appId}">
                            <button type="button" class="rating-star-btn" data-value="1">★</button>
                            <button type="button" class="rating-star-btn" data-value="2">★</button>
                            <button type="button" class="rating-star-btn" data-value="3">★</button>
                            <button type="button" class="rating-star-btn" data-value="4">★</button>
                            <button type="button" class="rating-star-btn" data-value="5">★</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="comment-input-${appId}">${AppState.developerMode ? 'Your Response' : 'Your Review'}</label>
                        <textarea id="comment-input-${appId}" placeholder="${AppState.developerMode ? 'Write an official response to users...' : 'Share your experience with this app...'}"></textarea>
                    </div>
                    <button type="submit" id="submit-review-${appId}">${AppState.developerMode ? 'Post Response' : 'Submit Review'}</button>
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
    elements.expandedOverlay.classList.add('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'true');
    AppState.expandedApp = null;
    
    document.body.style.overflow = '';
}

// ============================================================
// RATINGS AND REVIEWS
// ============================================================
function setupRatingForm(appId) {
    const form = document.getElementById(`comment-form-${appId}`);
    const ratingBtns = form?.querySelectorAll('.rating-star-btn');
    let selectedRating = 0;
    
    ratingBtns?.forEach(btn => {
        btn.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.value);
            updateRatingDisplay(form, selectedRating);
        });
        
        btn.addEventListener('mouseenter', function() {
            const value = parseInt(this.dataset.value);
            highlightStars(form, value);
        });
    });
    
    form?.addEventListener('mouseleave', function() {
        if (selectedRating > 0) {
            updateRatingDisplay(form, selectedRating);
        } else {
            clearStars(form);
        }
    });
    
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

function updateRatingDisplay(form, rating) {
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
    const userName = AppState.developerMode ? 'Developer' : 'Anonymous';
    const review = await RatingsSystem.saveReview(appId, rating, comment, userName, AppState.developerMode);
    
    if (review) {
        showNotification(AppState.developerMode ? 'Developer response posted!' : 'Review submitted successfully!');
        
        // Refresh the view
        openExpandedApp(appId);
    } else {
        alert('Failed to submit review. Please try again.');
    }
}

async function loadReviews(appId) {
    const container = document.getElementById(`comment-list-${appId}`);
    if (!container) return;
    
    // Load rating stats
    const [avgRating, totalReviews, distribution] = await Promise.all([
        RatingsSystem.getAverageRating(appId),
        RatingsSystem.getTotalReviews(appId),
        RatingsSystem.getRatingDistribution(appId)
    ]);
    
    // Update rating display
    const statsContainer = document.getElementById(`rating-stats-${appId}`);
    const barsContainer = document.getElementById(`rating-bars-${appId}`);
    
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="rating-big">${avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
            <div class="rating-details">
                <div class="rating-stars">${getStarDisplay(avgRating)}</div>
                <div class="rating-count">${totalReviews} review${totalReviews !== 1 ? 's' : ''}</div>
            </div>
        `;
    }
    
    if (barsContainer) {
        barsContainer.innerHTML = buildRatingBars(distribution, totalReviews);
    }
    
    // Load reviews
    const reviews = await RatingsSystem.getReviews(appId);
    
    if (reviews.length === 0) {
        container.innerHTML = '<p class="muted">No reviews yet. Be the first to leave a review!</p>';
        return;
    }
    
    container.innerHTML = reviews.map(review => {
        const isDeveloper = review.isDeveloperResponse === true;
        return `
            <div class="comment-item ${isDeveloper ? 'developer-response' : ''}">
                <div class="comment-header">
                    <div class="comment-author">
                        <div class="comment-avatar ${isDeveloper ? 'developer-avatar' : ''}">${review.user.charAt(0).toUpperCase()}</div>
                        <span class="comment-name">${escapeHtml(review.user)}</span>
                        ${isDeveloper ? '<span class="developer-badge">Developer</span>' : ''}
                    </div>
                    <div>
                        ${review.rating ? `<span class="comment-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>` : ''}
                        <span class="comment-date">${formatDate(review.timestamp || review.createdAt)}</span>
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
        const avgRating = await RatingsSystem.getAverageRating(appId);
        const displayElement = document.querySelector(`[data-avg-rating="${appId}"]`);
        
        if (displayElement) {
            displayElement.textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';
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
    console.log('Notification:', message);
    
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
// GLOBAL FUNCTIONS
// ============================================================
window.scrollToSection = scrollToSection;

console.log('Sawfish App Store JavaScript loaded successfully');
