// app.js - Hovedapplikasjon og initialisering

class App {
    constructor() {
        this.initialized = false;
        this.init();
    }

    async init() {
        console.log('🚀 Initialiserer Undercover app...');
        
        // Vent til DOM er lastet
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        // Initialiser komponenter
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.checkUrlParameters();
        this.initializeSettingsUI();
        
        // Oppdater tilkoblingsstatus for multiplayer
        this.updateMultiplayerStatus();
        
        this.initialized = true;
        console.log('✅ App initialisert');
    }

    setupEventListeners() {
        // Player input - Enter key support
        const playerInput = document.getElementById('player-name');
        if (playerInput) {
            playerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addPlayer();
                }
            });
        }

        // Settings form - auto-save on change
        const settingsInputs = document.querySelectorAll('#settings-page input, #settings-page select, #settings-page textarea');
        settingsInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.autoSaveSettings();
            });
        });

        // Special role checkboxes - visual feedback
        const specialRoleCheckboxes = document.querySelectorAll('.special-role input[type="checkbox"], .mode-setting input[type="checkbox"]');
        specialRoleCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const container = e.target.closest('.special-role, .mode-setting');
                if (container) {
                    container.classList.toggle('checked', e.target.checked);
                }
            });
            
            // Set initial state
            const container = checkbox.closest('.special-role, .mode-setting');
            if (container) {
                container.classList.toggle('checked', checkbox.checked);
            }
        });

        // LiamPower checkbox - show/hide textarea
        const liampowerCheckbox = document.getElementById('enable-liampower');
        const liampowerTextarea = document.getElementById('liampower-description');
        if (liampowerCheckbox && liampowerTextarea) {
            liampowerCheckbox.addEventListener('change', () => {
                liampowerTextarea.style.display = liampowerCheckbox.checked ? 'block' : 'none';
            });
            // Set initial state
            liampowerTextarea.style.display = liampowerCheckbox.checked ? 'block' : 'none';
        }

        // Victory screen confetti click
        const victoryIcon = document.getElementById('victory-icon');
        if (victoryIcon) {
            victoryIcon.addEventListener('click', () => {
                this.createExtraConfetti();
            });
        }

        // Notification click to dismiss
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('notification')) {
                e.target.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (e.target.parentNode) {
                        e.target.remove();
                    }
                }, 300);
            }
        });

        // Close overlays on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllOverlays();
            }
        });

        // Game code input formatting
        this.setupGameCodeInput();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Unngå shortcuts hvis man skriver i input felt
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    this.closeAllOverlays();
                    break;
                case 'h':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.showPage('main-menu');
                    }
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.showPage('settings-page');
                    }
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.showPage('rules-page');
                    }
                    break;
                case ' ':
                    // Space bar for timer toggle when in discussion
                    if (document.getElementById('discussion') && !document.getElementById('discussion').classList.contains('hidden')) {
                        e.preventDefault();
                        toggleTimer();
                    }
                    break;
            }
        });
    }

    setupGameCodeInput() {
        // Hvis det finnes input felt for spillkode, formater dem
        const gameCodeInputs = document.querySelectorAll('input[placeholder*="spillkode"], input[placeholder*="kode"]');
        gameCodeInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                // Konverter til store bokstaver og fjern ugyldig tegn
                let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (value.length > GAME_CONFIG.GAME_CODE_LENGTH) {
                    value = value.substring(0, GAME_CONFIG.GAME_CODE_LENGTH);
                }
                e.target.value = value;
            });
        });
    }

    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameCode = urlParams.get('game');
        
        if (gameCode) {
            // Automatisk prøv å bli med i spill basert på URL
            console.log('🔗 Fant spillkode i URL:', gameCode);
            // Dette kan implementeres senere for deling av lenker
        }
    }

    initializeSettingsUI() {
        // Initialiser settings UI med lagrede verdier
        if (window.gameManager) {
            window.gameManager.applySettingsToUI();
        }

        // Legg til tooltips for spesialroller
        this.addSettingsTooltips();
    }

    addSettingsTooltips() {
        const specialRoles = document.querySelectorAll('.special-role, .mode-setting');
        specialRoles.forEach(role => {
            const title = role.querySelector('.role-title, .mode-title');
            const desc = role.querySelector('.role-desc, .mode-desc');
            
            if (title && desc) {
                title.title = desc.textContent;
            }
        });
    }

    autoSaveSettings() {
        // Auto-lagre innstillinger etter 1 sekund uten endringer
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if (window.gameManager) {
                window.gameManager.saveSettings();
            }
        }, 1000);
    }

    updateMultiplayerStatus() {
        // Sjekk regelmessig om Supabase er tilgjengelig
        const checkConnection = () => {
            const indicator = document.getElementById('connection-indicator');
            if (indicator) {
                if (window.supabase) {
                    indicator.textContent = '🟢 Tilkoblet';
                    indicator.style.color = '#4CAF50';
                } else {
                    indicator.textContent = '🔴 Ikke tilkoblet';
                    indicator.style.color = '#ff4757';
                }
            }
        };

        // Sjekk umiddelbart og deretter hver 5. sekund
        checkConnection();
        setInterval(checkConnection, 5000);
    }

    closeAllOverlays() {
        const overlays = document.querySelectorAll('.overlay');
        overlays.forEach(overlay => {
            overlay.classList.add('hidden');
        });
    }

    showPage(pageId) {
        if (window.gameManager) {
            window.gameManager.showPage(pageId);
        }
    }

    createExtraConfetti() {
        const confettiContainer = document.querySelector('.confetti');
        if (!confettiContainer) return;

        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fd79a8', '#6c5ce7'];
        
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
            confetti.style.width = (Math.random() * 10 + 5) + 'px';
            confetti.style.height = confetti.style.width;
            confettiContainer.appendChild(confetti);
        }

        // Fjern etter 3 sekunder
        setTimeout(() => {
            const pieces = confettiContainer.querySelectorAll('.confetti-piece');
            pieces.forEach(piece => {
                if (piece.parentNode) {
                    piece.remove();
                }
            });
        }, 3000);
    }

    // Utility functions
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    getRandomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Accessibility functions
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Performance monitoring
    logPerformance(label, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }

    // Error handling
    handleError(error, context = '') {
        console.error(`❌ Error ${context}:`, error);
        
        if (window.gameManager) {
            window.gameManager.showNotification(
                `Feil: ${error.message || 'Ukjent feil'}`,
                window.NOTIFICATION_TYPES?.ERROR || 'error'
            );
        }
    }

    // Service Worker registration (for future PWA features)
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker registrert:', registration);
            } catch (error) {
                console.log('❌ Service Worker registrering feilet:', error);
            }
        }
    }

    // Analytics (placeholder for future implementation)
    trackEvent(eventName, properties = {}) {
        console.log(`📊 Event: ${eventName}`, properties);
        // Her kan du legge til Google Analytics, Mixpanel, etc.
    }

    // Local storage utilities
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.warn('⚠️ Kunne ikke lagre til localStorage:', error);
            return false;
        }
    }

    loadFromLocalStorage(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.warn('⚠️ Kunne ikke laste fra localStorage:', error);
            return defaultValue;
        }
    }

    // Theme handling (for future dark/light mode)
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.saveToLocalStorage('theme', theme);
    }

    getTheme() {
        return this.loadFromLocalStorage('theme', 'default');
    }

    // Device detection
    isMobile() {
        return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isTouch() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    // Network status
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            if (window.gameManager) {
                window.gameManager.showNotification('🌐 Tilkoblet til internett', window.NOTIFICATION_TYPES?.SUCCESS || 'success');
            }
        });

        window.addEventListener('offline', () => {
            if (window.gameManager) {
                window.gameManager.showNotification('🚫 Mistet internetttilkobling', window.NOTIFICATION_TYPES?.WARNING || 'warning');
            }
        });
    }
}

// Initialiser app når siden lastes
const app = new App();

// Eksporter app som global variabel for debugging
window.app = app;

// === GLOBALE HJELPEFUNKSJONER ===

// Disse funksjonene kan kalles fra hvor som helst i appen
window.showNotification = function(message, type = 'info') {
    if (window.gameManager) {
        window.gameManager.showNotification(message, type);
    }
};

window.logError = function(error, context = '') {
    if (window.app) {
        window.app.handleError(error, context);
    }
};

window.trackEvent = function(eventName, properties = {}) {
    if (window.app) {
        window.app.trackEvent(eventName, properties);
    }
};

// Debug funksjoner for utvikling
window.debugApp = function() {
    console.log('🐛 App Debug Info:');
    console.log('App initialized:', window.app?.initialized);
    console.log('Game Manager:', window.gameManager);
    console.log('Multiplayer Manager:', window.multiplayerManager);
    console.log('Current page:', document.querySelector('.container:not(.hidden)')?.id);
    console.log('Local storage:', localStorage);
    console.log('Device info:', {
        mobile: window.app?.isMobile(),
        touch: window.app?.isTouch(),
        online: navigator.onLine,
        userAgent: navigator.userAgent
    });
};

window.clearGameData = function() {
    localStorage.removeItem('undercover-settings');
    if (window.gameManager) {
        window.gameManager.resetGame();
        window.gameManager.loadSettings();
    }
    console.log('🗑️ Spilldata tømt');
};

// Keyboard shortcuts info
window.showKeyboardShortcuts = function() {
    const shortcuts = [
        'Ctrl/Cmd + H: Gå til hovedmeny',
        'Ctrl/Cmd + S: Gå til innstillinger',
        'Ctrl/Cmd + R: Gå til regler',
        'Escape: Lukk overlays',
        'Space: Toggle timer (under diskusjon)',
        'Enter: Legg til spiller (i input felt)'
    ];
    
    alert('⌨️ Tastatursnarveier:\n\n' + shortcuts.join('\n'));
};

// Eksporter versjon for support
window.getVersion = function() {
    return {
        app: '2.0.0',
        built: new Date().toISOString(),
        features: ['Local multiplayer', 'Online multiplayer', 'Special roles', 'Timer', 'Settings']
    };
};

console.log('📱 Undercover v2.0.0 lastet');
console.log('💡 Bruk debugApp() for debug info eller showKeyboardShortcuts() for snarveier');