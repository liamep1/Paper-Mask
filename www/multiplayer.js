// Legg til dette ØVERST i kode.js (før de eksisterende variablene)

// Supabase konfigurasjon
const SUPABASE_URL = 'https://rajqlpstkevirxyabejk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhanFscHN0a2V2aXJ4eWFiZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjYyMDIsImV4cCI6MjA2NDYwMjIwMn0.5rQIV1QnqIrURgnvf7CD2L5t3B_UHxKySJU-dw0ZJ9M';

// Sjekk om Supabase er lastet
let supabase = null;
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase connected');
        addMultiplayerButtons();
    } else {
        console.error('❌ Supabase not loaded');
    }
});

// Globale variabler for multiplayer
let currentGame = null;
let currentPlayer = null;
let gameSubscription = null;
let playersSubscription = null;
let onlinePlayers = [];

// Generer spillkode
function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Host et nytt spill
async function hostGame() {
    if (!supabase) {
        alert('Feil: Kan ikke koble til server');
        return;
    }

    try {
        const playerName = prompt("Skriv inn ditt navn:");
        if (!playerName?.trim()) return;

        const gameCode = generateGameCode();
        
        // Opprett spill
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .insert([{
                code: gameCode,
                status: 'waiting',
                settings: getGameSettings()
            }])
            .select()
            .single();

        if (gameError) throw gameError;

        // Legg til host som spiller
        const { data: playerData, error: playerError } = await supabase
            .from('players')
            .insert([{
                game_id: gameData.id,
                name: playerName.trim(),
                is_host: true
            }])
            .select()
            .single();

        if (playerError) throw playerError;

        currentGame = gameData;
        currentPlayer = playerData;

        // Start real-time subscriptions
        setupGameSubscriptions();

        // Vis spillkode til host
        alert(`Spillkode: ${gameCode}\nDel denne koden med andre spillere!`);
        
        // Gå til lobby
        showGameLobby();

    } catch (error) {
        console.error('Feil ved hosting:', error);
        alert(`Kunne ikke starte spill: ${error.message}`);
    }
}

// Bli med i spill
async function joinGame() {
    if (!supabase) {
        alert('Feil: Kan ikke koble til server');
        return;
    }

    try {
        const gameCode = prompt("Skriv inn spillkode:");
        if (!gameCode?.trim()) return;

        const playerName = prompt("Skriv inn ditt navn:");
        if (!playerName?.trim()) return;

        // Finn spillet
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('code', gameCode.toUpperCase().trim())
            .eq('status', 'waiting')
            .single();

        if (gameError || !gameData) {
            alert('Spillkode ikke funnet eller spillet har startet');
            return;
        }

        // Sjekk om navnet allerede er tatt
        const { data: existingPlayer } = await supabase
            .from('players')
            .select('name')
            .eq('game_id', gameData.id)
            .eq('name', playerName.trim());

        if (existingPlayer && existingPlayer.length > 0) {
            alert('Dette navnet er allerede tatt');
            return;
        }

        // Legg til spiller
        const { data: playerData, error: playerError } = await supabase
            .from('players')
            .insert([{
                game_id: gameData.id,
                name: playerName.trim(),
                is_host: false
            }])
            .select()
            .single();

        if (playerError) throw playerError;

        currentGame = gameData;
        currentPlayer = playerData;

        // Start real-time subscriptions
        setupGameSubscriptions();

        // Gå til lobby
        showGameLobby();

    } catch (error) {
        console.error('Feil ved joining:', error);
        alert(`Kunne ikke bli med i spill: ${error.message}`);
    }
}

// Erstatt setupGameSubscriptions() og legg til disse funksjonene i multiplayer.js

// Forbedret real-time setup
function setupGameSubscriptions() {
    console.log('🔄 Setter opp real-time subscriptions...');
    
    // Stopp eksisterende subscriptions først
    if (gameSubscription) gameSubscription.unsubscribe();
    if (playersSubscription) playersSubscription.unsubscribe();

    // Sett opp game subscription
    gameSubscription = supabase
        .channel(`game-${currentGame.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${currentGame.id}`
        }, (payload) => {
            console.log('🎮 Game update:', payload);
            handleGameUpdate(payload);
        })
        .subscribe((status) => {
            console.log('🎮 Game subscription status:', status);
        });

    // Sett opp players subscription
    playersSubscription = supabase
        .channel(`players-${currentGame.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `game_id=eq.${currentGame.id}`
        }, (payload) => {
            console.log('👥 Players update:', payload);
            handlePlayersUpdate(payload);
        })
        .subscribe((status) => {
            console.log('👥 Players subscription status:', status);
        });

    // Start polling som backup i tilfelle real-time feiler
    startPolling();
}

// Polling som backup for real-time
let pollingInterval = null;

function startPolling() {
    // Stopp eksisterende polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    // Poll hver 2. sekund som backup
    pollingInterval = setInterval(async () => {
        if (currentGame && document.getElementById('lobby-page')) {
            await refreshPlayersList();
        }
    }, 2000);

    console.log('🔄 Polling startet som backup');
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('⏹️ Polling stoppet');
    }
}

// Forbedret handlePlayersUpdate
async function handlePlayersUpdate(payload) {
    console.log('👥 Players update received:', payload.eventType, payload.new);
    
    // Alltid refresh spillerliste når det er endringer
    if (document.getElementById('lobby-page')) {
        await refreshPlayersList();
        
        // Vis notifikasjon hvis noen har joinet
        if (payload.eventType === 'INSERT' && payload.new) {
            showPlayerJoinedNotification(payload.new.name);
        }
    }
}

// Vis notifikasjon når noen joiner
function showPlayerJoinedNotification(playerName) {
    // Ikke vis notifikasjon for seg selv
    if (playerName === currentPlayer.name) return;

    // Opprett notifikasjon
    const notification = document.createElement('div');
    notification.className = 'player-joined-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">👋</span>
            <span class="notification-text">${playerName} ble med!</span>
        </div>
    `;

    // Legg til CSS for notifikasjon
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        font-family: 'Poppins', sans-serif;
        font-weight: 500;
    `;

    // Legg til keyframes hvis de ikke eksisterer
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .notification-icon {
                font-size: 1.2rem;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Fjern etter 3 sekunder
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Forbedret refreshPlayersList med force refresh
async function refreshPlayersList(forceRefresh = false) {
    try {
        const { data: playersList, error } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', currentGame.id)
            .order('joined_at');

        if (error) throw error;

        // Sjekk om listen faktisk har endret seg
        const playersChanged = !onlinePlayers || 
                              onlinePlayers.length !== playersList.length ||
                              forceRefresh;

        if (playersChanged) {
            console.log('👥 Spillerliste oppdatert:', playersList.map(p => p.name));
            onlinePlayers = playersList;
            updatePlayersListUI(playersList);
        }
        
    } catch (error) {
        console.error('❌ Feil ved henting av spillere:', error);
    }
}

// Forbedret leaveGame med cleanup
async function leaveGame() {
    const confirmLeave = confirm('Er du sikker på at du vil forlate spillet?');
    if (!confirmLeave) return;

    try {
        showConnectionStatus('Forlater spill...', true);
        
        // Stopp polling
        stopPolling();
        
        // Fjern subscriptions
        if (gameSubscription) {
            gameSubscription.unsubscribe();
            gameSubscription = null;
        }
        if (playersSubscription) {
            playersSubscription.unsubscribe();
            playersSubscription = null;
        }

        // Slett spiller fra database
        if (currentPlayer) {
            await supabase
                .from('players')
                .delete()
                .eq('id', currentPlayer.id);
        }

        // Reset variabler
        currentGame = null;
        currentPlayer = null;
        onlinePlayers = [];
        isMultiplayerMode = false;

        // Fjern lobby-siden
        const lobbyPage = document.getElementById('lobby-page');
        if (lobbyPage) {
            lobbyPage.remove();
        }

        // Fjern eventuelle notifikasjoner
        document.querySelectorAll('.player-joined-notification').forEach(n => n.remove());

        // Gå tilbake til hovedmeny
        showPage('main-menu');
        showConnectionStatus('Tilkoblet', true);

    } catch (error) {
        console.error('Feil ved forlating av spill:', error);
        showPage('main-menu'); // Gå tilbake uansett
        showConnectionStatus('Frakoblet', false);
    }
}

// Legg til en manual refresh-knapp i lobby (valgfritt)
function addRefreshButton() {
    const lobbyControls = document.getElementById('lobby-controls');
    if (lobbyControls && !document.getElementById('refresh-btn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refresh-btn';
        refreshBtn.className = 'game-btn secondary';
        refreshBtn.style.marginLeft = '0.5rem';
        refreshBtn.innerHTML = '🔄 Oppdater';
        refreshBtn.onclick = () => refreshPlayersList(true);
        
        const leaveBtn = lobbyControls.querySelector('button[onclick="leaveGame()"]');
        if (leaveBtn) {
            lobbyControls.insertBefore(refreshBtn, leaveBtn);
        }
    }
}

// Oppdater createLobbyPage for å inkludere refresh-knapp
function createLobbyPage() {
    const lobbyHTML = `
        <div class="container" id="lobby-page">
            <div class="header">
                <h2>🎮 Spillelobby</h2>
                <p>Spillkode: <strong id="lobby-game-code">${currentGame.code}</strong></p>
                <p style="font-size: 0.9rem; opacity: 0.8;">Del denne koden med andre spillere</p>
            </div>
            
            <div class="players-section">
                <h3 id="player-count-header">👥 Spillere (0)</h3>
                <div class="players-grid" id="lobby-players-list">
                    <div class="lobby-waiting">Laster spillere...</div>
                </div>
            </div>
            
            <div class="game-controls" id="lobby-controls">
                ${currentPlayer.is_host ? `
                    <button class="game-btn primary" onclick="startMultiplayerGame()" id="start-mp-game-btn" disabled>
                        Start Spill (min 3 spillere)
                    </button>
                ` : '<p class="lobby-waiting">⏳ Venter på at host starter spillet...</p>'}
                <button class="game-btn secondary" onclick="refreshPlayersList(true)">🔄 Oppdater</button>
                <button class="game-btn secondary" onclick="leaveGame()">Forlat Spill</button>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = lobbyHTML;
    return div.firstElementChild;
}
// Håndter spilloppdateringer
function handleGameUpdate(payload) {
    if (payload.new) {
        currentGame = payload.new;
        
        switch (currentGame.status) {
            case 'waiting':
                if (document.getElementById('lobby-page')) {
                    refreshPlayersList();
                }
                break;
            case 'revealing':
                // Gå til ord-revelering i multiplayer
                loadMultiplayerGame();
                break;
            case 'discussion':
                // Synkroniser diskusjon
                syncDiscussion();
                break;
            case 'voting':
                // Synkroniser avstemming
                syncVoting();
                break;
        }
    }
}

// Håndter spilleroppdateringer
async function handlePlayersUpdate(payload) {
    if (document.getElementById('lobby-page')) {
        await refreshPlayersList();
    }
}

// Oppdater spillerliste
async function refreshPlayersList() {
    try {
        const { data: playersList, error } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', currentGame.id)
            .order('joined_at');

        if (error) throw error;

        onlinePlayers = playersList;
        updatePlayersListUI(playersList);
        
    } catch (error) {
        console.error('Feil ved henting av spillere:', error);
    }
}

// Vis spillelobby
function showGameLobby() {
    // Skjul andre sider
    document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'));
    
    // Opprett eller vis lobby
    let lobbyPage = document.getElementById('lobby-page');
    if (!lobbyPage) {
        lobbyPage = createLobbyPage();
        document.body.appendChild(lobbyPage);
    }
    
    lobbyPage.classList.remove('hidden');
    refreshPlayersList();
}

// Opprett lobby side
function createLobbyPage() {
    const lobbyHTML = `
        <div class="container" id="lobby-page">
            <div class="header">
                <h2>🎮 Spillelobby</h2>
                <p>Spillkode: <strong id="lobby-game-code">${currentGame.code}</strong></p>
            </div>
            
            <div class="players-section">
                <h3 id="player-count-header">👥 Spillere (0)</h3>
                <div class="players-grid" id="lobby-players-list"></div>
            </div>
            
            <div class="game-controls" id="lobby-controls">
                ${currentPlayer.is_host ? `
                    <button class="game-btn primary" onclick="startMultiplayerGame()" id="start-mp-game-btn" disabled>
                        Start Spill (min 3 spillere)
                    </button>
                ` : '<p>Venter på at host starter spillet...</p>'}
                <button class="game-btn secondary" onclick="leaveGame()">Forlat Spill</button>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = lobbyHTML;
    return div.firstElementChild;
}

// Oppdater spillerliste UI
function updatePlayersListUI(playersList) {
    const playersListElement = document.getElementById('lobby-players-list');
    const headerElement = document.getElementById('player-count-header');
    
    if (!playersListElement) return;

    playersListElement.innerHTML = '';
    
    playersList.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div class="player-name">${player.name}</div>
            ${player.is_host ? '<div class="host-badge">👑 Host</div>' : ''}
        `;
        playersListElement.appendChild(playerCard);
    });

    // Oppdater header
    if (headerElement) {
        headerElement.textContent = `👥 Spillere (${playersList.length})`;
    }

    // Oppdater start-knapp
    const startBtn = document.getElementById('start-mp-game-btn');
    if (startBtn) {
        startBtn.disabled = playersList.length < 3;
        startBtn.textContent = `Start Spill (${playersList.length} spillere)`;
    }
}

// Start multiplayer spill
async function startMultiplayerGame() {
    if (!currentPlayer.is_host) return;

    try {
        // Oppdater spillstatus
        const { error } = await supabase
            .from('games')
            .update({ status: 'revealing' })
            .eq('id', currentGame.id);

        if (error) throw error;

    } catch (error) {
        console.error('Feil ved start av spill:', error);
        alert('Kunne ikke starte spill. Prøv igjen.');
    }
}

// Last multiplayer spill når det starter
async function loadMultiplayerGame() {
    try {
        // Hent spillere fra database
        const { data: playersList, error } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', currentGame.id)
            .order('joined_at');

        if (error) throw error;

        // Konverter til det formatet den eksisterende koden forventer
        players = playersList.map(p => p.name);
        
        // Hvis dette er host, tildel roller og ord
        if (currentPlayer.is_host) {
            await assignMultiplayerRoles(playersList);
        }

        // Start spillogikken fra eksisterende kode
        gameState = 'revealing';
        currentPlayerIndex = 0;
        eliminatedPlayers = [];

        showPage('game');
        showGameSection('word-reveal');
        
        // Vent på at rollene er tildelt før vi viser ord
        setTimeout(async () => {
            await loadPlayerWords();
            showCurrentPlayerWord();
        }, 1000);

    } catch (error) {
        console.error('Feil ved lasting av spill:', error);
    }
}

// Tildel roller for multiplayer
async function assignMultiplayerRoles(playersList) {
    if (!currentPlayer.is_host) return;

    // Bruk eksisterende logikk
    const wordPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    const normalWord = wordPair.normal;
    const undercoverWord = wordPair.undercover;

    const undercoverCount = parseInt(document.getElementById('undercover-count-setting')?.value) || 1;
    const mrWhiteEnabled = document.getElementById('enable-mr-white')?.checked || false;

    const shuffledPlayers = [...playersList].sort(() => Math.random() - 0.5);
    let playerIndex = 0;

    // Tildel roller
    for (const player of shuffledPlayers) {
        let role = 'normal';
        let word = normalWord;

        if (mrWhiteEnabled && playerIndex === 0) {
            role = 'mr-white';
            word = null;
        } else if (playerIndex < undercoverCount + (mrWhiteEnabled ? 1 : 0)) {
            role = 'undercover';
            word = undercoverWord;
        }

        // Oppdater i database
        await supabase
            .from('players')
            .update({
                role: role,
                word: word
            })
            .eq('id', player.id);

        playerIndex++;
    }
}

// Last spillerord fra database
async function loadPlayerWords() {
    try {
        const { data: playersList, error } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', currentGame.id);

        if (error) throw error;

        // Konverter til eksisterende format
        words = [];
        roles = {};

        playersList.forEach(player => {
            roles[player.name] = player.role;
            words.push({
                player: player.name,
                word: player.word,
                role: player.role
            });
        });

    } catch (error) {
        console.error('Feil ved lasting av ord:', error);
    }
}

// Forlat spill
async function leaveGame() {
    try {
        // Fjern subscriptions
        if (gameSubscription) {
            gameSubscription.unsubscribe();
            gameSubscription = null;
        }
        if (playersSubscription) {
            playersSubscription.unsubscribe();
            playersSubscription = null;
        }

        // Slett spiller fra database
        if (currentPlayer) {
            await supabase
                .from('players')
                .delete()
                .eq('id', currentPlayer.id);
        }

        // Reset variabler
        currentGame = null;
        currentPlayer = null;
        onlinePlayers = [];

        // Fjern lobby-siden
        const lobbyPage = document.getElementById('lobby-page');
        if (lobbyPage) {
            lobbyPage.remove();
        }

        // Gå tilbake til hovedmeny
        showPage('main-menu');

    } catch (error) {
        console.error('Feil ved forlating av spill:', error);
        showPage('main-menu'); // Gå tilbake uansett
    }
}

// Hent spillinnstillinger (tilpasset dine felt)
function getGameSettings() {
    return {
        timerDuration: parseInt(document.getElementById('timer-duration')?.value || 300),
        enableMrWhite: document.getElementById('enable-mr-white')?.checked || true,
        undercoverCount: parseInt(document.getElementById('undercover-count-setting')?.value || 1),
        specialRoles: {
            lovers: document.getElementById('enable-lovers')?.checked || false,
            revenger: document.getElementById('enable-revenger')?.checked || false,
            ghost: document.getElementById('enable-ghost')?.checked || false,
            goddess: document.getElementById('enable-goddess')?.checked || false,
            doublevoter: document.getElementById('enable-doublevoter')?.checked || false,
            distractor: document.getElementById('enable-distractor')?.checked || false,
            secretally: document.getElementById('enable-secretally')?.checked || false,
            mime: document.getElementById('enable-mime')?.checked || false,
            justice: document.getElementById('enable-justice')?.checked || false,
            liampower: document.getElementById('enable-liampower')?.checked || false
        }
    };
}

// Legg til multiplayer-knapper i hovedmenyen
function addMultiplayerButtons() {
    const menuButtons = document.querySelector('.menu-buttons');
    if (!menuButtons) return;
    
    // Sjekk om multiplayer-seksjonen allerede eksisterer
    if (document.querySelector('.multiplayer-section')) return;
    
    // Legg til multiplayer-seksjon
    const multiplayerSection = document.createElement('div');
    multiplayerSection.className = 'multiplayer-section';
    multiplayerSection.innerHTML = `
        <h3>🌐 Multiplayer</h3>
        <button class="menu-btn primary" onclick="hostGame()">
            <span class="btn-icon">🏠</span>
            Host Game
        </button>
        <button class="menu-btn" onclick="joinGame()">
            <span class="btn-icon">🔗</span>
            Join Game
        </button>
    `;
    
    // Sett inn før eksisterende "Start Nytt Spill" knapp
    const firstButton = menuButtons.querySelector('.menu-btn');
    if (firstButton) {
        menuButtons.insertBefore(multiplayerSection, firstButton);
    } else {
        menuButtons.appendChild(multiplayerSection);
    }
}

// Synkronisering for diskusjon og avstemming (grunnleggende)
function syncDiscussion() {
    // Her kan du legge til synkronisering av timer, etc.
    console.log('Synkroniserer diskusjon...');
}

function syncVoting() {
    // Her kan du legge til synkronisering av stemmer
    console.log('Synkroniserer avstemming...');
}