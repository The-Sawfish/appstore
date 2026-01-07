// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews, Firestore
// Enhanced with Firebase Authentication, Profile Pictures, Search
// Author: Eric Zhu / Sawfish Developer Group
// Date: January 8, 2026
// ============================================================

// ============================================================
// VERSION CONFIGURATION
// ============================================================
const APP_VERSION = '1.2.0';
const VERSION_CHECK_URL = '/update/version.json';

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
let auth;
let storage;
let app;

try {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        console.log('Firebase initialized successfully');
    } else {
        console.warn('Firebase SDK not loaded - limited functionality available');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

// ============================================================
// USER AUTHENTICATION SYSTEM
// ============================================================
const UserAuth = {
    currentUser: null,
    userProfile: null,
    isDeveloperMode: false,
    DEVELOPER_USERNAME: 'Developer',
    DEVELOPER_PASSWORD: '120622',
    
    // Initialize authentication
    init: function() {
        this.loadUserSession();
        this.setupAuthListeners();
        this.updateAuthUI();
    },
    
    // Load user session from storage
    loadUserSession: function() {
        try {
            const storedUser = localStorage.getItem('sawfish_user');
            const storedProfile = localStorage.getItem('sawfish_profile');
            
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
            }
            
            if (storedProfile) {
                this.userProfile = JSON.parse(storedProfile);
            }
            
            // Check developer mode
            const devSession = sessionStorage.getItem('developer_logged_in');
            this.isDeveloperMode = devSession === 'true';
        } catch (error) {
            console.error('Error loading session:', error);
        }
    },
    
    // Save user session
    saveUserSession: function() {
        try {
            if (this.currentUser) {
                localStorage.setItem('sawfish_user', JSON.stringify(this.currentUser));
            }
            if (this.userProfile) {
                localStorage.setItem('sawfish_profile', JSON.stringify(this.userProfile));
            }
        } catch (error) {
            console.error('Error saving session:', error);
        }
    },
    
    // Clear user session
    clearSession: function() {
        this.currentUser = null;
        this.userProfile = null;
        this.isDeveloperMode = false;
        localStorage.removeItem('sawfish_user');
        localStorage.removeItem('sawfish_profile');
        sessionStorage.removeItem('developer_logged_in');
    },
    
    // Setup authentication event listeners
    setupAuthListeners: function() {
        // Login form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Signup form submission
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }
        
        // Password reset form
        const resetForm = document.getElementById('reset-form');
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handlePasswordReset(e));
        }
        
        // Auth modal tabs
        this.setupAuthTabs();
        
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Profile picture upload
        const profileUpload = document.getElementById('profile-picture-upload');
        if (profileUpload) {
            profileUpload.addEventListener('change', (e) => this.handleProfilePictureUpload(e));
        }
    },
    
    // Setup auth modal tabs
    setupAuthTabs: function() {
        const tabBtns = document.querySelectorAll('.auth-tab-btn');
        const tabContents = document.querySelectorAll('.auth-tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.authTab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                const targetContent = document.getElementById(`${tab}-content`);
                if (targetContent) targetContent.classList.add('active');
            });
        });
    },
    
    // Handle login
    handleLogin: async function(event) {
        event.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const errorDiv = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');
        
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        
        if (!email || !password) {
            this.showError(errorDiv, 'Please enter both email and password');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        
        try {
            // Check for developer backdoor first
            if (email === this.DEVELOPER_USERNAME && password === this.DEVELOPER_PASSWORD) {
                this.isDeveloperMode = true;
                sessionStorage.setItem('developer_logged_in', 'true');
                this.currentUser = {
                    uid: 'developer',
                    email: null,
                    displayName: this.DEVELOPER_USERNAME,
                    isDeveloper: true
                };
                this.userProfile = {
                    username: this.DEVELOPER_USERNAME,
                    avatarUrl: null
                };
                this.saveUserSession();
                this.closeAuthModal();
                this.updateAuthUI();
                showNotification('Developer mode activated');
                return;
            }
            
            // Firebase authentication
            if (auth) {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Get or create user profile
                await this.getOrCreateUserProfile(user);
                
                this.saveUserSession();
                this.closeAuthModal();
                this.updateAuthUI();
                showNotification('Welcome back!');
            } else {
                this.showError(errorDiv, 'Authentication service unavailable');
            }
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed. Please try again.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later';
                    break;
            }
            
            this.showError(errorDiv, errorMessage);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    },
    
    // Handle signup
    handleSignup: async function(event) {
        event.preventDefault();
        
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const confirmInput = document.getElementById('signup-confirm');
        const errorDiv = document.getElementById('signup-error');
        const submitBtn = document.getElementById('signup-submit');
        
        const name = nameInput?.value.trim();
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        const confirm = confirmInput?.value;
        
        if (!name || !email || !password || !confirm) {
            this.showError(errorDiv, 'Please fill in all fields');
            return;
        }
        
        if (password.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters');
            return;
        }
        
        if (password !== confirm) {
            this.showError(errorDiv, 'Passwords do not match');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
        
        try {
            if (auth) {
                // Create user
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Update profile with name
                await user.updateProfile({ displayName: name });
                
                // Send email verification
                await user.sendEmailVerification();
                
                // Create user profile in Firestore
                this.userProfile = {
                    username: name,
                    email: email,
                    avatarUrl: null,
                    createdAt: new Date().toISOString(),
                    bio: '',
                    totalRatings: 0
                };
                
                await this.saveUserProfile(user.uid);
                
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: name,
                    emailVerified: user.emailVerified,
                    isDeveloper: false
                };
                
                this.saveUserSession();
                this.closeAuthModal();
                this.updateAuthUI();
                showNotification('Account created! Please check your email for verification.');
            } else {
                this.showError(errorDiv, 'Authentication service unavailable');
            }
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = 'Signup failed. Please try again.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'An account with this email already exists';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak';
                    break;
            }
            
            this.showError(errorDiv, errorMessage);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    },
    
    // Handle password reset
    handlePasswordReset: async function(event) {
        event.preventDefault();
        
        const emailInput = document.getElementById('reset-email');
        const errorDiv = document.getElementById('reset-error');
        const successDiv = document.getElementById('reset-success');
        const submitBtn = document.getElementById('reset-submit');
        
        const email = emailInput?.value.trim();
        
        if (!email) {
            this.showError(errorDiv, 'Please enter your email address');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        try {
            if (auth) {
                await auth.sendPasswordResetEmail(email);
                successDiv.textContent = `Password reset email sent to ${email}`;
                successDiv.classList.remove('hidden');
                errorDiv.classList.add('hidden');
                showNotification('Password reset email sent!');
            } else {
                this.showError(errorDiv, 'Authentication service unavailable');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            let errorMessage = 'Failed to send reset email';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email';
            }
            
            this.showError(errorDiv, errorMessage);
            successDiv.classList.add('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    },
    
    // Handle logout
    handleLogout: async function() {
        try {
            if (auth && this.currentUser && !this.isDeveloperMode) {
                await auth.signOut();
            }
            
            this.clearSession();
            this.updateAuthUI();
            showNotification('Logged out successfully');
            
            // Switch to home tab
            switchTab('home');
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Logout failed');
        }
    },
    
    // Get or create user profile from Firestore
    getOrCreateUserProfile: async function(user) {
        if (!db) return;
        
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            
            if (doc.exists) {
                this.userProfile = doc.data();
            } else {
                // Create new profile
                this.userProfile = {
                    username: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    avatarUrl: null,
                    createdAt: new Date().toISOString(),
                    bio: '',
                    totalRatings: 0
                };
                await this.saveUserProfile(user.uid);
            }
        } catch (error) {
            console.error('Error getting user profile:', error);
        }
    },
    
    // Save user profile to Firestore
    saveUserProfile: async function(uid) {
        if (!db || !this.userProfile) return;
        
        try {
            await db.collection('users').doc(uid).set(this.userProfile, { merge: true });
        } catch (error) {
            console.error('Error saving user profile:', error);
        }
    },
    
    // Handle profile picture upload
    handleProfilePictureUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const preview = document.getElementById('profile-picture-preview');
        const status = document.getElementById('profile-upload-status');
        
        if (!this.currentUser) {
            showNotification('Please log in to upload a profile picture');
            return;
        }
        
        try {
            status.textContent = 'Uploading...';
            status.classList.remove('hidden');
            
            // Upload to Firebase Storage
            if (storage && !this.isDeveloperMode) {
                const storageRef = storage.ref(`profiles/${this.currentUser.uid}/avatar`);
                await storageRef.put(file);
                const downloadUrl = await storageRef.getDownloadURL();
                
                // Update profile
                this.userProfile.avatarUrl = downloadUrl;
                await this.saveUserProfile(this.currentUser.uid);
                
                // Update Firebase user
                if (auth.currentUser) {
                    await auth.currentUser.updateProfile({ photoURL: downloadUrl });
                }
            } else {
                // For developer mode, use base64
                const reader = new FileReader();
                reader.onload = async (e) => {
                    this.userProfile.avatarUrl = e.target.result;
                    this.saveUserSession();
                };
                reader.readAsDataURL(file);
            }
            
            // Update preview
            if (preview) {
                preview.src = this.userProfile.avatarUrl || this.getDefaultAvatar();
            }
            
            status.textContent = 'Profile picture updated!';
            showNotification('Profile picture updated!');
        } catch (error) {
            console.error('Upload error:', error);
            status.textContent = 'Upload failed. Please try again.';
        }
    },
    
    // Get default avatar URL
    getDefaultAvatar: function() {
        const username = this.userProfile?.username || 'User';
        const initial = username.charAt(0).toUpperCase();
        return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#4da3ff"/><text x="50" y="50" text-anchor="middle" dy="0.35em" fill="white" font-size="50" font-family="sans-serif">${initial}</text></svg>`)}`;
    },
    
    // Show error message
    showError: function(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, 5000);
        }
    },
    
    // Open auth modal
    openAuthModal: function() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    },
    
    // Close auth modal
    closeAuthModal: function() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            
            // Reset forms
            const forms = modal.querySelectorAll('form');
            forms.forEach(f => f.reset());
            
            document.getElementById('login-error')?.classList.add('hidden');
            document.getElementById('signup-error')?.classList.add('hidden');
            document.getElementById('reset-success')?.classList.add('hidden');
        }
    },
    
    // Update auth UI based on login state
    updateAuthUI: function() {
        const loggedOutUI = document.getElementById('auth-logged-out');
        const loggedInUI = document.getElementById('auth-logged-in');
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profilePicture = document.getElementById('profile-picture-img');
        const profilePicturePreview = document.getElementById('profile-picture-preview');
        
        if (this.currentUser) {
            // Logged in state
            if (loggedOutUI) loggedOutUI.classList.add('hidden');
            if (loggedInUI) loggedInUI.classList.remove('hidden');
            
            const name = this.userProfile?.username || this.currentUser.displayName || 'User';
            const email = this.userProfile?.email || this.currentUser.email || '';
            
            if (profileName) profileName.textContent = name;
            if (profileEmail) profileEmail.textContent = email;
            
            const avatarUrl = this.userProfile?.avatarUrl || this.getDefaultAvatar();
            if (profilePicture) profilePicture.src = avatarUrl;
            if (profilePicturePreview) profilePicturePreview.src = avatarUrl;
            
            // Update login button in nav
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) {
                loginBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>${name}</span>
                `;
                loginBtn.onclick = () => switchTab('profile');
            }
        } else {
            // Logged out state
            if (loggedOutUI) loggedOutUI.classList.remove('hidden');
            if (loggedInUI) loggedInUI.classList.add('hidden');
            
            // Reset login button
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) {
                loginBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Login</span>
                `;
                loginBtn.onclick = () => this.openAuthModal();
            }
        }
    },
    
    // Check if user is logged in
    isLoggedIn: function() {
        return this.currentUser !== null;
    },
    
    // Check if user can rate (must be logged in)
    canRate: function() {
        return this.isLoggedIn() || this.isDeveloperMode;
    },
    
    // Get username for reviews
    getReviewUsername: function() {
        if (this.isDeveloperMode) return 'Developer';
        return this.userProfile?.username || this.currentUser?.displayName || 'Anonymous';
    },
    
    // Get user avatar for reviews
    getReviewAvatar: function() {
        if (this.isDeveloperMode) return null;
        return this.userProfile?.avatarUrl;
    }
};

// ============================================================
// MINECRAFT RE-GUEST WARNING SYSTEM
// ============================================================
const MinecraftReGuest = {
    MINECRAFT_APP_ID: 'minecraft',
    
    // Check if app requires re-guest
    requiresReGuest: function(appId) {
        return appId === this.MINECRAFT_APP_ID;
    },
    
    // Show re-guest warning modal
    showWarning: function(appId, appName, appLink) {
        const overlay = document.getElementById('minecraft-warning-overlay');
        if (!overlay) return;
        
        const title = document.getElementById('minecraft-warning-title');
        const message = document.getElementById('minecraft-warning-message');
        const launchBtn = document.getElementById('minecraft-launch-btn');
        const cancelBtn = document.getElementById('minecraft-cancel-btn');
        
        if (title) title.textContent = `${appName} - Multiplayer Notice`;
        if (message) {
            message.innerHTML = `
                <p><strong>Multiplayer requires re-guesting to work properly.</strong></p>
                <p>To play multiplayer in ${appName}, you need to refresh/re-guest the game page. This is necessary because:</p>
                <ul>
                    <li>Multiplayer sessions require fresh network connections</li>
                    <li>Cached data can interfere with server communication</li>
                    <li>Server authentication needs to be re-established</li>
                </ul>
                <p>Click "Launch Game" to open the game, then refresh the page when you want to play multiplayer.</p>
            `;
        }
        
        if (launchBtn) {
            launchBtn.onclick = () => {
                window.open(appLink, '_blank');
                this.closeWarning();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeWarning();
        }
        
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
    },
    
    // Close the warning modal
    closeWarning: function() {
        const overlay = document.getElementById('minecraft-warning-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }
};

// ============================================================
// OFFLINE TAG SYSTEM
// ============================================================
const OfflineTagSystem = {
    OFFLINE_APPS: ['circle', 'blockblast'],
    HACK_SITE_PASSWORD: '0128',
    
    // Check if app has offline tag
    isOfflineApp: function(appId) {
        return this.OFFLINE_APPS.includes(appId);
    },
    
    // Show hack site password toast
    showHackPassword: function(appId, appName) {
        showNotification(`${appName}: Hack site password is ${this.HACK_SITE_PASSWORD}`);
    }
};

// ============================================================
// COMMUNITY BOARD / FORUM SYSTEM
// ============================================================
const CommunityBoard = {
    COLLECTION_NAME: 'sawfish_community_posts',
    unsubscribe: null,
    
    // Initialize community board
    init: function() {
        this.setupPostForm();
        this.loadPosts();
    },
    
    // Setup post form submission
    setupPostForm: function() {
        const form = document.getElementById('community-post-form');
        if (!form) return;
        
        const submitBtn = form.querySelector('#community-submit-btn');
        const textarea = form.querySelector('#community-post-input');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const content = textarea?.value.trim();
            if (!content) {
                showNotification('Please enter a message');
                return;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
            }
            
            try {
                await this.createPost(content);
                if (textarea) textarea.value = '';
                showNotification('Message posted!');
            } catch (error) {
                console.error('Error posting:', error);
                showNotification('Failed to post message');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Post';
                }
            }
        });
    },
    
    // Create a new post
    createPost: async function(content) {
        if (!db) {
            // Local storage fallback
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            const newPost = {
                id: Date.now().toString(),
                content: content,
                author: UserAuth.isLoggedIn() ? UserAuth.getReviewUsername() : 'Anonymous',
                isAdmin: DeveloperMode.isLoggedIn,
                timestamp: new Date().toISOString(),
                type: DeveloperMode.isLoggedIn ? 'admin_alert' : 'chat'
            };
            posts.unshift(newPost);
            localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
            this.renderPosts(posts);
            return;
        }
        
        try {
            const post = {
                content: content,
                author: UserAuth.isLoggedIn() ? UserAuth.getReviewUsername() : 'Anonymous',
                isAdmin: DeveloperMode.isLoggedIn,
                timestamp: new Date().toISOString(),
                type: DeveloperMode.isLoggedIn ? 'admin_alert' : 'chat'
            };
            
            await db.collection(this.COLLECTION_NAME).add(post);
        } catch (error) {
            console.error('Error creating post in Firestore:', error);
            // Fallback to local storage
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            const newPost = {
                id: Date.now().toString(),
                content: content,
                author: UserAuth.isLoggedIn() ? UserAuth.getReviewUsername() : 'Anonymous',
                isAdmin: DeveloperMode.isLoggedIn,
                timestamp: new Date().toISOString(),
                type: DeveloperMode.isLoggedIn ? 'admin_alert' : 'chat'
            };
            posts.unshift(newPost);
            localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
            this.renderPosts(posts);
        }
    },
    
    // Load all posts
    loadPosts: function() {
        if (!db) {
            // Use local storage
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            this.renderPosts(posts);
            return;
        }
        
        try {
            // Real-time listener
            this.unsubscribe = db.collection(this.COLLECTION_NAME)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .onSnapshot(
                    (snapshot) => {
                        const posts = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        this.renderPosts(posts);
                    },
                    (error) => {
                        console.error('Error loading posts:', error);
                        // Fallback to local storage
                        const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
                        this.renderPosts(posts);
                    }
                );
        } catch (error) {
            console.error('Error setting up posts listener:', error);
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            this.renderPosts(posts);
        }
    },
    
    // Render posts to the community feed
    renderPosts: function(posts) {
        const container = document.getElementById('community-feed');
        if (!container) return;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="community-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h3>No messages yet</h3>
                    <p>Be the first to post a message!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = posts.map(post => {
            const isAdmin = post.isAdmin === true;
            const isAnonymous = !UserAuth.isLoggedIn() && post.author === 'Anonymous';
            const postClass = isAdmin ? 'community-post admin' : 'community-post';
            const avatar = isAdmin ? 'A' : (post.author === 'Anonymous' ? '?' : post.author.charAt(0).toUpperCase());
            
            return `
                <article class="${postClass}">
                    <div class="community-post-header">
                        <div class="community-post-author">
                            <div class="community-post-avatar ${isAdmin ? 'admin' : ''}">${escapeHtml(avatar)}</div>
                            <div class="community-post-info">
                                <span class="community-post-name">
                                    ${escapeHtml(post.author)}
                                    ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                                    ${isAnonymous ? '<span class="anonymous-badge">Anonymous</span>' : ''}
                                </span>
                                <span class="community-post-date">${formatDate(post.timestamp)}</span>
                            </div>
                        </div>
                        ${isAdmin ? '<span class="post-type-badge">Announcement</span>' : ''}
                    </div>
                    <div class="community-post-content">${escapeHtml(post.content)}</div>
                </article>
            `;
        }).join('');
    },
    
    // Cleanup on unload
    cleanup: function() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
};

// ============================================================
// SEARCH FUNCTIONALITY
// ============================================================
const SearchSystem = {
    searchIndex: [],
    
    init: function() {
        this.buildSearchIndex();
        this.setupSearchListeners();
    },
    
    // Build search index from app data
    buildSearchIndex: function() {
        this.searchIndex = Object.entries(appData).map(([id, app]) => ({
            id,
            name: app.name.toLowerCase(),
            developer: app.developer.toLowerCase(),
            description: app.description.toLowerCase(),
            category: app.category.toLowerCase(),
            tags: `${app.name} ${app.developer} ${app.category}`.toLowerCase()
        }));
    },
    
    // Setup search event listeners
    setupSearchListeners: function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value, searchResults);
            });
            
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length > 0) {
                    this.performSearch(searchInput.value, searchResults);
                }
            });
        }
        
        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container') && searchResults) {
                searchResults.classList.add('hidden');
            }
        });
    },
    
    // Perform search
    performSearch: function(query, resultsContainer) {
        if (!resultsContainer) return;
        
        if (query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        const results = this.searchIndex.filter(item => {
            return item.name.includes(query.toLowerCase()) ||
                   item.developer.includes(query.toLowerCase()) ||
                   item.tags.includes(query.toLowerCase());
        }).slice(0, 10);
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-no-results">No apps found</div>';
        } else {
            resultsContainer.innerHTML = results.map(result => {
                const app = appData[result.id];
                return `
                    <div class="search-result-item" data-app="${result.id}">
                        <img src="${app.icon}" alt="${app.name}" class="search-result-icon">
                        <div class="search-result-info">
                            <span class="search-result-name">${app.name}</span>
                            <span class="search-result-category">${app.category}</span>
                        </div>
                        <span class="search-result-rating" data-avg-rating="${result.id}">—</span>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const appId = item.dataset.app;
                    if (appId) {
                        openExpandedApp(appId);
                        resultsContainer.classList.add('hidden');
                        document.getElementById('search-input').value = '';
                    }
                });
            });
            
            // Load ratings for results
            this.loadResultRatings();
        }
        
        resultsContainer.classList.remove('hidden');
    },
    
    // Load ratings for search results
    loadResultRatings: async function() {
        const ratingElements = document.querySelectorAll('.search-result-rating');
        
        for (const element of ratingElements) {
            const appId = element.dataset.avgRating;
            try {
                const avgRating = await FirestoreComments.getAverageRating(appId);
                if (avgRating !== null && avgRating !== undefined) {
                    element.textContent = avgRating.toFixed(1);
                } else {
                    element.textContent = '—';
                }
            } catch (error) {
                element.textContent = '—';
            }
        }
    }
};

// ============================================================
// FIRESTORE RATINGS MODULE
// ============================================================
const FirestoreComments = {
    // Save a review to Firestore
    saveReview: async function(appId, rating, comment, userName, isDeveloper = false, userAvatar = null) {
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
                userAvatar: userAvatar,
                isDeveloper: isDeveloper,
                timestamp: new Date().toISOString()
            };
            
            await db.collection('reviews').add(review);
            
            // Update user's total ratings
            if (UserAuth.currentUser && !isDeveloper) {
                const userRef = db.collection('users').doc(UserAuth.currentUser.uid);
                await userRef.update({
                    totalRatings: firebase.firestore.FieldValue.increment(1)
                });
            }
            
            console.log('Review saved to Firestore:', review);
            return review;
        } catch (error) {
            console.error('Error saving to Firestore:', error);
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
                return null;
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
// NUMERIC RATING DISPLAY SYSTEM
// ============================================================
function getNumericRatingDisplay(rating) {
    if (rating === null || rating === undefined || isNaN(rating)) {
        return '<span class="rating-na">—</span>';
    }
    
    const formattedRating = rating.toFixed(1);
    
    // Color based on rating
    let colorClass = 'rating-poor';
    if (rating >= 4.5) colorClass = 'rating-excellent';
    else if (rating >= 3.5) colorClass = 'rating-good';
    else if (rating >= 2.5) colorClass = 'rating-average';
    
    return `<span class="numeric-rating ${colorClass}">${formattedRating}</span>`;
}

// ============================================================
// DEVELOPER MODE MODULE
// ============================================================
const DeveloperMode = {
    isLoggedIn: false,
    DEVELOPER_PASSWORD: '120622',
    
    init: function() {
        if (sessionStorage.getItem('developer_logged_in') === 'true') {
            this.isLoggedIn = true;
        }
        this.updateLoginButton();
    },
    
    toggleLogin: function() {
        if (this.isLoggedIn) {
            this.openDashboard();
        } else {
            UserAuth.openAuthModal();
        }
    },
    
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
    
    closeDashboard: function() {
        const dashboard = document.getElementById('developer-dashboard');
        if (dashboard) {
            dashboard.classList.add('hidden');
            dashboard.setAttribute('aria-hidden', 'true');
        }
    },
    
    updateLoginButton: function() {
        const btn = document.getElementById('developer-login-button');
        if (!btn) return;
        
        const statusText = btn.querySelector('.developer-status-text');
        const icon = btn.querySelector('svg');
        
        if (this.isLoggedIn) {
            btn.classList.add('logged-in');
            if (statusText) statusText.textContent = 'Dashboard';
            if (icon) {
                icon.innerHTML = `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`;
            }
        } else {
            btn.classList.remove('logged-in');
            if (statusText) statusText.textContent = 'Developer';
            if (icon) {
                icon.innerHTML = `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`;
            }
        }
    },
    
    logout: function() {
        this.isLoggedIn = false;
        sessionStorage.removeItem('developer_logged_in');
        this.closeDashboard();
        this.updateLoginButton();
        showNotification('Developer mode deactivated');
    },
    
    loadAnalytics: async function() {
        try {
            const [allReviews, totalApps] = await Promise.all([
                FirestoreComments.getAllReviews(),
                Promise.resolve(Object.keys(appData).length)
            ]);
            
            const totalReviews = allReviews.length;
            const developerResponses = allReviews.filter(r => r.isDeveloper).length;
            
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
            
            document.getElementById('stat-total-reviews').textContent = totalReviews;
            document.getElementById('stat-total-apps').textContent = totalApps;
            document.getElementById('stat-avg-rating').textContent = avgRating;
            document.getElementById('stat-developer-responses').textContent = developerResponses;
            
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
                                <span class="top-rated-rating">${getNumericRatingDisplay(app.avg)}</span>
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
    
    showAddAppForm: function() {
        const newAppId = prompt('Enter new app ID (lowercase, no spaces):');
        if (!newAppId) return;
        
        const appName = prompt('Enter app name:');
        if (!appName) return;
        
        const appDeveloper = prompt('Enter developer name:');
        const appCategory = prompt('Enter category:') || 'Games';
        const appLink = prompt('Enter app URL:');
        if (!appLink) return;
        
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
    
    deleteApp: function(appId) {
        const app = appData[appId];
        if (!app) return;
        
        if (confirm(`Are you sure you want to delete "${app.name}"?`)) {
            delete appData[appId];
            showNotification(`App "${app.name}" deleted`);
            this.loadAppManager();
        }
    },
    
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
        
        titleInput.value = '';
        textInput.value = '';
        
        showNotification('Announcement published!');
        this.loadAnnouncements();
    },
    
    deleteAnnouncement: function(index) {
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        announcements.splice(index, 1);
        localStorage.setItem('sawfish_announcements', JSON.stringify(announcements));
        this.loadAnnouncements();
        showNotification('Announcement deleted');
    },
    
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
                                <span class="moderation-rating">${review.rating}/5</span>
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
    
    deleteReviewById: async function(reviewId) {
        if (!confirm('Are you sure you want to delete this review?')) return;
        
        const success = await FirestoreComments.deleteReview(reviewId);
        if (success) {
            showNotification('Review deleted');
            this.loadModeration();
        } else {
            alert('Failed to delete review');
        }
    }
};

// ============================================================
// UPDATE CHECKER
// ============================================================
const UpdateChecker = {
    init: async function() {
        await this.checkForUpdates();
    },
    
    checkForUpdates: async function() {
        try {
            const response = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`);
            if (response.ok) {
                const versionData = await response.json();
                this.compareVersion(versionData);
            }
        } catch (error) {
            console.log('Update check failed:', error);
        }
    },
    
    compareVersion: function(remoteData) {
        const localVersion = APP_VERSION;
        const remoteVersion = remoteData.version;
        
        const updateBanner = document.getElementById('update-available-banner');
        const updateVersion = document.getElementById('update-version');
        const updateDescription = document.getElementById('update-description');
        
        if (this.isNewerVersion(remoteVersion, localVersion)) {
            if (updateBanner) {
                updateBanner.classList.remove('hidden');
                if (updateVersion) updateVersion.textContent = `v${remoteVersion}`;
                if (updateDescription) updateDescription.textContent = remoteData.description || 'A new version is available with improvements and fixes.';
            }
        }
    },
    
    isNewerVersion: function(remote, local) {
        const remoteParts = remote.split('.').map(Number);
        const localParts = local.split('.').map(Number);
        
        for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
            const remoteNum = remoteParts[i] || 0;
            const localNum = localParts[i] || 0;
            
            if (remoteNum > localNum) return true;
            if (remoteNum < localNum) return false;
        }
        
        return false;
    },
    
    dismissUpdate: function() {
        const updateBanner = document.getElementById('update-available-banner');
        if (updateBanner) {
            updateBanner.classList.add('hidden');
            localStorage.setItem('sawfish_update_dismissed', APP_VERSION);
        }
    },
    
    installUpdate: function() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.addEventListener('swUpdated', () => {
                    location.reload(true);
                });
            });
        }
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
    reviewSubscriptions: {}
};

// ============================================================
// APP DATA - Complete with reorganized categories
// ============================================================
const appData = {
    // Featured Apps (Home Page)
    hack: {
        name: "Hack Stuff",
        developer: "Sawfish Developer Group",
        icon: "icons/hack.png",
        category: "Hacks",
        description: "Hack Stuff is a comprehensive collection of advanced utilities and experimental tools designed specifically for students and developers who need access to low-level functionality within their browser environment.",
        features: "The Hack Stuff suite includes HTML and CSS inspectors, JavaScript consoles, network request monitors, and various debugging utilities. It also features a collection of educational coding challenges, API testing tools, and data format converters.",
        additional: "Please note that access to certain advanced features may be restricted based on school network policies. All tools are designed to be safe and educational, with no malicious capabilities.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Stuff+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Development+Tools"]
    },
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish Developer Group",
        icon: "icons/game-portal.png",
        category: "Games Hub",
        description: "The Sawfish Game Portal serves as a unified launcher and collection point for all approved browser-based games available through the Sawfish ecosystem. It provides a centralized hub for discovering and accessing entertaining games.",
        features: "The portal features a sophisticated categorization system that organizes games by genre, difficulty, playtime, and number of players. It includes user ratings, playtime tracking, and personalized recommendations.",
        additional: "All games available through the portal have been vetted for age-appropriate content and are regularly updated to ensure compatibility and safety.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal+Home", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Categories"]
    },
    chat: {
        name: "Chat App",
        developer: "Jimeneutron",
        icon: "icons/chat.png",
        category: "Social / Messaging",
        description: "Chat App provides a clean, efficient platform for real-time messaging designed specifically for student communication needs. Connect with classmates instantly in topic-based rooms.",
        features: "The app features topic-based rooms where students can join discussions relevant to their classes, projects, or interests. Includes direct messaging, file sharing, and customizable chat backgrounds.",
        additional: "The Chat App is designed to work within school network restrictions. All conversations are moderated and recorded for safety purposes. Students are expected to use the app responsibly.",
        link: "https://jimeneutron.github.io/chatapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+Rooms"]
    },
    call: {
        name: "Call App",
        developer: "Sawfish Developer Group",
        icon: "icons/call.png",
        category: "Social / Communication",
        description: "Call App offers a fast, minimal browser-based voice calling interface that enables quick communication between students. Just share a room code and start talking.",
        features: "The calling system supports direct calls between users who share a room code. Call quality adapts to network conditions, and the interface is designed for quick, efficient communication.",
        additional: "The Call App is intended for quick, efficient communication. Please use responsibly and respect others. All calls are logged for safety and security purposes.",
        link: "https://the-sawfish.github.io/call-app/?from=sawfish",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+App+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Controls"]
    },
    
    // Games
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish Developer Group",
        icon: "icons/circle.png",
        category: "Games / Skill",
        description: "Draw a Circle is a deceptively simple yet endlessly engaging reflex and precision challenge that tests your ability to create the most perfect circle possible. This game has become a favorite quick-break activity for students worldwide.",
        features: "The game employs sophisticated geometric analysis algorithms that measure circularity from multiple angles, providing instant feedback on your drawing accuracy. Features include scoring history, achievement badges, and global leaderboards.",
        additional: "The game is particularly popular as a quick break activity during study sessions. Research has shown that such precision tasks can help improve focus and fine motor skills.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Precision+Scoring"]
    },
    "2048": {
        name: "2048",
        developer: "Sawfish Developer Group",
        icon: "icons/2048.png",
        category: "Games / Puzzle",
        description: "2048 is the iconic sliding tile puzzle game that took the world by storm, now available optimized for school browsers and touch devices. This addictive puzzle challenges your strategic thinking and number sense.",
        features: "This implementation features touch-optimized controls that make swiping on tablets and touchscreens feel natural and responsive. Includes undo functionality, multiple board sizes, and daily challenges.",
        additional: "The game has been optimized for school networks, with no external dependencies and minimal data usage. It's completely self-contained and loads instantly.",
        link: "https://the-sawfish.github.io/2048/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Game+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tile+Merging"]
    },
    minecraft: {
        name: "Minecraft Web (Beta)",
        developer: "Zardoy",
        icon: "icons/minecraft.png",
        category: "Games / Sandbox",
        description: "Experience the boundless creativity of the world's best-selling game directly in your browser with Minecraft Web (Beta). Build, mine, and explore in a blocky world without any downloads or installation required.",
        features: "The Beta version introduces optimized rendering engines specifically tuned for web performance. Features include multiplayer servers, various game modes, and a selection of texture packs to customize your experience.",
        additional: "IMPORTANT: In this web version, single player mode does not include crafting functionality. You MUST use a multiplayer server. We recommend joining the official first server for the best experience with other players.",
        link: "https://zardoy.github.io/minecraft-web-client/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Minecraft+Web+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Multiplayer+Servers"]
    },
    blockblast: {
        name: "Block Blast",
        developer: "AAPPQQ",
        icon: "icons/blockblast.png",
        category: "Games / Puzzle",
        description: "Block Blast is a fast-paced, addictive puzzle game that challenges your spatial reasoning and strategic planning skills. Clear blocks before they reach the top in this Tetris-style game.",
        features: "Block Blast features multiple game modes including classic endless play, timed challenges, daily puzzle modes, and competitive versus mode. Includes stunning visual effects and satisfying sound design.",
        additional: "The game has been optimized to run smoothly on school devices with minimal performance requirements. Features an offline mode that works without internet connection.",
        link: "https://aappqq.github.io/BlockBlast/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Combo+System"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "R74n",
        icon: "icons/sandboxels.png",
        category: "Games / Simulation",
        description: "Sandboxels is an extraordinary physics-based falling sand simulation that offers an almost endless sandbox for creativity and experimentation. Watch as different elements interact in realistic ways.",
        features: "The simulation includes elements in multiple categories: basic materials (sand, water, stone, metal), liquids, gases, fire, electrical components, plants, and creatures. Users can create complex machines and artistic patterns.",
        additional: "Sandboxels is particularly valuable as an educational tool, teaching concepts of chemistry, physics, and emergent behavior. It's also just incredibly satisfying to watch and play with.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Simulation", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Element+Interactions"]
    },
    run3: {
        name: "Run 3",
        developer: "Joseph Cloutier",
        icon: "icons/run3.png",
        category: "Games / Platformer",
        description: "Run 3 is an incredibly addictive endless runner that takes place in the unique environment of procedurally generated space tunnels. Navigate through endless tunnels while avoiding gaps and obstacles.",
        features: "The game features multiple game modes including the classic endless run, the challenging tunnel run mode with a finish line, and the time attack mode. Features smooth controls and progressively harder challenges.",
        additional: "As you progress, the game introduces new challenges including crumbling tiles, portals, and sections where the tunnel rotates. The game is completely free with no ads or microtransactions.",
        link: "https://the-sawfish.github.io/Run3Final/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Run+3+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Space+Tunnels"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Jimeneutron",
        icon: "icons/syrup.png",
        category: "Games / Launcher",
        description: "Syrup Games is an alternative game launcher that provides access to a curated collection of unique browser-based games. Discover indie games and experimental titles you won't find elsewhere.",
        features: "The launcher features a clean, modern interface that makes it easy to browse and discover new games. Includes game ratings, playtime tracking, and curated collections based on mood and difficulty.",
        additional: "Syrup Games complements the main Sawfish Game Portal by offering access to indie and experimental titles. All games are tested for school appropriateness.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Collection"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "GameDevelop",
        icon: "icons/bobtherobber.png",
        category: "Games / Stealth",
        description: "Bob The Robber is a stealth puzzle game series that challenges players to infiltrate various locations, avoid security systems, and steal treasure without getting caught.",
        features: "Each level presents a unique location with different security systems, guard placements, and objectives. Features include multiple difficulty levels, unlockable upgrades, and engaging story progression.",
        additional: "The Bob The Robber series has multiple installments, each offering new challenges and environments. The games are designed to exercise problem-solving skills and strategic thinking.",
        link: "https://bobtherobberunblocked.github.io/2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Puzzles"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Coloso",
        icon: "icons/retrobowl.png",
        category: "Games / Sports",
        description: "Retro Bowl brings the classic American football video game experience to your browser with charming pixel-art graphics and addictive gameplay. Lead your team to championship glory.",
        features: "The gameplay combines strategy and action with management elements including player contracts, draft systems, and team customization. Features include season mode, playoffs, and challenging opponents.",
        additional: "Retro Bowl has been optimized for browser play with touch-friendly controls and responsive gameplay. The game captures the magic of classic football video games.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Football+Action"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Voodoo",
        icon: "icons/paperio2.png",
        category: "Games / Arcade",
        description: "Paper Io 2 is an addictive territory conquest game where you control a character to capture territory, expand your kingdom, and compete against other players in fast-paced battles.",
        features: "The game features both single-player mode against AI opponents and multiplayer mode against real players. Includes daily challenges, seasonal events, and unlockable skins and achievements.",
        additional: "Paper Io 2 is designed for quick, exciting matches that can be played in short bursts. The simple controls make it accessible while the strategy depth keeps it engaging.",
        link: "https://the-sawfish.github.io/seraph/games/paperio2/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Paper+Io+2+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territory+Capture"]
    },
    hextris: {
        name: "Hextris",
        developer: "Hextris",
        icon: "icons/hextris.png",
        category: "Games / Puzzle",
        description: "Hextris is a fast-paced puzzle game inspired by Tetris, played on a hexagonal grid. Rotate the hexagon to stack blocks and prevent the game from ending in this addictive challenge.",
        features: "Features include addictive gameplay with increasing difficulty, colorful hexagonal visuals, high score tracking, combo multipliers, and smooth animations.",
        additional: "Often hosted on GitHub Pages, making it less likely to be blocked by school filters. Perfect for quick gaming sessions during breaks.",
        link: "https://hextris.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hextris+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hexagonal+Puzzle"]
    },
    
    // New Arcade Games (January 2026)
    tinyfishing: {
        name: "Tiny Fishing",
        developer: "Kongregate",
        icon: "icons/tinyfishing.png",
        category: "Games / Arcade",
        description: "Tiny Fishing is an addictive arcade game where you cast your line into the water and catch fish of various sizes. Upgrade your gear and discover new fishing spots as you progress.",
        features: "Features include simple tap-to-cast mechanics, upgradeable fishing rods and lines, multiple fishing locations with different fish species, and satisfying catch animations.",
        additional: "Perfect for quick gaming sessions during breaks. The colorful graphics and relaxing gameplay make it a great way to unwind between classes.",
        link: "https://the-sawfish.github.io/legalizenuclearbombs5.github.io/games/Tiny%20Fishing",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tiny+Fishing+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Catch+Fish"]
    },
    ovo: {
        name: "OVO",
        developer: "Madbox",
        icon: "icons/ovo.png",
        category: "Games / Platformer",
        description: "OVO is a fast-paced platformer game featuring a small circular character navigating through obstacle courses. Jump, slide, and bounce your way through challenging levels.",
        features: "Features include smooth parkour mechanics, challenging obstacle courses, time trial modes, and unlockable character skins. The controls are tight and responsive for precise platforming.",
        additional: "OVO is known for its difficulty and rewarding gameplay. Master the mechanics to achieve fastest completion times and compete on leaderboards.",
        link: "https://the-sawfish.github.io/legalizenuclearbombs5.github.io/games/ovo.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=OVO+Platformer", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Obstacle+Course"]
    },
    towerofdestiny: {
        name: "Tower of Destiny",
        developer: "Ketchapp",
        icon: "icons/towerofdestiny.png",
        category: "Games / Adventure",
        description: "Tower of Destiny is an exciting adventure game where you build and ascend a tower while fighting enemies and collecting treasures. Upgrade your hero and conquer each floor.",
        features: "Features include procedurally generated levels, diverse enemy types, power-ups and collectibles, hero upgrades and skill trees, and boss battles on certain floors.",
        additional: "The tower keeps getting taller as you progress, offering new challenges and rewards. Perfect for fans of roguelike and tower defense games.",
        link: "https://the-sawfish.github.io/legalizenuclearbombs5.github.io/games/Tower%20of%20Destiny",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tower+of+Destiny", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ascend+the+Tower"]
    },
    
    // Educational / Productivity
    monkeytype: {
        name: "Monkeytype",
        developer: "Miodec",
        icon: "icons/monkeytype.png",
        category: "Educational / Typing",
        description: "Monkeytype is a minimalist, customizable typing test that helps you improve your typing speed and accuracy. Practice typing with beautiful themes and detailed statistics while tracking your progress over time.",
        features: "Features customizable themes, difficulty levels (easy, normal, hard, expert), typing modes (time, words, quotes,zen), and comprehensive statistics showing WPM, accuracy, character count, and key distributions.",
        additional: "Open source and completely ad-free. Great for practice during study breaks. The minimal design eliminates distractions so you can focus entirely on your typing practice.",
        link: "https://monkeytype.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Monkeytype+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Typing+Statistics"]
    },
    lichess: {
        name: "Lichess",
        developer: "Lichess Team",
        icon: "icons/lichess.png",
        category: "Games / Strategy",
        description: "Lichess is a free, open-source chess platform with no ads, no tracking, and completely free to play. Challenge AI opponents, play with friends, or compete against chess players worldwide.",
        features: "Multiple game modes including blitz, rapid, classical, and correspondence chess. Features puzzles, tactics training, analysis boards with Stockfish integration, tournaments, and team championships.",
        additional: "One of the least blocked chess sites on school networks due to its educational nature. The site is entirely supported by donations and has no commercial interests.",
        link: "https://lichess.org/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Lichess+Chess+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chess+Analysis"]
    },
    
    // Operating Systems
    novaos: {
        name: "NovaOS",
        developer: "RunNova",
        icon: "icons/novaos.png",
        category: "Operating System",
        description: "NovaOS is a full-featured browser-based desktop operating system environment that brings the concept of a web OS to life. Experience a complete desktop interface running entirely in your browser.",
        features: "The OS features a customizable desktop with drag-and-drop widgets, window management with minimize/maximize/close, file manager, text editor, calculator, music player, and a built-in app store.",
        additional: "For the full NovaOS experience, we recommend opening the OS directly in a new tab. This provides better performance and more screen space for the desktop environment.",
        link: "https://runnova.github.io/NovaOS/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Apps"]
    },
    winripen: {
        name: "WinRipen",
        developer: "Ripenos",
        icon: "icons/winripen.png",
        category: "Operating System",
        description: "WinRipen is a web-based operating system that recreates the familiar look and feel of classic Windows operating systems. Relive the Windows experience right in your browser.",
        features: "The OS features authentic-looking windows with title bars, minimize/maximize/close buttons, and resizing handles. Includes a start menu, taskbar, desktop icons, and several built-in applications.",
        additional: "Due to browser security restrictions, full interaction with WinRipen requires opening it directly in a new tab. This provides access to all features without iframe limitations.",
        link: "https://ripenos.web.app/WinRipen/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=WinRipen+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Windows+Apps"]
    },
    plutoos: {
        name: "PlutoOS",
        developer: "Zeon",
        icon: "icons/plutoos.png",
        category: "Operating System",
        description: "PlutoOS represents a futuristic vision of what a web-based operating system could be, with a focus on modern design aesthetics and smooth user interactions. Experience the next generation of web operating systems.",
        features: "The OS features a modular design with glass-morphism effects, smooth gradients, subtle shadows, and fluid animations. Includes customizable themes, widget support, and a sleek application launcher.",
        additional: "PlutoOS is an experimental project that demonstrates the cutting edge of browser-based computing. While it's primarily for exploration, it shows what's possible with modern web technologies.",
        link: "https://pluto-app.zeon.dev",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=PlutoOS+Modern+UI", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Fluid+Animations"]
    },
    ripenos: {
        name: "Ripenos",
        developer: "Ripenos",
        icon: "icons/ripenos.png",
        category: "Operating System",
        description: "Ripenos is a lightweight, modular web-based operating system framework designed for speed and efficiency. Experience a clean, fast desktop environment in your browser.",
        features: "The core OS provides essential desktop functionality including window management, app launching, system settings, and file management. Its modular architecture allows for easy customization and extension.",
        additional: "Ripenos is particularly suitable for educational environments where performance on varied hardware is important. It loads quickly and runs smoothly even on older devices.",
        link: "https://ripenos.web.app/Ripenos/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ripenos+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Modular+Apps"]
    },
    
    // Developer Tools
    piskel: {
        name: "Piskel",
        developer: "Piskel Team",
        icon: "icons/piskel.png",
        category: "Developer Tools / Graphics",
        description: "Piskel is a free online editor for creating animated sprites, pixel art, and static images. Create pixel-perfect artwork with powerful drawing tools and export to various formats.",
        features: "Features include layers, advanced color palettes, onion skinning for animation, frame management, various brush types, and export options including GIF, PNG spritesheets, and APNG.",
        additional: "Perfect for creating game assets, avatars, and pixel art. Works offline once loaded and all processing happens in your browser for privacy.",
        link: "https://www.piskelapp.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Piskel+Pixel+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Animation+Timeline"]
    },
    vscodeweb: {
        name: "VS Code Web",
        developer: "Microsoft",
        icon: "icons/vscode.png",
        category: "Developer Tools / Code",
        description: "VS Code Web brings the powerful Visual Studio Code editor to your browser. Write, edit, and debug code directly in your browser with syntax highlighting and extensions support.",
        features: "Features include syntax highlighting for multiple languages, IntelliSense code completion, integrated terminal, Git integration, and access to the VS Code extension marketplace (compatible extensions).",
        additional: "Requires a Microsoft account for full functionality. Perfect for quick code edits, reviewing pull requests, and working on projects from any computer.",
        link: "https://vscode.dev/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=VS+Code+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Code+IntelliSense"]
    },
    shadertoy: {
        name: "ShaderToy",
        developer: "ShaderToy Team",
        icon: "icons/shadertoy.png",
        category: "Developer Tools / Graphics",
        description: "ShaderToy is the world's first platform for learning, sharing, and connecting with creative coders to create and share GLSL shaders. Create stunning visual effects with code.",
        features: "Features include a powerful shader editor, thousands of example shaders, real-time preview, the ability to fork and modify other shaders, and a community to share your creations.",
        additional: "Perfect for learning computer graphics, creating visual effects, or just exploring the creative possibilities of shader programming. Great for both beginners and experts.",
        link: "https://www.shadertoy.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=ShaderToy+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=GLSL+Shaders"]
    },
    
    // Productivity
    photopea: {
        name: "Photopea",
        developer: "Ivan Kuckir",
        icon: "icons/photopea.png",
        category: "Productivity / Graphics",
        description: "Photopea is a powerful online image editor that works directly in your browser without any installation. It supports PSD, AI, Sketch, and many other file formats.",
        features: "Features include layer support, filters, adjustment layers, brushes, text tools, vector shapes, animation, and smart objects. Works offline once loaded.",
        additional: "All processing happens in your browser - no uploads required, ensuring privacy. A great free alternative to Photoshop for basic to intermediate image editing needs.",
        link: "https://www.photopea.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Photopea+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Image+Editing"]
    },
    tiddlywiki: {
        name: "TiddlyWiki",
        developer: "TiddlyWiki Community",
        icon: "icons/tiddlywiki.png",
        category: "Productivity / Notes",
        description: "TiddlyWiki is a unique personal wiki and non-linear notebook for capturing, organizing, and sharing your thoughts, ideas, and information in a flexible format.",
        features: "Features include powerful linking between tiddlers, tagging system, rich text editing, plugins and themes, and the ability to save everything in a single HTML file.",
        additional: "Completely self-contained - your entire wiki lives in one HTML file that you can back up, share, and access from anywhere. Perfect for notes, journals, and personal knowledge management.",
        link: "https://tiddlywiki.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=TiddlyWiki+Notebook", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Wiki+Organization"]
    },
    protonmail: {
        name: "Proton Mail",
        developer: "Proton AG",
        icon: "icons/protonmail.png",
        category: "Productivity / Email",
        description: "Proton Mail is a secure, encrypted email service based in Switzerland that protects your privacy. Send encrypted emails that even Proton cannot read.",
        features: "End-to-end encryption, zero-access architecture, self-destructing messages, custom domains, and 2GB free storage. No ads or tracking of your activity.",
        additional: "Proton Mail is protected by Swiss privacy laws, one of the strongest data protection regimes in the world. Perfect for sensitive communications.",
        link: "https://mail.proton.me/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Proton+Mail+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Encrypted+Email"]
    },
    
    // Media & Social
    spotifyweb: {
        name: "Spotify Web",
        developer: "Spotify",
        icon: "icons/spotify.png",
        category: "Media / Music",
        description: "Stream millions of songs, podcasts, and audiobooks directly in your browser with Spotify Web Player. Discover new music and enjoy your favorite playlists anywhere.",
        features: "Features include streaming quality options, playlist management, radio stations, podcast access, and social features to share music with friends.",
        additional: "Requires a Spotify account. Free tier available with shuffle play only. Premium removes ads and enables on-demand playback.",
        link: "https://open.spotify.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Spotify+Web+Player", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Music+Library"]
    },
    neocities: {
        name: "Neocities",
        developer: "Neocities Inc",
        icon: "icons/neocities.png",
        category: "Social / Web Publishing",
        description: "Neocities is a free service that lets you create your own website for free, with no coding required. Join a community of creators and bring the creative, independent spirit of the early web back to life.",
        features: "Features include free hosting with custom domains, site templates, drag-and-drop file uploads, a CLI tool, and an active community of creators sharing tips and feedback.",
        additional: "Neocities has revived the spirit of early web publishing. Create personal websites, portfolios, or experiment with HTML and CSS in a supportive community environment.",
        link: "https://neocities.org/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Neocities+Create", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Website+Builder"]
    },
    hackernews: {
        name: "Hacker News",
        developer: "Y Combinator",
        icon: "icons/hackernews.png",
        category: "News / Technology",
        description: "Hacker News is a social news website focusing on computer science, technology, and entrepreneurship. Read the latest discussions, insights, and stories from the tech world.",
        features: "Features include user-submitted stories, threaded comments, karma points, YC job board integration, and an active community of developers, entrepreneurs, and tech enthusiasts.",
        additional: "One of the best sources for staying informed about technology trends, startup news, and programming discussions. The community is known for thoughtful, in-depth conversations.",
        link: "https://news.ycombinator.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hacker+News+Front+Page", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tech+Discussions"]
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
    
    // Initialize modules
    UserAuth.init();
    DeveloperMode.init();
    SearchSystem.init();
    UpdateChecker.init();
    CommunityBoard.init();
    
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
    setupDeveloperDashboardListeners();
    setupAuthModalListeners();
    setupOfflineTagListeners();
    
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

function setupDeveloperDashboardListeners() {
    const closeBtn = document.getElementById('developer-close-dashboard');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => DeveloperMode.closeDashboard());
    }
    
    const navBtns = document.querySelectorAll('.developer-nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.developerTab;
            switchDeveloperTab(tab);
        });
    });
    
    const addAppBtn = document.getElementById('add-new-app-btn');
    if (addAppBtn) {
        addAppBtn.addEventListener('click', () => DeveloperMode.showAddAppForm());
    }
    
    const publishBtn = document.getElementById('publish-announcement');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => DeveloperMode.publishAnnouncement());
    }
    
    // Auth modal backdrop click
    const authModal = document.getElementById('auth-modal');
    const authBackdrop = authModal?.querySelector('.modal-backdrop');
    if (authBackdrop) {
        authBackdrop.addEventListener('click', () => UserAuth.closeAuthModal());
    }
    
    // Developer login button
    const devLoginBtn = document.getElementById('developer-login-button');
    if (devLoginBtn) {
        devLoginBtn.addEventListener('click', () => DeveloperMode.toggleLogin());
    }
}

function setupAuthModalListeners() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.auth-tab-btn').forEach(btn => {
                if (btn.dataset.authTab === 'reset') btn.click();
            });
        });
    }
    
    const backToLoginLink = document.getElementById('back-to-login-link');
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.auth-tab-btn').forEach(btn => {
                if (btn.dataset.authTab === 'login') btn.click();
            });
        });
    }
    
    // Close auth modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const authModal = document.getElementById('auth-modal');
            if (authModal && !authModal.classList.contains('hidden')) {
                UserAuth.closeAuthModal();
            }
        }
    });
}

function setupOfflineTagListeners() {
    // Use event delegation for offline tags
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('offline-tag')) {
            e.stopPropagation();
            const appId = e.target.dataset.app;
            const app = appData[appId];
            if (app) {
                OfflineTagSystem.showHackPassword(appId, app.name);
            }
        }
    });
    
    // Prevent card click when clicking offline tag
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('offline-tag')) {
            e.stopPropagation();
        }
    });
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

function switchDeveloperTab(tabName) {
    const navBtns = document.querySelectorAll('.developer-nav-btn');
    navBtns.forEach(btn => {
        if (btn.dataset.developerTab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const contents = document.querySelectorAll('.developer-tab-content');
    contents.forEach(content => {
        if (content.dataset.developerContent === tabName) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
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
    
    // Check if this is Minecraft and show warning
    if (appId === 'minecraft') {
        minecraftWarningSystem.showWarning(app.name, app.link);
        return;
    }
    
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
        
        if (displayElement) {
            if (avgRating === null || avgRating === undefined) {
                displayElement.innerHTML = '<span class="rating-na">—</span>';
            } else {
                displayElement.innerHTML = getNumericRatingDisplay(avgRating);
            }
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
    }
}

function updateRatingDisplay(appId, avgRating, distribution, totalReviews) {
    const bigRating = document.querySelector(`#expanded-overlay .rating-big`);
    const ratingCount = document.querySelector(`#expanded-overlay .rating-count`);
    
    if (bigRating) {
        if (avgRating === null || avgRating === undefined) {
            bigRating.innerHTML = '<span class="rating-na">—</span>';
            bigRating.classList.add('na-rating');
        } else {
            bigRating.innerHTML = getNumericRatingDisplay(avgRating);
            bigRating.classList.remove('na-rating');
        }
    }
    
    if (ratingCount) {
        ratingCount.textContent = `${totalReviews} reviews`;
    }
    
    const ratingBarsContainer = document.querySelector(`#expanded-overlay .rating-bars`);
    if (ratingBarsContainer) {
        ratingBarsContainer.innerHTML = buildRatingBars(distribution, totalReviews);
    }
}

function buildExpandedContent(app, appId, avgRating, totalReviews, distribution) {
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
                    <div class="rating-big">${avgRating !== null && avgRating !== undefined ? getNumericRatingDisplay(avgRating) : '<span class="rating-na">—</span>'}</div>
                    <div class="rating-details">
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
                            <button type="button" class="rating-num-btn" data-value="1">1</button>
                            <button type="button" class="rating-num-btn" data-value="2">2</button>
                            <button type="button" class="rating-num-btn" data-value="3">3</button>
                            <button type="button" class="rating-num-btn" data-value="4">4</button>
                            <button type="button" class="rating-num-btn" data-value="5">5</button>
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
    const ratingBtns = form?.querySelectorAll('.rating-num-btn');
    let selectedRating = 0;
    
    ratingBtns?.forEach(btn => {
        btn.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.value);
            updateRatingDisplayNumbers(form, selectedRating);
        });
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
        
        if (!UserAuth.canRate()) {
            alert('Please log in to leave a review');
            UserAuth.openAuthModal();
            return;
        }
        
        submitReview(appId, selectedRating, comment);
    });
}

function updateRatingDisplayNumbers(form, rating) {
    const btns = form.querySelectorAll('.rating-num-btn');
    btns.forEach(btn => {
        const value = parseInt(btn.dataset.value);
        if (value <= rating) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function submitReview(appId, rating, comment) {
    const isDeveloper = DeveloperMode.isLoggedIn;
    const userName = UserAuth.getReviewUsername();
    const userAvatar = UserAuth.getReviewAvatar();
    
    const review = await FirestoreComments.saveReview(appId, rating, comment, userName, isDeveloper, userAvatar);
    
    if (review) {
        showNotification(isDeveloper ? 'Developer response submitted!' : 'Review submitted successfully!');
        
        await loadAppRatings(appId);
        
        const textarea = document.getElementById(`comment-input-${appId}`);
        if (textarea) textarea.value = '';
        
        // Clear rating selection
        const form = document.getElementById(`comment-form-${appId}`);
        if (form) {
            form.querySelectorAll('.rating-num-btn').forEach(btn => btn.classList.remove('active'));
        }
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
        const isDeveloperReview = review.isDeveloper === true;
        const reviewClass = isDeveloperReview ? 'comment-item developer-response' : 'comment-item';
        
        // Get avatar or use initial
        let avatarHtml = '';
        if (review.userAvatar) {
            avatarHtml = `<img src="${review.userAvatar}" alt="${escapeHtml(review.user)}" class="comment-avatar-img">`;
        } else if (isDeveloperReview) {
            avatarHtml = `<div class="comment-avatar developer">D</div>`;
        } else {
            avatarHtml = `<div class="comment-avatar">${escapeHtml(review.user.charAt(0).toUpperCase())}</div>`;
        }
        
        return `
            <div class="${reviewClass}">
                <div class="comment-header">
                    <div class="comment-author">
                        ${avatarHtml}
                        <span class="comment-name">${escapeHtml(review.user)}</span>
                        ${isDeveloperReview ? '<span class="developer-badge">Developer</span>' : ''}
                    </div>
                    <div>
                        <span class="comment-rating">${review.rating}/5</span>
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
                if (avgRating === null || avgRating === undefined) {
                    displayElement.innerHTML = '<span class="rating-na">—</span>';
                } else {
                    displayElement.innerHTML = getNumericRatingDisplay(avgRating);
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
        const appId = card.dataset.app;
        const app = appData[appId];
        
        if (category === 'all') {
            card.style.display = '';
        } else if (app && app.category.toLowerCase().includes(category.toLowerCase())) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
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
// GLOBAL FUNCTIONS
// ============================================================
window.scrollToSection = scrollToSection;
window.DeveloperMode = DeveloperMode;
window.UserAuth = UserAuth;
window.openExpandedApp = openExpandedApp;

console.log('Sawfish App Store JavaScript loaded successfully');
