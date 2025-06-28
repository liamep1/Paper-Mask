// multiplayer.js - Komplett multiplayer funksjonalitet

class MultiplayerManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.supabase = null;
        this.currentGame = null;
        this.currentPlayer = null;
        this.gameSubscription = null;
        this.playersSubscription = null;
        this.onlinePlayers = [];
        this.pollingInterval = null;
        this.fastPollingInterval = null;
        
        this.initializeSupabase();
    }
    
    async initializeSupabase() {
        // Vent til Supabase er lastet
        if (typeof window.supabase === 'undefined') {
            setTimeout(() => this.initializeSupabase(), 500);
            return;
        }
    
        try {
            this.supabase = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey
            );
            console.log('✅ Supabase tilkoblet');
            this.updateConnectionStatus('Tilkoblet', CONNECTION_STATUS.CONNECTED);
        } catch (error) {
            console.error('❌ Supabase tilkobling feilet:', error);
            this.updateConnectionStatus('Tilkoblingsfeil', CONNECTION_STATUS.ERROR);
            setTimeout(() => this.initializeSupabase(), 5000);
        }
    }
    
    updateConnectionStatus(message, status) {
        const indicator = document.getElementById('connection-indicator');
        if (indicator) {
            const statusIcons = {
                [CONNECTION_STATUS.CONNECTED]: '🟢',
                [CONNECTION_STATUS.CONNECTING]: '🟡',
                [CONNECTION_STATUS.DISCONNECTED]: '🔴',
                [CONNECTION_STATUS.ERROR]: '🔴'
            };
            
            indicator.textContent = `${statusIcons[status]} ${message}`;
            indicator.style.color = status === CONNECTION_STATUS.CONNECTED ? '#4CAF50' : '#ff4757';
        }
    }
    
    generateGameCode() {
        let result = '';
        for (let i = 0; i < GAME_CONFIG.GAME_CODE_LENGTH; i++) {
            result += GAME_CONFIG.GAME_CODE_CHARS.charAt(
                Math.floor(Math.random() * GAME_CONFIG.GAME_CODE_CHARS.length)
            );
        }
        return result;
    }
    
    async hostGame() {
        if (!this.supabase) {
            this.gameManager.showNotification('❌ Ingen tilkobling til server. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
            return;
        }
    
        try {
            const playerName = prompt("Skriv inn ditt navn:");
            if (!playerName?.trim()) return;
    
            this.updateConnectionStatus('Oppretter spill...', CONNECTION_STATUS.CONNECTING);
            const gameCode = this.generateGameCode();
            
            // Opprett spill i database
            const { data: gameData, error: gameError } = await this.supabase
                .from('games')
                .insert([{
                    code: gameCode,
                    status: GAME_STATUS.WAITING,
                    settings: this.gameManager.settings,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
    
            if (gameError) throw gameError;
    
            // Legg til host som spiller
            const { data: playerData, error: playerError } = await this.supabase
                .from('players')
                .insert([{
                    game_id: gameData.id,
                    name: playerName.trim(),
                    is_host: true,
                    joined_at: new Date().toISOString()
                }])
                .select()
                .single();
    
            if (playerError) throw playerError;
    
            this.currentGame = gameData;
            this.currentPlayer = playerData;
            this.gameManager.isMultiplayerMode = true;
            this.gameManager.gameMode = 'online';
    
            // Start real-time subscriptions
            this.setupGameSubscriptions();
    
            // Vis spillkode til host
            this.gameManager.showNotification(`🎮 Spill opprettet! Spillkode: ${gameCode}`, NOTIFICATION_TYPES.SUCCESS);
            
            // Gå til lobby
            this.showGameLobby();
            this.updateConnectionStatus(`Host - ${gameCode}`, CONNECTION_STATUS.CONNECTED);
    
        } catch (error) {
            console.error('Feil ved hosting:', error);
            this.gameManager.showNotification(`❌ Kunne ikke starte spill: ${error.message}`, NOTIFICATION_TYPES.ERROR);
            this.updateConnectionStatus('Feil ved oppretting', CONNECTION_STATUS.ERROR);
        }
    }
    
    async joinGame() {
        if (!this.supabase) {
            this.gameManager.showNotification('❌ Ingen tilkobling til server. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
            return;
        }
    
        try {
            const gameCode = prompt("Skriv inn spillkode (6 bokstaver/tall):");
            if (!gameCode?.trim()) return;
    
            const playerName = prompt("Skriv inn ditt navn:");
            if (!playerName?.trim()) return;
    
            this.updateConnectionStatus('Blir med i spill...', CONNECTION_STATUS.CONNECTING);
    
            // Finn spillet
            const { data: gameData, error: gameError } = await this.supabase
                .from('games')
                .select('*')
                .eq('code', gameCode.toUpperCase().trim())
                .eq('status', GAME_STATUS.WAITING)
                .single();
    
            if (gameError || !gameData) {
                this.gameManager.showNotification('❌ Spillkode ikke funnet eller spillet har startet', NOTIFICATION_TYPES.ERROR);
                this.updateConnectionStatus('Feil spillkode', CONNECTION_STATUS.ERROR);
                return;
            }
    
            // Sjekk om navnet allerede er tatt
            const { data: existingPlayer } = await this.supabase
                .from('players')
                .select('name')
                .eq('game_id', gameData.id)
                .eq('name', playerName.trim());
    
            if (existingPlayer && existingPlayer.length > 0) {
                this.gameManager.showNotification('❌ Dette navnet er allerede tatt', NOTIFICATION_TYPES.ERROR);
                return;
            }
    
            // Sjekk spillergrense
            const { data: allPlayers } = await this.supabase
                .from('players')
                .select('id')
                .eq('game_id', gameData.id);
    
            if (allPlayers && allPlayers.length >= GAME_CONFIG.MAX_PLAYERS_ONLINE) {
                this.gameManager.showNotification(`❌ Spillet er fullt (${GAME_CONFIG.MAX_PLAYERS_ONLINE} spillere)`, NOTIFICATION_TYPES.ERROR);
                return;
            }
    
            // Legg til spiller
            const { data: playerData, error: playerError } = await this.supabase
                .from('players')
                .insert([{
                    game_id: gameData.id,
                    name: playerName.trim(),
                    is_host: false,
                    joined_at: new Date().toISOString()
                }])
                .select()
                .single();
    
            if (playerError) throw playerError;
    
            this.currentGame = gameData;
            this.currentPlayer = playerData;
            this.gameManager.isMultiplayerMode = true;
            this.gameManager.gameMode = 'online';
    
            // Start real-time subscriptions
            this.setupGameSubscriptions();
    
            // Gå til lobby
            this.showGameLobby();
            this.updateConnectionStatus(`Spiller - ${gameCode}`, CONNECTION_STATUS.CONNECTED);
            this.gameManager.showNotification(`🎉 Velkommen til spillet!`, NOTIFICATION_TYPES.SUCCESS);
    
        } catch (error) {
            console.error('Feil ved joining:', error);
            this.gameManager.showNotification(`❌ Kunne ikke bli med i spill: ${error.message}`, NOTIFICATION_TYPES.ERROR);
            this.updateConnectionStatus('Tilkoblingsfeil', CONNECTION_STATUS.ERROR);
        }
    }
    
    setupGameSubscriptions() {
        console.log('🔄 Setter opp real-time subscriptions...');
        
        // Stopp eksisterende subscriptions
        if (this.gameSubscription) {
            this.gameSubscription.unsubscribe();
            this.gameSubscription = null;
        }
        if (this.playersSubscription) {
            this.playersSubscription.unsubscribe();
            this.playersSubscription = null;
        }
    
        // Game subscription
        this.gameSubscription = this.supabase
            .channel(`game-${this.currentGame.id}`, {
                config: {
                    broadcast: { self: true },
                    presence: { key: this.currentPlayer.id }
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${this.currentGame.id}`
            }, (payload) => {
                console.log('🎮 Game update:', payload);
                this.handleGameUpdate(payload);
            })
            .subscribe((status) => {
                console.log('🎮 Game subscription status:', status);
            });
    
        // Players subscription
        this.playersSubscription = this.supabase
            .channel(`players-${this.currentGame.id}`, {
                config: {
                    broadcast: { self: true },
                    presence: { key: this.currentPlayer.id }
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'players',
                filter: `game_id=eq.${this.currentGame.id}`
            }, (payload) => {
                console.log('👥 Player JOINED:', payload);
                this.handlePlayerJoined(payload);
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'players',
                filter: `game_id=eq.${this.currentGame.id}`
            }, (payload) => {
                console.log('👥 Player LEFT:', payload);
                this.handlePlayerLeft(payload);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'players',
                filter: `game_id=eq.${this.currentGame.id}`
            }, (payload) => {
                console.log('👥 Player UPDATED:', payload);
                this.handlePlayerUpdated(payload);
            })
            .subscribe((status) => {
                console.log('👥 Players subscription status:', status);
                
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Real-time subscriptions aktive');
                    this.gameManager.showNotification('🔄 Real-time tilkobling aktiv', NOTIFICATION_TYPES.SUCCESS);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn('❌ Real-time tilkobling feilet, bruker kun polling');
                    this.gameManager.showNotification('⚠️ Bruker backup-synkronisering', NOTIFICATION_TYPES.WARNING);
                }
            });
    
        // Start aggressiv polling som backup
        this.startAggressivePolling();
    }
    
    async handlePlayerJoined(payload) {
        if (payload.new && payload.new.name !== this.currentPlayer.name) {
            console.log('🎉 Ny spiller registrert:', payload.new.name);
            this.showPlayerJoinedNotification(payload.new.name);
        }
        await this.refreshPlayersList(true);
    }
    
    async handlePlayerLeft(payload) {
        if (payload.old && payload.old.name !== this.currentPlayer.name) {
            console.log('👋 Spiller forlot:', payload.old.name);
            this.showPlayerLeftNotification(payload.old.name);
            
            if (payload.old.is_host) {
                this.handleHostLeft();
            }
        }
        await this.refreshPlayersList(true);
    }
    
    async handlePlayerUpdated(payload) {
        console.log('🔄 Spiller oppdatert:', payload.new?.name);
        
        // Sjekk om spilleren fikk tildelt en rolle (spillet startet)
        if (payload.new && payload.new.id === this.currentPlayer.id && payload.new.role && !this.currentPlayer.role) {
            console.log('🎭 Min rolle ble tildelt:', payload.new.role, payload.new.word);
            this.currentPlayer.role = payload.new.role;
            this.currentPlayer.word = payload.new.word;
            
            // Vis rolle til spilleren
            this.showPlayerRole();
        }
        
        await this.refreshPlayersList(true);
    }
    
    startAggressivePolling() {
        // Stopp eksisterende polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        if (this.fastPollingInterval) {
            clearInterval(this.fastPollingInterval);
        }
    
        // Start rask polling hver sekund for lobby
        this.fastPollingInterval = setInterval(async () => {
            if (this.currentGame && 
                document.getElementById('lobby-page') && 
                !document.getElementById('lobby-page').classList.contains('hidden')) {
                
                await this.checkForPlayerChanges();
            }
        }, 1000);
    
        // Normal polling hver 3. sekund som backup
        this.pollingInterval = setInterval(async () => {
            if (this.currentGame) {
                await this.refreshPlayersList();
                await this.checkForRoleAssignment();
            }
        }, 3000);
    
        console.log('🔄 Aggressiv polling startet (1s + 3s backup)');
    }
    
    async checkForRoleAssignment() {
        if (!this.currentPlayer || this.currentPlayer.role) {
            return;
        }
    
        try {
            const { data: playerData, error } = await this.supabase
                .from('players')
                .select('role, word')
                .eq('id', this.currentPlayer.id)
                .single();
    
            if (error) {
                console.error('Feil ved sjekk av rolle:', error);
                return;
            }
    
            if (playerData && playerData.role) {
                console.log('🎭 Rolle oppdaget via polling:', playerData.role, playerData.word);
                this.currentPlayer.role = playerData.role;
                this.currentPlayer.word = playerData.word;
                
                this.showPlayerRole();
            }
    
        } catch (error) {
            console.error('Feil ved polling for roller:', error);
        }
    }
    
    async checkForPlayerChanges() {
        try {
            const { data: currentPlayers, error } = await this.supabase
                .from('players')
                .select('id, name, is_host, joined_at')
                .eq('game_id', this.currentGame.id)
                .order('joined_at');
    
            if (error) {
                console.error('Polling feil:', error);
                return;
            }
    
            const currentIds = currentPlayers.map(p => p.id).sort();
            const cachedIds = this.onlinePlayers.map(p => p.id).sort();
    
            if (JSON.stringify(currentIds) !== JSON.stringify(cachedIds)) {
                console.log('🔍 Polling oppdaget endring');
    
                const leftPlayers = this.onlinePlayers.filter(oldPlayer => 
                    !currentPlayers.find(newPlayer => newPlayer.id === oldPlayer.id)
                );
    
                const newPlayers = currentPlayers.filter(newPlayer => 
                    !this.onlinePlayers.find(oldPlayer => oldPlayer.id === newPlayer.id)
                );
    
                leftPlayers.forEach(player => {
                    if (player.name !== this.currentPlayer.name) {
                        this.showPlayerLeftNotification(player.name);
                    }
                });
    
                newPlayers.forEach(player => {
                    if (player.name !== this.currentPlayer.name) {
                        this.showPlayerJoinedNotification(player.name);
                    }
                });
    
                this.onlinePlayers = currentPlayers;
                this.updatePlayersListUI(currentPlayers);
            }
    
        } catch (error) {
            console.error('❌ Feil ved player change check:', error);
        }
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.fastPollingInterval) {
            clearInterval(this.fastPollingInterval);
            this.fastPollingInterval = null;
        }
        console.log('⏹️ Alle polling stoppet');
    }
    
    // === SPILLOGIKK FOR MULTIPLAYER ===
    
    handleGameUpdate(payload) {
        if (payload.new) {
            const previousStatus = this.currentGame?.status;
            this.currentGame = payload.new;
            
            switch (this.currentGame.status) {
                case GAME_STATUS.WAITING:
                    if (document.getElementById('lobby-page') && !document.getElementById('lobby-page').classList.contains('hidden')) {
                        this.refreshPlayersList();
                    }
                    break;
                    
                case GAME_STATUS.REVEALING:
                    console.log('🎮 Spillet startet - laster din rolle');
                    this.loadPlayerRole();
                    break;
                    
                case GAME_STATUS.DISCUSSION:
                    this.startMultiplayerDiscussion();
                    break;
                    
                case GAME_STATUS.VOTING:
                    this.startMultiplayerVoting();
                    break;
                    
                case GAME_STATUS.RESULTS:
                    this.showMultiplayerResults();
                    break;
            }
        }
    }
    
    async startMultiplayerGame() {
        console.log('🚀 startMultiplayerGame() kalt');
        
        if (!this.currentPlayer.is_host) {
            console.warn('❌ Ikke host, kan ikke starte spill');
            return;
        }
        if (this.onlinePlayers.length < GAME_CONFIG.MIN_PLAYERS) {
            console.warn('❌ For få spillere:', this.onlinePlayers.length);
            this.gameManager.showNotification(`Minimum ${GAME_CONFIG.MIN_PLAYERS} spillere kreves!`, NOTIFICATION_TYPES.ERROR);
            return;
        }
    
        try {
            this.updateConnectionStatus('Starter spill...', CONNECTION_STATUS.CONNECTING);
            
            console.log('🎲 Tildeler roller...');
            // Tildel roller og ord til alle spillere
            await this.assignMultiplayerRoles();
            
            // Lag diskusjonsrekkefølge
            const discussionOrder = this.createDiscussionOrder();
            console.log('📝 Diskusjonsrekkefølge:', discussionOrder);
            
            // Prøv å oppdatere med discussion_order først, hvis det feiler, oppdater uten
            try {
                const { error } = await this.supabase
                    .from('games')
                    .update({ 
                        status: GAME_STATUS.REVEALING,
                        discussion_order: discussionOrder,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentGame.id);
    
                if (error) throw error;
                console.log('✅ Oppdaterte spill med diskusjonsrekkefølge');
            } catch (dbError) {
                console.warn('Diskusjonsrekkefølge kolonne ikke funnet, oppdaterer uten:', dbError);
                
                // Fallback uten discussion_order kolonne
                const { error: fallbackError } = await this.supabase
                    .from('games')
                    .update({ 
                        status: GAME_STATUS.REVEALING,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentGame.id);
    
                if (fallbackError) throw fallbackError;
                
                // Lagre diskusjonsrekkefølge lokalt
                this.currentGame.discussion_order = discussionOrder;
                console.log('✅ Oppdaterte spill uten diskusjonsrekkefølge, lagret lokalt');
            }
    
            console.log('✅ Spill startet - alle spillere får nå sine roller');
            this.updateConnectionStatus('Spill startet', CONNECTION_STATUS.CONNECTED);
    
        } catch (error) {
            console.error('❌ Feil ved start av spill:', error);
            this.gameManager.showNotification('❌ Kunne ikke starte spill. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    createDiscussionOrder() {
        const playerNames = this.onlinePlayers.map(p => p.name);
        const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
        return shuffled;
    }
    
    async assignMultiplayerRoles() {
        if (!this.currentPlayer.is_host) return;
    
        console.log('🎲 Tildeler roller til', this.onlinePlayers.length, 'spillere');
    
        const wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        const normalWord = wordPair.normal;
        const undercoverWord = wordPair.undercover;
    
        const undercoverCount = this.currentGame.settings?.undercoverCount || 1;
        const mrWhiteEnabled = this.currentGame.settings?.enableMrWhite !== false;
    
        const shuffledPlayers = [...this.onlinePlayers].sort(() => Math.random() - 0.5);
        let roleIndex = 0;
    
        console.log('📝 Ordpar:', normalWord, 'vs', undercoverWord);
    
        for (const player of shuffledPlayers) {
            let role = PLAYER_ROLES.NORMAL;
            let word = normalWord;
    
            if (mrWhiteEnabled && roleIndex === 0) {
                role = PLAYER_ROLES.MR_WHITE;
                word = null;
            } else if (roleIndex < undercoverCount + (mrWhiteEnabled ? 1 : 0)) {
                role = PLAYER_ROLES.UNDERCOVER;
                word = undercoverWord;
            }
    
            console.log('👤', player.name, '→', role, '→', word || 'Mr. White');
    
            await this.supabase
                .from('players')
                .update({
                    role: role,
                    word: word,
                    updated_at: new Date().toISOString()
                })
                .eq('id', player.id);
    
            roleIndex++;
        }
    
        console.log('✅ Roller tildelt!');
    }
    
    async loadPlayerRole() {
        try {
            const { data: updatedPlayer, error: playerError } = await this.supabase
                .from('players')
                .select('*')
                .eq('id', this.currentPlayer.id)
                .single();
    
            if (playerError) throw playerError;
    
            this.currentPlayer = updatedPlayer;
            
            if (this.currentPlayer.role) {
                console.log('🎭 Min rolle:', this.currentPlayer.role, '| Ord:', this.currentPlayer.word);
                this.showPlayerRole();
            } else {
                setTimeout(() => this.loadPlayerRole(), 1000);
            }
    
        } catch (error) {
            console.error('Feil ved lasting av rolle:', error);
            this.gameManager.showNotification('❌ Feil ved lasting av rolle. Prøv å laste siden på nytt.', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    showPlayerRole() {
        console.log('🎭 Viser rolle til spiller:', this.currentPlayer.role, this.currentPlayer.word);
        
        this.gameManager.showPage('game-page');
        this.gameManager.showGameSection('word-reveal');
        
        const currentPlayerNameEl = document.getElementById('current-player-name');
        const wordCard = document.getElementById('word-card');
        const wordText = document.getElementById('word-text');
        const roleIndicator = document.getElementById('role-indicator');
        
        if (currentPlayerNameEl) {
            currentPlayerNameEl.textContent = `${this.currentPlayer.name}s rolle`;
        }
        
        if (wordCard && wordText && roleIndicator) {
            if (this.currentPlayer.role === PLAYER_ROLES.MR_WHITE) {
                wordText.textContent = 'DU ER MR. WHITE';
                roleIndicator.textContent = 'Du vet ikke ordet! Prøv å gjette hva de andre snakker om.';
                wordCard.className = 'word-card mr-white';
            } else if (this.currentPlayer.role === PLAYER_ROLES.UNDERCOVER) {
                wordText.textContent = this.currentPlayer.word;
             
                wordCard.className = 'word-card undercover';
            } else {
                wordText.textContent = this.currentPlayer.word;
           
                wordCard.className = 'word-card normal';
            }
            
            wordCard.onclick = null;
        }
        
        const nextPlayerBtn = document.getElementById('next-player-btn');
        if (nextPlayerBtn) {
            nextPlayerBtn.textContent = 'Klar for diskusjon';
            nextPlayerBtn.onclick = () => readyForDiscussion();
        }
        
        this.gameManager.showNotification('🎭 Din rolle er tildelt!', NOTIFICATION_TYPES.SUCCESS);
    }
    
    async readyForDiscussion() {
        try {
            // Prøv å oppdatere med ready_for_discussion kolonne
            try {
                await this.supabase
                    .from('players')
                    .update({
                        ready_for_discussion: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentPlayer.id);
            } catch (dbError) {
                console.warn('ready_for_discussion kolonne ikke funnet:', dbError);
                // Fallback - bare oppdater updated_at
                await this.supabase
                    .from('players')
                    .update({
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentPlayer.id);
            }
    
            this.gameManager.showNotification('✅ Markert som klar for diskusjon', NOTIFICATION_TYPES.SUCCESS);
            
            if (this.currentPlayer.is_host) {
                // Vent litt før vi sjekker om alle er klare
                setTimeout(() => this.checkIfAllPlayersReady(), 1000);
            }
            
            const nextPlayerBtn = document.getElementById('next-player-btn');
            if (nextPlayerBtn) {
                nextPlayerBtn.textContent = 'Venter på andre spillere...';
                nextPlayerBtn.disabled = true;
            }
    
        } catch (error) {
            console.error('Feil ved markering som klar:', error);
        }
    }
    
    async checkIfAllPlayersReady() {
        try {
            // Prøv å sjekke ready_for_discussion kolonnen
            try {
                const { data: players, error } = await this.supabase
                    .from('players')
                    .select('ready_for_discussion')
                    .eq('game_id', this.currentGame.id);
    
                if (error) throw error;
    
                const allReady = players.every(p => p.ready_for_discussion);
                
                if (allReady) {
                    console.log('🎯 Alle spillere er klare - starter diskusjon');
                    
                    await this.supabase
                        .from('games')
                        .update({ 
                            status: GAME_STATUS.DISCUSSION,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', this.currentGame.id);
                }
            } catch (dbError) {
                console.warn('ready_for_discussion kolonne ikke tilgjengelig, starter diskusjon automatisk');
                
                // Fallback - start diskusjon automatisk etter 3 sekunder
                setTimeout(async () => {
                    await this.supabase
                        .from('games')
                        .update({ 
                            status: GAME_STATUS.DISCUSSION,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', this.currentGame.id);
                }, 3000);
            }
    
        } catch (error) {
            console.error('Feil ved sjekk av spillerberedskap:', error);
        }
    }
    
    startMultiplayerDiscussion() {
        console.log('💬 Starter multiplayer diskusjon');
        
        this.gameManager.showGameSection('discussion');
        this.setupMultiplayerDiscussion();
    }
    
    async setupMultiplayerDiscussion() {
        const discussionOrder = this.currentGame.discussion_order || [];
        
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = this.formatTime(this.currentGame.settings?.timerDuration || 300);
        }
        
        const orderList = document.getElementById('order-list');
        if (orderList) {
            orderList.innerHTML = discussionOrder.map((playerName, index) => {
                const isMe = playerName === this.currentPlayer.name;
                return `
                    <div class="order-item ${isMe ? 'my-turn' : ''}">
                        <span class="order-number">${index + 1}.</span>
                        <span class="player-name">${playerName} ${isMe ? '(DEG)' : ''}</span>
                    </div>
                `;
            }).join('');
        }
        
        const discussionInfo = document.createElement('div');
        discussionInfo.className = 'discussion-player-info';
        discussionInfo.innerHTML = `
            <div class="my-role-info">
                <h4>🎭 Din rolle:</h4>
                <p><strong>${this.getRoleDisplayName()}</strong></p>
                ${this.currentPlayer.word ? `<p><strong>Ditt ord:</strong> ${this.currentPlayer.word}</p>` : '<p><strong>Du må gjette ordet!</strong></p>'}
            </div>
        `;
        
        const discussionSection = document.getElementById('discussion');
        if (discussionSection && !discussionSection.querySelector('.discussion-player-info')) {
            discussionSection.insertBefore(discussionInfo, discussionSection.firstChild);
        }
        
        this.updateDiscussionControls();
    }
    
    updateDiscussionControls() {
        const gameControlsContainer = document.querySelector('#discussion .game-controls');
        if (gameControlsContainer) {
            if (this.currentPlayer.is_host) {
                gameControlsContainer.innerHTML = `
                    <button class="game-btn primary" onclick="startVotingAsHost()">
                        Start Avstemming
                    </button>
                    <button class="game-btn secondary" onclick="leaveMultiplayerGame()">
                        Forlat Spill
                    </button>
                `;
            } else {
                gameControlsContainer.innerHTML = `
                    <div class="waiting-for-host">
                        <p>⏳ Venter på at host starter avstemming...</p>
                    </div>
                    <button class="game-btn secondary" onclick="leaveMultiplayerGame()">
                        Forlat Spill
                    </button>
                `;
            }
        }
    }
    
    async startVotingAsHost() {
        if (!this.currentPlayer.is_host) return;
        
        try {
            console.log('🗳️ Host starter avstemming');
            
            await this.supabase
                .from('games')
                .update({ 
                    status: GAME_STATUS.VOTING,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentGame.id);
    
        } catch (error) {
            console.error('Feil ved start av avstemming:', error);
            this.gameManager.showNotification('❌ Kunne ikke starte avstemming', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    startMultiplayerVoting() {
        console.log('🗳️ Starter multiplayer avstemming');
        
        this.gameManager.showGameSection('voting');
        this.setupMultiplayerVoting();
    }
    
    async setupMultiplayerVoting() {
        const { data: allPlayers, error } = await this.supabase
            .from('players')
            .select('id, name')
            .eq('game_id', this.currentGame.id)
            .order('joined_at');
    
        if (error) {
            console.error('Feil ved henting av spillere for avstemming:', error);
            return;
        }
    
        const votingCards = document.getElementById('voting-cards');
        if (votingCards) {
            votingCards.innerHTML = allPlayers
                .filter(player => player.id !== this.currentPlayer.id)
                .map(player => `
                    <div class="vote-card" onclick="voteForPlayer('${player.id}', '${player.name}')">
                        <div class="vote-player-name">${player.name}</div>
                        <div class="vote-action">🗳️ Stem på ${player.name}</div>
                    </div>
                `).join('');
        }
        
        const votingInstructions = document.createElement('div');
        votingInstructions.className = 'voting-instructions';
        votingInstructions.innerHTML = `
            <h3>🗳️ Hvem tror du er Undercover eller Mr. White?</h3>
            <p>Velg en spiller å stemme på:</p>
        `;
        
        const votingSection = document.getElementById('voting');
        if (votingSection && !votingSection.querySelector('.voting-instructions')) {
            votingSection.insertBefore(votingInstructions, votingSection.firstChild);
        }
    }
    
    async voteForPlayer(playerId, playerName) {
        try {
            console.log('🗳️ Stemmer på:', playerName);
            
            const { error } = await this.supabase
                .from('votes')
                .insert([{
                    game_id: this.currentGame.id,
                    voter_id: this.currentPlayer.id,
                    voted_for_id: playerId,
                    created_at: new Date().toISOString()
                }]);
    
            if (error) throw error;
    
            this.gameManager.showNotification(`🗳️ Du stemte på ${playerName}!`, NOTIFICATION_TYPES.SUCCESS);
            
            const votingCards = document.getElementById('voting-cards');
            if (votingCards) {
                votingCards.innerHTML = `
                    <div class="vote-confirmation">
                        <h3>✅ Stemme avgitt!</h3>
                        <p>Du stemte på <strong>${playerName}</strong></p>
                        <p>⏳ Venter på at andre spillere stemmer...</p>
                    </div>
                `;
            }
            
            if (this.currentPlayer.is_host) {
                this.checkVotingComplete();
            }
    
        } catch (error) {
            console.error('Feil ved stemming:', error);
            this.gameManager.showNotification('❌ Kunne ikke registrere stemme', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    async checkVotingComplete() {
        try {
            const { data: playerCount } = await this.supabase
                .from('players')
                .select('id', { count: 'exact' })
                .eq('game_id', this.currentGame.id);
    
            const { data: voteCount } = await this.supabase
                .from('votes')
                .select('id', { count: 'exact' })
                .eq('game_id', this.currentGame.id);
    
            if (voteCount.length >= playerCount.length) {
                console.log('🎯 Alle har stemt - beregner resultater');
                await this.calculateAndShowResults();
            }
    
        } catch (error) {
            console.error('Feil ved sjekk av avstemming:', error);
        }
    }
    
    async calculateAndShowResults() {
        try {
            const { data: votes, error: votesError } = await this.supabase
                .from('votes')
                .select(`
                    voted_for_id,
                    players!votes_voted_for_id_fkey(name)
                `)
                .eq('game_id', this.currentGame.id);
    
            if (votesError) throw votesError;
    
            const voteCount = {};
            votes.forEach(vote => {
                const playerName = vote.players.name;
                voteCount[playerName] = (voteCount[playerName] || 0) + 1;
            });
    
            const maxVotes = Math.max(...Object.values(voteCount));
            const eliminatedPlayers = Object.keys(voteCount).filter(name => voteCount[name] === maxVotes);
    
            const results = { voteCount, eliminatedPlayers, maxVotes };
    
            // Prøv å lagre resultater i database, hvis det feiler, lagre lokalt
            try {
                await this.supabase
                    .from('games')
                    .update({ 
                        status: GAME_STATUS.RESULTS,
                        vote_results: results,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentGame.id);
            } catch (dbError) {
                console.warn('vote_results kolonne ikke funnet, lagrer lokalt:', dbError);
                
                // Fallback uten vote_results kolonne
                await this.supabase
                    .from('games')
                    .update({ 
                        status: GAME_STATUS.RESULTS,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentGame.id);
                
                // Lagre resultater lokalt
                this.currentGame.vote_results = results;
            }
    
        } catch (error) {
            console.error('Feil ved beregning av resultater:', error);
        }
    }
    
    showMultiplayerResults() {
        console.log('📊 Viser multiplayer resultater');
        
        this.gameManager.showGameSection('results');
        this.displayVoteResults();
    }
    
    async displayVoteResults() {
        const results = this.currentGame.vote_results;
        const resultDisplay = document.getElementById('result-display');
        
        if (!resultDisplay || !results) return;
    
        if (results.eliminatedPlayers.length > 1) {
            resultDisplay.innerHTML = `
                <div class="result-card">
                    <h3>🤝 Uavgjort!</h3>
                    <p>Følgende spillere fikk ${results.maxVotes} stemmer:</p>
                    <p><strong>${results.eliminatedPlayers.join(', ')}</strong></p>
                    <p>Ingen blir eliminert denne runden.</p>
                </div>
            `;
        } else {
            const eliminated = results.eliminatedPlayers[0];
            resultDisplay.innerHTML = `
                <div class="result-card">
                    <h3>📊 Avstemningsresultat</h3>
                    <p><strong>${eliminated}</strong> ble eliminert med ${results.maxVotes} stemmer.</p>
                </div>
            `;
        }
    
        const voteBreakdown = document.createElement('div');
        voteBreakdown.className = 'vote-breakdown';
        voteBreakdown.innerHTML = `
            <h4>🗳️ Stemmefordeling:</h4>
            ${Object.entries(results.voteCount).map(([name, count]) => 
                `<p>${name}: ${count} stemme${count !== 1 ? 'r' : ''}</p>`
            ).join('')}
        `;
        resultDisplay.appendChild(voteBreakdown);
    
        this.updateResultsControls();
    }
    
    updateResultsControls() {
        const gameControlsContainer = document.querySelector('#results .game-controls');
        if (gameControlsContainer) {
            if (this.currentPlayer.is_host) {
                gameControlsContainer.innerHTML = `
                    <button class="game-btn secondary" onclick="continueGameAsHost()">
                        Fortsett Spill
                    </button>
                    <button class="game-btn primary" onclick="endGameAsHost()">
                        Avslutt Spill
                    </button>
                `;
            } else {
                gameControlsContainer.innerHTML = `
                    <div class="waiting-for-host">
                        <p>⏳ Venter på at host bestemmer neste steg...</p>
                    </div>
                    <button class="game-btn secondary" onclick="leaveMultiplayerGame()">
                        Forlat Spill
                    </button>
                `;
            }
        }
    }
    
    async continueGameAsHost() {
        if (!this.currentPlayer.is_host) return;
        
        try {
            // Slett alle stemmer
            await this.supabase.from('votes').delete().eq('game_id', this.currentGame.id);
            
            // Prøv å resette ready_for_discussion
            try {
                await this.supabase
                    .from('players')
                    .update({ ready_for_discussion: false })
                    .eq('game_id', this.currentGame.id);
            } catch (dbError) {
                console.warn('ready_for_discussion kolonne ikke tilgjengelig for reset');
            }
    
            await this.supabase
                .from('games')
                .update({ 
                    status: GAME_STATUS.DISCUSSION,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentGame.id);
    
            this.gameManager.showNotification('🔄 Ny diskusjonsrunde startet!', NOTIFICATION_TYPES.SUCCESS);
    
        } catch (error) {
            console.error('Feil ved fortsettelse av spill:', error);
            this.gameManager.showNotification('❌ Kunne ikke fortsette spill', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    async endGameAsHost() {
        if (!this.currentPlayer.is_host) return;
        
        try {
            await this.supabase
                .from('games')
                .update({ 
                    status: GAME_STATUS.FINISHED,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentGame.id);
    
            this.gameManager.showNotification('🎯 Spill avsluttet!', NOTIFICATION_TYPES.SUCCESS);
            
            setTimeout(() => {
                this.leaveGame();
            }, 2000);
    
        } catch (error) {
            console.error('Feil ved avslutning av spill:', error);
        }
    }
    
    // === HJELPEFUNKSJONER ===
    
    getRoleDisplayName() {
        switch (this.currentPlayer.role) {
            case PLAYER_ROLES.MR_WHITE:
                return '🕵️ Mr. White';
            case PLAYER_ROLES.UNDERCOVER:
                return '🕵️ Undercover';
            default:
                return '👥 Normal spiller';
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    showPlayerJoinedNotification(playerName) {
        this.gameManager.showNotification(`👋 ${playerName} ble med!`, NOTIFICATION_TYPES.SUCCESS);
    }
    
    showPlayerLeftNotification(playerName) {
        if (playerName === this.currentPlayer.name) return;
        this.gameManager.showNotification(`👋 ${playerName} forlat spillet`, NOTIFICATION_TYPES.WARNING);
    }
    
    handleHostLeft() {
        this.gameManager.showNotification('👑 Host forlot spillet! Spillet kan bli ustabilt.', NOTIFICATION_TYPES.ERROR);
        setTimeout(async () => {
            await this.checkAndPromoteNewHost();
        }, 1000);
    }
    
    async checkAndPromoteNewHost() {
        try {
            const { data: remainingPlayers, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame.id)
                .order('joined_at');
    
            if (error) throw error;
    
            if (!remainingPlayers || remainingPlayers.length === 0) {
                return;
            }
    
            const currentHost = remainingPlayers.find(p => p.is_host);
            if (currentHost) {
                return;
            }
    
            const newHost = remainingPlayers[0];
            
            const { error: updateError } = await this.supabase
                .from('players')
                .update({ is_host: true })
                .eq('id', newHost.id);
    
            if (updateError) throw updateError;
    
            if (newHost.id === this.currentPlayer.id) {
                this.currentPlayer.is_host = true;
                this.gameManager.showNotification('👑 Du er nå den nye hosten!', NOTIFICATION_TYPES.INFO);
                this.setupLobbyUI();
            } else {
                this.gameManager.showNotification(`👑 ${newHost.name} er nå den nye hosten`, NOTIFICATION_TYPES.INFO);
            }
    
            await this.refreshPlayersList(true);
    
        } catch (error) {
            console.error('Feil ved host-overføring:', error);
        }
    }
    
    async refreshPlayersList(forceRefresh = false) {
        try {
            const { data: playersList, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame.id)
                .order('joined_at');
    
            if (error) throw error;
    
            const previousPlayerNames = this.onlinePlayers.map(p => p.name);
            const currentPlayerNames = playersList.map(p => p.name);
            
            const playersChanged = !this.onlinePlayers || 
                                  this.onlinePlayers.length !== playersList.length ||
                                  forceRefresh ||
                                  JSON.stringify(previousPlayerNames.sort()) !== JSON.stringify(currentPlayerNames.sort());
    
            if (playersChanged) {
                console.log('👥 Spillerliste oppdatert:', playersList.map(p => p.name));
                
                if (this.onlinePlayers.length > 0 && !forceRefresh) {
                    const leftPlayers = this.onlinePlayers.filter(oldPlayer => 
                        !playersList.find(newPlayer => newPlayer.id === oldPlayer.id)
                    );
                    
                    leftPlayers.forEach(leftPlayer => {
                        if (leftPlayer.name !== this.currentPlayer.name) {
                            console.log('👋 Spilleren forlot (oppdaget via polling):', leftPlayer.name);
                            this.showPlayerLeftNotification(leftPlayer.name);
                        }
                    });
                }
                
                this.onlinePlayers = playersList;
                this.updatePlayersListUI(playersList);
                
                if (playersList.length === 1 && playersList[0].id === this.currentPlayer.id) {
                    this.gameManager.showNotification('😔 Du er alene igjen i spillet', NOTIFICATION_TYPES.WARNING);
                }
            }
            
        } catch (error) {
            console.error('❌ Feil ved henting av spillere:', error);
            
            if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
                this.gameManager.showNotification('❌ Spillet eksisterer ikke lenger', NOTIFICATION_TYPES.ERROR);
                setTimeout(() => {
                    this.leaveGame();
                }, 2000);
            }
        }
    }
    
    showGameLobby() {
        this.gameManager.showPage('lobby-page');
        this.setupLobbyUI();
        this.refreshPlayersList();
    }
    
    setupLobbyUI() {
        const gameCodeElement = document.getElementById('lobby-game-code');
        if (gameCodeElement) {
            gameCodeElement.textContent = this.currentGame.code;
        }
    
        const controlsElement = document.getElementById('lobby-controls');
        if (controlsElement) {
            if (this.currentPlayer.is_host) {
                controlsElement.innerHTML = `
                    <button class="game-btn primary" onclick="startMultiplayerGame()" id="start-mp-game-btn" disabled>
                        Start Spill (min ${GAME_CONFIG.MIN_PLAYERS} spillere)
                    </button>
                    <button class="game-btn secondary" onclick="forcePlayerRefresh()">🔄 Oppdater</button>
                    <button class="game-btn secondary" onclick="leaveMultiplayerGame()">Forlat Spill</button>
                `;
            } else {
                controlsElement.innerHTML = `
                    <p class="lobby-waiting">⏳ Venter på at host starter spillet...</p>
                    <button class="game-btn secondary" onclick="forcePlayerRefresh()">🔄 Oppdater</button>
                    <button class="game-btn secondary" onclick="leaveMultiplayerGame()">Forlat Spill</button>
                `;
            }
        }
    }
    
    updatePlayersListUI(playersList) {
        const playersListElement = document.getElementById('lobby-players-list');
        const headerElement = document.getElementById('player-count-header');
        
        if (!playersListElement) return;
    
        if (playersList.length === 0) {
            playersListElement.innerHTML = '<div class="lobby-waiting">Ingen spillere ennå...</div>';
            return;
        }
    
        playersListElement.innerHTML = playersList.map((player, index) => {
            const isNew = index === playersList.length - 1 && playersList.length > 1;
            return `
                <div class="player-card ${isNew ? 'new-player' : ''}">
                    <div class="player-name">${player.name}</div>
                    ${player.is_host ? '<div class="host-badge">👑 Host</div>' : ''}
                </div>
            `;
        }).join('');
    
        if (headerElement) {
            headerElement.textContent = `👥 Spillere (${playersList.length})`;
        }
    
        const startBtn = document.getElementById('start-mp-game-btn');
        if (startBtn) {
            const canStart = playersList.length >= GAME_CONFIG.MIN_PLAYERS;
            startBtn.disabled = !canStart;
            
            if (canStart) {
                startBtn.textContent = `🚀 Start Spill (${playersList.length} spillere)`;
            } else {
                startBtn.textContent = `Start Spill (${playersList.length}/${GAME_CONFIG.MIN_PLAYERS} spillere)`;
            }
        }
    }
    
    async leaveGame() {
        const confirmLeave = confirm('Er du sikker på at du vil forlate spillet?');
        if (!confirmLeave) return;
    
        try {
            this.updateConnectionStatus('Forlater spill...', CONNECTION_STATUS.CONNECTING);
            
            const playerName = this.currentPlayer?.name;
            const playerId = this.currentPlayer?.id;
            const wasHost = this.currentPlayer?.is_host;
            
            console.log('🚪 Forlater spill...', { playerName, playerId, wasHost });
    
            this.stopPolling();
            
            if (this.gameSubscription) {
                await this.gameSubscription.unsubscribe();
                this.gameSubscription = null;
            }
            if (this.playersSubscription) {
                await this.playersSubscription.unsubscribe();
                this.playersSubscription = null;
            }
    
            if (this.currentPlayer && this.currentPlayer.id) {
                const { data: deletedData, error: deleteError } = await this.supabase
                    .from('players')
                    .delete()
                    .eq('id', this.currentPlayer.id)
                    .select();
                
                if (deleteError) {
                    console.error('❌ Feil ved sletting av spiller:', deleteError);
                    throw deleteError;
                } else {
                    console.log('✅ Spiller slettet fra database:', deletedData);
                }
            }
    
            if (wasHost && this.onlinePlayers.length > 1) {
                console.log('👑 Overfører host før avgang...');
                await this.transferHostBeforeLeaving();
            }
    
            this.currentGame = null;
            this.currentPlayer = null;
            this.onlinePlayers = [];
            this.gameManager.isMultiplayerMode = false;
            this.gameManager.gameMode = null;
    
            this.gameManager.showPage('main-menu');
            this.updateConnectionStatus('Tilkoblet', CONNECTION_STATUS.CONNECTED);
            
            this.gameManager.showNotification('👋 Du forlot spillet', NOTIFICATION_TYPES.INFO);
    
        } catch (error) {
            console.error('❌ Feil ved forlating av spill:', error);
            this.gameManager.showNotification(`❌ Feil ved forlating: ${error.message}`, NOTIFICATION_TYPES.ERROR);
            this.gameManager.showPage('main-menu');
            this.updateConnectionStatus('Feil ved frakobling', CONNECTION_STATUS.ERROR);
        }
    }
    
    async transferHostBeforeLeaving() {
        try {
            const { data: otherPlayers, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame.id)
                .neq('id', this.currentPlayer.id)
                .order('joined_at')
                .limit(1);
    
            if (error || !otherPlayers || otherPlayers.length === 0) {
                return;
            }
    
            const newHost = otherPlayers[0];
            await this.supabase
                .from('players')
                .update({ is_host: true })
                .eq('id', newHost.id);
    
            console.log('👑 Overførte host til:', newHost.name);
            
        } catch (error) {
            console.error('Feil ved host-overføring:', error);
        }
    }
    
    // Kopier spillkode til utklippstavlen
    copyGameCode() {
        const gameCode = this.currentGame?.code;
        if (!gameCode) return;
    
        if (navigator.clipboard) {
            navigator.clipboard.writeText(gameCode).then(() => {
                this.gameManager.showNotification('📋 Spillkode kopiert!', NOTIFICATION_TYPES.SUCCESS);
            }).catch(() => {
                this.fallbackCopyGameCode(gameCode);
            });
        } else {
            this.fallbackCopyGameCode(gameCode);
        }
    }
    
    fallbackCopyGameCode(gameCode) {
        const textArea = document.createElement('textarea');
        textArea.value = gameCode;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.gameManager.showNotification('📋 Spillkode kopiert!', NOTIFICATION_TYPES.SUCCESS);
        } catch (err) {
            this.gameManager.showNotification('❌ Kunne ikke kopiere spillkode', NOTIFICATION_TYPES.ERROR);
        }
        
        document.body.removeChild(textArea);
    }
    
    }
    
    // Initialiser multiplayer manager
    window.multiplayerManager = null;
    
    // Initialiser når siden er lastet
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (window.gameManager) {
                window.multiplayerManager = new MultiplayerManager(window.gameManager);
            }
        }, 100);
    });
    
    // === GLOBALE MULTIPLAYER FUNKSJONER ===
    
    function hostGame() {
        if (window.multiplayerManager) {
            window.multiplayerManager.hostGame();
        } else {
            gameManager.showNotification('❌ Multiplayer ikke initialisert ennå. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    function joinGame() {
        if (window.multiplayerManager) {
            window.multiplayerManager.joinGame();
        } else {
            gameManager.showNotification('❌ Multiplayer ikke initialisert ennå. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
        }
    }
    
    function copyGameCode() {
        if (window.multiplayerManager) {
            window.multiplayerManager.copyGameCode();
        }
    }
    
    // Eksporter multiplayerManager funksjoner til global scope
    window.startMultiplayerGame = function() {
        if (window.multiplayerManager) {
            window.multiplayerManager.startMultiplayerGame();
        }
    };
    
    window.startVotingAsHost = function() {
        if (window.multiplayerManager) {
            window.multiplayerManager.startVotingAsHost();
        }
    };
    
    window.continueGameAsHost = function() {
        if (window.multiplayerManager) {
            window.multiplayerManager.continueGameAsHost();
        }
    };
    
    window.endGameAsHost = function() {
        if (window.multiplayerManager) {
            window.multiplayerManager.endGameAsHost();
        }
    };
    
    window.voteForPlayer = function(playerId, playerName) {
        if (window.multiplayerManager) {
            window.multiplayerManager.voteForPlayer(playerId, playerName);
        }
    };
    
    window.readyForDiscussion = function() {
        if (window.multiplayerManager && window.multiplayerManager.currentPlayer) {
            window.multiplayerManager.readyForDiscussion();
        }
    };
    
    window.leaveMultiplayerGame = function() {
        if (window.multiplayerManager) {
            window.multiplayerManager.leaveGame();
        }
    };
    
    // Debug-funksjoner
    window.debugMultiplayer = function() {
        if (window.multiplayerManager) {
            console.log('🐛 Multiplayer Debug:');
            console.log('Supabase:', window.multiplayerManager.supabase ? '✅' : '❌');
            console.log('Current Game:', window.multiplayerManager.currentGame);
            console.log('Current Player:', window.multiplayerManager.currentPlayer);
            console.log('Online Players:', window.multiplayerManager.onlinePlayers);
            console.log('Game Manager Multiplayer Mode:', window.gameManager?.isMultiplayerMode);
            console.log('Game Subscription:', window.multiplayerManager.gameSubscription ? '✅ Aktiv' : '❌ Ikke aktiv');
            console.log('Players Subscription:', window.multiplayerManager.playersSubscription ? '✅ Aktiv' : '❌ Ikke aktiv');
            
            // Test globale funksjoner
            console.log('🔧 Globale funksjoner:');
            console.log('startMultiplayerGame:', typeof window.startMultiplayerGame);
            console.log('startVotingAsHost:', typeof window.startVotingAsHost);
            console.log('voteForPlayer:', typeof window.voteForPlayer);
            console.log('readyForDiscussion:', typeof window.readyForDiscussion);
            console.log('leaveMultiplayerGame:', typeof window.leaveMultiplayerGame);
        }
    };
    
    window.testStartGame = function() {
        console.log('🧪 Tester startMultiplayerGame...');
        if (typeof window.startMultiplayerGame === 'function') {
            window.startMultiplayerGame();
        } else {
            console.error('❌ startMultiplayerGame ikke tilgjengelig');
        }
    };
    
    window.testMultiplayerConnection = function() {
        if (window.multiplayerManager) {
            return window.multiplayerManager.testConnection();
        }
    };
    
    window.forcePlayerRefresh = function() {
        if (window.multiplayerManager) {
            console.log('🔄 Tvinger spillerliste-oppdatering...');
            window.multiplayerManager.refreshPlayersList(true);
            window.multiplayerManager.checkForPlayerChanges();
        }
    };