
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
        // Prøv igjen om 5 sekunder
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

    // Players subscription - lytter på ALL endringer
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
    }, 1000); // Hver sekund

    // Normal polling hver 3. sekund som backup
    this.pollingInterval = setInterval(async () => {
        if (this.currentGame) {
            await this.refreshPlayersList();
            
            // Sjekk også om spilleren har fått en rolle
            await this.checkForRoleAssignment();
        }
    }, 3000);

    console.log('🔄 Aggressiv polling startet (1s + 3s backup)');
}

async checkForRoleAssignment() {
    if (!this.currentPlayer || this.currentPlayer.role) {
        return; // Allerede har rolle eller ingen spiller
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
            
            // Vis rolle til spilleren
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

        // Sammenlign med cached liste
        const currentIds = currentPlayers.map(p => p.id).sort();
        const cachedIds = this.onlinePlayers.map(p => p.id).sort();

        if (JSON.stringify(currentIds) !== JSON.stringify(cachedIds)) {
            console.log('🔍 Polling oppdaget endring:', {
                før: cachedIds.length,
                nå: currentIds.length
            });

            // Finn spillere som forlot
            const leftPlayers = this.onlinePlayers.filter(oldPlayer => 
                !currentPlayers.find(newPlayer => newPlayer.id === oldPlayer.id)
            );

            // Finn nye spillere
            const newPlayers = currentPlayers.filter(newPlayer => 
                !this.onlinePlayers.find(oldPlayer => oldPlayer.id === newPlayer.id)
            );

            // Vis notifikasjoner
            leftPlayers.forEach(player => {
                if (player.name !== this.currentPlayer.name) {
                    console.log('📤 Polling: Spiller forlot -', player.name);
                    this.showPlayerLeftNotification(player.name);
                }
            });

            newPlayers.forEach(player => {
                if (player.name !== this.currentPlayer.name) {
                    console.log('📥 Polling: Spiller ble med -', player.name);
                    this.showPlayerJoinedNotification(player.name);
                }
            });

            // Oppdater cache og UI
            this.onlinePlayers = currentPlayers;
            this.updatePlayersListUI(currentPlayers);
        }

    } catch (error) {
        console.error('❌ Feil ved player change check:', error);
    }
}

startPolling() {
    if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
        if (this.currentGame && document.getElementById('lobby-page') && !document.getElementById('lobby-page').classList.contains('hidden')) {
            await this.refreshPlayersList();
        }
    }, GAME_CONFIG.POLLING_INTERVAL);

    console.log('🔄 Polling startet som backup (hver', GAME_CONFIG.POLLING_INTERVAL / 1000, 'sekund)');
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

handleGameUpdate(payload) {
    if (payload.new) {
        this.currentGame = payload.new;
        
        switch (this.currentGame.status) {
            case GAME_STATUS.WAITING:
                if (document.getElementById('lobby-page') && !document.getElementById('lobby-page').classList.contains('hidden')) {
                    this.refreshPlayersList();
                }
                break;
                case GAME_STATUS.REVEALING:
                    console.log('🎮 Spillet startet - laster multiplayer spill');
                    
                    if (!this.currentPlayer.role) {
                        console.log("Hhewuifnj")
                        this.checkForRoleAssignment(); 
                    } else {
                        this.showPlayerRole(); 
                    }
                    break;
                
            case GAME_STATUS.DISCUSSION:
                this.syncDiscussion();
                break;
            case GAME_STATUS.VOTING:
                this.syncVoting();
                break;
        }
    }
}

showPlayerJoinedNotification(playerName) {
    this.gameManager.showNotification(`👋 ${playerName} ble med!`, NOTIFICATION_TYPES.SUCCESS);
}

showPlayerLeftNotification(playerName) {
    // Ikke vis notifikasjon hvis det er deg selv som forlater
    if (playerName === this.currentPlayer.name) return;
    
    this.gameManager.showNotification(`👋 ${playerName} forlot spillet`, NOTIFICATION_TYPES.WARNING);
}

handleHostLeft() {
    // Hvis host forlot, finn ny host eller gi beskjed
    this.gameManager.showNotification('👑 Host forlot spillet! Spillet kan bli ustabilt.', NOTIFICATION_TYPES.ERROR);
    
    // Du kan implementere automatisk host-overføring her
    setTimeout(async () => {
        await this.checkAndPromoteNewHost();
    }, 1000);
}

async checkAndPromoteNewHost() {
    try {
        // Hent alle gjenværende spillere
        const { data: remainingPlayers, error } = await this.supabase
            .from('players')
            .select('*')
            .eq('game_id', this.currentGame.id)
            .order('joined_at');

        if (error) throw error;

        // Hvis ingen spillere igjen, ikke gjør noe
        if (!remainingPlayers || remainingPlayers.length === 0) {
            return;
        }

        // Sjekk om det fortsatt finnes en host
        const currentHost = remainingPlayers.find(p => p.is_host);
        if (currentHost) {
            // Det finnes fortsatt en host, alt OK
            return;
        }

        // Ingen host funnet, gjør den første spilleren til host
        const newHost = remainingPlayers[0];
        
        const { error: updateError } = await this.supabase
            .from('players')
            .update({ is_host: true })
            .eq('id', newHost.id);

        if (updateError) throw updateError;

        // Hvis den nye hosten er deg selv
        if (newHost.id === this.currentPlayer.id) {
            this.currentPlayer.is_host = true;
            this.gameManager.showNotification('👑 Du er nå den nye hosten!', NOTIFICATION_TYPES.INFO);
            
            // Oppdater lobby UI for å vise host-kontroller
            this.setupLobbyUI();
        } else {
            this.gameManager.showNotification(`👑 ${newHost.name} er nå den nye hosten`, NOTIFICATION_TYPES.INFO);
        }

        // Oppdater spillerliste
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

        // Sammenlign med forrige liste for å oppdage endringer
        const previousPlayerNames = this.onlinePlayers.map(p => p.name);
        const currentPlayerNames = playersList.map(p => p.name);
        
        const playersChanged = !this.onlinePlayers || 
                              this.onlinePlayers.length !== playersList.length ||
                              forceRefresh ||
                              JSON.stringify(previousPlayerNames.sort()) !== JSON.stringify(currentPlayerNames.sort());

        if (playersChanged) {
            console.log('👥 Spillerliste oppdatert:', playersList.map(p => p.name));
            
            // Sjekk om noen spillere forsvant (uten at det kom via real-time event)
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
            
            // Sjekk om vi er alene igjen
            if (playersList.length === 1 && playersList[0].id === this.currentPlayer.id) {
                this.gameManager.showNotification('😔 Du er alene igjen i spillet', NOTIFICATION_TYPES.WARNING);
            }
        }
        
    } catch (error) {
        console.error('❌ Feil ved henting av spillere:', error);
        
        // Hvis vi ikke kan hente spillerliste, kan det være at spillet er slettet
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
    // Sett spillkode
    const gameCodeElement = document.getElementById('lobby-game-code');
    if (gameCodeElement) {
        gameCodeElement.textContent = this.currentGame.code;
    }

    // Sett opp kontroller basert på host/participant
    const controlsElement = document.getElementById('lobby-controls');
    if (controlsElement) {
        if (this.currentPlayer.is_host) {
            controlsElement.innerHTML = `
                <button class="game-btn primary" onclick="multiplayerManager.startMultiplayerGame()" id="start-mp-game-btn" disabled>
                    Start Spill (min ${GAME_CONFIG.MIN_PLAYERS} spillere)
                </button>
                <button class="game-btn secondary" onclick="multiplayerManager.refreshPlayersList(true)">🔄 Oppdater</button>
                <button class="game-btn secondary" onclick="multiplayerManager.leaveGame()">Forlat Spill</button>
            `;
        } else {
            controlsElement.innerHTML = `
                <p class="lobby-waiting">⏳ Venter på at host starter spillet...</p>
                <button class="game-btn secondary" onclick="multiplayerManager.refreshPlayersList(true)">🔄 Oppdater</button>
                <button class="game-btn secondary" onclick="multiplayerManager.leaveGame()">Forlat Spill</button>
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

    // Oppdater header
    if (headerElement) {
        headerElement.textContent = `👥 Spillere (${playersList.length})`;
    }

    // Oppdater start-knapp for host
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

async startMultiplayerGame() {
    if (!this.currentPlayer.is_host) return;
    if (this.onlinePlayers.length < GAME_CONFIG.MIN_PLAYERS) {
        this.gameManager.showNotification(`Minimum ${GAME_CONFIG.MIN_PLAYERS} spillere kreves!`, NOTIFICATION_TYPES.ERROR);
        return;
    }

    try {
        this.updateConnectionStatus('Starter spill...', CONNECTION_STATUS.CONNECTING);
        
        // Tildel roller og oppdater spillstatus
        await this.assignMultiplayerRoles();
        
        const { error } = await this.supabase
            .from('games')
            .update({ 
                status: GAME_STATUS.REVEALING,
                updated_at: new Date().toISOString()
            })
            .eq('id', this.currentGame.id);

        if (error) throw error;

        console.log('✅ Spill startet - venter på rolle-synkronisering');
        // await this.loadMultiplayerGame(); 
        console.log("jfweiofjwl")
    } catch (error) {
        console.error('Feil ved start av spill:', error);
        this.gameManager.showNotification('❌ Kunne ikke starte spill. Prøv igjen.', NOTIFICATION_TYPES.ERROR);
    }
}

async assignMultiplayerRoles() {
    if (!this.currentPlayer.is_host) return;

    console.log('🎲 Tildeler roller til', this.onlinePlayers.length, 'spillere');

    // Velg ordpar
    const wordPair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const normalWord = wordPair.normal;
    const undercoverWord = wordPair.undercover;

    const undercoverCount = this.currentGame.settings?.undercoverCount || 1;
    const mrWhiteEnabled = this.currentGame.settings?.enableMrWhite !== false;

    const shuffledPlayers = [...this.onlinePlayers].sort(() => Math.random() - 0.5);
    let roleIndex = 0;

    console.log('📝 Ordpar:', normalWord, 'vs', undercoverWord);
    console.log('🕵️ Undercover:', undercoverCount, '| Mr. White:', mrWhiteEnabled);

    // Tildel roller
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

        // Oppdater i database
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

async loadMultiplayerGame() {
    try {
        console.log("Laster spill")
        this.updateConnectionStatus('Laster spill...', CONNECTION_STATUS.CONNECTING);
        
        // Hent oppdatert spillerinformasjon med roller
        const { data: updatedPlayer, error: playerError } = await this.supabase
            .from('players')
            .select('*')
            .eq('id', this.currentPlayer.id)
            .single();

        if (playerError) throw playerError;

        // Oppdater currentPlayer med rolle
        this.currentPlayer = updatedPlayer;
        
        console.log('🎭 Min rolle:', this.currentPlayer.role, '| Ord:', this.currentPlayer.word);
        
        // Vis rolle til spilleren
        this.showPlayerRole();
        
        this.updateConnectionStatus('Spiller', CONNECTION_STATUS.CONNECTED);

    } catch (error) {
        console.error('Feil ved lasting av spill:', error);
        this.gameManager.showNotification('❌ Feil ved lasting av spill. Prøv å laste siden på nytt.', NOTIFICATION_TYPES.ERROR);
    }
}

showPlayerRole() {
    console.log('🎭 Viser rolle til spiller:', this.currentPlayer.role, this.currentPlayer.word);
    
    // Gå til spillsiden
    this.gameManager.showPage('game-page');
    
    // Vis rolle-seksjonen
    this.gameManager.showGameSection('word-reveal');
    
    // Oppdater UI basert på rolle
    const wordDisplay = document.getElementById('word-display');
    const roleInfo = document.getElementById('role-info');
    
    if (wordDisplay && roleInfo) {
        if (this.currentPlayer.role === PLAYER_ROLES.MR_WHITE) {
            wordDisplay.innerHTML = `
                <div class="word-card mr-white">
                    <h2>🕵️ Du er Mr. White!</h2>
                    <p class="role-description">Du vet ikke ordet, men må gjette deg frem basert på andres beskrivelser.</p>
                    <p class="role-tip">💡 Tips: Hør nøye etter og prøv å ikke avsløre at du ikke vet ordet!</p>
                </div>
            `;
            roleInfo.textContent = 'Mr. White - Gjett ordet!';
        } else if (this.currentPlayer.role === PLAYER_ROLES.UNDERCOVER) {
            wordDisplay.innerHTML = `
                <div class="word-card undercover">
                    <h2>🕵️ Du er Undercover!</h2>
                    <div class="word-text">${this.currentPlayer.word}</div>
                    <p class="role-description">Du har et annet ord enn de fleste andre. Prøv å ikke avsløre deg selv!</p>
                    <p class="role-tip">💡 Tips: Vær forsiktig med beskrivelsene dine!</p>
                </div>
            `;
            roleInfo.textContent = `Undercover - ${this.currentPlayer.word}`;
        } else {
            wordDisplay.innerHTML = `
                <div class="word-card normal">
                    <h2>👥 Du er Normal spiller</h2>
                    <div class="word-text">${this.currentPlayer.word}</div>
                    <p class="role-description">Du har det normale ordet. Prøv å finne Undercover og Mr. White!</p>
                    <p class="role-tip">💡 Tips: Gi beskrivelser som avslører de falske spillerne!</p>
                </div>
            `;
            roleInfo.textContent = `Normal - ${this.currentPlayer.word}`;
        }
    }
    
    // Vis fortsett-knapp
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.style.display = 'block';
        continueBtn.onclick = () => {
            this.startMultiplayerDiscussion();
        };
        continueBtn.textContent = 'Forstått - Start diskusjon';
    }
    
    // Vis notifikasjon
    this.gameManager.showNotification('🎭 Din rolle er tildelt! Se skjermen.', NOTIFICATION_TYPES.SUCCESS);
}

startMultiplayerDiscussion() {
    console.log('💬 Starter multiplayer diskusjon');
    
    // Gå til diskusjonsseksjonen
    this.gameManager.showGameSection('discussion');
    
    // Hent alle spillere for å vise i diskusjonen
    this.refreshPlayersList();
    
    // Vis diskusjons-UI
    const discussionContent = document.getElementById('discussion-content');
    if (discussionContent) {
        discussionContent.innerHTML = `
            <div class="discussion-info">
                <h3>💬 Diskusjonsfase</h3>
                <p>Alle spillere beskriver sitt ord uten å nevne det direkte.</p>
                <p><strong>Din rolle:</strong> ${this.getRoleDisplayName()}</p>
                ${this.currentPlayer.word ? `<p><strong>Ditt ord:</strong> ${this.currentPlayer.word}</p>` : '<p><strong>Du må gjette ordet!</strong></p>'}
            </div>
            
            <div class="players-discussion">
                <h4>👥 Spillere i diskusjon:</h4>
                <div id="discussion-players">Laster spillere...</div>
            </div>
            
            <div class="discussion-controls">
                <button class="game-btn primary" onclick="multiplayerManager.readyForVoting()">
                    Klar for avstemming
                </button>
                <button class="game-btn secondary" onclick="multiplayerManager.leaveGame()">
                    Forlat spill
                </button>
            </div>
        `;
    }
    
    this.updateDiscussionPlayersList();
}

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

async updateDiscussionPlayersList() {
    try {
        const { data: playersList, error } = await this.supabase
            .from('players')
            .select('name, is_host')
            .eq('game_id', this.currentGame.id)
            .order('joined_at');

        if (error) throw error;

        const playersElement = document.getElementById('discussion-players');
        if (playersElement && playersList) {
            playersElement.innerHTML = playersList.map(player => `
                <div class="discussion-player">
                    <span class="player-name">${player.name}</span>
                    ${player.is_host ? '<span class="host-badge">👑</span>' : ''}
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Feil ved henting av spillere for diskusjon:', error);
    }
}

readyForVoting() {
    this.gameManager.showNotification('🗳️ Markert som klar for avstemming!', NOTIFICATION_TYPES.INFO);
    
    // Her kan du implementere logikk for å markere spilleren som klar
    // og eventuelt starte avstemming når alle er klare
    
    // For nå, gå direkte til avstemming
    this.startVoting();
}

startVoting() {
    console.log('🗳️ Starter avstemming');
    
    this.gameManager.showGameSection('voting');
    
    // Implementer avstemmings-UI her
    const votingContent = document.getElementById('voting-content');
    if (votingContent) {
        votingContent.innerHTML = `
            <div class="voting-info">
                <h3>🗳️ Avstemmingsfase</h3>
                <p>Stem på hvem du tror er Undercover eller Mr. White!</p>
            </div>
            
            <div class="voting-players">
                <h4>Velg hvem du vil stemme på:</h4>
                <div id="voting-player-list">Laster spillere...</div>
            </div>
            
            <div class="voting-controls">
                <button class="game-btn secondary" onclick="multiplayerManager.leaveGame()">
                    Forlat spill
                </button>
            </div>
        `;
    }
    
    this.updateVotingPlayersList();
}

async updateVotingPlayersList() {
    try {
        const { data: playersList, error } = await this.supabase
            .from('players')
            .select('name, id')
            .eq('game_id', this.currentGame.id)
            .order('joined_at');

        if (error) throw error;

        const votingElement = document.getElementById('voting-player-list');
        if (votingElement && playersList) {
            votingElement.innerHTML = playersList
                .filter(player => player.id !== this.currentPlayer.id) // Kan ikke stemme på seg selv
                .map(player => `
                    <button class="voting-option game-btn secondary" onclick="multiplayerManager.voteForPlayer('${player.id}', '${player.name}')">
                        🗳️ Stem på ${player.name}
                    </button>
                `).join('');
        }

    } catch (error) {
        console.error('Feil ved henting av spillere for avstemming:', error);
    }
}

voteForPlayer(playerId, playerName) {
    console.log('🗳️ Stemmer på:', playerName);
    this.gameManager.showNotification(`🗳️ Du stemte på ${playerName}!`, NOTIFICATION_TYPES.SUCCESS);
    
    // Her kan du implementere logikk for å lagre stemmen i databasen
    // og håndtere avstemmingsresultatet
    
    // For nå, bare vis bekreftelse
    const votingControls = document.querySelector('.voting-controls');
    if (votingControls) {
        votingControls.innerHTML = `
            <div class="vote-confirmation">
                <p>✅ Du stemte på <strong>${playerName}</strong></p>
                <p>⏳ Venter på at andre spillere stemmer...</p>
            </div>
            <button class="game-btn secondary" onclick="multiplayerManager.leaveGame()">
                Forlat spill
            </button>
        `;
    }
}

    async leaveGame() {
        const confirmLeave = confirm('Er du sikker på at du vil forlate spillet?');
        if (!confirmLeave) return;

        try {
            this.updateConnectionStatus('Forlater spill...', CONNECTION_STATUS.CONNECTING);
            
            // Lagre player info før vi sletter
            const playerName = this.currentPlayer?.name;
            const playerId = this.currentPlayer?.id;
            const wasHost = this.currentPlayer?.is_host;
            
            console.log('🚪 Forlater spill...', {
                playerName,
                playerId,
                wasHost,
                gameId: this.currentGame?.id
            });

            // Stopp polling og subscriptions FØRST
            this.stopPolling();
            
            if (this.gameSubscription) {
                await this.gameSubscription.unsubscribe();
                this.gameSubscription = null;
                console.log('✅ Game subscription stoppet');
            }
            if (this.playersSubscription) {
                await this.playersSubscription.unsubscribe();
                this.playersSubscription = null;
                console.log('✅ Players subscription stoppet');
            }

            // Forsøk å slette spiller fra database
            if (this.currentPlayer && this.currentPlayer.id) {
                console.log('🗑️ Sletter spiller fra database...', this.currentPlayer.id);
                
                const { data: deletedData, error: deleteError } = await this.supabase
                    .from('players')
                    .delete()
                    .eq('id', this.currentPlayer.id)
                    .select(); // Legg til select for å se hva som ble slettet
                
                if (deleteError) {
                    console.error('❌ Feil ved sletting av spiller:', deleteError);
                    throw deleteError;
                } else {
                    console.log('✅ Spiller slettet fra database:', deletedData);
                }

                // Verifiser at spilleren er borte
                const { data: verifyData, error: verifyError } = await this.supabase
                    .from('players')
                    .select('*')
                    .eq('id', this.currentPlayer.id);
                
                if (verifyError) {
                    console.warn('Kunne ikke verifisere sletting:', verifyError);
                } else if (verifyData && verifyData.length === 0) {
                    console.log('✅ Verifisert: Spiller er fjernet fra database');
                } else {
                    console.warn('⚠️ Spiller ser ut til å fortsatt være i database:', verifyData);
                }
            } else {
                console.warn('⚠️ Ingen currentPlayer.id å slette');
            }

            // Hvis jeg var host og det var andre spillere, prøv å overføre host
            if (wasHost && this.onlinePlayers.length > 1) {
                console.log('👑 Overfører host før avgang...');
                await this.transferHostBeforeLeaving();
            }

            // Reset variabler
            this.currentGame = null;
            this.currentPlayer = null;
            this.onlinePlayers = [];
            this.gameManager.isMultiplayerMode = false;
            this.gameManager.gameMode = null;

            // Gå tilbake til hovedmeny
            this.gameManager.showPage('main-menu');
            this.updateConnectionStatus('Tilkoblet', CONNECTION_STATUS.CONNECTED);
            
            this.gameManager.showNotification('👋 Du forlot spillet', NOTIFICATION_TYPES.INFO);

        } catch (error) {
            console.error('❌ Feil ved forlating av spill:', error);
            
            // Vis detaljert feilmelding
            this.gameManager.showNotification(`❌ Feil ved forlating: ${error.message}`, NOTIFICATION_TYPES.ERROR);
            
            // Gå tilbake til hovedmeny uansett
            this.gameManager.showPage('main-menu');
            this.updateConnectionStatus('Feil ved frakobling', CONNECTION_STATUS.ERROR);
        }
    }

    async transferHostBeforeLeaving() {
        try {
            // Finn andre spillere
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

            // Gjør den første andre spilleren til host
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

    // Placeholder-funksjoner for synkronisering
    syncDiscussion() {
        console.log('🗣️ Synkroniserer diskusjon...');
        // Her kan du legge til synkronisering av timer, etc.
        this.gameManager.startDiscussion();
    }

    syncVoting() {
        console.log('🗳️ Synkroniserer avstemming...');
        // Her kan du legge til synkronisering av stemmer
        this.gameManager.startVoting();
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
        // Fallback for eldre nettlesere
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

    // Debug-funksjon
    debug() {
        console.log('🐛 Multiplayer Debug:');
        console.log('Supabase:', this.supabase ? '✅' : '❌');
        console.log('Current Game:', this.currentGame);
        console.log('Current Player:', this.currentPlayer);
        console.log('Online Players:', this.onlinePlayers);
        console.log('Game Manager Multiplayer Mode:', this.gameManager.isMultiplayerMode);
        console.log('Game Subscription:', this.gameSubscription ? '✅ Aktiv' : '❌ Ikke aktiv');
        console.log('Players Subscription:', this.playersSubscription ? '✅ Aktiv' : '❌ Ikke aktiv');
        console.log('Polling Intervals:', {
            normal: this.pollingInterval ? '✅ Aktiv' : '❌ Ikke aktiv',
            fast: this.fastPollingInterval ? '✅ Aktiv' : '❌ Ikke aktiv'
        });
        
        // Test polling manuelt
        console.log('🧪 Tester manuell spillersjekk...');
        this.checkForPlayerChanges();
    }

    // Manuell test-funksjon
    async testConnection() {
        console.log('🧪 Tester Supabase tilkobling...');
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame?.id || 'test');
                
            console.log('✅ Tilkobling OK, data:', data);
            return true;
        } catch (error) {
            console.error('❌ Tilkoblingsfeil:', error);
            return false;
        }
    }

    // Test database operasjoner
    async testDatabaseOperations() {
        if (!this.currentGame) {
            console.log('❌ Ingen aktivt spill å teste med');
            return;
        }

        console.log('🧪 Tester database operasjoner...');
        
        try {
            // Test SELECT
            console.log('📖 Tester SELECT...');
            const { data: selectData, error: selectError } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame.id);
            
            if (selectError) {
                console.error('❌ SELECT feil:', selectError);
            } else {
                console.log('✅ SELECT OK, spillere:', selectData);
            }

            // Test om vi har rettigheter til å slette
            console.log('🗑️ Tester DELETE rettigheter...');
            const { data: deleteTest, error: deleteError } = await this.supabase
                .from('players')
                .delete()
                .eq('id', 'test-id-som-ikke-eksisterer')
                .select();
            
            if (deleteError) {
                console.error('❌ DELETE test feil:', deleteError);
                if (deleteError.code === '42501') {
                    console.error('🚫 Mangler DELETE rettigheter i databasen!');
                }
            } else {
                console.log('✅ DELETE rettigheter OK');
            }

            // Test INSERT for å verifisere tilkoblingsrettigheter
            console.log('📝 Tester INSERT rettigheter...');
            const testPlayer = {
                game_id: this.currentGame.id,
                name: 'TEST_DELETE_ME',
                is_host: false,
                joined_at: new Date().toISOString()
            };

            const { data: insertData, error: insertError } = await this.supabase
                .from('players')
                .insert([testPlayer])
                .select();

            if (insertError) {
                console.error('❌ INSERT test feil:', insertError);
            } else {
                console.log('✅ INSERT OK, test spiller opprettet:', insertData);
                
                // Prøv å slette test spilleren
                if (insertData && insertData.length > 0) {
                    const testPlayerId = insertData[0].id;
                    console.log('🗑️ Sletter test spiller...', testPlayerId);
                    
                    const { data: cleanupData, error: cleanupError } = await this.supabase
                        .from('players')
                        .delete()
                        .eq('id', testPlayerId)
                        .select();
                    
                    if (cleanupError) {
                        console.error('❌ Kunne ikke slette test spiller:', cleanupError);
                    } else {
                        console.log('✅ Test spiller slettet:', cleanupData);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Database test feil:', error);
        }
    }

    // Sjekk alle spillere i databasen for debugging
    async showAllPlayersInGame() {
        if (!this.currentGame) {
            console.log('❌ Ingen aktivt spill');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('game_id', this.currentGame.id)
                .order('joined_at');

            if (error) {
                console.error('❌ Feil ved henting av spillere:', error);
            } else {
                console.log('📊 Alle spillere i spill', this.currentGame.code + ':');
                console.table(data);
                
                console.log('🆔 Player IDs:', data.map(p => ({ name: p.name, id: p.id })));
            }
        } catch (error) {
            console.error('❌ Database feil:', error);
        }
    }
}

// Initialiser multiplayer manager
window.multiplayerManager = null;

// Initialiser når siden er lastet
document.addEventListener('DOMContentLoaded', function() {
    // Vent litt til gameManager er initialisert
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

// Debug-funksjon for utvikling
window.debugMultiplayer = function() {
    if (window.multiplayerManager) {
        window.multiplayerManager.debug();
    }
};

// Test-funksjoner for debugging
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

window.simulatePlayerLeft = function(playerName = 'TestSpiller') {
    if (window.multiplayerManager) {
        console.log('🧪 Simulerer at spiller forlot:', playerName);
        window.multiplayerManager.showPlayerLeftNotification(playerName);
    }
};

// Auto-diagnostikk hvis problemer
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.multiplayerManager && window.multiplayerManager.currentGame) {
            console.log('🔍 Auto-diagnostikk kjører om 10 sekunder...');
            setTimeout(() => {
                console.log('📊 Multiplayer status:');
                window.debugMultiplayer();
            }, 10000);
        }
    }, 5000);
});


