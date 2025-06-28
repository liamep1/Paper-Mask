// core-game.js - Hovedspilllogikk

class GameManager {
    constructor() {
        this.gameMode = null; // 'local' eller 'online'
        this.gameState = null;
        this.players = [];
        this.words = [];
        this.roles = {};
        this.currentPlayerIndex = 0;
        this.eliminatedPlayers = [];
        this.votes = {};
        this.settings = { ...DEFAULT_SETTINGS };
        this.timer = null;
        this.timerSeconds = 0;
        this.timerStatus = TIMER_STATUS.STOPPED;
        
        // Multiplayer spesifikke
        this.isMultiplayerMode = false;
        this.currentGame = null;
        this.currentPlayer = null;
        this.gameSubscription = null;
        this.playersSubscription = null;
        
        this.loadSettings();
    }

    // === GRUNNLEGGENDE SPILLFUNKSJONER ===

    startLocalGame() {
        this.gameMode = 'local';
        this.isMultiplayerMode = false;
        this.showPage('local-game-setup');
    }

    addPlayer(name) {
        if (!name || name.trim() === '') {
            this.showNotification('Spillernavn kan ikke være tomt', NOTIFICATION_TYPES.ERROR);
            return false;
        }

        name = name.trim();
        
        if (this.players.includes(name)) {
            this.showNotification('Dette navnet er allerede tatt', NOTIFICATION_TYPES.ERROR);
            return false;
        }

        if (this.players.length >= GAME_CONFIG.MAX_PLAYERS_LOCAL) {
            this.showNotification(`Maksimum ${GAME_CONFIG.MAX_PLAYERS_LOCAL} spillere i lokalt spill`, NOTIFICATION_TYPES.ERROR);
            return false;
        }

        this.players.push(name);
        this.updatePlayersListUI();
        this.updateStartGameButton();
        return true;
    }

    removePlayer(index) {
        if (index >= 0 && index < this.players.length) {
            const removedPlayer = this.players.splice(index, 1)[0];
            this.updatePlayersListUI();
            this.updateStartGameButton();
            this.showNotification(`${removedPlayer} fjernet`, NOTIFICATION_TYPES.INFO);
        }
    }

    updatePlayersListUI() {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        if (this.players.length === 0) {
            playersList.innerHTML = '<p class="lobby-waiting">Ingen spillere lagt til ennå...</p>';
            return;
        }

        playersList.innerHTML = this.players.map((player, index) => `
            <div class="player-item">
                <span class="player-name">${player}</span>
                <button class="remove-btn" onclick="gameManager.removePlayer(${index})">✕</button>
            </div>
        `).join('');
    }

    updateStartGameButton() {
        const startBtn = document.getElementById('start-local-game-btn');
        if (!startBtn) return;

        const canStart = this.players.length >= GAME_CONFIG.MIN_PLAYERS;
        startBtn.disabled = !canStart;
        
        if (canStart) {
            startBtn.textContent = `🚀 Start Spill (${this.players.length} spillere)`;
        } else {
            startBtn.textContent = `Start Spill (${this.players.length}/${GAME_CONFIG.MIN_PLAYERS} spillere)`;
        }
    }

    startLocalGameplay() {
        if (this.players.length < GAME_CONFIG.MIN_PLAYERS) {
            this.showNotification(`Minimum ${GAME_CONFIG.MIN_PLAYERS} spillere kreves`, NOTIFICATION_TYPES.ERROR);
            return;
        }

        this.assignRoles();
        this.gameState = GAME_STATUS.REVEALING;
        this.currentPlayerIndex = 0;
        this.eliminatedPlayers = [];
        this.votes = {};

        this.showPage('game-page');
        this.showGameSection('word-reveal');
        this.showCurrentPlayerWord();
    }

    assignRoles() {
        console.log('🎲 Tildeler roller til', this.players.length, 'spillere');

        // Velg tilfeldig ordpar
        const wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        const normalWord = wordPair.normal;
        const undercoverWord = wordPair.undercover;

        // Bland spillere
        const shuffledPlayers = [...this.players].sort(() => Math.random() - 0.5);
        
        // Reset roller og ord
        this.roles = {};
        this.words = [];

        let roleIndex = 0;
        const undercoverCount = this.settings.undercoverCount;
        const hasMrWhite = this.settings.enableMrWhite;

        // Tildel Mr. White først (hvis aktivert)
        if (hasMrWhite && shuffledPlayers.length > 0) {
            const player = shuffledPlayers[roleIndex];
            this.roles[player] = PLAYER_ROLES.MR_WHITE;
            this.words.push({
                player: player,
                word: null,
                role: PLAYER_ROLES.MR_WHITE
            });
            roleIndex++;
            console.log('👤', player, '→ Mr. White');
        }

        // Tildel Undercover roller
        for (let i = 0; i < undercoverCount && roleIndex < shuffledPlayers.length; i++) {
            const player = shuffledPlayers[roleIndex];
            this.roles[player] = PLAYER_ROLES.UNDERCOVER;
            this.words.push({
                player: player,
                word: undercoverWord,
                role: PLAYER_ROLES.UNDERCOVER
            });
            roleIndex++;
            console.log('👤', player, '→ Undercover →', undercoverWord);
        }

        // Resten får normale roller
        while (roleIndex < shuffledPlayers.length) {
            const player = shuffledPlayers[roleIndex];
            this.roles[player] = PLAYER_ROLES.NORMAL;
            this.words.push({
                player: player,
                word: normalWord,
                role: PLAYER_ROLES.NORMAL
            });
            roleIndex++;
            console.log('👤', player, '→ Normal →', normalWord);
        }

        // Tildel spesialroller
        this.assignSpecialRoles(shuffledPlayers);
        
        console.log('✅ Roller tildelt!');
    }

    assignSpecialRoles(players) {
        const availablePlayers = [...players];
        
        // The Lovers
        if (this.settings.specialRoles.lovers && availablePlayers.length >= 2) {
            const lover1 = this.removeRandomPlayer(availablePlayers);
            const lover2 = this.removeRandomPlayer(availablePlayers);
            this.addSpecialRole(lover1, PLAYER_ROLES.LOVERS);
            this.addSpecialRole(lover2, PLAYER_ROLES.LOVERS);
            console.log('💕 Lovers:', lover1, 'og', lover2);
        }

        // Andre spesialroller (én per spiller)
        const singleSpecialRoles = [
            { key: 'revenger', role: PLAYER_ROLES.REVENGER },
            { key: 'ghost', role: PLAYER_ROLES.GHOST },
            { key: 'goddess', role: PLAYER_ROLES.GUARDIAN_ANGEL },
            { key: 'doublevoter', role: PLAYER_ROLES.DOUBLE_VOTER },
            { key: 'distractor', role: PLAYER_ROLES.DISTRACTOR },
            { key: 'secretally', role: PLAYER_ROLES.SECRET_ALLY },
            { key: 'mime', role: PLAYER_ROLES.MIME },
            { key: 'justice', role: PLAYER_ROLES.JUSTICE },
            { key: 'liampower', role: PLAYER_ROLES.LIAMPOWER }
        ];

        singleSpecialRoles.forEach(({ key, role }) => {
            if (this.settings.specialRoles[key] && availablePlayers.length > 0) {
                const player = this.removeRandomPlayer(availablePlayers);
                this.addSpecialRole(player, role);
                console.log(`🎭 ${SPECIAL_ROLES[role].name}:`, player);
            }
        });
    }

    removeRandomPlayer(players) {
        const index = Math.floor(Math.random() * players.length);
        return players.splice(index, 1)[0];
    }

    addSpecialRole(playerName, role) {
        if (!this.roles[playerName]) {
            this.roles[playerName] = role;
        } else {
            // Hvis spilleren allerede har en rolle, legg til spesialrolle
            if (typeof this.roles[playerName] === 'string') {
                this.roles[playerName] = [this.roles[playerName], role];
            } else {
                this.roles[playerName].push(role);
            }
        }
    }

    showCurrentPlayerWord() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const playerWord = this.words.find(w => w.player === currentPlayer);
        
        document.getElementById('current-player-name').textContent = `${currentPlayer}s tur`;
        
        const wordCard = document.getElementById('word-card');
        const wordText = document.getElementById('word-text');
        const roleIndicator = document.getElementById('role-indicator');

        // Reset kort
        wordCard.className = 'word-card clickable';
        wordText.textContent = 'Trykk for å se ditt ord';
        roleIndicator.textContent = '';

        // Sett opp click handler
        wordCard.onclick = () => this.revealWord();
    }

    revealWord() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const playerWord = this.words.find(w => w.player === currentPlayer);
        const wordCard = document.getElementById('word-card');
        const wordText = document.getElementById('word-text');
        const roleIndicator = document.getElementById('role-indicator');

        if (!playerWord) return;

        // Vis ord og rolle
        if (playerWord.role === PLAYER_ROLES.MR_WHITE) {
            wordText.textContent = 'DU ER MR. WHITE';
            roleIndicator.textContent = 'Du vet ikke ordet! Prøv å gjette hva de andre snakker om.';
            wordCard.className = 'word-card mr-white';
        } else {
            wordText.textContent = playerWord.word;
            if (playerWord.role === PLAYER_ROLES.UNDERCOVER) {
              
                wordCard.className = 'word-card undercover';
            } else {
               
                wordCard.className = 'word-card normal';
            }
        }

        // Sjekk for spesialroller
        const playerRoles = this.roles[currentPlayer];
        if (playerRoles) {
            const roles = Array.isArray(playerRoles) ? playerRoles : [playerRoles];
            const specialRoles = roles.filter(role => role !== PLAYER_ROLES.NORMAL && 
                                                      role !== PLAYER_ROLES.UNDERCOVER && 
                                                      role !== PLAYER_ROLES.MR_WHITE);
            
            if (specialRoles.length > 0) {
                setTimeout(() => {
                    this.showSpecialRoleOverlay(specialRoles);
                }, 1000);
            }
        }

        wordCard.onclick = null;
    }

    showSpecialRoleOverlay(roles) {
        const overlay = document.getElementById('role-overlay');
        const title = document.getElementById('role-title');
        const description = document.getElementById('role-description');

        if (roles.length === 1) {
            const role = roles[0];
            const roleInfo = SPECIAL_ROLES[role];
            title.textContent = roleInfo.name;
            description.textContent = roleInfo.description;
            
            if (roleInfo.warning) {
                description.innerHTML += `<div class="mime-warning">${roleInfo.warning}</div>`;
            }
        } else {
            title.textContent = 'Flere spesialroller!';
            description.innerHTML = roles.map(role => {
                const roleInfo = SPECIAL_ROLES[role];
                return `<strong>${roleInfo.name}</strong><br>${roleInfo.description}`;
            }).join('<br><br>');
        }

        overlay.classList.remove('hidden');
    }

    nextPlayer() {
        this.currentPlayerIndex++;
        
        if (this.currentPlayerIndex >= this.players.length) {
            // Alle har sett sitt ord, start diskusjon
            this.startDiscussion();
        } else {
            this.showCurrentPlayerWord();
        }
    }

    startDiscussion() {
        this.gameState = GAME_STATUS.DISCUSSION;
        this.showGameSection('discussion');
        this.setupDiscussionOrder();
        this.startTimer();
    }

    setupDiscussionOrder() {
        const orderList = document.getElementById('order-list');
        const shuffledPlayers = [...this.players].sort(() => Math.random() - 0.5);
        
        orderList.innerHTML = shuffledPlayers.map((player, index) => `
            <div class="order-item">
                <span class="order-number">${index + 1}.</span>
                <span class="player-name">${player}</span>
            </div>
        `).join('');
    }

    startTimer() {
        this.timerSeconds = this.settings.timerDuration;
        this.timerStatus = TIMER_STATUS.RUNNING;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            if (this.timerStatus === TIMER_STATUS.RUNNING) {
                this.timerSeconds--;
                this.updateTimerDisplay();
                
                if (this.timerSeconds <= 0) {
                    this.stopTimer();
                    this.showNotification('Tiden er ute!', NOTIFICATION_TYPES.WARNING);
                }
            }
        }, 1000);
    }

    toggleTimer() {
        if (this.timerStatus === TIMER_STATUS.RUNNING) {
            this.pauseTimer();
        } else if (this.timerStatus === TIMER_STATUS.PAUSED) {
            this.resumeTimer();
        }
    }

    pauseTimer() {
        this.timerStatus = TIMER_STATUS.PAUSED;
        document.getElementById('timer-toggle').textContent = '▶️';
    }

    resumeTimer() {
        this.timerStatus = TIMER_STATUS.RUNNING;
        document.getElementById('timer-toggle').textContent = '⏸️';
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.timerStatus = TIMER_STATUS.STOPPED;
        document.getElementById('timer-toggle').textContent = '⏸️';
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('timer');
        if (!timerElement) return;

        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        timerElement.textContent = timeString;
        
        // Endre farge basert på tid
        timerElement.className = 'timer';
        if (this.timerSeconds <= 30) {
            timerElement.classList.add('urgent');
        } else if (this.timerSeconds <= 60) {
            timerElement.classList.add('warning');
        }
    }

    startVoting() {
        this.stopTimer();
        this.gameState = GAME_STATUS.VOTING;
        this.showGameSection('voting');
        this.setupVotingCards();
    }

    setupVotingCards() {
        const votingCards = document.getElementById('voting-cards');
        const alivePlayers = this.players.filter(player => !this.eliminatedPlayers.includes(player));
        
        votingCards.innerHTML = alivePlayers.map(player => `
            <div class="vote-card" onclick="gameManager.vote('${player}')">
                <div class="vote-player-name">${player}</div>
                <div class="vote-count" id="vote-count-${player}">0 stemmer</div>
            </div>
        `).join('');
        
        this.votes = {};
        document.getElementById('finish-vote-btn').disabled = true;
    }

    vote(playerName) {
        // I lokalt spill, bare registrer stemme
        this.votes[playerName] = (this.votes[playerName] || 0) + 1;
        this.updateVoteDisplay();
        
        // Sjekk om alle har stemt
        const totalVotes = Object.values(this.votes).reduce((sum, count) => sum + count, 0);
        const alivePlayers = this.players.filter(player => !this.eliminatedPlayers.includes(player));
        
        if (totalVotes >= alivePlayers.length) {
            document.getElementById('finish-vote-btn').disabled = false;
        }
    }

    updateVoteDisplay() {
        Object.keys(this.votes).forEach(player => {
            const countElement = document.getElementById(`vote-count-${player}`);
            if (countElement) {
                const count = this.votes[player];
                countElement.textContent = `${count} stemme${count !== 1 ? 'r' : ''}`;
            }
        });
    }

    finishVoting() {
        const results = this.calculateVoteResults();
        this.gameState = GAME_STATUS.RESULTS;
        this.showGameSection('results');
        this.showVoteResults(results);
    }

    calculateVoteResults() {
        const maxVotes = Math.max(...Object.values(this.votes));
        const winners = Object.keys(this.votes).filter(player => this.votes[player] === maxVotes);
        
        return {
            eliminated: winners.length === 1 ? winners[0] : null,
            tied: winners.length > 1 ? winners : null,
            votes: this.votes,
            maxVotes: maxVotes
        };
    }

    showVoteResults(results) {
        const resultDisplay = document.getElementById('result-display');
        
        if (results.tied) {
            resultDisplay.innerHTML = `
                <div class="result-card">
                    <h3>🤝 Uavgjort!</h3>
                    <p>Følgende spillere fikk ${results.maxVotes} stemmer:</p>
                    <p><strong>${results.tied.join(', ')}</strong></p>
                    <p>Ingen blir eliminert denne runden.</p>
                </div>
            `;
        } else {
            const eliminated = results.eliminated;
            this.eliminatedPlayers.push(eliminated);
            
            resultDisplay.innerHTML = `
                <div class="result-card">
                    <h3>📊 Avstemningsresultat</h3>
                    <p><strong>${eliminated}</strong> ble eliminert med ${results.maxVotes} stemmer.</p>
                </div>
            `;
            
            // Sjekk seiersbetingelser
            const winResult = this.checkWinConditions();
            if (winResult) {
                this.showVictoryScreen(winResult);
                return;
            }
        }
    }

    checkWinConditions() {
        const alivePlayers = this.players.filter(player => !this.eliminatedPlayers.includes(player));
        const aliveRoles = alivePlayers.map(player => this.roles[player]);
        
        const normalPlayers = aliveRoles.filter(role => 
            role === PLAYER_ROLES.NORMAL || 
            (Array.isArray(role) && role.includes(PLAYER_ROLES.NORMAL))
        ).length;
        
        const undercoverPlayers = aliveRoles.filter(role => 
            role === PLAYER_ROLES.UNDERCOVER || 
            (Array.isArray(role) && role.includes(PLAYER_ROLES.UNDERCOVER))
        ).length;
        
        const mrWhitePlayers = aliveRoles.filter(role => 
            role === PLAYER_ROLES.MR_WHITE || 
            (Array.isArray(role) && role.includes(PLAYER_ROLES.MR_WHITE))
        ).length;

        // Undercover vinner hvis de er like mange eller flere enn normale spillere
        if (undercoverPlayers > 0 && undercoverPlayers >= normalPlayers) {
            return {
                winner: 'Undercover',
                message: 'Undercover-spillerne har overtatt kontrollen!',
                details: `${undercoverPlayers} Undercover vs ${normalPlayers} normale spillere`
            };
        }

        // Normale spillere vinner hvis alle undercover og mr. white er eliminert
        if (undercoverPlayers === 0 && mrWhitePlayers === 0) {
            return {
                winner: 'Normale spillere',
                message: 'Alle skjulte roller er eliminert!',
                details: 'Normale spillere vinner!'
            };
        }

        return null; // Spillet fortsetter
    }

    continueGame() {
        // Gå tilbake til diskusjon med gjenværende spillere
        this.startDiscussion();
    }

    endGame() {
        this.showPage('main-menu');
        this.resetGame();
    }

    resetGame() {
        this.gameState = null;
        this.players = [];
        this.words = [];
        this.roles = {};
        this.currentPlayerIndex = 0;
        this.eliminatedPlayers = [];
        this.votes = {};
        this.stopTimer();
    }

    // === UI HJELPEFUNKSJONER ===

    showPage(pageId) {
        document.querySelectorAll('.container').forEach(container => {
            container.classList.add('hidden');
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
    }

    showGameSection(sectionId) {
        document.querySelectorAll('.game-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    }

    showNotification(message, type = NOTIFICATION_TYPES.INFO) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);

        // Auto-fjern etter 3 sekunder
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, GAME_CONFIG.NOTIFICATION_DURATION);

        // Klikk for å fjerne
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }

    // === INNSTILLINGER ===

    loadSettings() {
        const saved = localStorage.getItem('undercover-settings');
        if (saved) {
            try {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('Kunne ikke laste innstillinger:', e);
                this.settings = { ...DEFAULT_SETTINGS };
            }
        }
        this.applySettingsToUI();
    }

    saveSettings() {
        this.collectSettingsFromUI();
        localStorage.setItem('undercover-settings', JSON.stringify(this.settings));
        this.showNotification('Innstillinger lagret!', NOTIFICATION_TYPES.SUCCESS);
    }

    applySettingsToUI() {
        // Timer
        const timerSelect = document.getElementById('timer-duration');
        if (timerSelect) timerSelect.value = this.settings.timerDuration;

        // Mr. White
        const mrWhiteCheckbox = document.getElementById('enable-mr-white');
        if (mrWhiteCheckbox) mrWhiteCheckbox.checked = this.settings.enableMrWhite;

        // Undercover count
        const undercoverSelect = document.getElementById('undercover-count-setting');
        if (undercoverSelect) undercoverSelect.value = this.settings.undercoverCount;

        // Spesialroller
        Object.keys(this.settings.specialRoles).forEach(role => {
            const checkbox = document.getElementById(`enable-${role}`);
            if (checkbox) checkbox.checked = this.settings.specialRoles[role];
        });

        // LiamPower beskrivelse
        const liampowerDesc = document.getElementById('liampower-description');
        if (liampowerDesc) liampowerDesc.value = this.settings.liampowerDescription || '';
    }

    collectSettingsFromUI() {
        // Timer
        const timerSelect = document.getElementById('timer-duration');
        if (timerSelect) this.settings.timerDuration = parseInt(timerSelect.value);

        // Mr. White
        const mrWhiteCheckbox = document.getElementById('enable-mr-white');
        if (mrWhiteCheckbox) this.settings.enableMrWhite = mrWhiteCheckbox.checked;

        // Undercover count
        const undercoverSelect = document.getElementById('undercover-count-setting');
        if (undercoverSelect) this.settings.undercoverCount = parseInt(undercoverSelect.value);

        // Spesialroller
        Object.keys(this.settings.specialRoles).forEach(role => {
            const checkbox = document.getElementById(`enable-${role}`);
            if (checkbox) this.settings.specialRoles[role] = checkbox.checked;
        });

        // LiamPower beskrivelse
        const liampowerDesc = document.getElementById('liampower-description');
        if (liampowerDesc) this.settings.liampowerDescription = liampowerDesc.value;
    }

    showVictoryScreen(winResult) {
        this.showPage('victory-page');
        
        const titleElement = document.getElementById('victory-title');
        const iconElement = document.getElementById('victory-icon');
        const messageElement = document.getElementById('victory-message');
        const detailsElement = document.getElementById('victory-details');

        titleElement.textContent = `🎉 ${winResult.winner.toUpperCase()} VINNER! 🎉`;
        messageElement.textContent = winResult.message;
        
        // Vis spillerroller
        const roleReveals = this.players.map(player => {
            const isEliminated = this.eliminatedPlayers.includes(player);
            const playerRoles = this.roles[player];
            const word = this.words.find(w => w.player === player)?.word || 'Ukjent ord';
            
            let roleText = 'Normal';
            if (playerRoles === PLAYER_ROLES.UNDERCOVER) roleText = 'Undercover';
            else if (playerRoles === PLAYER_ROLES.MR_WHITE) roleText = 'Mr. White';
            else if (Array.isArray(playerRoles)) {
                roleText = playerRoles.map(r => {
                    if (r === PLAYER_ROLES.NORMAL) return 'Normal';
                    if (r === PLAYER_ROLES.UNDERCOVER) return 'Undercover';
                    if (r === PLAYER_ROLES.MR_WHITE) return 'Mr. White';
                    return SPECIAL_ROLES[r]?.name || r;
                }).join(', ');
            }

            return `
                <div class="player-role ${isEliminated ? 'eliminated' : 'alive'}">
                    <div class="player-name">${player}</div>
                    <div class="player-word">"${word}"</div>
                    <div class="player-role-type">${roleText}</div>
                </div>
            `;
        }).join('');

        detailsElement.innerHTML = `
            <h3>📊 Spillerroller</h3>
            <div class="role-reveals">
                ${roleReveals}
            </div>
            <p style="margin-top: 1rem; opacity: 0.8;">${winResult.details}</p>
        `;

        // Legg til konfetti-effekt
        this.createConfetti();
    }

    createConfetti() {
        const confettiContainer = document.querySelector('.confetti');
        if (!confettiContainer) return;

        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confettiContainer.appendChild(confetti);
        }

        // Fjern konfetti etter 5 sekunder
        setTimeout(() => {
            confettiContainer.innerHTML = '';
        }, 5000);
    }

    restartGame() {
        // Start nytt spill med samme spillere
        this.assignRoles();
        this.gameState = GAME_STATUS.REVEALING;
        this.currentPlayerIndex = 0;
        this.eliminatedPlayers = [];
        this.votes = {};

        this.showPage('game-page');
        this.showGameSection('word-reveal');
        this.showCurrentPlayerWord();
    }
}

// Initialiser spillmanager som global variabel
window.gameManager = new GameManager();

// === GLOBALE HJELPEFUNKSJONER ===

// Disse funksjonene kalles fra HTML onclick events
function showGameModeSelection() {
    gameManager.showPage('game-mode-selection');
    updateConnectionStatus();
}

function startLocalGame() {
    gameManager.startLocalGame();
}

function showMultiplayerOptions() {
    gameManager.showPage('multiplayer-options');
}

function showPage(pageId) {
    gameManager.showPage(pageId);
}

function addPlayer() {
    const input = document.getElementById('player-name');
    if (input && input.value.trim()) {
        if (gameManager.addPlayer(input.value.trim())) {
            input.value = '';
        }
    }
    input?.focus();
}

// Legg til Enter-key support for å legge til spillere
document.addEventListener('DOMContentLoaded', function() {
    const playerInput = document.getElementById('player-name');
    if (playerInput) {
        playerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addPlayer();
            }
        });
    }
});

function startLocalGameplay() {
    gameManager.startLocalGameplay();
}

function revealWord() {
    gameManager.revealWord();
}

function nextPlayer() {
    gameManager.nextPlayer();
}

function toggleTimer() {
    gameManager.toggleTimer();
}

function startVoting() {
    gameManager.startVoting();
}

function finishVoting() {
    gameManager.finishVoting();
}

function continueGame() {
    gameManager.continueGame();
}

function endGame() {
    gameManager.endGame();
}

function restartGame() {
    gameManager.restartGame();
}

function saveSettings() {
    gameManager.saveSettings();
}

function closeRoleOverlay() {
    document.getElementById('role-overlay').classList.add('hidden');
}

function showDeveloperOverlay() {
    document.getElementById('developer-overlay').classList.remove('hidden');
}

function closeDeveloperOverlay() {
    document.getElementById('developer-overlay').classList.add('hidden');
}

function closeGhostOverlay() {
    document.getElementById('ghost-overlay').classList.add('hidden');
}

function sendGhostHint() {
    const hintInput = document.getElementById('ghost-hint');
    const hint = hintInput.value.trim();
    
    if (hint) {
        gameManager.showNotification(`👻 Hint sendt: "${hint}"`, NOTIFICATION_TYPES.INFO);
        closeGhostOverlay();
        hintInput.value = '';
    }
}

// Tilkoblingsstatus for multiplayer
function updateConnectionStatus() {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;

    if (window.supabase) {
        indicator.textContent = '🟢 Tilkoblet';
        indicator.style.color = '#4CAF50';
    } else {
        indicator.textContent = '🔴 Ikke tilkoblet';
        indicator.style.color = '#ff4757';
    }
}