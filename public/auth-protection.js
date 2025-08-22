// auth-protection.js - À inclure dans toutes les pages admin
// Script de protection pour l'interface d'administration

(function() {
    'use strict';

    // Configuration
    const AUTH_CONFIG = {
        sessionKey: 'dj_admin_logged_in',
        userKey: 'dj_admin_user',
        timeKey: 'dj_login_time',
        loginPage: '/admin-login.html',
        sessionDuration: 24 * 60 * 60 * 1000, // 24 heures en ms
        inactivityTimeout: 30 * 60 * 1000 // 30 minutes en ms
    };

    // Fonction principale de vérification
    function checkAuthentication() {
        if (!isLoggedIn()) {
            redirectToLogin();
            return false;
        }
        
        initializeAuthenticatedSession();
        return true;
    }

    // Vérifier si l'utilisateur est connecté
    function isLoggedIn() {
        const loggedIn = sessionStorage.getItem(AUTH_CONFIG.sessionKey);
        const loginTime = sessionStorage.getItem(AUTH_CONFIG.timeKey);
        
        if (!loggedIn || !loginTime) {
            return false;
        }
        
        // Vérifier l'expiration de session
        const loginDate = new Date(loginTime);
        const now = new Date();
        const timeDiff = now - loginDate;
        
        if (timeDiff > AUTH_CONFIG.sessionDuration) {
            clearSession();
            return false;
        }
        
        return true;
    }

    // Initialiser la session authentifiée
    function initializeAuthenticatedSession() {
        // Afficher l'indicateur de connexion
        showAuthIndicator();
        
        // Démarrer le timer d'inactivité
        startInactivityTimer();
        
        // Écouter les événements d'activité
        attachActivityListeners();
        
        console.log('✅ Session admin active:', {
            user: sessionStorage.getItem(AUTH_CONFIG.userKey),
            loginTime: sessionStorage.getItem(AUTH_CONFIG.timeKey)
        });
    }

    // Rediriger vers la page de connexion
    function redirectToLogin() {
        const currentPage = window.location.pathname;
        
        // Sauvegarder la page actuelle pour redirection après connexion
        if (currentPage !== AUTH_CONFIG.loginPage) {
            sessionStorage.setItem('dj_redirect_after_login', currentPage);
        }
        
        window.location.href = AUTH_CONFIG.loginPage;
    }

    // Nettoyer la session
    function clearSession() {
        sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
        sessionStorage.removeItem(AUTH_CONFIG.userKey);
        sessionStorage.removeItem(AUTH_CONFIG.timeKey);
    }

    // Déconnexion
    function logout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            clearSession();
            sessionStorage.removeItem('dj_redirect_after_login');
            
            // Log déconnexion
            console.log('🚪 Déconnexion admin');
            // Remove admin bar class on logout
            try { document.body.classList.remove('has-admin-bar'); } catch (_) {}
            
            redirectToLogin();
        }
    }

    // Afficher l'indicateur de connexion
    function showAuthIndicator() {
        const username = sessionStorage.getItem(AUTH_CONFIG.userKey);
        
        // Créer la barre d'admin si elle n'existe pas
        if (!document.getElementById('admin-auth-bar')) {
            const authBar = document.createElement('div');
            authBar.id = 'admin-auth-bar';
            authBar.innerHTML = `
                <style>
                    #admin-auth-bar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(45deg, #28a745, #20c997);
                        color: white;
                        padding: 8px 15px;
                        font-size: 0.9rem;
                        z-index: 9999;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    #admin-auth-bar .auth-info {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    #admin-auth-bar .logout-btn {
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 4px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        transition: all 0.3s ease;
                    }
                    #admin-auth-bar .logout-btn:hover {
                        background: rgba(255,255,255,0.3);
                    }
                </style>
                <div class="auth-info">
                    <span>🔐 Mode Admin</span>
                    <span>👤 ${username}</span>
                    <span id="session-timer">⏱️ Session active</span>
                </div>
                <button class="logout-btn" onclick="window.djAuth.logout()">🚪 Déconnexion</button>
            `;
            
            document.body.insertBefore(authBar, document.body.firstChild);
        }
        
        // Add class to body so the app header can offset correctly
        try { document.body.classList.add('has-admin-bar'); } catch (_) {}

        // Mettre à jour le timer de session
        updateSessionTimer();
    }

    // Mettre à jour l'affichage du timer de session
    function updateSessionTimer() {
        const timerEl = document.getElementById('session-timer');
        if (!timerEl) return;
        
        const loginTime = new Date(sessionStorage.getItem(AUTH_CONFIG.timeKey));
        const now = new Date();
        const elapsed = Math.floor((now - loginTime) / 1000 / 60); // minutes
        
        timerEl.textContent = `⏱️ Session: ${elapsed}min`;
        
        // Mettre à jour toutes les 30 secondes
        setTimeout(updateSessionTimer, 30000);
    }

    // Timer d'inactivité
    let inactivityTimer;
    
    function startInactivityTimer() {
        resetInactivityTimer();
    }
    
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        
        inactivityTimer = setTimeout(() => {
            alert('⚠️ Session expirée par inactivité (30 minutes)');
            logout();
        }, AUTH_CONFIG.inactivityTimeout);
    }

    // Écouter les événements d'activité
    function attachActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, resetInactivityTimer, true);
        });
    }

    // Fonction pour protéger des éléments spécifiques
    function protectElement(selector, message = 'Accès réservé aux administrateurs') {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            if (!isLoggedIn()) {
                element.style.display = 'none';
                
                // Créer un message de protection
                const protectionMsg = document.createElement('div');
                protectionMsg.innerHTML = `
                    <div style="
                        background: #f8d7da;
                        color: #721c24;
                        padding: 15px;
                        border-radius: 8px;
                        text-align: center;
                        border: 1px solid #f5c6cb;
                        margin: 10px 0;
                    ">
                        🔒 ${message}
                    </div>
                `;
                
                element.parentNode.insertBefore(protectionMsg, element);
            }
        });
    }

    // API publique
    window.djAuth = {
        checkAuth: checkAuthentication,
        isLoggedIn: isLoggedIn,
        logout: logout,
        protectElement: protectElement,
        getUser: () => sessionStorage.getItem(AUTH_CONFIG.userKey)
    };

    // Auto-exécution au chargement
    document.addEventListener('DOMContentLoaded', function() {
        // Vérifier si on est sur la page de login
        if (window.location.pathname.includes('admin-login')) {
            return; // Ne pas vérifier l'auth sur la page de login
        }
        
        // Vérifier l'authentification
        checkAuthentication();
    });

    // Empêcher l'accès direct aux fonctions sensibles
    Object.freeze(window.djAuth);

})();

// Fonction helper pour créer des éléments protégés
function createProtectedButton(text, onclick, className = '') {
    if (!window.djAuth.isLoggedIn()) {
        return document.createElement('span'); // Élément vide si pas connecté
    }
    
    const button = document.createElement('button');
    button.textContent = text;
    button.className = className;
    button.onclick = onclick;
    return button;
}

// Fonction helper pour les requêtes API authentifiées
async function authenticatedFetch(url, options = {}) {
    if (!window.djAuth.isLoggedIn()) {
        throw new Error('Authentication required');
    }
    
    // Ajouter un header d'identification admin
    const authOptions = {
        ...options,
        headers: {
            ...options.headers,
            'X-Admin-User': window.djAuth.getUser(),
            'X-Admin-Session': sessionStorage.getItem('dj_admin_logged_in')
        }
    };
    
    try {
        const response = await fetch(url, authOptions);
        
        // Si erreur d'auth côté serveur, déconnecter
        if (response.status === 401 || response.status === 403) {
            window.djAuth.logout();
            throw new Error('Session expired');
        }
        
        return response;
    } catch (error) {
        console.error('Authenticated fetch error:', error);
        throw error;
    }
}

// Export pour modules ES6 si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { djAuth: window.djAuth, authenticatedFetch };
}
