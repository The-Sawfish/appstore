// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews
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
// APPLICATION STATE
// ============================================================
const AppState = {
    isPWA: false,
    isFirstVisit: true,
    currentPage: 'home',
    expandedApp: null,
    sidebarOpen: false
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
    
    // OS Preview Overlays
    setupOSPreviewListeners();
    
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

function setupOSPreviewListeners() {
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
        description: "Hack Stuff is a collection of advanced utilities and experimental tools designed specifically for students and developers who need access to low-level functionality within their browser environment. This powerful toolkit provides sandboxed access to various development and debugging tools that would typically require elevated system permissions. All tools operate within strict security boundaries to ensure user safety while still providing meaningful functionality for educational and development purposes.",
        features: "The Hack Stuff suite includes HTML and CSS inspectors, JavaScript consoles, network request monitors, and various debugging utilities. Each tool has been carefully implemented to work within browser security constraints while still providing genuine utility. The interface mimics professional development environments, giving students experience with tools they will encounter in real-world development careers.",
        additional: "Please note that access to certain advanced features may be restricted based on school network policies or device management configurations. The tool is designed to work within these constraints while still providing as much functionality as possible. Use of these tools should align with school policies and be limited to legitimate educational purposes.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Stuff+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Development+Tools"]
    },
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish Developer Group",
        icon: "icons/game-portal.png",
        category: "Games Hub",
        description: "The Sawfish Game Portal serves as a unified launcher and collection point for all approved browser-based games available through the Sawfish ecosystem. Instead of bookmarking dozens of individual game links, students can access everything from one beautifully designed, organized interface. Each game has been carefully reviewed to ensure it meets school-appropriate standards while still providing engaging entertainment.",
        features: "The portal features a sophisticated categorization system that organizes games by genre, difficulty, and playtime. Games can be filtered by category including puzzle games, platformers, simulation games, arcade classics, and educational content. Each game card displays important information including average playtime, difficulty rating, and user ratings. The portal also tracks which games you've played and provides personalized recommendations based on your preferences.",
        additional: "All games available through the portal have been vetted for age-appropriate content, no excessive advertising, and reasonable system requirements. New games are added regularly after going through the approval process. The portal also synchronizes your progress and high scores across devices when you're logged in, so you never lose your achievements.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal+Home", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Categories"]
    },
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish Developer Group",
        icon: "icons/circle.png",
        category: "Games / Skill",
        description: "Draw a Circle is a deceptively simple yet endlessly engaging reflex and precision challenge that tests your ability to create the most perfect circle possible using only your finger or mouse. The game tracks the geometry of your drawing in real-time, analyzing every curve and angle to determine how close you came to mathematical perfection. Higher scores require smoother, more consistent movements without hesitation or jagged corrections.",
        features: "The game employs sophisticated geometric analysis algorithms that measure circularity from multiple angles, scoring your drawing on precision, consistency, and smoothness. Multiple difficulty modes range from casual practice with visual guides to expert modes that remove all assistance. Daily challenges pit you against the community to see who can draw the most perfect circles, with global leaderboards tracking the top performers.",
        additional: "The game is particularly popular as a quick break activity during study sessions, as it requires only a few seconds to play but provides immediate feedback and a satisfying sense of accomplishment. The minimalist design ensures fast loading times and works reliably even on slower school devices. Adding the game to your Home Screen enables full-screen mode for the most immersive experience.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Precision+Scoring"]
    },
    "2048": {
        name: "2048",
        developer: "Sawfish Developer Group",
        icon: "icons/2048.png",
        category: "Games / Puzzle",
        description: "2048 is the iconic sliding tile puzzle game that took the world by storm, and now it's available optimized for school browsers and touch devices. The goal is deceptively simple: combine matching numbered tiles to reach the 2048 tile. However, the strategic depth is substantial, requiring careful planning several moves ahead to successfully merge tiles while keeping the board from filling up. The game teaches mathematical concepts of powers of two in an engaging, interactive format.",
        features: "This implementation features touch-optimized controls that make swiping on tablets and touchscreens feel natural and responsive. The game includes multiple board sizes including the classic 4x4, plus harder 5x5 and 6x6 variants for experienced players. An undo feature allows you to backtrack mistakes, while the hint system provides subtle suggestions when you get stuck. Daily challenges and achievement tracking add long-term engagement.",
        additional: "The game has been optimized for school networks, with no external dependencies and minimal data usage. All game state is saved locally on your device, so you can close the browser and return later without losing progress. The game runs smoothly even on older devices, making it accessible to all students regardless of their hardware.",
        link: "https://the-sawfish.github.io/2048/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Game+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tile+Merging"]
    },
    minecraft: {
        name: "Minecraft Web (Beta)",
        developer: "Zardoy",
        icon: "icons/minecraft.png",
        category: "Games / Sandbox",
        description: "Experience the boundless creativity of the world's best-selling game directly in your browser with Minecraft Web (Beta). This specialized web port allows players to dive into the iconic blocky universe without the need for heavy downloads or high-end hardware. Whether you are looking to construct monumental castles, intricate redstone machinery, or simple survival shelters, the core mechanics that made the original game a global phenomenon are preserved here in stunning detail optimized for web browsers.",
        features: "The Beta version introduces optimized rendering engines specifically tuned for web performance, ensuring smooth frame rates even on Chromebooks and older laptops. Players can explore procedurally generated terrains including lush forests, arid deserts, and deep cavernous systems. The inventory system has been streamlined for touch and mouse inputs, making crafting tools and weapons intuitive and fast. Creative mode provides unlimited resources for building, while survival mode challenges you to gather, craft, and survive against environmental hazards.",
        additional: "IMPORTANT: In this web version, single player mode does not include crafting functionality. You MUST use a multiplayer server to access full crafting features. We recommend joining the official first server listed when launching for the best multiplayer experience with other players. The developers are working on enabling single player crafting, but for now, multiplayer is required for full functionality. All progress and builds on servers are persistent and saved to the server.",
        link: "https://zardoy.github.io/minecraft-web-client/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Minecraft+Web+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Multiplayer+Servers"]
    },
    blockblast: {
        name: "Block Blast",
        developer: "AAPPQQ",
        icon: "icons/blockblast.png",
        category: "Games / Puzzle",
        description: "Block Blast is a fast-paced, addictive puzzle game that challenges your spatial reasoning and strategic planning skills. The objective is to place colorful blocks onto a grid, clearing lines when rows or columns are completely filled. The game combines the satisfying feeling of tetromino-style block placement with modern visuals and smooth animations. Each move requires careful consideration, as poorly placed blocks can quickly lead to game over.",
        features: "Block Blast features multiple game modes including classic endless play, timed challenges, and daily puzzle modes. The controls have been optimized for touch input, with intuitive drag-and-drop mechanics and snap-to-grid functionality. Visual feedback includes satisfying particle effects and combo multipliers for clearing multiple lines simultaneously. A progression system tracks your best scores and unlocks new block styles as you improve.",
        additional: "The game has been optimized to run smoothly on school devices with minimal performance requirements. No account creation is required to play, and all progress is saved locally on your device. The clean, colorful visuals are designed to be engaging without being distracting, making it appropriate for short breaks between classes or focused study sessions.",
        link: "https://aappqq.github.io/BlockBlast/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Combo+System"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "R74n",
        icon: "icons/sandboxels.png",
        category: "Games / Simulation",
        description: "Sandboxels is an extraordinary physics-based falling sand simulation that offers an almost endless sandbox for creativity and experimentation. With over 500 unique elements ranging from basic powders and liquids to complex chemicals, living organisms, and even weather phenomena, this simulation provides hours of engaging play while also teaching scientific concepts about physics, chemistry, and cause-and-effect relationships. Each element behaves according to realistic physics rules that you can observe and manipulate in real-time.",
        features: "The simulation includes elements in multiple categories: basic materials like sand, water, stone, and metal; liquids with varying viscosities and densities; gases and smoke; fire and temperature-based effects; electrical components and circuits; plants that grow and respond to environment; creatures with simple AI behaviors; and even special elements like gravity wells and black holes. Elements can interact with each other in thousands of ways - fire burns wood, water evaporates on hot surfaces, acid dissolves certain materials, and electricity conducts through metals.",
        additional: "Sandboxels is particularly valuable as an educational tool, allowing students to experiment with scientific concepts in a safe, controlled environment. Teachers have used it to demonstrate concepts ranging from density and states of matter to ecology and environmental science. The simulation runs efficiently in browsers and performs best when added to your Home Screen for full-screen interaction. Performance may vary depending on the number of active elements and device capabilities.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Simulation", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Element+Interactions"]
    },
    run3: {
        name: "Run 3",
        developer: "Joseph Cloutier",
        icon: "icons/run3.png",
        category: "Games / Platformer",
        description: "Run 3 is an incredibly addictive endless runner that takes place in the unique environment of procedurally generated space tunnels. As a small alien character, you must navigate through endless tunnels that twist, turn, and spin in three dimensions. The challenge comes from the constantly changing tunnel geometry, gaps in the floor, and the need to adapt your strategy as gravity shifts and new obstacles appear. This third installment in the Run series introduces new features while refining the core gameplay that made the originals so popular.",
        features: "The game features multiple game modes including the classic endless run, the challenging tunnel run mode with a finish line, and the time attack mode. There are over 20 unique alien characters to unlock, each with different attributes that affect gameplay. The tunnels are procedurally generated, meaning no two runs are exactly the same. The graphics are clean and minimal, which contributes to the smooth performance on school devices. Progress is saved locally on your device, though it doesn't sync across browsers or devices.",
        additional: "As you progress, the game introduces new challenges including crumbling tiles, portals, and sections where the tunnel rotates in ways that disorient even experienced players. The game rewards persistence and quick reflexes, with leaderboards tracking the best runners. Adding Run 3 to your Home Screen provides the best experience with full-screen gameplay and touch controls optimized for mobile play.",
        link: "https://the-sawfish.github.io/Run3Final/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Run+3+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Space+Tunnels"]
    },
    chat: {
        name: "Chat App",
        developer: "Jimeneutron",
        icon: "icons/chat.png",
        category: "Social / Messaging",
        description: "Chat App provides a clean, efficient platform for real-time messaging designed specifically for student communication needs. The interface prioritizes simplicity and speed, allowing students to quickly join conversations without complicated setup processes. Messages are delivered instantly with delivery confirmations, and the system is designed to work reliably on school networks that may have restrictions on other communication platforms.",
        features: "The app features topic-based rooms where students can join discussions relevant to their classes, projects, or interests. Each room supports multiple users and includes features like message history, user presence indicators, and @mentions for direct replies. The interface is fully keyboard accessible and works well with screen readers. Moderation tools help maintain a positive environment, and all messages are logged for safety purposes while respecting student privacy.",
        additional: "The Chat App is designed to work within school network restrictions while still providing effective real-time communication. No personal information is required to use the service, and students can use nicknames if they prefer. The app is optimized for low bandwidth environments and works reliably even on slower school networks. Regular updates add new features based on student feedback.",
        link: "https://jimeneutron.github.io/chatapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+Rooms"]
    },
    call: {
        name: "Call App",
        developer: "Sawfish Developer Group",
        icon: "icons/call.png",
        category: "Social / Communication",
        description: "Call App offers a fast, minimal browser-based voice calling interface that enables quick communication between students without requiring app installation or account creation. The application uses WebRTC technology for peer-to-peer audio communication, providing surprisingly good call quality even on school networks. The design philosophy focuses on simplicity, with the entire call interface fitting on a single screen with no complicated menus or settings to navigate.",
        features: "The calling system supports direct calls between users who share a room code, making it easy to set up quick study sessions or collaborative calls. Call quality adapts to network conditions, automatically adjusting to maintain the best possible audio experience. The interface includes basic call controls including mute, end call, and volume adjustment. Visual indicators show call duration and connection status.",
        additional: "The Call App is intended for quick, efficient communication rather than extended calls, though there are no hard time limits. The app works best with a stable internet connection and headphones for privacy. All calls are peer-to-peer where possible, minimizing server involvement for privacy. The app has been tested to work within typical school network constraints.",
        link: "https://the-sawfish.github.io/call-app/?from=sawfish",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Controls"]
    },
    novaos: {
        name: "NovaOS",
        developer: "RunNova",
        icon: "icons/novaos.png",
        category: "Operating System",
        description: "NovaOS is a full-featured browser-based desktop operating system environment that brings the concept of a web OS to life with remarkable completeness. The system includes a functional desktop with draggable windows, a taskbar, system tray, and start menu. Multiple applications run within the OS including a file manager, text editor, calculator, settings panel, and various entertainment apps. The attention to detail in recreating the desktop experience is impressive, making it feel surprisingly like a real operating system.",
        features: "The OS features a customizable desktop where you can change wallpapers, arrange icons, and configure various settings. Window management includes minimize, maximize, close, and drag functionality. Built-in apps include a fully functional file manager that can create, delete, and organize files in a virtual filesystem. The text editor supports basic formatting, and the calculator provides scientific functions. An app store within NovaOS allows you to install additional applications developed by the community.",
        additional: "For the full NovaOS experience, we recommend opening the OS directly in a new tab or installing the Sawfish App Store to your Home Screen. The preview mode inside the app store has reduced interactivity due to iframe restrictions. NovaOS demonstrates the potential of browser-based computing and provides an educational experience about how operating systems work. Performance is best on modern browsers with good JavaScript support.",
        link: "https://runnova.github.io/NovaOS/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Apps"]
    },
    winripen: {
        name: "WinRipen",
        developer: "Ripenos",
        icon: "icons/winripen.png",
        category: "Operating System",
        description: "WinRipen is a web-based operating system that recreates the familiar look and feel of classic Windows operating systems entirely within your browser. The attention to detail in replicating Windows UI elements, window management behaviors, and system interactions makes for a surprisingly authentic experience. This project serves both as an educational tool for understanding how operating systems work and as a nostalgic trip for those familiar with Windows interfaces of the past.",
        features: "The OS features authentic-looking windows with title bars, minimize/maximize/close buttons, and resizing handles. A start menu provides access to various system applications including a notepad, calculator, and file explorer. The desktop supports shortcuts and can be customized with different wallpapers. Background processes simulate system tasks, and various Windows-specific behaviors have been carefully recreated for authenticity.",
        additional: "Due to browser security restrictions, full interaction with WinRipen requires opening it directly or installing the Sawfish App Store. The preview mode in the app store shows the OS running but with limited interactivity. WinRipen is intended for educational purposes, demonstration, and exploration rather than actual productivity work. Performance may vary depending on browser and device capabilities.",
        link: "https://ripenos.web.app/WinRipen/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=WinRipen+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Windows+Apps"]
    },
    plutoos: {
        name: "PlutoOS",
        developer: "Zeon",
        icon: "icons/plutoos.png",
        category: "Operating System",
        description: "PlutoOS represents a futuristic vision of what a web-based operating system could be, with a focus on modern design aesthetics and smooth, fluid animations. Unlike traditional OS simulations that mimic existing systems, PlutoOS charts its own course with a unique visual identity. The interface emphasizes smoothness and elegance, with transitions and animations that feel genuinely premium. This experimental approach pushes the boundaries of what's possible in a browser-based environment.",
        features: "The OS features a modular design where apps are treated as discrete components that can be arranged and configured. The visual design employs modern principles including glass-morphism effects, smooth gradients, and subtle shadows. Animations are carefully tuned for both aesthetic appeal and performance efficiency. The system includes essential apps like a file viewer, settings panel, and various utilities, with more apps available through the integrated app system.",
        additional: "PlutoOS is an experimental project that demonstrates the cutting edge of browser-based computing. Due to its advanced features and animations, performance may vary across different devices and browsers. For the best experience, use a modern browser with hardware acceleration enabled. The preview mode in the app store provides a glimpse of the OS, but opening it directly or installing to Home Screen enables full functionality.",
        link: "https://pluto-app.zeon.dev",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=PlutoOS+Modern+UI", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Fluid+Animations"]
    },
    ripenos: {
        name: "Ripenos",
        developer: "Ripenos",
        icon: "icons/ripenos.png",
        category: "Operating System",
        description: "Ripenos is a lightweight, modular web-based operating system framework designed for speed and efficiency. Unlike more feature-heavy web OS projects, Ripenos prioritizes performance and simplicity, making it accessible even on lower-powered devices. The modular architecture allows for easy expansion, and the clean codebase makes it an excellent learning resource for those interested in how web applications can simulate operating system functionality.",
        features: "The core OS provides essential desktop functionality including window management, app launching, and system settings. The modular design means you only load the apps and features you need, keeping the system fast and responsive. A plugin system allows developers to create additional functionality that integrates seamlessly with the core OS. The interface is clean and functional, prioritizing usability over visual flash.",
        additional: "Ripenos is particularly suitable for educational environments where performance on varied hardware is important. The system starts quickly and remains responsive even on older devices. For full interaction, open Ripenos directly or install the Sawfish App Store to your Home Screen. The project welcomes community contributions and has an active development community creating new modules and features.",
        link: "https://ripenos.web.app/Ripenos/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ripenos+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Modular+Apps"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Jimeneutron",
        icon: "icons/syrup.png",
        category: "Games / Launcher",
        description: "Syrup Games is an alternative game launcher that provides access to a curated collection of unique browser-based games. The launcher focuses on quality over quantity, featuring games that offer something special whether through innovative gameplay, beautiful presentation, or creative concepts. All games in the collection have been selected for their appropriateness in school environments and their ability to run smoothly on school devices.",
        features: "The launcher features a clean, modern interface that makes it easy to browse and discover new games. Each game listing includes screenshots, descriptions, and player ratings to help you find the perfect game for your mood. Categories help narrow down options when you're looking for something specific. The launcher syncs your game progress and favorites across devices when you're logged in.",
        additional: "Syrup Games complements the main Sawfish Game Portal by offering a different selection of titles with a unique focus. New games are added regularly, and the community can submit suggestions for games to consider. All games work without downloads and run directly in your browser, making them accessible from any device with an internet connection.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Collection"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "GameDevelop",
        icon: "icons/bobtherobber.png",
        category: "Games / Stealth",
        description: "Bob The Robber is a stealth puzzle game series that challenges players to infiltrate various locations, avoid detection, and make off with valuable items. As Bob, a master thief, you must carefully plan your approach, study guard patrol patterns, and use the environment to your advantage. The game combines puzzle-solving with timing-based gameplay, requiring patience and careful observation to succeed.",
        features: "Each level presents a unique location with different security systems, guard placements, and objectives. The gameplay involves observation, planning, and execution - watching guard patrol routes, identifying camera positions, and finding the perfect moment to act. Various tools and power-ups can be collected and used strategically. The art style is clean and readable, making it easy to understand the game state at a glance.",
        additional: "The Bob The Robber series has multiple installments, each with increasing complexity and new mechanics. The games are designed for short play sessions, making them perfect for breaks between classes. No download is required, and the games run smoothly on school devices. Progress is saved locally, allowing you to continue from where you left off.",
        link: "https://bobtherobberunblocked.github.io/2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Puzzles"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Coloso",
        icon: "icons/retrobowl.png",
        category: "Games / Sports",
        description: "Retro Bowl brings the classic American football video game experience to your browser with charming pixel-art graphics and addictive gameplay. As a manager and coach, you build your team, call plays, and lead them to championship glory. The game captures the magic of classic football video games while adding modern touches that make it accessible to new players while rewarding those who master its systems.",
        features: "The gameplay combines strategy and action. On offense, you call plays and control the quarterback, making decisions about when to pass, run, or scramble. On defense, you set up your formation and try to stop the opposing team's drive. The management aspect includes player contracts, team upgrades, and a draft system for acquiring new talent. Season mode takes you through a full football season with playoffs and a championship game.",
        additional: "Retro Bowl has been optimized for browser play, with controls that work well on both desktop and touch devices. The game captures the nostalgic feel of classic football games while adding quality-of-life features that make it more accessible. It's perfect for sports fans looking for a quick football fix or anyone who enjoys management games with satisfying gameplay.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Football+Action"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Voodoo",
        icon: "icons/paperio2.png",
        category: "Games / Arcade",
        description: "Paper Io 2 is an addictive territory conquest game where you control a character that leaves a trail as it moves, and your goal is to capture territory by returning to your base to fill in the enclosed area. The game combines quick reflexes with strategic thinking, as you must balance expanding your territory with defending against other players who can cut your trail and eliminate you. The simple concept hides surprising depth and competitive intensity.",
        features: "The game features both single-player mode against AI opponents and multiplayer mode where you compete against real players. Your territory provides safety - within your own area, you're protected from elimination. Leaving your territory exposes your trail, which opponents can cross to eliminate you. Capturing territory earns points, and the player with the most territory when time runs out wins.",
        additional: "Paper Io 2 is designed for quick, exciting matches that can be completed in a few minutes, making it perfect for short breaks. The controls are simple and responsive, working well on both mouse and touch input. The game runs smoothly on school devices and has been optimized for browser performance. Practice mode is available for learning the mechanics without pressure from other players.",
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
    
    // Get ratings data
    const avgRating = RatingsLocalStorage.getAverageRating(appId);
    const totalReviews = RatingsLocalStorage.getTotalReviews(appId);
    const distribution = RatingsLocalStorage.getRatingDistribution(appId);
    
    // Build expanded content
    const content = buildExpandedContent(app, appId, avgRating, totalReviews, distribution);
    
    // Insert content
    elements.expandedContentWrapper.innerHTML = content;
    
    // Show overlay
    elements.expandedOverlay.classList.remove('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'false');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Setup rating form
    setupRatingForm(appId);
    
    // Load existing reviews
    loadReviews(appId);
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
                <button class="preview-btn" data-iframe="${appId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Open Preview
                </button>
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

function submitReview(appId, rating, comment) {
    // Save to local storage (and Firestore if available)
    const review = RatingsLocalStorage.saveRating(appId, rating, comment, 'Anonymous');
    
    if (review) {
        // Refresh the view
        openExpandedApp(appId);
        
        // Show success message
        showNotification('Review submitted successfully!');
    } else {
        alert('Failed to submit review. Please try again.');
    }
}

function loadReviews(appId) {
    const container = document.getElementById(`comment-list-${appId}`);
    const reviews = RatingsLocalStorage.getAppRatings(appId);
    
    if (!container) return;
    
    if (reviews.length === 0) {
        container.innerHTML = '<p class="muted">No reviews yet. Be the first to leave a review!</p>';
        return;
    }
    
    container.innerHTML = reviews.map(review => `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">
                    <div class="comment-avatar">${review.user.charAt(0).toUpperCase()}</div>
                    <span class="comment-name">${escapeHtml(review.user)}</span>
                </div>
                <div>
                    <span class="comment-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                    <span class="comment-date">${formatDate(review.timestamp)}</span>
                </div>
            </div>
            <div class="comment-body">${escapeHtml(review.comment)}</div>
        </div>
    `).join('');
}

// ============================================================
// LOAD ALL RATINGS
// ============================================================
function loadAllRatings() {
    // Load ratings for all apps
    const apps = Object.keys(appData);
    
    apps.forEach(appId => {
        const avgRating = RatingsLocalStorage.getAverageRating(appId);
        const displayElement = document.querySelector(`[data-avg-rating="${appId}"]`);
        
        if (displayElement) {
            displayElement.textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';
        }
    });
    
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
    // Simple notification - can be enhanced with toast notifications
    console.log('Notification:', message);
    
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
