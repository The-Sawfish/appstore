// ============================================================
// SAWFISH APP STORE - APPLICATION JAVASCRIPT
// Full Logic for PWA, Navigation, Ratings, Reviews, Firestore
// Enhanced with Firebase Authentication, Profile Pictures, Search
// Author: Eric Zhu / Sawfish Developer Group
// Date: January 10, 2026
// ============================================================

// ============================================================
// VERSION CONFIGURATION
// ============================================================
const APP_VERSION = '2.8.0';
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
let db = null;
let auth = null;
let storage = null;
let app = null;

// Force Firebase initialization - NO LOCALSTORAGE FALLBACK FOR REVIEWS
function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        return false;
    }
    
    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
        console.error('Firebase config not properly set');
        return false;
    }
    
    try {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        
        // Configure Firestore settings for better reliability
        db.settings({
            experimentalForceLongPolling: false,
            merge: true
        });
        
        console.log('Firebase initialized successfully');
        console.log('Project ID:', firebaseConfig.projectId);
        
        // Set up auth persistence
        if (auth) {
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log('Auth persistence set to LOCAL');
                })
                .catch((error) => {
                    console.error('Error setting auth persistence:', error);
                });
            
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
        
        return true;
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        return false;
    }
}

// Initialize Firebase immediately
const firebaseInitialized = initializeFirebase();

if (!firebaseInitialized) {
    console.error('CRITICAL: Firebase failed to initialize. Reviews will not work until Firebase is available.');
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
    
    init: function() {
        this.loadUserSession();
        this.setupAuthListeners();
        this.updateAuthUI();
    },
    
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
            
            const devSession = sessionStorage.getItem('developer_logged_in');
            this.isDeveloperMode = devSession === 'true';
        } catch (error) {
            console.error('Error loading session:', error);
        }
    },
    
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
    
    clearSession: function() {
        this.currentUser = null;
        this.userProfile = null;
        this.isDeveloperMode = false;
        localStorage.removeItem('sawfish_user');
        localStorage.removeItem('sawfish_profile');
        sessionStorage.removeItem('developer_logged_in');
    },
    
    setupAuthListeners: function() {
        console.log('Setting up auth listeners...');
        
        const loginForm = document.getElementById('login-form');
        console.log('Login form found:', !!loginForm);
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        const signupForm = document.getElementById('signup-form');
        console.log('Signup form found:', !!signupForm);
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }
        
        const resetForm = document.getElementById('reset-form');
        console.log('Reset form found:', !!resetForm);
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handlePasswordReset(e));
        }
        
        const authTabs = document.querySelectorAll('.auth-tab');
        authTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.authTab;
                
                authTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
                document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
                document.getElementById('reset-form').style.display = tab === 'reset' ? 'block' : 'none';
                
                const title = document.getElementById('auth-modal-title');
                if (title) {
                    if (tab === 'login') title.textContent = 'Sign In';
                    else if (tab === 'signup') title.textContent = 'Create Account';
                    else if (tab === 'reset') title.textContent = 'Reset Password';
                }
            });
        });
        
        const userProfileBtn = document.getElementById('user-profile-button');
        if (userProfileBtn) {
            userProfileBtn.addEventListener('click', () => this.handleProfileButtonClick());
        }
        
        const logoutBtn = document.getElementById('profile-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        const profileSaveBtn = document.getElementById('profile-save-btn');
        if (profileSaveBtn) {
            profileSaveBtn.addEventListener('click', () => this.saveProfileChanges());
        }
        
        const profileCancelBtn = document.getElementById('profile-cancel-btn');
        if (profileCancelBtn) {
            profileCancelBtn.addEventListener('click', () => this.closeProfileModal());
        }
        
        const avatarUpload = document.getElementById('avatar-upload-input');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => this.handleProfilePictureUpload(e));
        }
        
        const profileClose = document.getElementById('profile-close');
        if (profileClose) {
            profileClose.addEventListener('click', () => this.closeProfileModal());
        }
        
        const authCancel = document.getElementById('auth-cancel');
        if (authCancel) {
            authCancel.addEventListener('click', () => this.closeAuthModal());
        }
        
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            const backdrop = authModal.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', () => this.closeAuthModal());
            }
        }
        
        // User profile modal close button
        const userProfileClose = document.getElementById('user-profile-modal-close');
        if (userProfileClose) {
            userProfileClose.addEventListener('click', () => this.closeUserProfileModal());
        }
        
        // User profile modal backdrop
        const userProfileModal = document.getElementById('user-profile-modal');
        if (userProfileModal) {
            const backdrop = userProfileModal.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', () => this.closeUserProfileModal());
            }
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const authModal = document.getElementById('auth-modal');
                if (authModal && !authModal.classList.contains('hidden')) {
                    this.closeAuthModal();
                }
                const userProfileModal = document.getElementById('user-profile-modal');
                if (userProfileModal && !userProfileModal.classList.contains('hidden')) {
                    this.closeUserProfileModal();
                }
            }
        });
    },
    
    handleProfileButtonClick: function() {
        if (this.isLoggedIn()) {
            this.openProfileModal();
        } else {
            this.openAuthModal();
        }
    },
    
    openProfileModal: function() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        
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
        
        this.updateProfileAvatar();
        
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
    
    closeProfileModal: function() {
        const modal = document.getElementById('profile-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
    closeUserProfileModal: function() {
        const modal = document.getElementById('user-profile-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
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
            
            this.closeProfileModal();
        }
    },
    
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
                
                DeveloperMode.isLoggedIn = true;
                DeveloperMode.updateLoginButton();
                updateDevOnlyElements();
                
                Achievements.checkAchievements('be_a_dev');
                
                showNotification('Developer mode activated');
                return;
            }
            
            if (auth) {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                await this.getOrCreateUserProfile(user);
                
                this.saveUserSession();
                this.closeAuthModal();
                this.updateAuthUI();
                showNotification('Welcome back!');
            } else {
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
                        email: email,
                        bio: storedUsers[email].bio || '',
                        achievements: storedUsers[email].achievements || [],
                        avatarUrl: storedUsers[email].avatarUrl || null
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
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                await user.updateProfile({ displayName: name });
                await user.sendEmailVerification();
                
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
                    createdAt: new Date().toISOString(),
                    achievements: ['first_time']
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
                    email: email,
                    achievements: ['first_time']
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
    
    handleLogout: async function() {
        try {
            if (auth && this.currentUser && !this.isDeveloperMode) {
                await auth.signOut();
            }
            
            this.clearSession();
            this.closeProfileModal();
            this.updateAuthUI();
            
            if (DeveloperMode.isLoggedIn) {
                DeveloperMode.isLoggedIn = false;
                DeveloperMode.updateLoginButton();
                updateDevOnlyElements();
            }
            
            showNotification('Logged out successfully');
            switchTab('home');
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Logout failed');
        }
    },
    
    getOrCreateUserProfile: async function(user) {
        if (!db) return;
        
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            
            if (doc.exists) {
                this.userProfile = doc.data();
            } else {
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
    
    saveUserProfile: async function(uid) {
        if (!db || !this.userProfile) return;
        
        try {
            await db.collection('users').doc(uid).set(this.userProfile, { merge: true });
        } catch (error) {
            console.error('Error saving user profile:', error);
        }
    },
    
    handleProfilePictureUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const previewInitial = document.getElementById('upload-preview-initial');
        const previewImg = document.getElementById('upload-preview-img');
        
        if (!this.currentUser) {
            showNotification('Please log in to upload a profile picture');
            return;
        }
        
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Data = e.target.result;
                
                this.userProfile = this.userProfile || {};
                this.userProfile.avatarUrl = base64Data;
                this.saveUserSession();
                
                if (previewInitial) {
                    previewInitial.textContent = '';
                    previewInitial.style.display = 'none';
                }
                if (previewImg) {
                    previewImg.src = base64Data;
                    previewImg.style.display = 'block';
                }
                
                this.updateProfileAvatar();
                
                const sidebarAvatar = document.getElementById('sidebar-avatar');
                if (sidebarAvatar) {
                    sidebarAvatar.innerHTML = `<img src="${base64Data}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                }
                
                Achievements.checkAchievements('upload_avatar');
                
                if (db && this.currentUser) {
                    db.collection('users').doc(this.currentUser.uid).set({
                        avatarUrl: base64Data
                    }, { merge: true })
                    .then(() => {
                        console.log('Profile picture saved to Firestore');
                    })
                    .catch((error) => {
                        console.error('Error saving profile picture to Firestore:', error);
                    });
                }
                
                // Also save to localStorage for offline mode
                if (!db && this.currentUser && this.currentUser.email) {
                    const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                    if (storedUsers[this.currentUser.email]) {
                        storedUsers[this.currentUser.email].avatarUrl = base64Data;
                        localStorage.setItem('sawfish_users', JSON.stringify(storedUsers));
                    }
                }
                
                showNotification('Profile picture updated!');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Upload failed. Please try again.');
        }
    },
    
    getDefaultAvatar: function() {
        const username = this.userProfile?.username || 'User';
        const initial = username.charAt(0).toUpperCase();
        return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#4da3ff"/><text x="50" y="50" text-anchor="middle" dy="0.35em" fill="white" font-size="50" font-family="sans-serif">${initial}</text></svg>`)}`;
    },
    
    showError: function(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, 5000);
        }
    },
    
    openAuthModal: function() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    },
    
    closeAuthModal: function() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            
            const forms = modal.querySelectorAll('form');
            forms.forEach(f => f.reset());
            
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('reset-form').style.display = 'none';
            
            const errorDiv = document.getElementById('auth-error');
            const successDiv = document.getElementById('auth-success');
            if (errorDiv) errorDiv.classList.add('hidden');
            if (successDiv) successDiv.classList.add('hidden');
            
            const authTabs = document.querySelectorAll('.auth-tab');
            authTabs.forEach((btn, index) => {
                btn.classList.toggle('active', index === 0);
            });
            
            const title = document.getElementById('auth-modal-title');
            if (title) title.textContent = 'Sign In';
        }
    },
    
    updateAuthUI: function() {
        const profileStatusText = document.getElementById('profile-status-text');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        
        if (this.currentUser) {
            const name = this.userProfile?.username || this.currentUser.displayName || 'User';
            
            if (profileStatusText) profileStatusText.textContent = name;
            
            if (this.userProfile?.avatarUrl) {
                if (sidebarAvatar) {
                    sidebarAvatar.innerHTML = `<img src="${this.userProfile.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                }
            } else {
                const initial = name.charAt(0).toUpperCase();
                if (sidebarAvatar) {
                    sidebarAvatar.innerHTML = '';
                    sidebarAvatar.textContent = initial;
                }
            }
            
            const userProfileBtn = document.getElementById('user-profile-button');
            if (userProfileBtn) {
                userProfileBtn.classList.add('logged-in');
            }
        } else {
            if (profileStatusText) profileStatusText.textContent = 'Sign In';
            if (sidebarAvatar) {
                sidebarAvatar.innerHTML = '';
                sidebarAvatar.textContent = '?';
            }
            
            const userProfileBtn = document.getElementById('user-profile-button');
            if (userProfileBtn) {
                userProfileBtn.classList.remove('logged-in');
            }
        }
    },
    
    isLoggedIn: function() {
        return this.currentUser !== null;
    },
    
    canRate: function() {
        return this.isLoggedIn() || this.isDeveloperMode;
    },
    
    getReviewUsername: function() {
        if (this.isDeveloperMode) return 'Developer';
        return this.userProfile?.username || this.currentUser?.displayName || 'Anonymous';
    },
    
    getReviewAvatar: function() {
        if (this.isDeveloperMode) return null;
        return this.userProfile?.avatarUrl;
    },
    
    openUserProfile: function(userId) {
        this.loadUserProfileData(userId);
    },
    
    loadUserProfileData: async function(userId) {
        const modal = document.getElementById('user-profile-modal');
        if (!modal) return;
        
        const nameEl = document.getElementById('user-profile-name');
        const bioEl = document.getElementById('user-profile-bio');
        const avatarEl = document.getElementById('user-profile-avatar');
        const achievementsEl = document.getElementById('user-profile-achievements');
        const statsEl = document.getElementById('user-profile-stats');
        const memberSinceEl = document.getElementById('user-profile-member-since');
        
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        try {
            let userData;
            let achievements = [];
            let postCount = 0;
            
            if (db) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                    achievements = userData.achievements || [];
                }
                
                // Get post count
                const postsSnapshot = await db.collection('sawfish_community_posts')
                    .where('author', '==', userData?.username || 'Unknown')
                    .get();
                postCount = postsSnapshot.size;
            } else {
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                for (const email in storedUsers) {
                    if (storedUsers[email].uid === userId) {
                        userData = storedUsers[email];
                        achievements = userData.achievements || [];
                        break;
                    }
                }
                
                // Get post count from localStorage
                const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
                postCount = posts.filter(p => p.author === userData?.username).length;
            }
            
            // Update name
            if (nameEl) {
                nameEl.textContent = userData?.username || 'Unknown User';
            }
            
            // Update bio
            if (bioEl) {
                bioEl.textContent = userData?.bio || 'No bio yet';
                bioEl.style.display = userData?.bio ? 'block' : 'none';
            }
            
            // Update avatar
            if (avatarEl) {
                const initial = (userData?.username || 'U').charAt(0).toUpperCase();
                if (userData?.avatarUrl) {
                    avatarEl.innerHTML = `<img src="${userData.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    avatarEl.textContent = initial;
                }
            }
            
            // Update achievements
            if (achievementsEl) {
                achievementsEl.innerHTML = '';
                achievements.forEach(achId => {
                    const ach = Achievements.getAchievementInfo(achId);
                    const badge = document.createElement('span');
                    badge.className = 'achievement-badge-circle';
                    badge.title = `${ach.name}: ${ach.description}`;
                    badge.innerHTML = ach.icon;
                    badge.dataset.achievementId = achId;
                    achievementsEl.appendChild(badge);
                });
                
                // Add click handlers for achievement details
                achievementsEl.querySelectorAll('.achievement-badge-circle').forEach(badge => {
                    badge.addEventListener('click', () => {
                        const achId = badge.dataset.achievementId;
                        const ach = Achievements.getAchievementInfo(achId);
                        showNotification(`${ach.icon} ${ach.name}: ${ach.description}`);
                    });
                });
            }
            
            // Update stats
            if (statsEl) {
                statsEl.innerHTML = `
                    <div class="stat-item">
                        <span class="stat-value">${achievements.length}</span>
                        <span class="stat-label">Achievements</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${postCount}</span>
                        <span class="stat-label">Posts</span>
                    </div>
                `;
            }
            
            // Update member since
            if (memberSinceEl && userData?.createdAt) {
                const createdDate = new Date(userData.createdAt);
                const now = new Date();
                const diffTime = Math.abs(now - createdDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffMonths = Math.floor(diffDays / 30);
                const diffYears = Math.floor(diffDays / 365);
                
                let timeAgo = '';
                if (diffYears > 0) {
                    timeAgo = `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
                } else if (diffMonths > 0) {
                    timeAgo = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
                } else if (diffDays > 0) {
                    timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                } else {
                    timeAgo = 'Today';
                }
                
                memberSinceEl.innerHTML = `
                    <span class="member-since-label">Member since</span>
                    <span class="member-since-date">${createdDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    <span class="member-since-time">(${timeAgo})</span>
                `;
            }
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            showNotification('Failed to load user profile');
        }
    }
};

// ============================================================
// ACHIEVEMENTS SYSTEM
// ============================================================
const Achievements = {
    ACHIEVEMENTS: {
        'first_time': {
            name: 'First Steps',
            icon: '👋',
            description: 'First time visiting Sawfish App Store'
        },
        'first_rating': {
            name: 'Critic',
            icon: '💬',
            description: 'Left your first rating'
        },
        'five_ratings': {
            name: 'Active Reviewer',
            icon: '⭐',
            description: 'Rated 5 apps'
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
        },
        'started_petition': {
            name: 'Voice of Change',
            icon: '📢',
            description: 'Started a petition'
        },
        'resolved_petition': {
            name: 'Problem Solver',
            icon: '✅',
            description: 'Resolved a petition as developer'
        },
        'petition_success': {
            name: 'Champion',
            icon: '🏆',
            description: 'Had a petition successfully resolved'
        }
    },
    
    getAchievementInfo: function(achievementId) {
        return this.ACHIEVEMENTS[achievementId] || {
            name: 'Unknown',
            icon: '❓',
            description: 'Unknown achievement'
        };
    },
    
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
                        
                        const achievement = this.ACHIEVEMENTS[achievementId];
                        showNotification(`Achievement Unlocked: ${achievement.icon} ${achievement.name}`);
                        return true;
                    }
                }
            } else {
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                for (const email in storedUsers) {
                    if (storedUsers[email].uid === userId || userId === 'local_user') {
                        const achievements = storedUsers[email].achievements || [];
                        if (!achievements.includes(achievementId)) {
                            achievements.push(achievementId);
                            storedUsers[email].achievements = achievements;
                            localStorage.setItem('sawfish_users', JSON.stringify(storedUsers));
                            console.log('Achievement awarded (offline):', achievementId);
                            
                            const achievement = this.ACHIEVEMENTS[achievementId];
                            showNotification(`Achievement Unlocked: ${achievement.icon} ${achievement.name}`);
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
    
    checkAchievements: async function(actionType, extraData = {}) {
        if (!UserAuth.currentUser && !UserAuth.isDeveloperMode) return;
        
        const userId = UserAuth.currentUser?.uid || 'developer';
        
        switch (actionType) {
            case 'submit_rating':
                this.awardAchievement(userId, 'first_rating');
                break;
            case 'be_a_dev':
                this.awardAchievement(userId, 'be_a_dev');
                break;
            case 'upload_avatar':
                this.awardAchievement(userId, 'has_profile_pic');
                break;
            case 'update_bio':
                if (extraData.bio && extraData.bio.length > 0) {
                    this.awardAchievement(userId, 'has_bio');
                }
                break;
            case 'community_post':
                this.awardAchievement(userId, 'social_butterfly');
                break;
            case 'start_petition':
                this.awardAchievement(userId, 'started_petition');
                break;
            case 'resolve_petition':
                this.awardAchievement(userId, 'resolved_petition');
                break;
            case 'petition_success':
                if (extraData.authorId) {
                    this.awardAchievement(extraData.authorId, 'petition_success');
                }
                break;
        }
    },
    
    getUserAchievements: async function(userId) {
        try {
            if (db) {
                const doc = await db.collection('users').doc(userId).get();
                if (doc.exists) {
                    return doc.data().achievements || [];
                }
            } else {
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
    },
    
    renderAchievementsBadges: function(achievements, container) {
        if (!container) return;
        
        container.innerHTML = '';
        
        achievements.forEach(achievementId => {
            const achievement = this.getAchievementInfo(achievementId);
            const badge = document.createElement('span');
            badge.className = 'achievement-badge-circle';
            badge.title = `${achievement.name}: ${achievement.description}`;
            badge.textContent = achievement.icon;
            container.appendChild(badge);
        });
    }
};

// ============================================================
// MINECRAFT RE-GUEST WARNING SYSTEM
// ============================================================
const MinecraftReGuest = {
    MINECRAFT_APP_ID: 'minecraft',
    
    requiresReGuest: function(appId) {
        return appId === this.MINECRAFT_APP_ID;
    },
    
    showWarning: function(appId, appName, appLink, app) {
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
                <p>To play multiplayer in ${appName}, you need to refresh/re-guest the game page.</p>
            `;
        }
        
        if (launchBtn) {
            launchBtn.textContent = 'Launch Game';
            launchBtn.onclick = () => {
                window.open(appLink, '_blank');
                this.closeWarning();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.textContent = 'View Info & Reviews';
            cancelBtn.onclick = () => {
                this.closeWarning();
                if (app) {
                    this.showExpandedView(app, appId);
                }
            };
        }
        
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
    },
    
    showExpandedView: function(app, appId) {
        const content = buildExpandedContent(app, appId, 0, 0, {5:0,4:0,3:0,2:0,1:0});
        elements.expandedContentWrapper.innerHTML = content;
        
        elements.expandedOverlay.classList.remove('hidden');
        elements.expandedOverlay.setAttribute('aria-hidden', 'false');
        
        document.body.style.overflow = 'hidden';
        
        loadAppRatings(appId);
        
        setupRatingForm(appId);
        
        subscribeToAppReviews(appId);
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
// OFFLINE TAG SYSTEM
// ============================================================
const OfflineTagSystem = {
    OFFLINE_APPS: ['circle', 'blockblast'],
    HACK_SITE_PASSWORD: '0128',
    
    isOfflineApp: function(appId) {
        return this.OFFLINE_APPS.includes(appId);
    },
    
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
    
    init: function() {
        this.setupPostForm();
        this.setupFilterButtons();
        this.loadPosts();
        this.initUserSearch();
    },
    
    setupPostForm: function() {
        const form = document.getElementById('community-post-form');
        if (!form) return;
        
        const submitBtn = form.querySelector('#community-submit-btn');
        const textarea = form.querySelector('#community-post-input');
        const charCurrent = form.querySelector('#char-current');
        
        if (textarea && charCurrent) {
            textarea.addEventListener('input', () => {
                charCurrent.textContent = textarea.value.length;
            });
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check if user is logged in
            if (!UserAuth.isLoggedIn()) {
                showNotification('Please log in to post');
                UserAuth.openAuthModal();
                return;
            }
            
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
                const petitionCheckbox = document.getElementById('post-is-petition');
                const isPetition = petitionCheckbox ? petitionCheckbox.checked : false;
                
                await this.createPost(content, isPetition);
                
                if (textarea) textarea.value = '';
                if (charCurrent) charCurrent.textContent = '0';
                if (petitionCheckbox) petitionCheckbox.checked = false;
                
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
    
    createPost: async function(content, isPetition = false) {
        const post = {
            content: content,
            author: UserAuth.isLoggedIn() ? UserAuth.getReviewUsername() : 'Anonymous',
            authorId: UserAuth.isLoggedIn() ? UserAuth.currentUser.uid : null,
            authorAvatar: UserAuth.isLoggedIn() ? UserAuth.getReviewAvatar() : null,
            isAdmin: UserAuth.isDeveloperMode || DeveloperMode.isLoggedIn,
            timestamp: new Date().toISOString(),
            type: isPetition ? 'petition' : 'chat',
            isPetition: isPetition,
            isResolved: false
        };
        
        if (!db) {
            const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
            const newPost = {
                id: Date.now().toString(),
                ...post
            };
            posts.unshift(newPost);
            localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
            this.renderPosts(posts);
            
            if (isPetition) {
                Achievements.checkAchievements('start_petition');
            } else {
                Achievements.checkAchievements('community_post');
            }
            return;
        }
        
        try {
            const docRef = await db.collection(this.COLLECTION_NAME).add(post);
            this.renderPosts(await this.getPosts());
            
            if (isPetition) {
                Achievements.checkAchievements('start_petition');
            } else {
                Achievements.checkAchievements('community_post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            throw error;
        }
    },
    
    deletePost: async function(postId) {
        if (!DeveloperMode.isLoggedIn && !UserAuth.isDeveloperMode) {
            showNotification('Only developers can delete posts');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this post?')) return;
        
        try {
            if (db) {
                await db.collection(this.COLLECTION_NAME).doc(postId).delete();
                this.renderPosts(await this.getPosts());
                showNotification('Post deleted!');
            } else {
                const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
                const filteredPosts = posts.filter(p => p.id !== postId);
                localStorage.setItem('sawfish_community_posts', JSON.stringify(filteredPosts));
                this.renderPosts(filteredPosts);
                showNotification('Post deleted!');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            showNotification('Failed to delete post');
        }
    },
    
    resolvePetition: async function(postId, authorId) {
        if (!DeveloperMode.isLoggedIn && !UserAuth.isDeveloperMode) {
            showNotification('Only developers can resolve petitions');
            return;
        }
        
        try {
            if (db) {
                await db.collection(this.COLLECTION_NAME).doc(postId).update({
                    isResolved: true,
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: UserAuth.getReviewUsername()
                });
                this.renderPosts(await this.getPosts());
                showNotification('Petition marked as resolved!');
                Achievements.checkAchievements('resolve_petition');
                
                // Award the petition success achievement to the author
                if (authorId) {
                    Achievements.checkAchievements('petition_success', { authorId: authorId });
                }
            } else {
                const posts = JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
                const postIndex = posts.findIndex(p => p.id === postId);
                if (postIndex !== -1) {
                    posts[postIndex].isResolved = true;
                    posts[postIndex].resolvedAt = new Date().toISOString();
                    posts[postIndex].resolvedBy = UserAuth.getReviewUsername();
                    localStorage.setItem('sawfish_community_posts', JSON.stringify(posts));
                    this.renderPosts(posts);
                    showNotification('Petition marked as resolved!');
                    Achievements.checkAchievements('resolve_petition');
                }
            }
        } catch (error) {
            console.error('Error resolving petition:', error);
            showNotification('Failed to resolve petition');
        }
    },
    
    getPosts: async function() {
        if (!db) {
            return JSON.parse(localStorage.getItem('sawfish_community_posts') || '[]');
        }
        
        try {
            const snapshot = await db.collection(this.COLLECTION_NAME)
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting posts:', error);
            return [];
        }
    },
    
    loadPosts: async function() {
        const container = document.getElementById('community-posts-container');
        if (!container) return;
        
        if (db) {
            this.unsubscribe = db.collection(this.COLLECTION_NAME)
                .orderBy('timestamp', 'desc')
                .limit(50)
                .onSnapshot((snapshot) => {
                    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.renderPosts(posts);
                }, (error) => {
                    console.error('Error subscribing to posts:', error);
                });
        } else {
            const posts = await this.getPosts();
            this.renderPosts(posts);
        }
    },
    
    renderPosts: function(posts) {
        const container = document.getElementById('community-posts-container');
        if (!container) return;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="community-empty"><p>No posts yet. Be the first to share something!</p></div>';
            return;
        }
        
        container.innerHTML = posts.map(post => {
            const isPetition = post.isPetition === true || post.type === 'petition';
            const isResolved = post.isResolved === true;
            const isAdmin = post.isAdmin === true;
            
            let badgeHtml = '';
            if (isPetition) {
                badgeHtml = `<span class="post-badge ${isResolved ? 'resolved' : 'petition'}">${isResolved ? 'Resolved' : 'Petition'}</span>`;
            } else if (isAdmin) {
                badgeHtml = `<span class="post-badge admin">Announcement</span>`;
            }
            
            const formattedDate = formatDate(post.timestamp);
            
            // Get author avatar or use initial
            let avatarHtml = '';
            if (post.authorAvatar) {
                avatarHtml = `<img src="${post.authorAvatar}" alt="${escapeHtml(post.author)}" class="post-author-avatar">`;
            } else {
                const initial = post.author.charAt(0).toUpperCase();
                avatarHtml = `<div class="post-author-avatar-default">${initial}</div>`;
            }
            
            let resolveButton = '';
            if (isPetition && !isResolved && (DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode)) {
                resolveButton = `<button class="resolve-petition-btn" data-post-id="${post.id}" data-author-id="${post.authorId || ''}" title="Mark as Resolved">✓ Resolve</button>`;
            }
            
            let deleteButton = '';
            if (DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode) {
                deleteButton = `<button class="delete-post-btn" data-post-id="${post.id}" title="Delete Post">🗑️</button>`;
            }
            
            let resolvedInfo = '';
            if (isResolved) {
                resolvedInfo = `<div class="resolved-info">✓ Resolved by ${escapeHtml(post.resolvedBy || 'Developer')}</div>`;
            }
            
            return `
                <article class="community-post ${isPetition ? 'petition' : ''} ${isResolved ? 'resolved' : ''}" data-type="${post.type}" data-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author-info">
                            ${avatarHtml}
                            <div class="post-author-details">
                                <span class="post-author-name">${escapeHtml(post.author)}</span>
                                <span class="post-date">${formattedDate}</span>
                            </div>
                        </div>
                        <div class="post-badges">
                            ${badgeHtml}
                        </div>
                    </div>
                    <div class="post-content">
                        ${escapeHtml(post.content)}
                    </div>
                    ${resolvedInfo}
                    <div class="post-actions">
                        ${resolveButton}
                        ${deleteButton}
                    </div>
                </article>
            `;
        }).join('');
        
        // Add click handlers for resolve buttons
        container.querySelectorAll('.resolve-petition-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = btn.dataset.postId;
                const authorId = btn.dataset.authorId;
                if (confirm('Mark this petition as resolved? The author will receive an award.')) {
                    this.resolvePetition(postId, authorId);
                }
            });
        });
        
        // Add click handlers for delete buttons
        container.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = btn.dataset.postId;
                this.deletePost(postId);
            });
        });
    },
    
    initUserSearch: function() {
        const searchInput = document.getElementById('community-user-search');
        const usersSection = document.getElementById('community-users-section');
        const usersList = document.getElementById('community-users-list');
        
        if (!searchInput || !usersSection || !usersList) return;
        
        // Load all users immediately on page load
        this.loadAllUsers();
        
        // Show users section when input is focused
        searchInput.addEventListener('focus', () => {
            usersSection.classList.remove('hidden');
            this.loadAllUsers();
        });
        
        // Filter users on input
        searchInput.addEventListener('input', () => {
            this.filterUsers(searchInput.value);
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !usersSection.contains(e.target)) {
                usersSection.classList.add('hidden');
            }
        });
    },
    
    loadAllUsers: async function() {
        const usersList = document.getElementById('community-users-list');
        if (!usersList) return;
        
        usersList.innerHTML = '<div class="loading-users">Loading users...</div>';
        
        try {
            let users = [];
            
            if (db) {
                const snapshot = await db.collection('users').get();
                users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                const storedUsers = JSON.parse(localStorage.getItem('sawfish_users') || '{}');
                users = Object.values(storedUsers).map(u => ({
                    uid: u.uid,
                    username: u.username,
                    bio: u.bio || '',
                    email: u.email,
                    achievements: u.achievements || [],
                    createdAt: u.createdAt
                }));
                
                // Also add current local user if exists
                if (UserAuth.currentUser) {
                    const existingUser = users.find(u => u.uid === UserAuth.currentUser.uid);
                    if (!existingUser) {
                        users.unshift({
                            uid: UserAuth.currentUser.uid,
                            username: UserAuth.getReviewUsername(),
                            bio: UserAuth.userProfile?.bio || '',
                            achievements: UserAuth.userProfile?.achievements || [],
                            createdAt: UserAuth.userProfile?.createdAt
                        });
                    }
                }
            }
            
            this.renderUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<div class="error-loading">Failed to load users</div>';
        }
    },
    
    filterUsers: function(searchTerm) {
        const users = document.querySelectorAll('.community-user-card');
        const term = searchTerm.toLowerCase().trim();
        
        users.forEach(card => {
            const username = card.dataset.username?.toLowerCase() || '';
            const bio = card.dataset.bio?.toLowerCase() || '';
            const email = card.dataset.email?.toLowerCase() || '';
            
            const matches = !term || 
                username.includes(term) || 
                bio.includes(term) ||
                email.includes(term);
            
            card.style.display = matches ? '' : 'none';
        });
    },
    
    renderUsers: function(users) {
        const usersList = document.getElementById('community-users-list');
        if (!usersList) return;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="no-users">No users found</div>';
            return;
        }
        
        usersList.innerHTML = users.map(user => {
            const username = user.username || 'Unknown';
            const bio = user.bio || '';
            const initial = username.charAt(0).toUpperCase();
            
            // Get achievements
            const achievements = user.achievements || [];
            let achievementsHtml = '';
            if (achievements.length > 0) {
                achievementsHtml = achievements.slice(0, 5).map(achId => {
                    const ach = Achievements.getAchievementInfo(achId);
                    return `<span class="achievement-badge-small" title="${ach.name}: ${ach.description}">${ach.icon}</span>`;
                }).join('');
                if (achievements.length > 5) {
                    achievementsHtml += `<span class="achievement-more">+${achievements.length - 5}</span>`;
                }
            }
            
            // Use profile picture or default avatar
            let avatarHtml = '';
            if (user.avatarUrl) {
                avatarHtml = `<div class="community-user-avatar"><img src="${user.avatarUrl}" alt="${username}" class="user-avatar-img"></div>`;
            } else {
                avatarHtml = `<div class="community-user-avatar"><div class="user-avatar-initial">${initial}</div></div>`;
            }
            
            return `
                <div class="community-user-card" 
                     data-username="${escapeHtml(username)}" 
                     data-bio="${escapeHtml(bio)}"
                     data-email="${escapeHtml(user.email || '')}"
                     data-uid="${user.uid}"
                     onclick="UserAuth.openUserProfile('${user.uid}')">
                    ${avatarHtml}
                    <div class="user-card-info">
                        <div class="user-card-name">${escapeHtml(username)}</div>
                        ${bio ? `<div class="user-card-bio">${escapeHtml(bio)}</div>` : ''}
                        ${achievementsHtml ? `<div class="user-card-achievements">${achievementsHtml}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
};

// ============================================================
// DEVELOPER MODE SYSTEM
// ============================================================
const DeveloperMode = {
    isLoggedIn: false,
    
    init: function() {
        this.updateLoginButton();
        // Initialize developer page content visibility
        this.updateDeveloperPageContent(this.isLoggedIn);
    },
    
    updateLoginButton: function() {
        const btn = document.getElementById('developer-login-button');
        const statusText = btn?.querySelector('.developer-status-text');
        const indicator = document.getElementById('developer-logged-in-indicator');
        
        if (this.isLoggedIn) {
            if (statusText) statusText.textContent = 'Developer ✓';
            btn?.classList.add('logged-in');
            // Show the logged in indicator
            if (indicator) {
                indicator.classList.remove('hidden');
                btn.style.display = 'none';
            }
        } else {
            if (statusText) statusText.textContent = 'Developer';
            btn?.classList.remove('logged-in');
            // Hide the logged in indicator
            if (indicator) {
                indicator.classList.add('hidden');
                btn.style.display = 'flex';
            }
        }
        
        // Update dev-only elements visibility
        updateDevOnlyElements();
    },
    
    login: function(password) {
        if (password === '120622') {
            this.isLoggedIn = true;
            sessionStorage.setItem('developer_logged_in', 'true');
            this.updateLoginButton();
            
            const modal = document.getElementById('developer-login-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
            }
            
            showNotification('Developer mode activated');
            
            UserAuth.isDeveloperMode = true;
            UserAuth.currentUser = {
                uid: 'developer',
                displayName: 'Developer'
            };
            
            // Show developer content and hide login prompt
            this.updateDeveloperPageContent(true);
            updateDevOnlyElements();
            return true;
        }
        return false;
    },
    
    logout: function() {
        this.isLoggedIn = false;
        sessionStorage.removeItem('developer_logged_in');
        this.updateLoginButton();
        
        const dashboard = document.getElementById('developer-dashboard');
        if (dashboard) {
            dashboard.classList.add('hidden');
            dashboard.setAttribute('aria-hidden', 'true');
        }
        
        UserAuth.isDeveloperMode = false;
        
        // Hide developer content and show login prompt
        this.updateDeveloperPageContent(false);
        updateDevOnlyElements();
        
        showNotification('Developer mode deactivated');
    },
    
    updateDeveloperPageContent: function(isLoggedIn) {
        const loginRequired = document.getElementById('developer-login-required');
        const content = document.getElementById('developer-content');
        
        if (loginRequired) {
            loginRequired.style.display = isLoggedIn ? 'none' : 'flex';
        }
        
        if (content) {
            content.style.display = isLoggedIn ? 'block' : 'none';
            // Populate developer grids when showing content
            if (isLoggedIn) {
                populateDeveloperResources();
                populateDeveloperProductivity();
                populateDeveloperPublishing();
            }
        }
    },
    
    toggleLogin: function() {
        if (this.isLoggedIn) {
            this.logout();
        } else {
            const modal = document.getElementById('developer-login-modal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.setAttribute('aria-hidden', 'false');
            }
        }
    },
    
    closeLoginModal: function() {
        const modal = document.getElementById('developer-login-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    },
    
    showAddAppForm: function() {
        showNotification('App management - Coming soon!');
    },
    
    publishAnnouncement: function() {
        const title = document.getElementById('announcement-title')?.value.trim();
        const text = document.getElementById('announcement-text')?.value.trim();
        const type = document.getElementById('announcement-type')?.value || 'info';
        
        if (!title || !text) {
            showNotification('Please fill in both title and message');
            return;
        }
        
        const announcement = {
            title,
            text,
            type,
            timestamp: new Date().toISOString()
        };
        
        if (db) {
            db.collection('sawfish_announcements').add(announcement)
                .then(() => {
                    showNotification('Announcement published!');
                    document.getElementById('announcement-title').value = '';
                    document.getElementById('announcement-text').value = '';
                })
                .catch(error => {
                    console.error('Error publishing announcement:', error);
                    showNotification('Failed to publish announcement');
                });
        } else {
            const announcements = JSON.parse(localStorage.getItem('sawfish_announcements') || '[]');
            announcements.unshift({ id: Date.now().toString(), ...announcement });
            localStorage.setItem('sawfish_announcements', JSON.stringify(announcements));
            showNotification('Announcement published! (Offline mode)');
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
    
    checkForUpdates: function() {
        const status = document.getElementById('update-status');
        const action = document.getElementById('update-action');
        
        if (status) status.textContent = 'Checking for updates...';
        
        fetch(VERSION_CHECK_URL + '?t=' + Date.now())
            .then(response => {
                if (!response.ok) {
                    throw new Error('Version check failed');
                }
                return response.json();
            })
            .then(data => {
                const currentVersion = APP_VERSION;
                const latestVersion = data.version;
                
                if (this.compareVersions(latestVersion, currentVersion) > 0) {
                    if (status) status.textContent = `Update available (v${latestVersion})`;
                    if (action) {
                        action.innerHTML = '<span class="btn-text">Update</span><span class="btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></span>';
                    }
                    
                    if (data.announcement) {
                        const banner = document.getElementById('announcement-banner');
                        const bannerText = banner?.querySelector('.announcement-text');
                        if (bannerText) bannerText.textContent = data.announcement;
                        if (banner) banner.classList.remove('hidden');
                    }
                } else {
                    if (status) status.textContent = 'Up to date';
                    if (action) {
                        action.innerHTML = '<span class="btn-text">Up to date</span>';
                    }
                }
            })
            .catch(error => {
                console.error('Update check failed:', error);
                if (status) status.textContent = 'Unable to check for updates';
            });
    },
    
    compareVersions: function(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        
        return 0;
    }
};

// ============================================================
// FIRESTORE COMMENTS / RATINGS SYSTEM
// ============================================================
const FirestoreComments = {
    COLLECTION_NAME: 'sawfish_ratings',
    firebaseReady: false,
    
    init: function() {
        // Check if Firebase is properly initialized
        if (db && typeof db.collection === 'function') {
            this.firebaseReady = true;
            console.log('Firestore Comments: Firebase is ready');
        } else {
            console.warn('Firestore Comments: Firebase not available, using localStorage');
            this.firebaseReady = false;
        }
    },
    
    saveReview: async function(appId, rating, comment, user, isDeveloper, userAvatar) {
        const review = {
            appId,
            rating,
            comment,
            user,
            userAvatar,
            isDeveloper: isDeveloper === true,
            timestamp: new Date().toISOString()
        };
        
        console.log('Saving review to Firebase:', { appId, rating, user });
        
        // ALWAYS try Firebase first, only fall back to localStorage if it fails
        if (this.firebaseReady) {
            try {
                const docRef = await db.collection(this.COLLECTION_NAME).add(review);
                console.log('Review saved to Firebase with ID:', docRef.id);
                return { id: docRef.id, ...review };
            } catch (error) {
                console.error('Firebase save failed, falling back to localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        console.log('Saving review to localStorage');
        const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
        const newReview = {
            id: Date.now().toString(),
            ...review
        };
        reviews.push(newReview);
        localStorage.setItem('sawfish_ratings', JSON.stringify(reviews));
        return newReview;
    },
    
    getReviews: async function(appId) {
        console.log('Loading reviews for app:', appId);
        
        if (this.firebaseReady) {
            try {
                const snapshot = await db.collection(this.COLLECTION_NAME)
                    .where('appId', '==', appId)
                    .orderBy('timestamp', 'desc')
                    .get();
                
                const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Loaded', reviews.length, 'reviews from Firebase');
                return reviews;
            } catch (error) {
                console.error('Firebase getReviews failed:', error);
            }
        }
        
        // Fallback to localStorage
        console.log('Loading reviews from localStorage');
        const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
        const appReviews = reviews.filter(r => r.appId === appId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        console.log('Loaded', appReviews.length, 'reviews from localStorage');
        return appReviews;
    },
    
    getAverageRating: async function(appId) {
        if (this.firebaseReady) {
            try {
                const snapshot = await db.collection(this.COLLECTION_NAME)
                    .where('appId', '==', appId)
                    .get();
                
                if (snapshot.empty) return null;
                
                let sum = 0;
                let count = 0;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.rating) {
                        sum += data.rating;
                        count++;
                    }
                });
                
                const avg = count > 0 ? sum / count : null;
                console.log('Average rating from Firebase:', avg);
                return avg;
            } catch (error) {
                console.error('Firebase getAverageRating failed:', error);
            }
        }
        
        // Fallback to localStorage
        const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
        const appReviews = reviews.filter(r => r.appId === appId);
        
        if (appReviews.length === 0) return null;
        
        const sum = appReviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = sum / appReviews.length;
        console.log('Average rating from localStorage:', avg);
        return avg;
    },
    
    getRatingDistribution: async function(appId) {
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        
        if (this.firebaseReady) {
            try {
                const snapshot = await db.collection(this.COLLECTION_NAME)
                    .where('appId', '==', appId)
                    .get();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.rating) {
                        const rating = Math.round(data.rating);
                        if (distribution[rating] !== undefined) {
                            distribution[rating]++;
                        }
                    }
                });
                return distribution;
            } catch (error) {
                console.error('Firebase getRatingDistribution failed:', error);
            }
        }
        
        // Fallback to localStorage
        const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
        const appReviews = reviews.filter(r => r.appId === appId);
        
        appReviews.forEach(r => {
            const rating = Math.round(r.rating);
            if (distribution[rating] !== undefined) {
                distribution[rating]++;
            }
        });
        
        return distribution;
    },
    
    getTotalReviews: async function(appId) {
        if (this.firebaseReady) {
            try {
                const snapshot = await db.collection(this.COLLECTION_NAME)
                    .where('appId', '==', appId)
                    .get();
                return snapshot.size;
            } catch (error) {
                console.error('Firebase getTotalReviews failed:', error);
            }
        }
        
        // Fallback to localStorage
        const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
        return reviews.filter(r => r.appId === appId).length;
    },
    
    subscribeToReviews: function(appId, callback) {
        console.log('Subscribing to reviews for:', appId);
        
        if (this.firebaseReady) {
            try {
                const unsubscribe = db.collection(this.COLLECTION_NAME)
                    .where('appId', '==', appId)
                    .orderBy('timestamp', 'desc')
                    .onSnapshot((snapshot) => {
                        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        console.log('Firebase real-time update:', reviews.length, 'reviews');
                        callback(reviews);
                    }, (error) => {
                        console.error('Firebase subscription error:', error);
                    });
                return unsubscribe;
            } catch (error) {
                console.error('Firebase subscribe failed:', error);
            }
        }
        
        // Fallback to localStorage with polling
        const loadLocalReviews = async () => {
            const reviews = JSON.parse(localStorage.getItem('sawfish_ratings') || '[]');
            const appReviews = reviews.filter(r => r.appId === appId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            console.log('LocalStorage reviews update:', appReviews.length, 'reviews');
            callback(appReviews);
        };
        
        // Load immediately
        loadLocalReviews();
        
        // Poll for changes every 2 seconds
        const interval = setInterval(loadLocalReviews, 2000);
        
        // Return unsubscribe function
        return () => {
            console.log('Unsubscribing from reviews');
            clearInterval(interval);
        };
    }
};

// Initialize FirestoreComments after Firebase is initialized
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        FirestoreComments.init();
    }, 1000);
});

// ============================================================
// LIKE SYSTEM
// ============================================================
const LikeSystem = {
    likes: {},
    
    init: function() {
        this.loadLikes();
    },
    
    loadLikes: function() {
        try {
            const stored = localStorage.getItem('sawfish_likes');
            if (stored) {
                this.likes = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading likes:', error);
        }
    },
    
    saveLikes: function() {
        try {
            localStorage.setItem('sawfish_likes', JSON.stringify(this.likes));
        } catch (error) {
            console.error('Error saving likes:', error);
        }
    },
    
    toggleLike: function(appId) {
        const hasLiked = this.likes[appId] === true;
        
        if (hasLiked) {
            delete this.likes[appId];
        } else {
            this.likes[appId] = true;
            Achievements.checkAchievements('like_app');
        }
        
        this.saveLikes();
        return !hasLiked;
    },
    
    hasLiked: function(appId) {
        return this.likes[appId] === true;
    },
    
    getLikeCount: function(appId) {
        const stored = localStorage.getItem('sawfish_like_counts');
        const counts = stored ? JSON.parse(stored) : {};
        return counts[appId] || 0;
    },
    
    incrementLikeCount: function(appId) {
        const stored = localStorage.getItem('sawfish_like_counts');
        const counts = stored ? JSON.parse(stored) : {};
        counts[appId] = (counts[appId] || 0) + 1;
        localStorage.setItem('sawfish_like_counts', JSON.stringify(counts));
        return counts[appId];
    }
};

// ============================================================
// SEARCH SYSTEM
// ============================================================
const SearchSystem = {
    init: function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchCount = document.getElementById('search-count');
        const noResults = document.getElementById('search-no-results');
        
        if (!searchInput || !searchResults) return;
        
        let currentCategory = 'all';
        let currentResults = [];
        
        const categoryBtns = document.querySelectorAll('.search-category-btn');
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.dataset.searchCategory;
                this.performSearch(searchInput.value, currentCategory, searchResults, searchCount, noResults);
            });
        });
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.performSearch(e.target.value, currentCategory, searchResults, searchCount, noResults);
            }, 200);
        });
        
        this.performSearch('', currentCategory, searchResults, searchCount, noResults);
    },
    
    performSearch: function(query, category, resultsContainer, countContainer, noResultsContainer) {
        const term = query.toLowerCase().trim();
        const isDevMode = DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode;
        const results = Object.entries(appData).filter(([id, app]) => {
            // Hide developer-only apps when not in developer mode
            if (app.isDev && !isDevMode) return false;
            
            const matchesTerm = !term || 
                app.name.toLowerCase().includes(term) || 
                app.developer.toLowerCase().includes(term) ||
                app.description.toLowerCase().includes(term) ||
                app.category.toLowerCase().includes(term);
            
            if (!matchesTerm) return false;
            
            if (category === 'all') return true;
            
            if (category === 'Games') {
                return app.category.toLowerCase().includes('game');
            }
            if (category === 'Social') {
                return app.category.toLowerCase().includes('social') || app.name.toLowerCase().includes('chat');
            }
            if (category === 'Operating System' || category === 'OS') {
                return app.category.toLowerCase().includes('operating system');
            }
            if (category === 'Educational') {
                return app.category.toLowerCase().includes('educational') || app.category.toLowerCase().includes('productivity');
            }
            if (category === 'Utilities') {
                return app.category.toLowerCase().includes('miscellaneous') || app.category.toLowerCase().includes('tools');
            }
            
            return app.category.toLowerCase().includes(category.toLowerCase());
        });
        
        currentResults = results;
        
        if (countContainer) {
            countContainer.textContent = results.length;
        }
        
        if (results.length === 0) {
            if (resultsContainer) resultsContainer.innerHTML = '';
            if (noResultsContainer) noResultsContainer.classList.remove('hidden');
            return;
        }
        
        if (noResultsContainer) noResultsContainer.classList.add('hidden');
        
        if (resultsContainer) {
            resultsContainer.innerHTML = results.map(([id, app]) => {
                const isMinecraft = id === 'minecraft';
                const reGuestBanner = isMinecraft ? `
                    <div class="reguest-banner">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>Re-Guest Required for Multiplayer</span>
                    </div>
                ` : '';
                
                return `
                    <article class="app-card" data-app="${id}">
                        ${reGuestBanner}
                        <div class="card-icon">
                            <img src="${app.icon}" alt="${escapeHtml(app.name)} Icon" loading="lazy">
                        </div>
                        <div class="card-content">
                            <h4>${escapeHtml(app.name)}</h4>
                            <p class="card-desc">${escapeHtml(app.description.substring(0, 80))}${app.description.length > 80 ? '...' : ''}</p>
                            <div class="card-rating" data-avg-rating="${id}">—</div>
                        </div>
                    </article>
                `;
            }).join('');
            
            resultsContainer.querySelectorAll('.app-card').forEach(card => {
                card.addEventListener('click', function() {
                    const appId = this.dataset.app;
                    if (appId) {
                        openExpandedApp(appId);
                    }
                });
            });
        }
    }
};

// ============================================================
// APP DATA
// ============================================================
const appData = {
    portal: {
        name: "Sawfish Game Portal",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=P",
        category: "Games / Portal",
        description: "Central launcher for all approved Sawfish games in one place.",
        features: "Browse games by category, see what's popular, quick launch any game.",
        additional: "This portal serves as your gateway to all the games available.",
        link: "https://the-sawfish.github.io/game-portal/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Portal", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Game+Library"]
    },
    chat: {
        name: "Chat App",
        developer: "Jimeneutron",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=C",
        category: "Social / Communication",
        description: "Real-time browser-based messaging with rooms and channels.",
        features: "Join topic-based rooms, create channels, share text messages instantly.",
        additional: "Perfect for study groups and class discussions.",
        link: "https://jimeneutron.github.io/chatapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chat+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Message+Rooms"]
    },
    call: {
        name: "Call App",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Ca",
        category: "Social / Communication",
        description: "Fast, simple browser-based voice calling interface.",
        features: "One-click calling, no app installation required, low latency audio.",
        additional: "Great for quick check-ins with study partners.",
        link: "https://the-sawfish.github.io/callapp/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Call+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Voice+Call"]
    },
    circle: {
        name: "Draw a Circle",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=O",
        category: "Games / Puzzle",
        description: "Quick reflex challenge - draw the most perfect circle you can.",
        features: "Instant feedback on circle precision, score tracking.",
        additional: "Perfect for quick breaks between classes. Works offline once loaded.",
        link: "https://the-sawfish.github.io/circle/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Draw+a+Circle", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Score+Screen"]
    },
    sandboxels: {
        name: "Sandboxels",
        developer: "Rhex Lorenz",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=S",
        category: "Games / Simulation",
        description: "Falling sand physics simulator with over 500 unique elements.",
        features: "Hundreds of different elements, realistic physics simulation.",
        additional: "A great way to learn about cellular automata and physics.",
        link: "https://the-sawfish.github.io/sandboxels/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sandboxels+Simulation", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Physics+Elements"]
    },
    minecraft: {
        name: "Minecraft Web (Beta)",
        developer: "Zardoy",
        icon: "https://via.placeholder.com/100x100/5c8a3d/ffffff?text=MC",
        category: "Games / Sandbox",
        description: "The iconic sandbox building game, now in your browser.",
        features: "Full block-based world generation, mining and crafting, multiplayer support.",
        additional: "This is a browser-based recreation of Minecraft.",
        link: "https://zardoy.github.io/minecraft-web-client/",
        screenshots: ["https://via.placeholder.com/400x250/5c8a3d/ffffff?text=Minecraft+Web", "https://via.placeholder.com/400x250/5c8a3d/ffffff?text=Block+Building"],
        reguestRequired: true
    },
    blockblast: {
        name: "Block Blast",
        developer: "A Guy",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=BB",
        category: "Games / Puzzle",
        description: "Fast-paced block placement puzzle game with competitive scoring.",
        features: "Classic block puzzle mechanics, competitive scoring system.",
        additional: "Perfect for quick gaming sessions. Works offline once loaded.",
        link: "https://aappqq.github.io/BlockBlast/index.html/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Block+Blast", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Puzzle+Gameplay"]
    },
    run3: {
        name: "Run 3",
        developer: "Jupiter Hadley",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=R3",
        category: "Games / Platformer",
        description: "Endless space runner through procedurally generated tunnels.",
        features: "Procedurally generated endless tunnels, wall-running mechanics.",
        additional: "A classic endless runner with a unique 3D tunnel perspective.",
        link: "https://the-sawfish.github.io/Run3Final/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Run+3+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Space+Tunnels"]
    },
    retrobowl: {
        name: "Retro Bowl",
        developer: "Collin Crews",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=RB",
        category: "Games / Sports",
        description: "Classic American football management game with retro aesthetics.",
        features: "Team management, strategic playcalling, retro pixel art style.",
        additional: "The perfect game for football fans.",
        link: "https://the-sawfish.github.io/seraph/games/retrobowl/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Retro+Bowl", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Football+Action"]
    },
    paperio2: {
        name: "Paper Io 2",
        developer: "Voodoo",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=IO",
        category: "Games / Action",
        description: "Territory conquest game. Capture territory and defeat opponents.",
        features: "Territory capture mechanics, real-time multiplayer battles.",
        additional: "A highly addictive territory conquest game.",
        link: "https://the-sawfish.github.io/seraph/games/paperio2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Paper+IO+2", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territory+Capture"]
    },
    bobtherobber: {
        name: "Bob The Robber",
        developer: "Bob The Robber Team",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=BR",
        category: "Games / Puzzle",
        description: "Stealth puzzle game series. Infiltrate locations and steal treasures.",
        features: "Progressive level difficulty, stealth mechanics.",
        additional: "A beloved stealth puzzle series.",
        link: "https://bobtherobberunblocked.github.io/2/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Bob+The+Robber", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stealth+Action"]
    },
    tinyfishing: {
        name: "Tiny Fishing",
        developer: "Ketchapp",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=TF",
        category: "Games / Casual",
        description: "Addictive fishing game. Catch fish and upgrade your gear.",
        features: "Hook fish of various sizes, upgrade your fishing gear.",
        additional: "A simple yet addictive fishing game.",
        link: "https://the-sawfish.github.io/seraph/games/tinyfishing/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tiny+Fishing", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Fish+Collection"]
    },
    ovo: {
        name: "OVO",
        developer: "Maestro",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=OV",
        category: "Games / Platformer",
        description: "Fast-paced parkour game. Jump, slide, and wall-run through obstacles.",
        features: "Smooth parkour mechanics, challenging obstacle courses.",
        additional: "A beloved parkour platformer with fluid movement controls.",
        link: "https://the-sawfish.github.io/legalizenuclearbombs5.github.io/games/ovo.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=OVO+Parkour", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Obstacle+Course"]
    },
    towerofdestiny: {
        name: "Tower of Destiny",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=TD",
        category: "Games / Adventure",
        description: "Exciting adventure game where you build and ascend a tower.",
        features: "Procedurally generated levels, hero upgrades, boss battles.",
        additional: "The tower keeps getting taller as you progress.",
        link: "https://natleef1.github.io/tower-of-destiny/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tower+of+Destiny", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ascend+the+Tower"]
    },
    novaos: {
        name: "NovaOS",
        developer: "RunNova",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=N",
        category: "Operating System",
        description: "Full-featured browser-based desktop operating system environment.",
        features: "Customizable desktop, window management, file manager.",
        additional: "For the full NovaOS experience, open in a new tab.",
        link: "https://runnova.github.io/NovaOS/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=NovaOS+Apps"]
    },
    winripen: {
        name: "WinRipen",
        developer: "Ripenos",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=WR",
        category: "Operating System",
        description: "Web-based operating system recreating classic Windows.",
        features: "Authentic Windows-like interface, window management.",
        additional: "Due to browser security restrictions, open in a new tab.",
        link: "https://ripenos.web.app/WinRipen/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=WinRipen+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Windows+Apps"]
    },
    plutoos: {
        name: "PlutoOS",
        developer: "Zeon",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=PL",
        category: "Operating System",
        description: "Futuristic vision of a web-based operating system.",
        features: "Modular design, glass-morphism effects, smooth animations.",
        additional: "An experimental project demonstrating cutting edge web computing.",
        link: "https://pluto-app.zeon.dev",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=PlutoOS+Modern+UI", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Fluid+Animations"]
    },
    ripenos: {
        name: "Ripenos",
        developer: "Ripenos",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=RP",
        category: "Operating System",
        description: "Lightweight, modular web-based operating system framework.",
        features: "Essential desktop functionality, modular architecture.",
        additional: "Suitable for educational environments with varied hardware.",
        link: "https://ripenos.web.app/Ripenos/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ripenos+Desktop", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Modular+Apps"]
    },
    piskel: {
        name: "Piskel",
        developer: "Piskel Team",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Pi",
        category: "Developer Tools / Graphics",
        description: "Free online editor for creating animated sprites and pixel art.",
        features: "Layers, color palettes, onion skinning, animation timeline.",
        additional: "Perfect for creating game assets and pixel art.",
        link: "https://www.piskelapp.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Piskel+Pixel+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Animation+Timeline"],
        isDev: true
    },
    vscodeweb: {
        name: "VS Code Web",
        developer: "Microsoft",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=VS",
        category: "Developer Tools / Code",
        description: "Visual Studio Code editor in your browser.",
        features: "Syntax highlighting, IntelliSense, Git integration.",
        additional: "Requires a Microsoft account for full functionality.",
        link: "https://vscode.dev/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=VS+Code+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Code+IntelliSense"],
        isDev: true
    },
    shadertoy: {
        name: "ShaderToy",
        developer: "ShaderToy Team",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=ST",
        category: "Developer Tools / Graphics",
        description: "Platform for learning and sharing GLSL shaders.",
        features: "Powerful shader editor, thousands of example shaders.",
        additional: "Perfect for learning computer graphics programming.",
        link: "https://www.shadertoy.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=ShaderToy+Editor", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=GLSL+Shaders"],
        isDev: true
    },
    photopea: {
        name: "Photopea",
        developer: "Ivan Kuckir",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Ph",
        category: "Productivity / Graphics",
        description: "Powerful online image editor in your browser.",
        features: "Layer support, filters, brushes, vector shapes.",
        additional: "All processing happens in your browser for privacy.",
        link: "https://www.photopea.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Photopea+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Image+Editing"]
    },
    tiddlywiki: {
        name: "TiddlyWiki",
        developer: "TiddlyWiki Community",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=TW",
        category: "Productivity / Notes",
        description: "Personal wiki and non-linear notebook for organizing thoughts.",
        features: "Powerful linking, tagging system, rich text editing.",
        additional: "Completely self-contained in one HTML file.",
        link: "https://tiddlywiki.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=TiddlyWiki+Notebook", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Wiki+Organization"],
        isDev: true
    },
    monkeytype: {
        name: "Monkeytype",
        developer: "Miodec",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=MT",
        category: "Educational / Typing",
        description: "Minimalist typing test for improving speed and accuracy.",
        features: "Customizable themes, difficulty levels, comprehensive statistics.",
        additional: "Open source and completely ad-free.",
        link: "https://monkeytype.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Monkeytype+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Typing+Statistics"]
    },
    lichess: {
        name: "Lichess",
        developer: "Lichess Team",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Li",
        category: "Games / Strategy",
        description: "Free, open-source chess platform with no ads or tracking.",
        features: "Multiple game modes, puzzles, tactics training, tournaments.",
        additional: "One of the least blocked chess sites on school networks.",
        link: "https://lichess.org/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Lichess+Chess+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chess+Analysis"]
    },
    neocities: {
        name: "Neocities",
        developer: "Neocities Inc",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=NC",
        category: "Social / Web Publishing",
        description: "Free service for creating your own website.",
        features: "Free hosting, site templates, drag-and-drop uploads.",
        additional: "Revives the spirit of early web publishing.",
        link: "https://neocities.org/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Neocities+Create", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Website+Builder"],
        isDev: true
    },
    hack: {
        name: "Hack Stuff",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Hk",
        category: "Miscellaneous / Tools",
        description: "Utilities and experimental tools for advanced users.",
        features: "Password generator, cipher tools, hash generator.",
        additional: "For educational purposes only.",
        link: "https://the-sawfish.github.io/hack/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hack+Tools+Interface", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Password+Generator"]
    },
    securecomms: {
        name: "Secure Communication",
        developer: "Jimeneutron",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=SC",
        category: "Miscellaneous / Tools",
        description: "Encrypt and decrypt messages securely.",
        features: "AES-256 encryption, message encoding, key generation.",
        additional: "Learn about encryption and data security.",
        link: "https://jimeneutron.github.io/SecureCommunication/",
        screenshots: ["icons/IMG_0634.jpeg", "icons/IMG_0635.jpeg"]
    },
    2048: {
        name: "2048",
        developer: "Gabriele Cirulli",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=20",
        category: "Games / Puzzle",
        description: "Classic number puzzle game. Combine tiles to reach 2048.",
        features: "Simple swipe controls, score tracking, undo functionality.",
        additional: "One of the most popular puzzle games of all time.",
        link: "https://the-sawfish.github.io/seraph/games/2048/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Game+Board", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=2048+Win+Screen"]
    },
    hackernews: {
        name: "Hacker News",
        developer: "Y Combinator",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=HN",
        category: "News / Technology",
        description: "Social news website focusing on computer science and technology.",
        features: "User-submitted stories, threaded comments, karma points.",
        additional: "One of the best sources for technology news.",
        link: "https://news.ycombinator.com/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hacker+News+Front+Page", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Tech+Discussions"]
    },
    syrup: {
        name: "Syrup Games",
        developer: "Syrup Games",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Sy",
        category: "Games / Arcade",
        description: "Alternative game launcher with unique browser-based titles.",
        features: "Collection of indie games, daily challenges, leaderboards.",
        additional: "Discover unique indie games you won't find anywhere else.",
        link: "https://jimeneutron.github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Syrup+Games+Launcher", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Indie+Games"]
    },
    hextris: {
        name: "Hextris",
        developer: "Hextris",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=He",
        category: "Games / Puzzle",
        description: "Addictive puzzle game played on a hexagonal grid.",
        features: "Fast-paced gameplay, score tracking, increasing difficulty.",
        additional: "A unique twist on the classic tetris-style gameplay.",
        link: "https://codechefvit.github.io/DevTris/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hextris+Gameplay", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Hexagonal+Puzzle"]
    },
    snowrider3d: {
        name: "Snow Rider 3D",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=SR",
        category: "Games / Arcade",
        description: "Thrilling sled racing game with 3D graphics and obstacles.",
        features: "3D graphics, obstacle avoidance, gifts and power-ups.",
        additional: "A classic school-friendly game. Works offline once loaded.",
        link: "https://the-sawfish.github.io/Snow-Rider3D/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Snow+Rider+3D", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Sled+Racing"]
    },
    investopedia: {
        name: "Investopedia Simulator",
        developer: "Investopedia",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=In",
        category: "Educational / Finance",
        description: "Learn stock market trading with virtual currency.",
        features: "Real-time market data simulation, portfolio tracking.",
        additional: "Perfect for learning trading strategies without risk.",
        link: "http://investopedia.com/simulator",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Investopedia+Simulator", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Stock+Trading"]
    },
    studentgrade: {
        name: "Student Grade Viewer",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=SG",
        category: "Productivity / Education",
        description: "Track and view student grades and academic performance.",
        features: "Grade tracking, GPA calculation, assignment management.",
        additional: "Designed for students to monitor their academic progress.",
        link: "http://pa.neonet.org/Student/Grade",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Student+Grade+Viewer", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Grade+Tracking"]
    },
    chilibowl: {
        name: "Chilibowl Flash",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=CB",
        category: "Games / Arcade",
        description: "Classic flash game featuring chili pepper challenges.",
        features: "Classic gameplay, multiple levels, time attack mode.",
        additional: "Nostalgic flash gaming experience.",
        link: "https://the-sawfish.github.io/chilibowlflash/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chilibowl+Flash", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Chili+Challenge"]
    },
    territorial: {
        name: "Territorial.io",
        developer: "Territorial Team",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Ti",
        category: "Games / Strategy",
        description: "Strategic territory conquest game with real-time battles.",
        features: "Territory expansion, unit management, real-time multiplayer.",
        additional: "A highly strategic conquest game.",
        link: "https://the-sawfish.github.io/seraph/games/territorialio/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territorial.io", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Territory+Conquest"]
    },
    slope: {
        name: "Slope",
        developer: "Sawfish",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=Sl",
        category: "Games / Arcade",
        description: "Fast-paced ball rolling game through an endless slope.",
        features: "Endless runner mechanics, obstacle avoidance, high scores.",
        additional: "A thrilling test of reflexes and timing.",
        link: "https://the-sawfish.github.io/seraph/games/slope/index.html",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Slope+Game", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Ball+Rolling"]
    },
    agentminimax: {
        name: "Agent Minimax",
        developer: "MiniMax",
        icon: "https://via.placeholder.com/100x100/4da3ff/ffffff?text=AM",
        category: "Productivity / AI Tools",
        description: "AI-powered task management and automation assistant.",
        features: "Smart scheduling, task prioritization, workflow automation.",
        additional: "Boost your productivity with AI assistance.",
        link: "https://agent.minimax.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Agent+Minimax", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=AI+Assistant"],
        isDev: true
    },
    githubio: {
        name: "GitHub.io",
        developer: "GitHub",
        icon: "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/github.svg",
        category: "Productivity / Web Publishing",
        description: "Free static web hosting for GitHub repositories.",
        features: "Free hosting, custom domains, HTTPS support.",
        additional: "Deploy static sites directly from your repositories.",
        link: "https://github.io/",
        screenshots: ["https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=GitHub+Pages", "https://via.placeholder.com/400x250/1a1a2e/4da3ff?text=Static+Hosting"],
        isDev: true
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
    // Clear any welcome modal flags to prevent blocking
    localStorage.removeItem('sawfish_welcome_acknowledged');
    localStorage.removeItem('sawfish_visited');
    initializeElements();
    detectPWA();
    setupEventListeners();
    loadAllRatings();
    // checkFirstVisit(); // Disabled to prevent modal blocking
    removeLoadingClass();
    
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
    console.log('Initializing LikeSystem...');
    LikeSystem.init();
    
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
    setupFAQListeners();
    
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
        closeBtn.addEventListener('click', () => {
            DeveloperMode.logout();
        });
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
    
    const devLoginBtn = document.getElementById('developer-login-button');
    if (devLoginBtn) {
        devLoginBtn.addEventListener('click', () => DeveloperMode.toggleLogin());
    }
    
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
    
    const exitDevBtn = document.getElementById('exit-developer-mode');
    if (exitDevBtn) {
        exitDevBtn.addEventListener('click', () => {
            DeveloperMode.logout();
        });
    }
    
    // Exit developer mode button in sidebar
    const exitDevBtnSidebar = document.getElementById('exit-developer-mode-btn');
    if (exitDevBtnSidebar) {
        exitDevBtnSidebar.addEventListener('click', () => {
            DeveloperMode.logout();
        });
    }
    
    const devModal = document.getElementById('developer-login-modal');
    if (devModal) {
        const backdrop = devModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => DeveloperMode.closeLoginModal());
        }
    }
    
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
    
    // Developer page login button
    const devPageLoginBtn = document.getElementById('developer-page-login-btn');
    if (devPageLoginBtn) {
        devPageLoginBtn.addEventListener('click', () => {
            const modal = document.getElementById('developer-login-modal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.setAttribute('aria-hidden', 'false');
            }
        });
    }
}

function setupAuthModalListeners() {
    // Already handled in UserAuth.setupAuthListeners()
}

function setupOfflineTagListeners() {
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

function setupFAQListeners() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                    }
                });
                
                // Toggle current item
                item.classList.toggle('active', !isActive);
            });
            
            // Allow keyboard navigation
            question.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    question.click();
                }
            });
        }
    });
}

// ============================================================
// NAVIGATION FUNCTIONS
// ============================================================
function switchTab(tabName) {
    // Check if accessing developer tab without login
    if (tabName === 'developer') {
        if (!DeveloperMode.isLoggedIn && !UserAuth.isDeveloperMode) {
            // Show developer login modal instead of opening the tab
            const modal = document.getElementById('developer-login-modal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.setAttribute('aria-hidden', 'false');
            }
            return; // Don't switch to developer tab
        }
    }
    
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
    
    // Populate developer grids when developer tab is shown
    if (tabName === 'developer' && (DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode)) {
        populateDeveloperResources();
        populateDeveloperProductivity();
        populateDeveloperPublishing();
    }
    
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
    
    if (appId === 'minecraft') {
        MinecraftReGuest.showWarning(appId, app.name, app.link, app);
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
    const isMinecraft = appId === 'minecraft';
    const reguestBanner = isMinecraft ? `
        <div class="reguest-banner expanded-reguest-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Re-Guest Required for Multiplayer</span>
        </div>
    ` : '';
    
    return `
        <article class="expanded-app" data-app="${appId}">
            ${reguestBanner}
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
                ${isMinecraft ? `
                <a href="${app.link}" target="_blank" rel="noopener noreferrer" class="featured-btn" style="background: #5c8a3d;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Launch Game
                </a>
                ` : ''}
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
        
        const form = document.getElementById(`comment-form-${appId}`);
        if (form) {
            form.querySelectorAll('.rating-num-btn').forEach(btn => btn.classList.remove('active'));
        }
        
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
    
    if (!container) {
        console.error('Review container not found for app:', appId);
        return;
    }
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p class="muted">No reviews yet. Be the first to leave a review!</p>';
        return;
    }
    
    // Ensure reviews is an array
    const reviewArray = Array.isArray(reviews) ? reviews : [reviews];
    
    container.innerHTML = reviewArray.map(review => {
        if (!review) return '';
        
        const isDeveloperReview = review.isDeveloper === true;
        const reviewClass = isDeveloperReview ? 'comment-item developer-response' : 'comment-item';
        
        // Safely get user information with fallbacks
        const userName = review.user || review.username || review.author || 'Anonymous';
        const userRating = review.rating || review.stars || 0;
        const userComment = review.comment || review.text || review.review || '';
        const userAvatar = review.userAvatar || review.avatarUrl || review.avatar || null;
        const reviewTimestamp = review.timestamp || review.date || review.createdAt || new Date().toISOString();
        
        let avatarHtml = '';
        if (userAvatar) {
            avatarHtml = `<img src="${escapeHtml(userAvatar)}" alt="${escapeHtml(userName)}" class="comment-avatar-img">`;
        } else if (isDeveloperReview) {
            avatarHtml = `<div class="comment-avatar developer">D</div>`;
        } else {
            const initial = userName.charAt(0).toUpperCase();
            avatarHtml = `<div class="comment-avatar">${escapeHtml(initial)}</div>`;
        }
        
        return `
            <div class="${reviewClass}" data-review-id="${review.id || ''}">
                <div class="comment-header">
                    <div class="comment-author">
                        ${avatarHtml}
                        <span class="comment-name">${escapeHtml(userName)}</span>
                        ${isDeveloperReview ? '<span class="developer-badge">Developer</span>' : ''}
                    </div>
                    <div>
                        <span class="comment-rating">${userRating}/5</span>
                        <span class="comment-date">${formatDate(reviewTimestamp)}</span>
                    </div>
                </div>
                ${userComment ? `<div class="comment-body">${escapeHtml(userComment)}</div>` : '<div class="comment-body muted">No comment provided</div>'}
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
    const isDevMode = DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode;
    const cards = document.querySelectorAll('.page[data-page="games"] .app-card');
    
    cards.forEach(card => {
        const appId = card.dataset.app;
        const app = appData[appId];
        
        // First check if this card should be visible based on developer mode
        if (app && app.isDev && !isDevMode) {
            card.style.display = 'none';
            return;
        }
        
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
// WELCOME MODAL - DISABLED TO PREVENT BLOCKING
// ============================================================
function showWelcomeModal(isFirstVisit) {
    // Modal disabled - do nothing
    return;
    
    // Original code commented out below:
    /*if (!elements.welcomeModal) return;
    
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
    elements.welcomeModal.setAttribute('aria-hidden', 'false');*/
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

function getNumericRatingDisplay(rating) {
    if (rating === null || rating === undefined) return '<span class="rating-na">—</span>';
    return `<span class="rating-number">${rating.toFixed(1)}</span>`;
}

function updateDevOnlyElements() {
    // Only hide elements that are NOT pages (pages are handled by switchTab)
    const devOnlyElements = document.querySelectorAll('.developer-only:not(.page)');
    const devNavItems = document.querySelectorAll('.developer-nav-item');
    const devToolsNavItems = document.querySelectorAll('.developer-tools-nav-item');
    const isDev = DeveloperMode.isLoggedIn || UserAuth.isDeveloperMode;

    // Add/remove developer mode class on body for CSS styling
    if (isDev) {
        document.body.classList.add('developer-mode-active');
    } else {
        document.body.classList.remove('developer-mode-active');
    }

    // Hide elements that should only be visible when logged in as developer
    devOnlyElements.forEach(el => {
        if (isDev) {
            el.style.display = '';
            el.classList.add('visible');
        } else {
            el.style.display = 'none';
            el.classList.remove('visible');
        }
    });

    // Hide nav items that should only be visible when logged in
    devNavItems.forEach(el => {
        el.style.removeProperty('display');
        el.setAttribute('data-dev-hidden', isDev ? 'false' : 'true');
        if (!isDev) {
            el.style.display = 'none';
        }
    });

    devToolsNavItems.forEach(el => {
        el.style.removeProperty('display');
        el.setAttribute('data-dev-hidden', isDev ? 'false' : 'true');
        if (!isDev) {
            el.style.display = 'none';
        }
    });

    // Populate developer grids when developer mode is active
    if (isDev) {
        populateDeveloperResources();
        populateDeveloperProductivity();
        populateDeveloperPublishing();
    }
}

function populateDeveloperResources() {
    const grid = document.getElementById('developer-resources-grid');
    console.log('Developer Resources Grid found:', grid);
    if (!grid) return;

    // Clear existing content and repopulate
    grid.innerHTML = '';

    // Development tools
    const devTools = Object.entries(appData)
        .filter(([id, app]) => app.isDev === true &&
            (app.name === 'Piskel' || app.name === 'VS Code Web' || app.name === 'ShaderToy'))
        .map(([id, app]) => createAppCard(id, app));

    console.log('Developer Resources found:', devTools.length);
    grid.innerHTML = devTools.join('') || '<p class="muted">No development resources available.</p>';
    addCardClickHandlers(grid);
}

function populateDeveloperProductivity() {
    const grid = document.getElementById('developer-productivity-grid');
    console.log('Developer Productivity Grid found:', grid);
    if (!grid) return;
    
    // Clear existing content and repopulate
    grid.innerHTML = '';
    
    // AI and productivity tools
    const productivityTools = Object.entries(appData)
        .filter(([id, app]) => app.isDev === true && 
            (app.name === 'Agent Minimax' || app.name === 'TiddlyWiki'))
        .map(([id, app]) => createAppCard(id, app));
    
    console.log('Developer Productivity tools found:', productivityTools.length);
    grid.innerHTML = productivityTools.join('') || '<p class="muted">No productivity tools available.</p>';
    addCardClickHandlers(grid);
}

function populateDeveloperPublishing() {
    const grid = document.getElementById('developer-publishing-grid');
    console.log('Developer Publishing Grid found:', grid);
    if (!grid) return;
    
    // Clear existing content and repopulate
    grid.innerHTML = '';
    
    // Web publishing tools
    const publishingTools = Object.entries(appData)
        .filter(([id, app]) => app.isDev === true && 
            (app.name === 'GitHub.io' || app.name === 'Neocities'))
        .map(([id, app]) => createAppCard(id, app));
    
    console.log('Developer Publishing tools found:', publishingTools.length);
    grid.innerHTML = publishingTools.join('') || '<p class="muted">No web publishing tools available.</p>';
    addCardClickHandlers(grid);
}

function createAppCard(appId, app) {
    const displayName = app.name;
    return `
        <article class="app-card developer-only" data-app="${appId}">
            <div class="card-icon">
                <img src="${app.icon}" alt="${escapeHtml(displayName)} Icon" loading="lazy">
            </div>
            <div class="card-content">
                <h4>${escapeHtml(displayName)}</h4>
                <p class="card-desc">${escapeHtml(app.description.substring(0, 80))}${app.description.length > 80 ? '...' : ''}</p>
            </div>
        </article>
    `;
}

function addCardClickHandlers(container) {
    container.querySelectorAll('.app-card').forEach(card => {
        card.addEventListener('click', function() {
            const appId = this.dataset.app;
            if (appId) {
                openExpandedApp(appId);
            }
        });
    });
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
