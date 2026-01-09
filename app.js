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
const APP_VERSION = '1.3.0';
const VERSION_CHECK_URL = '/update/version.json';

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// NOTE: Replace these values with your own Firebase config
// You can get these from the Firebase Console:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing one
// 3. Go to Project Settings > General > Your apps
// 4. Copy the firebaseConfig values
const firebaseConfig = {
    apiKey: "AIzaSyB5JaGq3ezv1ghif7ggRr8_jxuq7ZGw4Bo",
    authDomain: "appstore-cb2fa.firebaseapp.com",
    projectId: "appstore-cb2fa",
    storageBucket: "appstore-cb2fa.firebasestorage.app",
    messagingSenderId: "122307463006",
    appId: "1:122307463006:web:25993ed888531908fbb1cf"
};

// Initialize Firebase
let db = null;
let auth = null;
let storage = null;
let app = null;

try {
    if (typeof firebase !== 'undefined') {
        // Check if config is set properly
        if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
            app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();
            
            // Set auth persistence to maintain login state across sessions
            if (auth) {
                auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                    .then(() => {
                        console.log('Auth persistence set to LOCAL');
                    })
                    .catch((error) => {
                        console.error('Error setting auth persistence:', error);
                    });
                
                // Listen for auth state changes to maintain session
                auth.onAuthStateChanged((user) => {
                    if (user) {
                        console.log('User signed in:', user.email);
                        UserAuth.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || user.email.split('@')[0],
                            emailVerified: user.emailVerified
                        };
                        UserAuth.updateAuthUI();
                    } else {
                        console.log('User signed out');
                    }
                });
            }
            
            console.log('Firebase initialized successfully');
            console.log('Project ID:', firebaseConfig.projectId);
        } else {
            console.warn('Firebase config not set - using local storage fallback');
            console.warn('To enable cloud sync, configure firebaseConfig with your values');
        }
    } else {
        console.warn('Firebase SDK not loaded - using local storage fallback');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
    console.warn('Falling back to local storage');
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
        console.log('Setting up auth listeners...');
        
        // Login form submission
        const loginForm = document.getElementById('login-form');
        console.log('Login form found:', !!loginForm);
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Signup form submission
        const signupForm = document.getElementById('signup-form');
        console.log('Signup form found:', !!signupForm);
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }
        
        // Password reset form
        const resetForm = document.getElementById('reset-form');
        console.log('Reset form found:', !!resetForm);
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handlePasswordReset(e));
        }
        
        // Auth modal tabs - Fixed selector
        const authTabs = document.querySelectorAll('.auth-tab');
        authTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.authTab;
                
                authTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show/hide forms based on tab
                document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
                document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
                document.getElementById('reset-form').style.display = tab === 'reset' ? 'block' : 'none';
                
                // Update title
                const title = document.getElementById('auth-modal-title');
                if (title) {
                    if (tab === 'login') title.textContent = 'Sign In';
                    else if (tab === 'signup') title.textContent = 'Create Account';
                    else if (tab === 'reset') title.textContent = 'Reset Password';
                }
            });
        });
        
        // User profile button in sidebar
        const userProfileBtn = document.getElementById('user-profile-button');
        if (userProfileBtn) {
            userProfileBtn.addEventListener('click', () => this.handleProfileButtonClick());
        }
        
        // Logout button from profile modal
        const logoutBtn = document.getElementById('profile-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // Profile save button
        const profileSaveBtn = document.getElementById('profile-save-btn');
        if (profileSaveBtn) {
            profileSaveBtn.addEventListener('click', () => this.saveProfileChanges());
        }
        
        // Profile cancel button
        const profileCancelBtn = document.getElementById('profile-cancel-btn');
        if (profileCancelBtn) {
            profileCancelBtn.addEventListener('click', () => this.closeProfileModal());
        }
        
        // Avatar upload
        const avatarUpload = document.getElementById('avatar-upload-input');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => this.handleProfilePictureUpload(e));
        }
        
        // Profile modal close
        const profileClose = document.getElementById('profile-close');
        if (profileClose) {
            profileClose.addEventListener('click', () => this.closeProfileModal());
        }
        
        // Auth modal close/cancel
        const authCancel = document.getElementById('auth-cancel');
        if (authCancel) {
            authCancel.addEventListener('click', () => this.closeAuthModal());
        }
        
        // Backdrop click to close auth modal
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            const backdrop = authModal.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', () => this.closeAuthModal());
            }
        }
        
        // Escape key to close auth modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const authModal = document.getElementById('auth-modal');
                if (authModal && !authModal.classList.contains('hidden')) {
                    this.closeAuthModal();
                }
            }
        });
    },
    
    // Handle profile button click
    handleProfileButtonClick: function() {
        if (this.isLoggedIn()) {
            this.openProfileModal();
        } else {
            this.openAuthModal();
        }
    },
    
    // Open profile modal
    openProfileModal: function() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        
        // Update profile info
        const name = this.userProfile?.username || this.currentUser?.displayName || 'User';
        const email = this.userProfile?.email || this.currentUser?.email || 'Not signed in';
        const bio = this.userProfile?.bio || '';
        
        const nameEl = document.getElementById('profile-display-name');
        const emailEl = document.getElementById('profile-email');
        const nameInput = document.getElementById('profile-name-input');
        const bioInput = document.getElementById('profile-bio-input');
        
        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;
        if (nameInput) nameInput.value = name;
        if (bioInput) bioInput.value = bio;
        
        // Update avatar
        this.updateProfileAvatar();
        
        // Update status badge
        const statusBadge = document.getElementById('profile-status-badge');
        if (statusBadge) {
            if (this.isDeveloperMode) {
                statusBadge.textContent = 'Developer';
                statusBadge.classList.add('developer');
            } else {
                statusBadge.textContent = 'User';
                statusBadge.classList.remove('developer');
            }
        }
        
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    },
    
    // Close profile modal
    closeProfileModal: function() {
        const modal = document.getElementById('profile-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
    // Update profile avatar display
    updateProfileAvatar: function() {
        const avatarInitial = document.getElementById('profile-avatar-initial');
        const avatarImg = document.getElementById('profile-avatar-img');
        const previewInitial = document.getElementById('upload-preview-initial');
        const previewImg = document.getElementById('upload-preview-img');
        
        const name = this.userProfile?.username || this.currentUser?.displayName || 'User';
        const initial = name.charAt(0).toUpperCase();
        
        if (this.userProfile?.avatarUrl) {
            if (avatarInitial) avatarInitial.style.display = 'none';
            if (avatarImg) {
                avatarImg.src = this.userProfile.avatarUrl;
                avatarImg.style.display = 'block';
            }
            if (previewInitial) previewInitial.style.display = 'none';
            if (previewImg) {
                previewImg.src = this.userProfile.avatarUrl;
                previewImg.style.display = 'block';
            }
        } else {
            if (avatarInitial) {
                avatarInitial.textContent = initial;
                avatarInitial.style.display = 'flex';
            }
            if (avatarImg) avatarImg.style.display = 'none';
            if (previewInitial) {
                previewInitial.textContent = initial;
                previewInitial.style.display = 'flex';
            }
            if (previewImg) previewImg.style.display = 'none';
        }
    },
    
    // Save profile changes
    saveProfileChanges: function() {
        const nameInput = document.getElementById('profile-name-input');
        const bioInput = document.getElementById('profile-bio-input');
        const name = nameInput?.value.trim();
        const bio = bioInput?.value.trim();
        
        if (name) {
            this.userProfile = this.userProfile || {};
            this.userProfile.username = name;
            this.userProfile.bio = bio || '';
            
            if (this.currentUser) {
                this.currentUser.displayName = name;
            }
            
            this.saveUserSession();
            
            // Update Firestore if available
            if (db && this.currentUser) {
                db.collection('users').doc(this.currentUser.uid).set({
                    username: name,
                    bio: bio || ''
                }, { merge: true })
                .then(() => {
                    console.log('Profile saved to Firestore');
                })
                .catch((error) => {
                    console.error('Error saving profile to Firestore:', error);
                });
            }
            
            // Also save to localStorage for offline mode
            if (!db && this.currentUser) {
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                const email = this.currentUser.email;
                if (storedUsers[email]) {
                    storedUsers[email].username = name;
                    storedUsers[email].bio = bio || '';
                    localStorage.setItem('sawfish_users', JSON.stringify(storedUsers));
                }
            }
            
            this.updateAuthUI();
            this.updateProfileAvatar();
            showNotification('Profile updated!');
            
            // Close the profile modal
            this.closeProfileModal();
        }
    },
    
    // Close profile modal
    closeProfileModal: function() {
        const modal = document.getElementById('profile-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
    // Handle login
    handleLogin: async function(event) {
        event.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const errorDiv = document.getElementById('auth-error');
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
                
                // Update developer mode UI
                DeveloperMode.isLoggedIn = true;
                DeveloperMode.updateLoginButton();
                updateDevOnlyElements();
                
                // Award developer achievement
                Achievements.checkAchievements('become_developer');
                
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
                // Fallback: check local storage for demo users
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                if (storedUsers[email] && storedUsers[email].password === password) {
                    this.currentUser = {
                        uid: storedUsers[email].uid,
                        email: email,
                        displayName: storedUsers[email].username,
                        isDeveloper: false
                    };
                    this.userProfile = {
                        username: storedUsers[email].username,
                        email: email
                    };
                    this.saveUserSession();
                    this.closeAuthModal();
                    this.updateAuthUI();
                    showNotification('Welcome back! (Offline mode)');
                } else {
                    this.showError(errorDiv, 'Invalid email or password. In offline mode, please sign up first.');
                }
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
        const errorDiv = document.getElementById('auth-error');
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
                    totalRatings: 0,
                    achievements: ['first_time']
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
                // Fallback: store in localStorage
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                
                if (storedUsers[email]) {
                    this.showError(errorDiv, 'An account with this email already exists');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account';
                    return;
                }
                
                const uid = 'user_' + Date.now();
                storedUsers[email] = {
                    uid: uid,
                    username: name,
                    email: email,
                    password: password,
                    createdAt: new Date().toISOString()
                };
                localStorage.setItem('sawfish_users', JSON.stringify(storedUsers));
                
                this.currentUser = {
                    uid: uid,
                    email: email,
                    displayName: name,
                    isDeveloper: false
                };
                this.userProfile = {
                    username: name,
                    email: email
                };
                
                this.saveUserSession();
                this.closeAuthModal();
                this.updateAuthUI();
                showNotification('Account created! (Offline mode)');
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
        const errorDiv = document.getElementById('auth-error');
        const successDiv = document.getElementById('auth-success');
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
            this.closeProfileModal();
            this.updateAuthUI();
            
            // Update developer mode if was in dev mode
            if (DeveloperMode.isLoggedIn) {
                DeveloperMode.isLoggedIn = false;
                DeveloperMode.updateLoginButton();
                updateDevOnlyElements();
            }
            
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
                    totalRatings: 0,
                    achievements: ['first_time']
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
        
        const status = document.getElementById('profile-upload-status');
        const previewInitial = document.getElementById('upload-preview-initial');
        const previewImg = document.getElementById('upload-preview-img');
        
        if (!this.currentUser) {
            showNotification('Please log in to upload a profile picture');
            return;
        }
        
        try {
            if (status) {
                status.textContent = 'Uploading...';
                status.classList.remove('hidden');
            }
            
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
                
                // Update profile avatar for Firebase Storage upload path
                this.updateProfileAvatar();
                
                if (status) {
                    status.textContent = 'Profile picture updated!';
                }
                showNotification('Profile picture updated!');
            } else {
                // For developer mode or offline, use base64
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.userProfile.avatarUrl = e.target.result;
                    this.saveUserSession();
                    
                    // Update preview immediately
                    if (previewInitial) {
                        previewInitial.textContent = '';
                        previewInitial.style.display = 'none';
                    }
                    if (previewImg) {
                        previewImg.src = e.target.result;
                        previewImg.style.display = 'block';
                    }
                    
                    // Update profile avatar in all places
                    this.updateProfileAvatar();
                    
                    // Award achievement
                    Achievements.checkAchievements('upload_avatar');
                    
                    if (status) {
                        status.textContent = 'Profile picture updated!';
                    }
                    showNotification('Profile picture updated!');
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Upload error:', error);
            if (status) {
                status.textContent = 'Upload failed. Please try again.';
            }
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
            
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('reset-form').style.display = 'none';
            
            const errorDiv = document.getElementById('auth-error');
            const successDiv = document.getElementById('auth-success');
            if (errorDiv) errorDiv.classList.add('hidden');
            if (successDiv) successDiv.classList.add('hidden');
            
            // Reset tabs
            const authTabs = document.querySelectorAll('.auth-tab');
            authTabs.forEach((btn, index) => {
                btn.classList.toggle('active', index === 0);
            });
            
            const title = document.getElementById('auth-modal-title');
            if (title) title.textContent = 'Sign In';
        }
    },
    
    // Update auth UI based on login state
    updateAuthUI: function() {
        const profileStatusText = document.getElementById('profile-status-text');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        
        if (this.currentUser) {
            // Logged in state
            const name = this.userProfile?.username || this.currentUser.displayName || 'User';
            const initial = name.charAt(0).toUpperCase();
            
            if (profileStatusText) profileStatusText.textContent = name;
            if (sidebarAvatar) sidebarAvatar.textContent = initial;
            
            // Update sidebar avatar style
            const userProfileBtn = document.getElementById('user-profile-button');
            if (userProfileBtn) {
                userProfileBtn.classList.add('logged-in');
            }
        } else {
            // Logged out state
            if (profileStatusText) profileStatusText.textContent = 'Sign In';
            if (sidebarAvatar) sidebarAvatar.textContent = '?';
            
            const userProfileBtn = document.getElementById('user-profile-button');
            if (userProfileBtn) {
                userProfileBtn.classList.remove('logged-in');
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
// ACHIEVEMENTS SYSTEM
// ============================================================
const Achievements = {
    // Achievement definitions
    ACHIEVEMENTS: {
        'first_time': {
            name: 'First Steps',
            icon: '👋',
            description: 'First time visiting Sawfish App Store'
        },
        'first_like': {
            name: 'Thumbs Up',
            icon: '👍',
            description: 'Liked your first app'
        },
        'ten_likes': {
            name: 'Popular',
            icon: '⭐',
            description: 'Liked 10 apps'
        },
        'first_rating': {
            name: 'Critic',
            icon: '💬',
            description: 'Left your first rating'
        },
        'rate_all_apps': {
            name: 'Completionist',
            icon: '🏆',
            description: 'Rated all available apps'
        },
        'be_a_dev': {
            name: 'Developer',
            icon: '💻',
            description: 'Entered developer mode'
        },
        'has_profile_pic': {
            name: 'Face to Face',
            icon: '📸',
            description: 'Uploaded a profile picture'
        },
        'has_bio': {
            name: 'Storyteller',
            icon: '📝',
            description: 'Wrote a bio'
        },
        'social_butterfly': {
            name: 'Social Butterfly',
            icon: '🦋',
            description: 'Posted in the community board'
        }
    },
    
    // Get achievement info
    getAchievementInfo: function(achievementId) {
        return this.ACHIEVEMENTS[achievementId] || {
            name: 'Unknown',
            icon: '❓',
            description: 'Unknown achievement'
        };
    },
    
    // Award an achievement to a user
    awardAchievement: async function(userId, achievementId) {
        if (!this.ACHIEVEMENTS[achievementId]) {
            console.warn('Unknown achievement:', achievementId);
            return false;
        }
        
        try {
            if (db) {
                const userRef = db.collection('users').doc(userId);
                const doc = await userRef.get();
                
                if (doc.exists) {
                    const userData = doc.data();
                    const achievements = userData.achievements || [];
                    
                    if (!achievements.includes(achievementId)) {
                        achievements.push(achievementId);
                        await userRef.update({
                            achievements: achievements
                        });
                        console.log('Achievement awarded:', achievementId);
                        return true;
                    }
                }
            } else {
                // Offline mode - update localStorage
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                for (const email in storedUsers) {
                    if (storedUsers[email].uid === userId || userId === 'local_user') {
                        const achievements = storedUsers[email].achievements || [];
                        if (!achievements.includes(achievementId)) {
                            achievements.push(achievementId);
                            storedUsers[email].achievements = achievements;
                            localStorage.setItem('sawfish_users', JSON.stringify(storedUsers));
                            console.log('Achievement awarded (offline):', achievementId);
                            return true;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error awarding achievement:', error);
        }
        return false;
    },
    
    // Check and award achievements based on actions
    checkAchievements: async function(actionType, extraData = {}) {
        if (!UserAuth.currentUser && !UserAuth.isDeveloperMode) return;
        
        const userId = UserAuth.currentUser?.uid || 'developer';
        
        switch (actionType) {
            case 'like_app':
                // Check for first like
                this.awardAchievement(userId, 'first_like');
                // Check for 10 likes
                this.awardAchievement(userId, 'ten_likes');
                break;
                
            case 'submit_rating':
                // Check for first rating
                this.awardAchievement(userId, 'first_rating');
                break;
                
            case 'become_developer':
                // Award developer achievement
                this.awardAchievement(userId, 'be_a_dev');
                break;
                
            case 'upload_avatar':
                // Award profile picture achievement
                this.awardAchievement(userId, 'has_profile_pic');
                break;
                
            case 'update_bio':
                // Award bio achievement if bio is not empty
                if (extraData.bio && extraData.bio.length > 0) {
                    this.awardAchievement(userId, 'has_bio');
                }
                break;
                
            case 'community_post':
                // Award social butterfly
                this.awardAchievement(userId, 'social_butterfly');
                break;
        }
    },
    
    // Get user's achievements
    getUserAchievements: async function(userId) {
        try {
            if (db) {
                const doc = await db.collection('users').doc(userId).get();
                if (doc.exists) {
                    return doc.data().achievements || [];
                }
            } else {
                // Check localStorage
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                for (const email in storedUsers) {
                    if (storedUsers[email].uid === userId) {
                        return storedUsers[email].achievements || [];
                    }
                }
            }
        } catch (error) {
            console.error('Error getting user achievements:', error);
        }
        return [];
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
        this.setupFilterButtons();
        this.loadPosts();
        this.initUserSearch();
    },
    
    // Setup post form submission
    setupPostForm: function() {
        const form = document.getElementById('community-post-form');
        if (!form) return;
        
        const submitBtn = form.querySelector('#community-submit-btn');
        const textarea = form.querySelector('#community-post-input');
        const charCurrent = form.querySelector('#char-current');
        
        // Character count
        if (textarea && charCurrent) {
            textarea.addEventListener('input', () => {
                charCurrent.textContent = textarea.value.length;
            });
        }
        
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
                if (charCurrent) charCurrent.textContent = '0';
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
    
    // Setup filter buttons
    setupFilterButtons: function() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.filterPosts(filter);
            });
        });
    },
    
    // Filter posts by type
    filterPosts: function(filter) {
        const container = document.getElementById('community-posts-container');
        if (!container) return;
        
        const posts = container.querySelectorAll('.community-post');
        posts.forEach(post => {
            if (filter === 'all') {
                post.style.display = '';
            } else if (filter === 'chat') {
                post.style.display = post.dataset.type === 'chat' ? '' : 'none';
            } else if (filter === 'petition') {
                post.style.display = post.dataset.type === 'petition' ? '' : 'none';
            }
        });
    },
    
    // Create a new post
    createPost: async function(content) {
        const petitionCheckbox = document.getElementById('post-is-petition');
        const isPetition = petitionCheckbox ? petitionCheckbox.checked : false;
        
        const post = {
            content: content,
            author: UserAuth.isLoggedIn() ? UserAuth.getReviewUsername() : 'Anonymous',
            isAdmin: UserAuth.isDeveloperMode || DeveloperMode.isLoggedIn,
            timestamp: new Date().toISOString(),
            type: isPetition ? 'petition' : (DeveloperMode.isLoggedIn ? 'admin_alert' : 'chat'),
            isPetition: isPetition
        };
        
        if (!db) {
            // Local storage fallback
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            const newPost = {
                id: Date.now().toString(),
                ...post
            };
            posts.unshift(newPost);
            localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
            this.renderPosts(posts);
            
            // Reset petition checkbox
            if (petitionCheckbox) petitionCheckbox.checked = false;
            
            // Award community post achievement
            if (UserAuth.currentUser) {
                Achievements.checkAchievements('community_post');
            }
            
            return;
        }
        
        try {
            await db.collection(this.COLLECTION_NAME).add(post);
            
            // Reset petition checkbox
            if (petitionCheckbox) petitionCheckbox.checked = false;
            
            // Award community post achievement
            if (UserAuth.currentUser) {
                Achievements.checkAchievements('community_post');
            }
        } catch (error) {
            console.error('Error creating post in Firestore:', error);
            // Fallback to local storage
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            const newPost = {
                id: Date.now().toString(),
                ...post
            };
            posts.unshift(newPost);
            localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
            this.renderPosts(posts);
            
            // Reset petition checkbox
            if (petitionCheckbox) petitionCheckbox.checked = false;
            
            // Award community post achievement
            if (UserAuth.currentUser) {
                Achievements.checkAchievements('community_post');
            }
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
        const container = document.getElementById('community-posts-container');
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
            const postType = post.type || 'chat';
            const isAnonymous = post.author === 'Anonymous';
            const avatar = isAdmin ? 'A' : (isAnonymous ? '?' : post.author.charAt(0).toUpperCase());
            const likeCount = post.likes || 0;
            
            return `
                <article class="community-post" data-type="${postType}" data-id="${post.id}">
                    <div class="community-post-header">
                        <div class="community-post-author">
                            <div class="community-post-avatar ${isAdmin ? 'admin' : ''}">${escapeHtml(avatar)}</div>
                            <div class="community-post-info">
                                <span class="community-post-name">
                                    ${!isAnonymous ? escapeHtml(post.author) : ''}
                                    ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                                    ${isAnonymous ? '<span class="anonymous-badge">Anonymous</span>' : ''}
                                </span>
                                <span class="community-post-date">${formatDate(post.timestamp)}</span>
                            </div>
                        </div>
                        <span class="community-post-type ${postType}">
                            ${postType === 'admin_alert' ? 'Announcement' : (postType === 'petition' ? 'Petition' : 'Chat')}
                        </span>
                    </div>
                    <div class="community-post-content">${escapeHtml(post.content)}</div>
                    <div class="community-post-actions">
                        <button class="community-action-btn like-btn" onclick="CommunityBoard.likePost('${post.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            <span class="like-count">${likeCount}</span>
                        </button>
                        ${DeveloperMode.isLoggedIn ? `
                        <button class="community-action-btn delete-btn" onclick="CommunityBoard.deletePost('${post.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </article>
            `;
        }).join('');
    },
    
    // Like a post
    likePost: function(postId) {
        if (!db) {
            // Local storage fallback for likes
            const likes = JSON.parse(localStorage.getItem('sawfish_post_likes') || '{}');
            const postLikes = likes[postId] || 0;
            likes[postId] = postLikes + 1;
            localStorage.setItem('sawfish_post_likes', JSON.stringify(likes));
            
            // Update the UI immediately
            const likeCount = document.querySelector(`.community-post[data-id="${postId}"] .like-count`);
            if (likeCount) {
                likeCount.textContent = likes[postId];
            }
            
            // Update the like button style
            const likeBtn = document.querySelector(`.community-post[data-id="${postId}"] .like-btn`);
            if (likeBtn) {
                likeBtn.classList.add('liked');
            }
            
            showNotification('Post liked!');
        } else {
            // Firestore implementation
            const postRef = db.collection(this.COLLECTION_NAME).doc(postId);
            postRef.update({
                likes: firebase.firestore.FieldValue.increment(1)
            }).then(() => {
                showNotification('Post liked!');
            }).catch(err => {
                console.error('Error liking post:', err);
                showNotification('Failed to like post');
            });
        }
    },
    
    // Delete a post (developer only)
    deletePost: function(postId) {
        if (!DeveloperMode.isLoggedIn) return;
        
        if (confirm('Are you sure you want to delete this post?')) {
            if (db) {
                db.collection(this.COLLECTION_NAME).doc(postId).delete()
                    .then(() => showNotification('Post deleted'))
                    .catch(err => {
                        console.error('Error deleting post:', err);
                        showNotification('Failed to delete post');
                    });
            } else {
                // Local storage fallback
                const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
                const filtered = posts.filter(p => p.id !== postId);
                localStorage.setItem('sawfish_community_posts', JSON.stringify(filtered));
                this.renderPosts(filtered);
                showNotification('Post deleted');
            }
        }
    },
    
    // ========== USER SEARCH FUNCTIONALITY ==========
    USERS_COLLECTION_NAME: 'sawfish_users',
    allUsers: [],
    
    // Initialize user search
    initUserSearch: function() {
        const searchInput = document.getElementById('community-user-search');
        const usersSection = document.getElementById('community-users-section');
        if (!searchInput) return;
        
        // Show users section immediately on load
        if (usersSection) {
            usersSection.classList.remove('hidden');
        }
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.filterUsers(query);
        });
        
        searchInput.addEventListener('focus', () => {
            // Show all users when focusing on search
            if (!searchInput.value.trim()) {
                this.renderUsers(this.allUsers);
                if (usersSection) {
                    usersSection.classList.remove('hidden');
                }
            }
        });
        
        // Load all users on init
        this.loadUsers();
    },
    
    // Load all users from Firestore
    loadUsers: async function() {
        const usersSection = document.getElementById('community-users-section');
        const usersList = document.getElementById('community-users-list');
        if (!usersSection || !usersList) return;
        
        try {
            if (db) {
                // Load from Firestore
                const snapshot = await db.collection(this.USERS_COLLECTION_NAME).get();
                this.allUsers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } else {
                // Fallback to localStorage
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                this.allUsers = Object.values(storedUsers).map(user => ({
                    id: user.uid,
                    username: user.username,
                    email: user.email,
                    bio: user.bio || '',
                    avatarUrl: user.avatarUrl || null
                }));
            }
            
            // Also add current logged in user if not in list
            if (UserAuth.currentUser && !this.allUsers.find(u => u.id === UserAuth.currentUser.uid)) {
                this.allUsers.push({
                    id: UserAuth.currentUser.uid,
                    username: UserAuth.userProfile?.username || UserAuth.currentUser.displayName,
                    email: UserAuth.currentUser.email,
                    bio: UserAuth.userProfile?.bio || '',
                    avatarUrl: UserAuth.userProfile?.avatarUrl || null
                });
            }
            
            // Show users section
            usersSection.classList.remove('hidden');
            
            // Render all users initially
            this.renderUsers(this.allUsers);
            
        } catch (error) {
            console.error('Error loading users:', error);
        }
    },
    
    // Render users to the list
    renderUsers: function(users) {
        const usersList = document.getElementById('community-users-list');
        if (!usersList) return;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = `
                <div class="community-empty">
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        usersList.innerHTML = users.map(user => {
            const username = user.username || user.email.split('@')[0];
            const initial = username.charAt(0).toUpperCase();
            const avatarUrl = user.avatarUrl;
            const bio = user.bio || 'No bio yet';
            
            return `
                <div class="community-user-card" data-user-id="${user.id}">
                    <div class="community-user-avatar">
                        ${avatarUrl 
                            ? `<img src="${avatarUrl}" alt="${username}" class="user-avatar-img">`
                            : `<div class="user-avatar-initial">${initial}</div>`
                        }
                    </div>
                    <div class="community-user-info">
                        <div class="community-user-name">${username}</div>
                        <div class="community-user-bio">${this.escapeHtml(bio)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Filter users by search query
    filterUsers: function(query) {
        const usersList = document.getElementById('community-users-list');
        const usersSection = document.getElementById('community-users-section');
        if (!usersList || !usersSection) return;
        
        // Always show the section when searching
        usersSection.classList.remove('hidden');
        
        if (!query || !query.trim()) {
            // Show all users if no query or query is empty
            this.renderUsers(this.allUsers);
            return;
        }
        
        const lowerQuery = query.toLowerCase().trim();
        
        const filtered = this.allUsers.filter(user => {
            const username = (user.username || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const bio = (user.bio || '').toLowerCase();
            
            return username.includes(lowerQuery) || 
                   email.includes(lowerQuery) || 
                   bio.includes(lowerQuery);
        });
        
        this.renderUsers(filtered);
    },
    
    // Escape HTML to prevent XSS
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    DEVELOPER_APPS: ['vscodeweb', 'shadertoy', 'neocities', 'piskel', 'tiddlywiki'],
    
    init: function() {
        this.buildSearchIndex();
        this.setupSearchListeners();
    },
    
    // Build search index from app data
    buildSearchIndex: function() {
        this.searchIndex = Object.entries(appData).map(([id, app]) => {
            // Hide developer-only apps from regular users
            const isDeveloperOnly = this.DEVELOPER_APPS.includes(id);
            
            return {
                id,
                name: app.name.toLowerCase(),
                developer: app.developer.toLowerCase(),
                description: app.description.toLowerCase(),
                category: app.category.toLowerCase(),
                tags: `${app.name} ${app.developer} ${app.category}`.toLowerCase(),
                isDeveloperOnly: isDeveloperOnly
            };
        });
    },
    
    // Setup search event listeners
    setupSearchListeners: function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchCount = document.getElementById('search-count');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value, searchResults, searchCount);
            });
            
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length > 0) {
                    this.performSearch(searchInput.value, searchResults, searchCount);
                }
            });
        }
    },
    
    // Perform search
    performSearch: function(query, resultsContainer, countContainer) {
        if (!resultsContainer) return;
        
        const searchQuery = query.toLowerCase().trim();
        
        if (searchQuery.length < 2) {
            resultsContainer.classList.add('hidden');
            if (countContainer) countContainer.textContent = '0';
            return;
        }
        
        // Filter results based on developer mode
        const results = this.searchIndex.filter(item => {
            // item.name, item.developer, item.tags are already lowercase from buildSearchIndex
            
            let matchesQuery = false;
            
            if (searchQuery.length <= 3) {
                // For short queries (2-3 chars), use more permissive matching
                // Allow apps that START with the query string
                const nameWords = item.name.split(' ');
                const devWords = item.developer.split(' ');
                
                matchesQuery = nameWords.some(word => word.startsWith(searchQuery)) ||
                               devWords.some(word => word.startsWith(searchQuery)) ||
                               item.tags.split(' ').some(tag => tag.startsWith(searchQuery));
            } else {
                // For longer queries, use more flexible matching
                matchesQuery = item.name.includes(searchQuery) ||
                               item.name.split(' ').some(word => word.startsWith(searchQuery)) ||
                               item.developer.includes(searchQuery) ||
                               item.tags.includes(searchQuery);
            }
            
            // Hide developer-only apps from non-developers
            const canSeeDeveloperApps = UserAuth.isDeveloperMode || DeveloperMode.isLoggedIn;
            const isVisible = !item.isDeveloperOnly || canSeeDeveloperApps;
            
            return matchesQuery && isVisible;
        }).slice(0, 10);
        
        if (countContainer) {
            countContainer.textContent = results.length;
        }
        
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
// UPDATE CHECKER
// ============================================================
const UpdateChecker = {
    init: function() {
        this.checkForUpdates();
    },
    
    checkForUpdates: async function() {
        try {
            const response = await fetch(VERSION_CHECK_URL + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (data.version && data.version !== APP_VERSION) {
                    updateAppStatus('update');
                } else {
                    updateAppStatus('ready');
                }
            } else {
                updateAppStatus('ready');
            }
        } catch (error) {
            console.log('Version check failed, assuming up to date');
            updateAppStatus('ready');
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
    
    return `<span class="numeric-rating ${colorClass}">${formattedRating} ⭐</span>`;
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
        updateDevOnlyElements();
    },
    
    toggleLogin: function() {
        if (this.isLoggedIn) {
            this.openDashboard();
        } else {
            this.openLoginModal();
        }
    },
    
    openLoginModal: function() {
        const modal = document.getElementById('developer-login-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            
            // Focus password input
            setTimeout(() => {
                const passwordInput = document.getElementById('developer-password');
                if (passwordInput) passwordInput.focus();
            }, 100);
        }
    },
    
    closeLoginModal: function() {
        const modal = document.getElementById('developer-login-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            
            // Clear password
            const passwordInput = document.getElementById('developer-password');
            if (passwordInput) passwordInput.value = '';
        }
    },
    
    login: function(password) {
        if (password === this.DEVELOPER_PASSWORD) {
            this.isLoggedIn = true;
            sessionStorage.setItem('developer_logged_in', 'true');
            
            // Set UserAuth developer mode
            UserAuth.isDeveloperMode = true;
            
            this.closeLoginModal();
            this.updateLoginButton();
            updateDevOnlyElements();
            this.openDashboard();
            
            showNotification('Developer mode activated');
            return true;
        }
        return false;
    },
    
    logout: function() {
        this.isLoggedIn = false;
        sessionStorage.removeItem('developer_logged_in');
        
        // Clear UserAuth developer mode
        UserAuth.isDeveloperMode = false;
        
        this.closeDashboard();
        this.updateLoginButton();
        updateDevOnlyElements();
        
        showNotification('Developer mode deactivated');
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
        // Exit developer mode when closing dashboard
        this.logout();
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
    
    loadAnalytics: async function() {
        const statTotalReviews = document.getElementById('stat-total-reviews');
        const statTotalApps = document.getElementById('stat-total-apps');
        const statAvgRating = document.getElementById('stat-avg-rating');
        const statDevResponses = document.getElementById('stat-developer-responses');
        const topAppsList = document.getElementById('top-rated-apps');
        
        if (statTotalApps) statTotalApps.textContent = Object.keys(appData).length;
        
        try {
            const allReviews = await FirestoreComments.getAllReviews();
            if (statTotalReviews) statTotalReviews.textContent = allReviews.length;
            
            // Calculate average rating
            let totalRating = 0;
            let ratingCount = 0;
            allReviews.forEach(review => {
                if (typeof review.rating === 'number') {
                    totalRating += review.rating;
                    ratingCount++;
                }
            });
            if (statAvgRating && ratingCount > 0) {
                statAvgRating.textContent = (totalRating / ratingCount).toFixed(1);
            }
            
            // Count developer responses
            const devResponses = allReviews.filter(r => r.isDeveloper === true);
            if (statDevResponses) statDevResponses.textContent = devResponses.length;
            
            // Get top rated apps
            const appRatings = [];
            for (const appId of Object.keys(appData)) {
                const avgRating = await FirestoreComments.getAverageRating(appId);
                if (avgRating !== null) {
                    appRatings.push({ id: appId, rating: avgRating, name: appData[appId].name });
                }
            }
            appRatings.sort((a, b) => b.rating - a.rating);
            
            if (topAppsList && appRatings.length > 0) {
                topAppsList.innerHTML = appRatings.slice(0, 5).map((app, i) => `
                    <div class="top-rated-item">
                        <span class="top-ranked">#${i + 1}</span>
                        <span class="top-app-name">${app.name}</span>
                        <span class="top-app-rating">${app.rating.toFixed(1)}</span>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    },
    
    loadAppManager: function() {
        const appList = document.getElementById('app-manager-list');
        if (!appList) return;
        
        appList.innerHTML = Object.entries(appData).map(([id, app]) => `
            <div class="app-manager-item">
                <img src="${app.icon}" alt="${app.name}" class="app-manager-icon">
                <div class="app-manager-info">
                    <span class="app-manager-name">${app.name}</span>
                    <span class="app-manager-category">${app.category}</span>
                </div>
                <div class="app-manager-actions">
                    <button class="app-manager-btn edit" onclick="DeveloperMode.editApp('${id}')">Edit</button>
                </div>
            </div>
        `).join('');
    },
    
    editApp: function(appId) {
        showNotification('Edit app: ' + appId);
    },
    
    loadAnnouncements: function() {
        const announcementList = document.getElementById('announcement-list');
        if (!announcementList) return;
        
        // Load from localStorage or Firestore
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        
        if (announcements.length === 0) {
            announcementList.innerHTML = '<p class="muted">No announcements yet</p>';
        } else {
            announcementList.innerHTML = announcements.map(a => `
                <div class="announcement-item">
                    <div class="announcement-item-header">
                        <span class="announcement-item-title">${escapeHtml(a.title)}</span>
                        <span class="announcement-item-type type-${a.type}">${a.type}</span>
                    </div>
                    <p class="announcement-item-text">${escapeHtml(a.text)}</p>
                </div>
            `).join('');
        }
    },
    
    publishAnnouncement: function() {
        const titleInput = document.getElementById('announcement-title');
        const textInput = document.getElementById('announcement-text');
        const typeSelect = document.getElementById('announcement-type');
        
        const title = titleInput?.value.trim();
        const text = textInput?.value.trim();
        const type = typeSelect?.value || 'info';
        
        if (!title || !text) {
            showNotification('Please fill in title and message');
            return;
        }
        
        const announcement = {
            title,
            text,
            type,
            timestamp: new Date().toISOString()
        };
        
        // Store announcement
        const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
        announcements.unshift(announcement);
        localStorage.setItem('sawfish_announcements', JSON.stringify(announcements));
        
        // Clear form
        if (titleInput) titleInput.value = '';
        if (textInput) textInput.value = '';
        
        this.loadAnnouncements();
        showNotification('Announcement published!');
    },
    
    loadModeration: function() {
        const moderationList = document.getElementById('moderation-list');
        if (!moderationList) return;
        
        moderationList.innerHTML = '<p class="muted">Select reviews from the analytics tab to moderate</p>';
    }
};

// ============================================================
// UPDATE DEVELOPER-ONLY ELEMENTS
// ============================================================
function updateDevOnlyElements() {
    const isDeveloper = UserAuth.isDeveloperMode || DeveloperMode.isLoggedIn;
    
    // Update developer-only app visibility
    const developerApps = ['vscodeweb', 'shadertoy', 'neocities', 'piskel', 'tiddlywiki'];
    
    developerApps.forEach(appId => {
        const card = document.querySelector(`[data-app="${appId}"]`);
        if (card) {
            card.style.display = isDeveloper ? '' : 'none';
        }
    });
    
    // Update body class for CSS styling
    if (isDeveloper) {
        document.body.classList.add('developer-mode-active');
    } else {
        document.body.classList.remove('developer-mode-active');
    }
}

// ============================================================
// MINECRAFT WARNING SYSTEM
// ============================================================
const minecraftWarningSystem = {
    showWarning: function(appName, appLink) {
        const overlay = document.getElementById('minecraft-warning-overlay');
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
        
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.setAttribute('aria-hidden', 'false');
        }
    },
    
    closeWarning: function() {
        const overlay = document.getElementById('minecraft-warning-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }
};

// ============================================================
// APP DATA
// ============================================================
const appData = {
    // Games
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish",
        icon: "icons/game-portal.png",
        category: "Games / Launcher",
        description: "Central launcher for all approved Sawfish games in one place.",
        features: "Quick launch for all games, organized categories, search functionality, favorites list, recent games history, and offline support for selected games.",
        additional: "This is your go-to hub for accessing all games in the Sawfish ecosystem. Games are carefully curated for school safety.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Categories"]
    },
    chat: {
        name: "Chat App",
        developer: "Jimeneutron",
        icon: "icons/chat.png",
        category: "Social / Communication",
        description: "Real-time messaging for students with rooms and channels.",
        features: "Instant messaging, room creation, channel subscriptions, message history, emoji reactions, and @mentions.",
        additional: "Designed for school collaboration. All messages are logged for safety. Respect the community guidelines.",
        link: "https://jimeneutron.github.io/chatapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Channel+View"]
    },
    call: {
        name: "Call App",
        developer: "Sawfish",
        icon: "icons/call.png",
        category: "Social / Communication",
        description: "Fast, simple browser-based voice calling interface.",
        features: "One-click voice calls, no registration required, low latency audio, works on all modern browsers.",
        additional: "For quick voice conversations with classmates. Ideal for study groups and project discussions.",
        link: "https://the-sawfish.github.io/call-app/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Controls"]
    },
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish",
        icon: "icons/circle.png",
        category: "Games / Puzzle",
        description: "Quick reflex challenge - draw the most perfect circle you can.",
        features: "Instant play, accuracy scoring, global leaderboard, practice mode, and streak bonuses.",
        additional: "Often used as a hack - clicking the OFFLINE tag reveals the hack site password.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Accuracy+Score"]
    },
    minecraft: {
        name: "Minecraft Web (Beta)",
        developer: "Zardoy",
        icon: "icons/minecraft.png",
        category: "Games / Sandbox",
        description: "The iconic sandbox building game, now in your browser. Build, explore, and create without downloads.",
        features: "Browser-based Minecraft, multiplayer servers, creative/survival modes, skin support, and cross-device save sync.",
        additional: "NOTE: Multiplayer requires re-guesting/refresh to work properly. This is a web version limitation. Single player mode available but crafting is disabled in web version.",
        link: "https://zardoy.github.io/minecraft-web-client/",
        screenshots: ["IMG_0610.jpeg", "IMG_0611.jpeg"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "Rother",
        icon: "icons/sandboxels.png",
        category: "Games / Simulation",
        description: "Falling sand physics simulator with over 500 elements.",
        features: "500+ elements, realistic physics, cellular automata, color mixing, and element interactions.",
        additional: "Excellent for learning about physics and creating art. Very satisfying to play with.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Physics", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Element+Interactions"]
    },
    blockblast: {
        name: "Block Blast",
        developer: "Sawfish",
        icon: "icons/blockblast.png",
        category: "Games / Puzzle",
        description: "Fast-paced block placement puzzle game with competitive scoring.",
        features: "Classic block puzzle mechanics, competitive scoring, daily challenges, and offline play.",
        additional: "Often used as a hack - clicking the OFFLINE tag reveals the hack site password.",
        link: "https://the-sawfish.github.io/blockblast/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Placement"]
    },
    run3: {
        name: "Run 3",
        developer: "Nitrome",
        icon: "icons/run3.png",
        category: "Games / Platformer",
        description: "Endless space runner with gravity-shifting tunnel gameplay.",
        features: "Infinite tunnel running, gravity shifting, character unlocking, achievements, and upgrade system.",
        additional: "One of the most popular unblocked games. Works great on school networks.",
        link: "https://the-sawfish.github.io/Run3Final/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Run+3+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tunnel+Navigation"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Jimeneutron",
        icon: "icons/syrup.png",
        category: "Games / Launcher",
        description: "Alternative game launcher with unique browser-based titles.",
        features: "Syrup's flagship games including Nitter and other titles, integrated launcher, achievement tracking.",
        additional: "Provides access to Syrup's suite of unique browser games. Often hosts events and challenges.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Available+Games"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "Bob The Robber Team",
        icon: "icons/bobtherobber.png",
        category: "Games / Puzzle",
        description: "Stealth puzzle game series. Infiltrate locations and steal treasure.",
        features: "Stealth mechanics, puzzle-solving, level progression, character upgrades, and multiple installments.",
        additional: "Fun puzzle series that requires thinking ahead. Each level is a new challenge.",
        link: "https://the-sawfish.github.io/seraph/games/bobtherobber/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Puzzles"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Retro Bowl Team",
        icon: "icons/retrobowl.png",
        category: "Games / Sports",
        description: "Classic American football management game with retro aesthetics.",
        features: "Team management, game simulation, player trading, stadium upgrades, and retro graphics.",
        additional: "Provides the classic football gaming experience with modern gameplay mechanics. Perfect for sports fans.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Team+Management"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Paper Io Team",
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
        link: "https://codechefvit.github.io/DevTris/",
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
    
    // Developer-only apps (only visible when developer mode is active)
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
    hack: {
        name: "Hack Stuff",
        developer: "Sawfish",
        icon: "icons/hack.png",
        category: "Miscellaneous / Tools",
        description: "Restricted utilities and experimental tools for advanced users. Access various hacking simulations and security testing tools in a safe environment.",
        features: "Password generator, cipher tools, hash generator, and various security utilities for educational purposes.",
        additional: "For educational purposes only. These tools are designed to help students understand cybersecurity concepts. DO NOT use for malicious purposes.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Tools+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Password+Generator"]
    },
    securecomms: {
        name: "Secure Communication",
        developer: "Jimeneutron",
        icon: "icons/IMG_0636.jpeg",
        category: "Miscellaneous / Tools",
        description: "Encrypt and decrypt messages securely. Protect your private conversations with military-grade encryption.",
        features: "AES-256 encryption, message encoding/decoding, secure key generation, and base64 conversion tools.",
        additional: "Learn about encryption and data security. Perfect for understanding how modern encryption works while keeping your messages private.",
        link: "https://jimeneutron.github.io/SecureCommunication/",
        screenshots: ["IMG_0634.jpeg", "IMG_0635.jpeg"]
    },
    2048: {
        name: "2048",
        developer: "Gabriele Cirulli",
        icon: "icons/2048.png",
        category: "Games / Puzzle",
        description: "Classic number puzzle game. Combine matching tiles to reach the 2048 tile and win the game.",
        features: "Simple swipe controls, score tracking, undo functionality, and mobile-friendly design.",
        additional: "One of the most popular puzzle games of all time. Train your brain while having fun combining numbers.",
        link: "https://the-sawfish.github.io/seraph/games/2048/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Game+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Win+Screen"]
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
// APP STATE
// ============================================================
const AppState = {
    isPWA: false,
    isFirstVisit: true,
    currentPage: 'home',
    expandedApp: null,
    reviewSubscriptions: {}
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
    console.log('DOM loaded, initializing app...');
    initializeElements();
    detectPWA();
    setupEventListeners();
    loadAllRatings();
    checkFirstVisit();
    removeLoadingClass();
    
    // Initialize modules
    console.log('Initializing UserAuth...');
    UserAuth.init();
    console.log('Initializing DeveloperMode...');
    DeveloperMode.init();
    console.log('Initializing SearchSystem...');
    SearchSystem.init();
    console.log('Initializing UpdateChecker...');
    UpdateChecker.init();
    console.log('Initializing CommunityBoard...');
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
    // Check if running in standalone mode (installed as PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isStandaloneiOS = window.navigator.standalone === true;
    const isAndroidApp = document.referrer.includes('android-app://');
    
    AppState.isPWA = isStandalone || isStandaloneiOS || isAndroidApp;
    
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
    setupMinecraftWarningListeners();
    
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
    // Close/exit dashboard button - actually exits developer mode
    const closeBtn = document.getElementById('developer-close-dashboard');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            DeveloperMode.logout();
        });
    }
    
    // Dashboard navigation
    const navBtns = document.querySelectorAll('.developer-nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.developerTab;
            switchDeveloperTab(tab);
        });
    });
    
    // Add new app button
    const addAppBtn = document.getElementById('add-new-app-btn');
    if (addAppBtn) {
        addAppBtn.addEventListener('click', () => DeveloperMode.showAddAppForm());
    }
    
    // Publish announcement button
    const publishBtn = document.getElementById('publish-announcement');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => DeveloperMode.publishAnnouncement());
    }
    
    // Developer login button in sidebar
    const devLoginBtn = document.getElementById('developer-login-button');
    if (devLoginBtn) {
        devLoginBtn.addEventListener('click', () => DeveloperMode.toggleLogin());
    }
    
    // Developer login modal handlers
    const devCancelBtn = document.getElementById('developer-cancel');
    if (devCancelBtn) {
        devCancelBtn.addEventListener('click', () => DeveloperMode.closeLoginModal());
    }
    
    const devSubmitBtn = document.getElementById('developer-submit');
    if (devSubmitBtn) {
        devSubmitBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('developer-password');
            if (passwordInput) {
                const success = DeveloperMode.login(passwordInput.value);
                if (!success) {
                    showNotification('Invalid developer password');
                    passwordInput.value = '';
                }
            }
        });
    }
    
    // Exit developer mode button in dashboard
    const exitDevBtn = document.getElementById('exit-developer-mode');
    if (exitDevBtn) {
        exitDevBtn.addEventListener('click', () => {
            DeveloperMode.logout();
        });
    }
    
    // Close modal on backdrop click
    const devModal = document.getElementById('developer-login-modal');
    if (devModal) {
        const backdrop = devModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => DeveloperMode.closeLoginModal());
        }
    }
    
    // Enter key to submit developer password
    const devPasswordInput = document.getElementById('developer-password');
    if (devPasswordInput) {
        devPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const success = DeveloperMode.login(devPasswordInput.value);
                if (!success) {
                    showNotification('Invalid developer password');
                    devPasswordInput.value = '';
                }
            }
        });
    }
}

function setupAuthModalListeners() {
    // Already handled in UserAuth.setupAuthListeners()
    // Additional auth modal setup can go here
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

function setupMinecraftWarningListeners() {
    const cancelBtn = document.getElementById('minecraft-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => MinecraftReGuest.closeWarning());
    }
    
    const overlay = document.getElementById('minecraft-warning-overlay');
    if (overlay) {
        const backdrop = overlay.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => MinecraftReGuest.closeWarning());
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
        MinecraftReGuest.showWarning(appId, app.name, app.link);
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
        
        if (!UserAuth.canRate()) {
            alert('Please log in to leave a review');
            UserAuth.openAuthModal();
            return;
        }
        
        submitReview(appId, selectedRating, comment || '');
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
        
        // Award achievement for rating
        Achievements.checkAchievements('submit_rating');
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
                ${review.comment ? `<div class="comment-body">${escapeHtml(review.comment)}</div>` : ''}
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
window.CommunityBoard = CommunityBoard;

console.log('Sawfish App Store JavaScript loaded successfully');
