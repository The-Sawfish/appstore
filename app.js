// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews, Firestore
// Enhanced Developer Mode with Analytics, App Management, Announcements
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
                return null; // Return null to indicate no reviews
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
            
            return count > 0 ? sum / count : null;
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
    },
    
    // Get all reviews across all apps (for analytics)
    getAllReviews: async function() {
        if (!db) {
            const allRatings = RatingsLocalStorage.getAllRatings();
            let allReviews = [];
            Object.keys(allRatings).forEach(appId => {
                allReviews = allReviews.concat(allRatings[appId]);
            });
            return allReviews;
        }
        
        try {
            const snapshot = await db.collection('reviews')
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting all reviews:', error);
            return [];
        }
    },
    
    // Delete a review
    deleteReview: async function(reviewId) {
        if (!db) {
            console.warn('Firestore not available');
            return false;
        }
        
        try {
            await db.collection('reviews').doc(reviewId).delete();
            console.log('Review deleted:', reviewId);
            return true;
        } catch (error) {
            console.error('Error deleting review:', error);
            return false;
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
        if (ratings.length === 0) return null;
        
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
// DEVELOPER MODE MODULE
// Enhanced with Analytics, App Management, Announcements, Moderation
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
        
        // Set up developer modal listeners
        this.setupModalListeners();
        
        // Set up dashboard listeners
        this.setupDashboardListeners();
    },
    
    // Setup developer modal event listeners
    setupModalListeners: function() {
        const modal = document.getElementById('developer-login-modal');
        const cancelBtn = document.getElementById('developer-cancel');
        const submitBtn = document.getElementById('developer-submit');
        const passwordInput = document.getElementById('developer-password');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeLoginModal());
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitPassword());
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.submitPassword();
                }
            });
        }
        
        // Close modal on backdrop click
        const backdrop = modal?.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.closeLoginModal());
        }
    },
    
    // Setup dashboard event listeners
    setupDashboardListeners: function() {
        // Close dashboard
        const closeBtn = document.getElementById('developer-close-dashboard');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeDashboard());
        }
        
        // Dashboard navigation
        const navBtns = document.querySelectorAll('.developer-nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.developerTab;
                this.switchDeveloperTab(tab);
            });
        });
        
        // Add new app button
        const addAppBtn = document.getElementById('add-new-app-btn');
        if (addAppBtn) {
            addAppBtn.addEventListener('click', () => this.showAddAppForm());
        }
        
        // Publish announcement button
        const publishBtn = document.getElementById('publish-announcement');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => this.publishAnnouncement());
        }
        
        // Close announcement banner
        const bannerClose = document.getElementById('announcement-close');
        if (bannerClose) {
            bannerClose.addEventListener('click', () => this.dismissAnnouncement());
        }
    },
    
    // Toggle login/logout
    toggleLogin: function() {
        if (this.isLoggedIn) {
            this.openDashboard();
        } else {
            this.openLoginModal();
        }
    },
    
    // Open login modal
    openLoginModal: function() {
        const modal = document.getElementById('developer-login-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            const passwordInput = document.getElementById('developer-password');
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.focus();
            }
        }
    },
    
    // Close login modal
    closeLoginModal: function() {
        const modal = document.getElementById('developer-login-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
    // Submit password
    submitPassword: function() {
        const passwordInput = document.getElementById('developer-password');
        const password = passwordInput?.value;
        
        if (password === this.DEVELOPER_PASSWORD) {
            this.isLoggedIn = true;
            sessionStorage.setItem('developer_logged_in', 'true');
            this.closeLoginModal();
            this.updateLoginButton();
            this.openDashboard();
            showNotification('Developer mode activated');
            console.log('Developer logged in successfully');
        } else if (password && password !== '') {
            alert('Incorrect password. Please try again.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    },
    
    // Log out
    logout: function() {
        this.isLoggedIn = false;
        sessionStorage.removeItem('developer_logged_in');
        this.closeDashboard();
        this.updateLoginButton();
        showNotification('Developer mode deactivated');
        console.log('Developer logged out');
    },
    
    // Open developer dashboard
    openDashboard: function() {
        const dashboard = document.getElementById('developer-dashboard');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.setAttribute('aria-hidden', 'false');
            this.loadAnalytics();
            this.loadAppManager();
            this.loadAnnouncements();
            this.loadModeration();
        }
    },
    
    // Close developer dashboard
    closeDashboard: function() {
        const dashboard = document.getElementById('developer-dashboard');
        if (dashboard) {
            dashboard.classList.add('hidden');
            dashboard.setAttribute('aria-hidden', 'true');
        }
    },
    
    // Switch developer dashboard tab
    switchDeveloperTab: function(tabName) {
        // Update nav buttons
        const navBtns = document.querySelectorAll('.developer-nav-btn');
        navBtns.forEach(btn => {
            if (btn.dataset.developerTab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update content
        const contents = document.querySelectorAll('.developer-tab-content');
        contents.forEach(content => {
            if (content.dataset.developerContent === tabName) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    },
    
    // Load analytics data
    loadAnalytics: async function() {
        try {
            const [allReviews, totalApps] = await Promise.all([
                FirestoreComments.getAllReviews(),
                Promise.resolve(Object.keys(appData).length)
            ]);
            
            // Calculate statistics
            const totalReviews = allReviews.length;
            const developerResponses = allReviews.filter(r => r.isDeveloper).length;
            
            // Calculate average rating
            let sum = 0;
            let count = 0;
            const appRatings = {};
            
            allReviews.forEach(review => {
                sum += review.rating;
                count++;
                if (!appRatings[review.appId]) {
                    appRatings[review.appId] = { sum: 0, count: 0 };
                }
                appRatings[review.appId].sum += review.rating;
                appRatings[review.appId].count++;
            });
            
            const avgRating = count > 0 ? (sum / count).toFixed(1) : '0.0';
            
            // Update UI
            document.getElementById('stat-total-reviews').textContent = totalReviews;
            document.getElementById('stat-total-apps').textContent = totalApps;
            document.getElementById('stat-avg-rating').textContent = avgRating;
            document.getElementById('stat-developer-responses').textContent = developerResponses;
            
            // Show top rated apps
            const topRatedContainer = document.getElementById('top-rated-apps');
            if (topRatedContainer) {
                const topApps = Object.entries(appRatings)
                    .map(([appId, data]) => ({
                        appId,
                        avg: data.sum / data.count,
                        count: data.count
                    }))
                    .sort((a, b) => b.avg - a.avg)
                    .slice(0, 5);
                
                if (topApps.length > 0) {
                    topRatedContainer.innerHTML = topApps.map(app => {
                        const appInfo = appData[app.appId];
                        return `
                            <div class="top-rated-item">
                                <span class="top-rated-name">${appInfo ? appInfo.name : app.appId}</span>
                                <span class="top-rated-stars">${getStarDisplay(app.avg)}</span>
                                <span class="top-rated-count">(${app.count})</span>
                            </div>
                        `;
                    }).join('');
                } else {
                    topRatedContainer.innerHTML = '<p class="muted">No ratings data available</p>';
                }
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    },
    
    // Load app manager
    loadAppManager: function() {
        const appList = document.getElementById('app-manager-list');
        if (!appList) return;
        
        const apps = Object.entries(appData).map(([id, data]) => ({ id, ...data }));
        
        appList.innerHTML = apps.map(app => `
            <div class="app-manager-item">
                <div class="app-manager-info">
                    <img src="${app.icon}" alt="${app.name}" class="app-manager-icon">
                    <div>
                        <strong>${app.name}</strong>
                        <span class="app-manager-category">${app.category}</span>
                    </div>
                </div>
                <div class="app-manager-actions">
                    <button class="action-btn small" onclick="DeveloperMode.editApp('${app.id}')">Edit</button>
                    <button class="action-btn small danger" onclick="DeveloperMode.deleteApp('${app.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    },
    
    // Add new app
    showAddAppForm: function() {
        const newAppId = prompt('Enter new app ID (lowercase, no spaces):');
        if (!newAppId) return;
        
        const appName = prompt('Enter app name:');
        if (!appName) return;
        
        const appDeveloper = prompt('Enter developer name:');
        const appCategory = prompt('Enter category:') || 'Games';
        const appLink = prompt('Enter app URL:');
        if (!appLink) return;
        
        // Create new app data
        appData[newAppId] = {
            name: appName,
            developer: appDeveloper || 'Unknown',
            icon: `icons/${newAppId}.png`,
            category: appCategory,
            description: `${appName} - A new app added to the Sawfish App Store.`,
            features: 'This app offers great features and functionality for students.',
            additional: 'Enjoy using this application!',
            link: appLink,
            screenshots: [
                `https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=${encodeURIComponent(appName)}`,
                `https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=${encodeURIComponent(appName)}+Features`
            ]
        };
        
        showNotification(`App "${appName}" added successfully!`);
        this.loadAppManager();
    },
    
    // Edit app
    editApp: function(appId) {
        const app = appData[appId];
        if (!app) return;
        
        const newName = prompt('Edit app name:', app.name);
        if (newName) app.name = newName;
        
        const newDeveloper = prompt('Edit developer:', app.developer);
        if (newDeveloper !== null) app.developer = newDeveloper;
        
        const newCategory = prompt('Edit category:', app.category);
        if (newCategory !== null) app.category = newCategory;
        
        const newLink = prompt('Edit URL:', app.link);
        if (newLink) app.link = newLink;
        
        showNotification(`App "${app.name}" updated successfully!`);
    },
    
    // Delete app
    deleteApp: function(appId) {
        const app = appData[appId];
        if (!app) return;
        
        if (confirm(`Are you sure you want to delete "${app.name}"?`)) {
            delete appData[appId];
            showNotification(`App "${app.name}" deleted`);
            this.loadAppManager();
        }
    },
    
    // Load announcements
    loadAnnouncements: function() {
        const announcementList = document.getElementById('announcement-list');
        if (!announcementList) return;
        
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        
        if (announcements.length > 0) {
            announcementList.innerHTML = announcements.map((ann, index) => `
                <div class="announcement-item ${ann.type}">
                    <strong>${escapeHtml(ann.title)}</strong>
                    <p>${escapeHtml(ann.text)}</p>
                    <span class="announcement-date">${formatDate(ann.timestamp)}</span>
                    <button class="action-btn small danger" onclick="DeveloperMode.deleteAnnouncement(${index})">Delete</button>
                </div>
            `).join('');
        } else {
            announcementList.innerHTML = '<p class="muted">No announcements yet</p>';
        }
    },
    
    // Publish announcement
    publishAnnouncement: function() {
        const titleInput = document.getElementById('announcement-title');
        const textInput = document.getElementById('announcement-text');
        const typeInput = document.getElementById('announcement-type');
        
        const title = titleInput?.value.trim();
        const text = textInput?.value.trim();
        const type = typeInput?.value || 'info';
        
        if (!title || !text) {
            alert('Please enter both title and message');
            return;
        }
        
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        announcements.unshift({
            title,
            text,
            type,
            timestamp: new Date().toISOString()
        });
        
        localStorage.setItem('sawfish_announcements', JSON.stringify(announcements));
        
        // Clear form
        titleInput.value = '';
        textInput.value = '';
        
        showNotification('Announcement published!');
        this.loadAnnouncements();
        
        // Show announcement banner
        this.showAnnouncementBanner(title, type);
    },
    
    // Delete announcement
    deleteAnnouncement: function(index) {
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        announcements.splice(index, 1);
        localStorage.setItem('sawfish_announcements', JSON.stringify(announcements));
        this.loadAnnouncements();
        showNotification('Announcement deleted');
    },
    
    // Show announcement banner
    showAnnouncementBanner: function(title, type) {
        const banner = document.getElementById('announcement-banner');
        const textSpan = banner?.querySelector('.announcement-text');
        const iconSpan = banner?.querySelector('.announcement-icon');
        
        if (banner && textSpan && iconSpan) {
            banner.className = `announcement-banner ${type}`;
            textSpan.textContent = title;
            
            // Set icon based on type
            switch (type) {
                case 'warning':
                    iconSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
                    break;
                case 'success':
                    iconSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
                    break;
                default:
                    iconSpan.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
            }
            
            banner.classList.remove('hidden');
            banner.setAttribute('aria-hidden', 'false');
        }
    },
    
    // Dismiss announcement banner
    dismissAnnouncement: function() {
        const banner = document.getElementById('announcement-banner');
        if (banner) {
            banner.classList.add('hidden');
            banner.setAttribute('aria-hidden', 'true');
        }
    },
    
    // Load moderation list
    loadModeration: async function() {
        const moderationList = document.getElementById('moderation-list');
        if (!moderationList) return;
        
        try {
            const allReviews = await FirestoreComments.getAllReviews();
            
            if (allReviews.length > 0) {
                moderationList.innerHTML = allReviews.map(review => {
                    const appInfo = appData[review.appId];
                    return `
                        <div class="moderation-item ${review.isDeveloper ? 'developer' : ''}">
                            <div class="moderation-info">
                                <strong>${escapeHtml(review.user)}</strong>
                                <span>on ${appInfo ? appInfo.name : review.appId}</span>
                                <span class="moderation-rating">${'★'.repeat(review.rating)}</span>
                            </div>
                            <p class="moderation-comment">${escapeHtml(review.comment)}</p>
                            <span class="moderation-date">${formatDate(review.timestamp)}</span>
                            <div class="moderation-actions">
                                ${review.isDeveloper ? '' : `<button class="action-btn small" onclick="DeveloperMode.respondToReview('${review.id}', '${review.appId}')">Respond</button>`}
                                <button class="action-btn small danger" onclick="DeveloperMode.deleteReviewById('${review.id}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                moderationList.innerHTML = '<p class="muted">No reviews to moderate</p>';
            }
        } catch (error) {
            console.error('Error loading moderation:', error);
            moderationList.innerHTML = '<p class="muted">Error loading reviews</p>';
        }
    },
    
    // Respond to a review
    respondToReview: function(reviewId, appId) {
        const response = prompt('Enter your developer response:');
        if (!response) return;
        
        FirestoreComments.saveReview(appId, 5, response, 'Developer', true)
            .then(() => {
                showNotification('Response submitted!');
                this.loadModeration();
            })
            .catch(error => {
                console.error('Error responding:', error);
                alert('Failed to submit response');
            });
    },
    
    // Delete review by ID
    deleteReviewById: async function(reviewId) {
        if (!confirm('Are you sure you want to delete this review?')) return;
        
        const success = await FirestoreComments.deleteReview(reviewId);
        if (success) {
            showNotification('Review deleted');
            this.loadModeration();
        } else {
            alert('Failed to delete review');
        }
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
                statusText.textContent = 'Dashboard';
            }
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
// APP DATA - Including new recommended apps
// ============================================================
const appData = {
    hack: {
        name: "Hack Stuff",
        developer: "Sawfish Developer Group",
        icon: "icons/hack.png",
        category: "Utilities / Experimental",
        description: "Hack Stuff is a collection of advanced utilities and experimental tools designed specifically for students and developers who need access to low-level functionality within their browser environment.",
        features: "The Hack Stuff suite includes HTML and CSS inspectors, JavaScript consoles, network request monitors, and various debugging utilities.",
        additional: "Please note that access to certain advanced features may be restricted based on school network policies.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Stuff+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Development+Tools"]
    },
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish Developer Group",
        icon: "icons/game-portal.png",
        category: "Games Hub",
        description: "The Sawfish Game Portal serves as a unified launcher and collection point for all approved browser-based games available through the Sawfish ecosystem.",
        features: "The portal features a sophisticated categorization system that organizes games by genre, difficulty, and playtime.",
        additional: "All games available through the portal have been vetted for age-appropriate content.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal+Home", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Categories"]
    },
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish Developer Group",
        icon: "icons/circle.png",
        category: "Games / Skill",
        description: "Draw a Circle is a deceptively simple yet endlessly engaging reflex and precision challenge that tests your ability to create the most perfect circle possible.",
        features: "The game employs sophisticated geometric analysis algorithms that measure circularity from multiple angles.",
        additional: "The game is particularly popular as a quick break activity during study sessions.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Precision+Scoring"]
    },
    "2048": {
        name: "2048",
        developer: "Sawfish Developer Group",
        icon: "icons/2048.png",
        category: "Games / Puzzle",
        description: "2048 is the iconic sliding tile puzzle game that took the world by storm, now available optimized for school browsers and touch devices.",
        features: "This implementation features touch-optimized controls that make swiping on tablets and touchscreens feel natural and responsive.",
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
        features: "The Beta version introduces optimized rendering engines specifically tuned for web performance.",
        additional: "IMPORTANT: In this web version, single player mode does not include crafting functionality. You MUST use a multiplayer server.",
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
        additional: "Sandboxels is particularly valuable as an educational tool.",
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
        additional: "The Chat App is designed to work within school network restrictions.",
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
        additional: "The Call App is intended for quick, efficient communication.",
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
        additional: "For the full NovaOS experience, we recommend opening the OS directly in a new tab.",
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
        additional: "Syrup Games complements the main Sawfish Game Portal.",
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
        additional: "The Bob The Robber series has multiple installments.",
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
        additional: "Retro Bowl has been optimized for browser play.",
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
        additional: "Paper Io 2 is designed for quick, exciting matches.",
        link: "https://the-sawfish.github.io/seraph/games/paperio2/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Paper+Io+2+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territory+Capture"]
    },
    // NEW RECOMMENDED APPS (3-4 from GitHub/sources)
    photopea: {
        name: "Photopea",
        developer: "Ivan Kuckir",
        icon: "icons/photopea.png",
        category: "Productivity / Graphics",
        description: "Photopea is a powerful online image editor that works directly in your browser. It supports PSD, AI, and Sketch files, making it a great free alternative to Photoshop.",
        features: "Layer support, filters, brushes, text tools, and more. Works offline once loaded.",
        additional: "All processing happens in your browser - no uploads required.",
        link: "https://www.photopea.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Photopea+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Image+Editing"]
    },
    monkeytype: {
        name: "Monkeytype",
        developer: "Miodec",
        icon: "icons/monkeytype.png",
        category: "Educational / Typing",
        description: "Monkeytype is a minimalist, customizable typing test that helps you improve your typing speed and accuracy.",
        features: "Customizable themes, difficulty levels, and feedback. Shows WPM, accuracy, and other statistics.",
        additional: "Open source and ad-free. Great for practice during study breaks.",
        link: "https://monkeytype.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Monkeytype+Typing", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Typing+Stats"]
    },
    lichess: {
        name: "Lichess",
        developer: "Lichess Team",
        icon: "icons/lichess.png",
        category: "Games / Strategy",
        description: "Lichess is a free, open-source chess platform with no ads and no tracking. Play against AI or real opponents worldwide.",
        features: "Multiple game modes, puzzles, tournaments, and learning resources. Beautiful analysis boards.",
        additional: "One of the least blocked chess sites on school networks due to its educational nature.",
        link: "https://lichess.org/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Lichess+Chess", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chess+Analysis"]
    },
    hextris: {
        name: "Hextris",
        developer: "Hextris",
        icon: "icons/hextris.png",
        category: "Games / Puzzle",
        description: "Hextris is a fast-paced puzzle game inspired by Tetris, played on a hexagonal grid. Rotate the hexagon to stack blocks and prevent the game from ending.",
        features: "Addictive gameplay, colorful visuals, and increasing difficulty. High score tracking.",
        additional: "Often hosted on GitHub Pages, making it less likely to be blocked by school filters.",
        link: "https://hextris.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hextris+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hexagonal+Puzzle"]
    }
};

// ============================================================
// DOM ELEMENTS
// ============================================================
const elements = {
    installScreen: null,
    appScreen: null,
    tabButtons: null,
    navItems: null,
    sidebar: null,
    pages: null,
    expandedOverlay: null,
    expandedContentWrapper: null,
    expandedCloseBtn: null,
    welcomeModal: null,
    welcomeScrollContent: null,
    welcomeReturningContent: null,
    welcomeAck: null,
    welcomeAckRow: null,
    welcomeContinue: null,
    pwaBanner: null,
    updateStatus: null,
    updateAction: null,
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
    setupServiceWorkerListeners();
    
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
    const featuredCards = document.querySelectorAll('.featured-card');
    
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
function openExpandedApp(appId) {
    const app = appData[appId];
    if (!app) {
        console.error('App not found:', appId);
        return;
    }
    
    AppState.expandedApp = appId;
    
    const content = buildExpandedContent(app, appId, 0, 0, {5:0,4:0,3:0,2:0,1:0});
    elements.expandedContentWrapper.innerHTML = content;
    
    elements.expandedOverlay.classList.remove('hidden');
    elements.expandedOverlay.setAttribute('aria-hidden', 'false');
    
    document.body.style.overflow = 'hidden';
    
    loadAppRatings(appId);
    
    setupRatingForm(appId);
    
    subscribeToAppReviews(appId);
}

async function loadAppRatings(appId) {
    try {
        const [avgRating, distribution, totalReviews] = await Promise.all([
            FirestoreComments.getAverageRating(appId),
            FirestoreComments.getRatingDistribution(appId),
            FirestoreComments.getTotalReviews(appId)
        ]);
        
        updateRatingDisplay(appId, avgRating, distribution, totalReviews);
        
        loadReviews(appId);
        
        // Update main card grid
        const displayElement = document.querySelector(`[data-avg-rating="${appId}"]`);
        const starsElement = document.querySelector(`[data-app-rating="${appId}"]`);
        
        if (displayElement) {
            if (avgRating === null || avgRating === undefined) {
                displayElement.textContent = 'N/A';
            } else {
                displayElement.textContent = avgRating.toFixed(1);
            }
        }
        
        if (starsElement) {
            if (avgRating === null || avgRating === undefined) {
                starsElement.innerHTML = '<span class="no-rating">N/A</span>';
            } else {
                starsElement.innerHTML = getStarDisplay(avgRating);
            }
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
    }
}

function updateRatingDisplay(appId, avgRating, distribution, totalReviews) {
    const bigRating = document.querySelector(`#expanded-overlay .rating-big`);
    const ratingCount = document.querySelector(`#expanded-overlay .rating-count`);
    const ratingStars = document.querySelector(`#expanded-overlay .rating-stars`);
    
    if (bigRating) {
        if (avgRating === null || avgRating === undefined) {
            bigRating.textContent = 'N/A';
            bigRating.classList.add('na-rating');
        } else {
            bigRating.textContent = avgRating.toFixed(1);
            bigRating.classList.remove('na-rating');
        }
    }
    
    if (ratingCount) {
        ratingCount.textContent = `${totalReviews} reviews`;
    }
    
    if (ratingStars) {
        if (avgRating === null || avgRating === undefined) {
            ratingStars.innerHTML = '<span class="no-rating">No ratings yet</span>';
        } else {
            ratingStars.innerHTML = getStarDisplay(avgRating);
        }
    }
    
    const ratingBarsContainer = document.querySelector(`#expanded-overlay .rating-bars`);
    if (ratingBarsContainer) {
        ratingBarsContainer.innerHTML = buildRatingBars(distribution, totalReviews);
    }
}

function buildExpandedContent(app, appId, avgRating, totalReviews, distribution) {
    const ratingStars = avgRating !== null && avgRating !== undefined ? getStarDisplay(avgRating) : '<span class="no-rating">No ratings yet</span>';
    
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
                    <div class="rating-big">${avgRating !== null && avgRating !== undefined ? avgRating.toFixed(1) : 'N/A'}</div>
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
    if (rating === null || rating === undefined) {
        return '<span class="no-rating">N/A</span>';
    }
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
        stars += '<span class="star full">★</span>';
    }
    
    // Add half star if needed
    if (hasHalfStar) {
        stars += '<span class="star half">★</span>';
    }
    
    // Add empty stars
    for (let i = 0; i < emptyStars; i++) {
        stars += '<span class="star empty">★</span>';
    }
    
    return stars;
}

function buildRatingBars(distribution, total) {
    if (total === 0) {
        return '<p class="muted">No ratings yet. Be the first to rate!</p>';
    }
    
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
    if (AppState.expandedApp && AppState.reviewSubscriptions[AppState.expandedApp]) {
        AppState.reviewSubscriptions[AppState.expandedApp]();
        delete AppState.reviewSubscriptions[AppState.expandedApp];
    }
    
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
    const isDeveloper = DeveloperMode.isLoggedIn;
    const userName = isDeveloper ? 'Developer' : 'Anonymous';
    
    const review = await FirestoreComments.saveReview(appId, rating, comment, userName, isDeveloper);
    
    if (review) {
        showNotification(isDeveloper ? 'Developer response submitted!' : 'Review submitted successfully!');
        
        await loadAppRatings(appId);
        
        const textarea = document.getElementById(`comment-input-${appId}`);
        if (textarea) textarea.value = '';
        clearStars(document.getElementById(`comment-form-${appId}`));
    } else {
        alert('Failed to submit review. Please try again.');
    }
}

function subscribeToAppReviews(appId) {
    if (AppState.reviewSubscriptions[appId]) {
        AppState.reviewSubscriptions[appId]();
    }
    
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
            const starsElement = document.querySelector(`[data-app-rating="${appId}"]`);
            
            if (displayElement) {
                if (avgRating === null || avgRating === undefined) {
                    displayElement.textContent = 'N/A';
                } else {
                    displayElement.textContent = avgRating.toFixed(1);
                }
            }
            
            if (starsElement) {
                if (avgRating === null || avgRating === undefined) {
                    starsElement.innerHTML = '<span class="no-rating">N/A</span>';
                } else {
                    starsElement.innerHTML = getStarDisplay(avgRating);
                }
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
window.DeveloperMode = DeveloperMode;

// ============================================================
// END OF JAVASCRIPT
// ============================================================
console.log('Sawfish App Store JavaScript loaded successfully');
