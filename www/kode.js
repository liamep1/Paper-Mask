// 🎮 Hovedvariabler
let players = [];
let currentPlayerIndex = 0;
let gameState = 'setup';
let words = [];
let roles = {};
let votingResults = {};
let timer = null;
let timerSeconds = 300;
let isTimerRunning = false;
let eliminatedPlayers = [];
let specialRoleActions = {};
let enabledSpecialRoles = [];

// 📚 Ordliste
const wordPairs = [
    { normal: "Båt", undercover: "Tog", category: "Transport" },
    { normal: "Skinke", undercover: "Pølse", category: "Mat" },
    { normal: "Lue", undercover: "Skjorte", category: "Klær" },
    { normal: "Torden", undercover: "Sol", category: "Vær" },
    { normal: "Bil", undercover: "Fly", category: "Transport" },
    { normal: "Eple", undercover: "Appelsin", category: "Frukt" },
    { normal: "Fugl", undercover: "Katt", category: "Dyr" },
    { normal: "Juice", undercover: "Brus", category: "Drikke" },
    { normal: "Gul", undercover: "Blå", category: "Farger" },
    { normal: "Kaffe", undercover: "Juice", category: "Drikke" },
    { normal: "Ost", undercover: "Egg", category: "Mat" },
    { normal: "Perm", undercover: "Blyant", category: "Skole" },
    { normal: "Blå", undercover: "Grønn", category: "Farger" },
    { normal: "Brød", undercover: "Pølse", category: "Mat" },
    { normal: "Smør", undercover: "Skinke", category: "Mat" },
    { normal: "Sol", undercover: "Snø", category: "Vær" },
    { normal: "Hest", undercover: "Hund", category: "Dyr" },
    { normal: "Skinke", undercover: "Ost", category: "Mat" },
    { normal: "Viskelær", undercover: "Perm", category: "Skole" },
    { normal: "Skap", undercover: "Stol", category: "Møbler" },
    { normal: "Hylle", undercover: "Sofa", category: "Møbler" },
    { normal: "Blyant", undercover: "Penn", category: "Skole" },
    { normal: "Hund", undercover: "Katt", category: "Dyr" },
    { normal: "Sykkel", undercover: "Bil", category: "Transport" },
    { normal: "Te", undercover: "Vann", category: "Drikke" },
    { normal: "Brus", undercover: "Te", category: "Drikke" },
    { normal: "Tog", undercover: "Sykkel", category: "Transport" },
    { normal: "Sko", undercover: "Jakke", category: "Klær" },
    { normal: "Stol", undercover: "Hylle", category: "Møbler" },
    { normal: "Eple", undercover: "Pære", category: "Frukt" },
    { normal: "Bil", undercover: "Tog", category: "Transport" },
    { normal: "Brød", undercover: "Egg", category: "Mat" },
    { normal: "Hest", undercover: "Kanin", category: "Dyr" },
    { normal: "Sofa", undercover: "Bord", category: "Møbler" },
    { normal: "Sol", undercover: "Vind", category: "Vær" },
    { normal: "Regn", undercover: "Torden", category: "Vær" },
    { normal: "Torden", undercover: "Sky", category: "Vær" },
    { normal: "Bord", undercover: "Sofa", category: "Møbler" },
    { normal: "Genser", undercover: "Skjorte", category: "Klær" },
    { normal: "Hvit", undercover: "Rød", category: "Farger" },
    { normal: "Buss", undercover: "Båt", category: "Transport" },
    { normal: "Perm", undercover: "Blyant", category: "Skole" },
    { normal: "Viskelær", undercover: "Blyant", category: "Skole" },
    { normal: "Seng", undercover: "Sofa", category: "Møbler" },
    { normal: "Pølse", undercover: "Brød", category: "Mat" },
    { normal: "Fisk", undercover: "Kanin", category: "Dyr" },
    { normal: "Regn", undercover: "Vind", category: "Vær" },
    { normal: "Eple", undercover: "Druer", category: "Frukt" },
    { normal: "Hylle", undercover: "Skap", category: "Møbler" },
    { normal: "Perm", undercover: "Penn", category: "Skole" },
    { normal: "Smør", undercover: "Egg", category: "Mat" },
    { normal: "Torden", undercover: "Regn", category: "Vær" },
    { normal: "Fisk", undercover: "Hund", category: "Dyr" },
    { normal: "Genser", undercover: "Bukse", category: "Klær" },
    { normal: "Pære", undercover: "Banan", category: "Frukt" },
    { normal: "Vann", undercover: "Melk", category: "Drikke" },
    { normal: "Perm", undercover: "Blyant", category: "Skole" },
    { normal: "Hund", undercover: "Katt", category: "Dyr" },
    { normal: "Rød", undercover: "Gul", category: "Farger" },
    { normal: "Genser", undercover: "Bukse", category: "Klær" },
    { normal: "Penn", undercover: "Bok", category: "Skole" },
    { normal: "Hvit", undercover: "Rød", category: "Farger" },
    { normal: "Sol", undercover: "Sky", category: "Vær" },
    { normal: "Bok", undercover: "Perm", category: "Skole" },
    { normal: "Skinke", undercover: "Egg", category: "Mat" },
    { normal: "Lue", undercover: "Jakke", category: "Klær" },
    { normal: "Appelsin", undercover: "Pære", category: "Frukt" },
    { normal: "Svart", undercover: "Grønn", category: "Farger" },
    { normal: "Fisk", undercover: "Hund", category: "Dyr" },
    { normal: "Bord", undercover: "Seng", category: "Møbler" },
    { normal: "Grønn", undercover: "Svart", category: "Farger" },
    { normal: "Vann", undercover: "Juice", category: "Drikke" },
    { normal: "Hund", undercover: "Fisk", category: "Dyr" },
    { normal: "Kiwi", undercover: "Appelsin", category: "Frukt" },
    { normal: "Hvit", undercover: "Svart", category: "Farger" },
    { normal: "Pølse", undercover: "Smør", category: "Mat" },
    { normal: "Blyant", undercover: "Bok", category: "Skole" },
    { normal: "Sko", undercover: "Bukse", category: "Klær" },
    { normal: "Viskelær", undercover: "Penn", category: "Skole" },
    { normal: "Hvit", undercover: "Grønn", category: "Farger" },
    { normal: "Torden", undercover: "Snø", category: "Vær" },
    { normal: "Skap", undercover: "Hylle", category: "Møbler" },
    { normal: "Penn", undercover: "Bok", category: "Skole" },
    { normal: "Bil", undercover: "Tog", category: "Transport" },
    { normal: "Kanin", undercover: "Fugl", category: "Dyr" },
    { normal: "Sol", undercover: "Vind", category: "Vær" },
    { normal: "Hund", undercover: "Fugl", category: "Dyr" },
    { normal: "Hylle", undercover: "Sofa", category: "Møbler" },
    { normal: "Skinke", undercover: "Brød", category: "Mat" },
    { normal: "Svart", undercover: "Hvit", category: "Farger" },
    { normal: "Sykkel", undercover: "Fly", category: "Transport" },
    { normal: "Hund", undercover: "Hest", category: "Dyr" },
    { normal: "Grønn", undercover: "Svart", category: "Farger" },
    { normal: "Grønn", undercover: "Rød", category: "Farger" },
    { normal: "Pære", undercover: "Kiwi", category: "Frukt" },
    { normal: "Appelsin", undercover: "Pære", category: "Frukt" },
    { normal: "Vann", undercover: "Brus", category: "Drikke" },
    { normal: "Hylle", undercover: "Skap", category: "Møbler" },
    { normal: "Perm", undercover: "Penn", category: "Skole" },
    { normal: "Smør", undercover: "Egg", category: "Mat" },
    { normal: "Torden", undercover: "Regn", category: "Vær" },
    { normal: "Fisk", undercover: "Hund", category: "Dyr" },
    { normal: "Genser", undercover: "Bukse", category: "Klær" },
    { normal: "Pære", undercover: "Banan", category: "Frukt" },
    { normal: "Vann", undercover: "Melk", category: "Drikke" },
    { normal: "Perm", undercover: "Blyant", category: "Skole" },
    { normal: "Hund", undercover: "Katt", category: "Dyr" },
    { normal: "Rød", undercover: "Gul", category: "Farger" },
    { normal: "Genser", undercover: "Bukse", category: "Klær" },
    { normal: "Penn", undercover: "Bok", category: "Skole" },
    { normal: "Hvit", undercover: "Rød", category: "Farger" },
    { normal: "Sol", undercover: "Sky", category: "Vær" },
    { normal: "Bok", undercover: "Perm", category: "Skole" },
    { normal: "Skinke", undercover: "Egg", category: "Mat" },
    { normal: "Lue", undercover: "Jakke", category: "Klær" },
    { normal: "Appelsin", undercover: "Pære", category: "Frukt" },
    { normal: "Svart", undercover: "Grønn", category: "Farger" },
    { normal: "Fisk", undercover: "Hund", category: "Dyr" },
    { normal: "Bord", undercover: "Seng", category: "Møbler" },
    { normal: "Grønn", undercover: "Svart", category: "Farger" },
    { normal: "Vann", undercover: "Juice", category: "Drikke" },
    { normal: "Hund", undercover: "Fisk", category: "Dyr" },
    { normal: "Kiwi", undercover: "Appelsin", category: "Frukt" },
    { normal: "Hvit", undercover: "Svart", category: "Farger" },
    { normal: "Pølse", undercover: "Smør", category: "Mat" },
    { normal: "Blyant", undercover: "Bok", category: "Skole" },
    { normal: "Sko", undercover: "Bukse", category: "Klær" },
    { normal: "Viskelær", undercover: "Penn", category: "Skole" },
    { normal: "Hvit", undercover: "Grønn", category: "Farger" },
    { normal: "Torden", undercover: "Snø", category: "Vær" },
    { normal: "Skap", undercover: "Hylle", category: "Møbler" },
    { normal: "Penn", undercover: "Bok", category: "Skole" },
    { normal: "Bil", undercover: "Tog", category: "Transport" },
    { normal: "Kanin", undercover: "Fugl", category: "Dyr" },
    { normal: "Sol", undercover: "Vind", category: "Vær" },
    { normal: "Hund", undercover: "Fugl", category: "Dyr" },
    { normal: "Hylle", undercover: "Sofa", category: "Møbler" },
    { normal: "Skinke", undercover: "Brød", category: "Mat" },
    { normal: "Svart", undercover: "Hvit", category: "Farger" },
    { normal: "Sykkel", undercover: "Fly", category: "Transport" },
    { normal: "Hund", undercover: "Hest", category: "Dyr" },
    { normal: "Grønn", undercover: "Svart", category: "Farger" },
    { normal: "Grønn", undercover: "Rød", category: "Farger" },
    { normal: "Pære", undercover: "Kiwi", category: "Frukt" },
    { normal: "Appelsin", undercover: "Pære", category: "Frukt" },
    { normal: "Vann", undercover: "Brus", category: "Drikke" },
    { normal: "Perm", undercover: "Linjal", category: "Skole" },
    { normal: "Sofa", undercover: "Stol", category: "Møbler" },
    { normal: "Rød", undercover: "Svart", category: "Farger" },
    { normal: "Te", undercover: "Vann", category: "Drikke" },
    { normal: "Bukse", undercover: "Skjorte", category: "Klær" },
    { normal: "Kaffe", undercover: "Brus", category: "Drikke" },
    { normal: "Seng", undercover: "Hylle", category: "Møbler" },
    { normal: "Lue", undercover: "Sko", category: "Klær" },
    { normal: "Eple", undercover: "Banan", category: "Frukt" },
    { normal: "Vann", undercover: "Te", category: "Drikke" },
    { normal: "Hvit", undercover: "Blå", category: "Farger" },
    { normal: "Skinke", undercover: "Pølse", category: "Mat" },
    { normal: "Penn", undercover: "Blyant", category: "Skole" },
    { normal: "Båt", undercover: "Fly", category: "Transport" },
    { normal: "Snø", undercover: "Regn", category: "Vær" },
    { normal: "Seng", undercover: "Sofa", category: "Møbler" },
    { normal: "Perm", undercover: "Bok", category: "Skole" },
    { normal: "Vann", undercover: "Kaffe", category: "Drikke" },
    { normal: "Jakke", undercover: "Genser", category: "Klær" },
    { normal: "Torden", undercover: "Vind", category: "Vær" },
    { normal: "Vind", undercover: "Snø", category: "Vær" },
    { normal: "Sofa", undercover: "Bord", category: "Møbler" },
    { normal: "Skap", undercover: "Sofa", category: "Møbler" },
    { normal: "Genser", undercover: "Sko", category: "Klær" },
    { normal: "Stol", undercover: "Sofa", category: "Møbler" },
    { normal: "Vind", undercover: "Regn", category: "Vær" },
    { normal: "Vind", undercover: "Regn", category: "Vær" },
    { normal: "Kaffe", undercover: "Brus", category: "Drikke" },
    { normal: "Sofa", undercover: "Seng", category: "Møbler" },
    { normal: "Pølse", undercover: "Smør", category: "Mat" },
    { normal: "Seng", undercover: "Skap", category: "Møbler" },
    { normal: "Druer", undercover: "Kiwi", category: "Frukt" },
    { normal: "Sykkel", undercover: "Båt", category: "Transport" },
    { normal: "Fugl", undercover: "Kanin", category: "Dyr" },
    { normal: "Kiwi", undercover: "Banan", category: "Frukt" },
    { normal: "Hylle", undercover: "Bord", category: "Møbler" },
    { normal: "Eple", undercover: "Kiwi", category: "Frukt" },
    { normal: "Hylle", undercover: "Stol", category: "Møbler" },
    { normal: "Appelsin", undercover: "Druer", category: "Frukt" },
    { normal: "Rød", undercover: "Blå", category: "Farger" },
    { normal: "Lue", undercover: "Genser", category: "Klær" },
    { normal: "Fisk", undercover: "Kanin", category: "Dyr" },
    { normal: "Melk", undercover: "Vann", category: "Drikke" },
    { normal: "Te", undercover: "Kaffe", category: "Drikke" },
    { normal: "Torden", undercover: "Sol", category: "Vær" },
    { normal: "Skinke", undercover: "Smør", category: "Mat" },
    { normal: "Sko", undercover: "Lue", category: "Klær" },
    { normal: "Bukse", undercover: "Sko", category: "Klær" },
    { normal: "Vind", undercover: "Torden", category: "Vær" },
    { normal: "Juice", undercover: "Vann", category: "Drikke" },
    { normal: "Bok", undercover: "Viskelær", category: "Skole" },
    { normal: "Kiwi", undercover: "Pære", category: "Frukt" },
    { normal: "Viskelær", undercover: "Blyant", category: "Skole" },
    { normal: "Penn", undercover: "Viskelær", category: "Skole" },
    { normal: "Eple", undercover: "Pære", category: "Frukt" }
];



// ⭐ Spesialroller
const specialRoles = {
    lovers: { name: "💕 The Lovers", description: "Hvis en av dere dør, dør den andre også." },
    revenger: { name: "⚔️ The Revenger", description: "Hvis du blir stemt ut, velg en spiller som dør med deg." },
    ghost: { name: "👻 The Ghost", description: "Når du dør, gi hint til gjenlevende spillere." },
    goddess: { name: "⚖️ Guardian Angel", description: "Kan redde en spiller én gang." },
    doublevoter: { name: "🎲 Double Voter", description: "Du kan stemme to ganger." },
    distractor: { name: "🎭 Distractor", description: "Hvis du blir stemt ut, vinner du alene!" },
    secretally: { name: "🕵️‍♂️ Secret Ally", description: "Du er en alliert av Mr. White." },
    mime: { name: "🤐 Mr. Mime", description: "Du kan kun bruke kroppsspråk!" },
    justice: { name: "justice", description: "Du avgjør hvem som blir stemt ut om det blir likt stemmer" },
    liampower: { name: "💥 LiamPower", description: "Her kan du fylle inn hva LiamPower skal gjøre." }

};

// 🔄 Shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ➕ Legg til spiller
function addPlayer() {
    const input = document.getElementById('player-name');
    const name = input.value.trim();

    if (name && !players.includes(name)) {
        players.push(name);
        input.value = '';
        updatePlayersList();
        updateStartButton();
    }
}

// ➖ Fjern spiller
function removePlayer(index) {
    players.splice(index, 1);
    updatePlayersList();
    updateStartButton();
}

// Oppdater spillerlisten
function updatePlayersList() {
    const list = document.getElementById('players-list');
    list.innerHTML = players.map((player, index) => `
        <div class="player-item">
            <span class="player-name">${player}</span>
            <button class="remove-btn" onclick="removePlayer(${index})">❌</button>
        </div>
    `).join('');
}

// Oppdater start-knapp
function updateStartButton() {
    const btn = document.getElementById('start-game-btn');
    btn.disabled = players.length < 3;
}

// 🚀 Start spill
function startGame() {
    if (players.length < 3) {
        alert("Minimum 3 spillere kreves!");
        return;
    }

    gameState = 'revealing';
    currentPlayerIndex = 0;
    eliminatedPlayers = [];

    assignWords();
    assignSpecialRoles();
    showGameSection('word-reveal');
    showCurrentPlayerWord();
}

// 🎲 Tildel ord
function assignWords() {
    const wordPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    const normalWord = wordPair.normal;
    const undercoverWord = wordPair.undercover;

    const undercoverCount = parseInt(document.getElementById('undercover-count-setting')?.value) || 2;
    const mrWhiteEnabled = document.getElementById('enable-mr-white')?.checked || false;
    const mrWhiteCount = mrWhiteEnabled ? 1 : 0;

    words = [];
    roles = {};
    const shuffledPlayers = [...players];
    shuffle(shuffledPlayers);

    // Mr. White
    for (let i = 0; i < mrWhiteCount; i++) {
        roles[shuffledPlayers[i]] = 'mr-white';
        words.push({ player: shuffledPlayers[i], word: null, role: 'mr-white' });
    }

    // Undercover
    for (let i = mrWhiteCount; i < mrWhiteCount + undercoverCount; i++) {
        roles[shuffledPlayers[i]] = 'undercover';
        words.push({ player: shuffledPlayers[i], word: undercoverWord, role: 'undercover' });
    }

    // Normal
    for (let i = mrWhiteCount + undercoverCount; i < players.length; i++) {
        roles[shuffledPlayers[i]] = 'normal';
        words.push({ player: shuffledPlayers[i], word: normalWord, role: 'normal' });
    }
}

// 🎭 Tildel spesialroller
function assignSpecialRoles() {
    const rolesToUse = [...enabledSpecialRoles];  // Bruk det som er lagret fra saveSettings()
    shuffle(rolesToUse);

    const normalPlayers = players.filter(p => roles[p] === 'normal');
    shuffle(normalPlayers);

    const maxSpecialRoles = Math.floor(players.length / 2);
    const rolesToAssign = Math.min(rolesToUse.length, maxSpecialRoles, normalPlayers.length);

    specialRoleActions = {};  // Nullstiller spesialrolle-mapping

    for (let i = 0; i < rolesToAssign; i++) {
        const role = rolesToUse[i];
        if (role === 'lovers' && i + 1 < rolesToAssign) {
            specialRoleActions[normalPlayers[i]] = role;
            specialRoleActions[normalPlayers[i + 1]] = role;
            i++; // Hopper over neste (fordi lovers er 2 stk)
        } else {
            specialRoleActions[normalPlayers[i]] = role;
        }
    }

    // For debug
    console.log("🎭 Assigned special roles:", specialRoleActions);
}

// 🎬 Vis spiller sitt ord
function showCurrentPlayerWord() {
    const player = players[currentPlayerIndex];
    const wordData = words.find(w => w.player === player);

    document.getElementById('current-player-name').textContent = `${player}s tur`;

    const wordCard = document.getElementById('word-card');
    const wordText = document.getElementById('word-text');
    const roleIndicator = document.getElementById('role-indicator');

    wordCard.className = 'word-card clickable';
    wordText.textContent = 'Klikk for å se ditt ord';
    roleIndicator.textContent = '';

    wordCard.onclick = () => {
        if (wordData.role === 'mr-white') {
            wordText.textContent = 'Du er MR. WHITE!';
            roleIndicator.textContent = '⚪ Du vet ikke ordet - gjett det!';
            wordCard.className = 'word-card mr-white';
        } else if (wordData.role === 'undercover') {
            wordText.textContent = wordData.word;
            wordCard.className = 'word-card undercover';
        } else {
            wordText.textContent = wordData.word;
            wordCard.className = 'word-card normal';
        }

        if (specialRoleActions[player]) {
            setTimeout(() => showSpecialRole(player), 1000);
        }

        wordCard.onclick = null;
    };
}

// 🎭 Vis spesialrolle overlay
function showSpecialRole(player) {
    const roleKey = specialRoleActions[player];
    const role = specialRoles[roleKey];

    document.getElementById('role-title').textContent = role.name;

    let descriptionHTML = '';
    
    // OBS! Her passer vi på at justice viser justice og mime viser mime:
    if (roleKey === 'justice') {
        descriptionHTML = `
            <div class="justice-warning">
                 <h2> ⚖️Velg smart⚖️ </h2>
                <p>Du velger hvem som blir stemt ut om det blir likt med stemmer</p>
            </div>
        `;
    } else if (roleKey === 'mime') {
        descriptionHTML = `
            <div class="mime-warning">
                <h2>⚠️ VIKTIG! ⚠️</h2>
                <p>Du kan IKKE snakke under hele spillet!</p>
            </div>
        `;
    } else {
        descriptionHTML = role.description;
    }
    
    document.getElementById('role-description').innerHTML = descriptionHTML;
    // Her bruker vi .show for å få popup-animasjonen
    const overlay = document.getElementById('role-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('show');
}

function closeRoleOverlay() {
    const overlay = document.getElementById('role-overlay');
    overlay.classList.remove('show');
    overlay.classList.add('hidden');
}

// ➡️ Neste spiller
function nextPlayer() {
    currentPlayerIndex++;
    if (currentPlayerIndex >= players.length) {
        startDiscussion();
    } else {
        showCurrentPlayerWord();
    }
}
// 👉 Start diskusjon
function startDiscussion() {
    gameState = 'discussion';
    showGameSection('discussion');

    const alivePlayers = players.filter(p => !eliminatedPlayers.includes(p));
    shuffle(alivePlayers);

    document.getElementById('order-list').innerHTML = alivePlayers.map((player, index) => `
        <div class="order-item">
            <span class="order-number">${index + 1}.</span>
            <span class="player-name">${player}</span>
        </div>
    `).join('');

    timerSeconds = parseInt(document.getElementById('timer-duration')?.value) || 300;
    updateTimerDisplay();
    startTimer();
}

// ⏱️ Start timer
function startTimer() {
    isTimerRunning = true;
    document.getElementById('timer-toggle').textContent = '⏸️';

    timer = setInterval(() => {
        if (isTimerRunning) {
            timerSeconds--;
            updateTimerDisplay();

            if (timerSeconds <= 0) {
                clearInterval(timer);
                setTimeout(startVoting, 1000);
            }
        }
    }, 1000);
}

// ⏯️ Toggle timer
function toggleTimer() {
    isTimerRunning = !isTimerRunning;
    document.getElementById('timer-toggle').textContent = isTimerRunning ? '⏸️' : '▶️';
}

// ⏱️ Oppdater timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const timerEl = document.getElementById('timer');
    if (timerSeconds <= 30) {
        timerEl.style.color = '#ff4757';
    } else if (timerSeconds <= 60) {
        timerEl.style.color = '#ffa502';
    } else {
        timerEl.style.color = '#2ed573';
    }
}

// 🗳️ Start avstemming
function startVoting() {
    if (timer) clearInterval(timer);
    gameState = 'voting';
    showGameSection('voting');

    votingResults = {};
    const alivePlayers = players.filter(p => !eliminatedPlayers.includes(p));

    document.getElementById('voting-cards').innerHTML = alivePlayers.map(player => `
        <div class="vote-card" onclick="voteForPlayer('${player}')">
            <div class="vote-player-name">${player}</div>
            <div class="vote-count" id="votes-${player}">0 stemmer</div>
        </div>
    `).join('');
}

// 🗳️ Stem på spiller
function voteForPlayer(player) {
    votingResults[player] = (votingResults[player] || 0) + 1;
    document.getElementById(`votes-${player}`).textContent = `${votingResults[player]} stemmer`;

    const totalVotes = Object.values(votingResults).reduce((a, b) => a + b, 0);
    const alivePlayers = players.filter(p => !eliminatedPlayers.includes(p));

    if (totalVotes >= alivePlayers.length) {
        document.getElementById('finish-vote-btn').disabled = false;
    }
}

// 🗳️ Fullfør avstemming
function finishVoting() {
    gameState = 'results';
    showGameSection('results');

    const maxVotes = Math.max(...Object.values(votingResults));
    const eliminatedPlayer = Object.keys(votingResults).find(player => votingResults[player] === maxVotes);

    document.getElementById('result-display').innerHTML = `
        <div class="result-card">
            <h3>📊 Avstemmingsresultat</h3>
            <p><strong>${eliminatedPlayer}</strong> ble eliminert med ${maxVotes} stemmer</p>
            <div class="role-reveal">
                <h4>🎭 ${eliminatedPlayer} var:</h4>
                <p class="role-${roles[eliminatedPlayer]}">${getRoleDisplayName(roles[eliminatedPlayer])}</p>
            </div>
        </div>
    `;

    if (roles[eliminatedPlayer] === 'mr-white') {
        showMrWhiteGuess(eliminatedPlayer);
        return;
    }

    eliminatePlayer(eliminatedPlayer);
}

// ❌ Eliminer spiller
function eliminatePlayer(player) {
    eliminatedPlayers.push(player);
    setTimeout(checkWinConditions, 2000);
}

// ⚪ Mr. White gjetter
function showMrWhiteGuess(mrWhitePlayer) {
    const normalWord = words.find(w => w.role === 'normal')?.word || '';

    document.getElementById('result-display').innerHTML += `
        <div class="result-card mr-white-guess">
            <h3>⚪ MR. WHITE GJETTER!</h3>
            <p>${mrWhitePlayer}, du ble avslørt! Gjett det riktige ordet:</p>
            <input type="text" id="mr-white-guess" placeholder="Skriv ditt gjett...">
            <button class="game-btn primary" onclick="checkMrWhiteGuess('${normalWord}', '${mrWhitePlayer}')">Gjett</button>
        </div>
    `;
}

function checkMrWhiteGuess(correctWord, mrWhitePlayer) {
    const guess = document.getElementById('mr-white-guess').value.trim().toLowerCase();
    const correct = correctWord.toLowerCase();

    if (guess === correct) {
        showVictoryScreen('mr-white', `${mrWhitePlayer} gjettet riktig og vant som Mr. White!`);
    } else {
        eliminatedPlayers.push(mrWhitePlayer);

        document.querySelector('.mr-white-guess').innerHTML = `
            <p><strong>${mrWhitePlayer}</strong> gjettet feil! Spillet fortsetter...</p>
        `;

        setTimeout(checkWinConditions, 2000);
    }
}

// 🏆 Sjekk vinnbetingelser
function checkWinConditions() {
    const alivePlayers = players.filter(p => !eliminatedPlayers.includes(p));
    const aliveNormal = alivePlayers.filter(p => roles[p] === 'normal');
    const aliveUndercover = alivePlayers.filter(p => roles[p] === 'undercover');
    const aliveMrWhite = alivePlayers.filter(p => roles[p] === 'mr-white');

    let winner = null;
    let winMessage = '';

    if (aliveUndercover.length === 0 && aliveMrWhite.length === 0) {
        winner = 'normal';
        winMessage = 'De normale spillerne vant!';
    } else if (aliveUndercover.length >= aliveNormal.length) {
        winner = 'undercover';
        winMessage = 'Undercover spillerne vant!';
    } else if (alivePlayers.length <= 2 && aliveMrWhite.length > 0) {
        showMrWhiteGuess(players.find(p => roles[p] === 'mr-white' && !eliminatedPlayers.includes(p)));
        return;
    }

    if (winner) {
        showVictoryScreen(winner, winMessage);
    }
}

// 🏅 Vis seiersskjerm
function showVictoryScreen(winner, message) {
    gameState = 'victory';

    const title = document.getElementById('victory-title');
    const icon = document.getElementById('victory-icon');
    const msg = document.getElementById('victory-message');
    const details = document.getElementById('victory-details');

    switch (winner) {
        case 'normal':
            title.textContent = '🎉 DE NORMALE VANT! 🎉';
            icon.textContent = '👥';
            break;
        case 'undercover':
            title.textContent = '🕵️ UNDERCOVER VANT! 🕵️';
            icon.textContent = '🎭';
            break;
        case 'mr-white':
            title.textContent = '⚪ MR. WHITE VANT! ⚪';
            icon.textContent = '🧙‍♂️';
            break;
    }

    msg.textContent = message;

    const roleDetails = players.map(player => {
        const wordData = words.find(w => w.player === player);
        const isEliminated = eliminatedPlayers.includes(player);
        const specialRole = specialRoleActions[player];

        return `
            <div class="player-role ${isEliminated ? 'eliminated' : 'alive'}">
                <span class="player-name">${player}</span>
                <span class="player-word">${wordData?.word || 'Mr. White'}</span>
                <span class="player-role-type">${getRoleDisplayName(roles[player])}</span>
                ${specialRole ? `<span class="special-role">${specialRoles[specialRole].name}</span>` : ''}
            </div>
        `;
    }).join('');

    details.innerHTML = `
        <h3>🎭 Roller avduket:</h3>
        <div class="role-reveals">
            ${roleDetails}
        </div>
    `;

    showPage('victory');
    createConfetti();
}

// 🎈 Konfetti
function createConfetti() {
    const confetti = document.querySelector('.confetti');
    confetti.innerHTML = '';

    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.animationDelay = Math.random() * 3 + 's';
        piece.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
        confetti.appendChild(piece);
    }
}

// ➡️ ContinueGame (knappen du manglet)
function continueGame() {
    if (players.filter(p => !eliminatedPlayers.includes(p)).length < 3) {
        endGame();
        return;
    }

    votingResults = {};
    document.getElementById('finish-vote-btn').disabled = true;

    startDiscussion();
}

function endGame() {
    location.reload();  // 🔥 Reloader hele appen
}

// ♻️ Reset Game
function resetGame() {
    players = [];
    currentPlayerIndex = 0;
    gameState = 'setup';
    words = [];
    roles = {};
    votingResults = {};
    eliminatedPlayers = [];
    specialRoleActions = {};

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    updatePlayersList();
    updateStartButton();
}

// 🔄 Restart Game (samme spillere)
function restartGame() {
    currentPlayerIndex = 0;
    gameState = 'setup';
    words = [];
    roles = {};
    votingResults = {};
    eliminatedPlayers = [];
    specialRoleActions = {};

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    showPage('game');
    showGameSection('player-setup');
}

// 🎭 Get role name
function getRoleDisplayName(role) {
    switch (role) {
        case 'normal': return '👥 Normal';
        case 'undercover': return '🕵️ Undercover';
        case 'mr-white': return '⚪ Mr. White';
        default: return role;
    }
}

function showPage(pageId) {
    document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId === 'main-menu' ? 'main-menu' : pageId + '-page').classList.remove('hidden');

    // Hvis settings-siden vises → last inn innstillingene
    if (pageId === 'settings') {
        loadSettings();
    }
}
// 🎬 Show game section
function showGameSection(sectionId) {
    document.querySelectorAll('.game-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

// 🧑‍💻 Developer overlay
function showDeveloperOverlay() {
    document.getElementById('developer-overlay').classList.remove('hidden');
}
function closeDeveloperOverlay() {
    document.getElementById('developer-overlay').classList.add('hidden');
}

// Enter-key støtte
document.addEventListener('DOMContentLoaded', function () {
    const playerNameInput = document.getElementById('player-name');
    const ghostHintInput = document.getElementById('ghost-hint');

    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Hindrer evt. form submit
                addPlayer();
                this.value = '';    // Tømmer feltet
                this.focus();       // Setter fokus tilbake
            }
        });
    }

    if (ghostHintInput) {
        ghostHintInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendGhostHint();
            }
        });
    }
});

// Easter egg på victory-icon
document.addEventListener('click', function (e) {
    if (e.target.id === 'victory-icon') {
        createConfetti();

        const messages = [
            "🎊 FANTASTISK SPILL! 🎊",
            "🌟 LEGENDESPILL! 🌟",
            "🚀 EPISK SEIER! 🚀",
            "⭐ MESTERVERK! ⭐"
        ];

        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        document.getElementById('victory-title').textContent = randomMsg;
    }
});
// 🔄 Lagre innstillinger
function saveSettings() {
    enabledSpecialRoles = [];

    if (document.getElementById('enable-lovers')?.checked) enabledSpecialRoles.push('lovers');
    if (document.getElementById('enable-revenger')?.checked) enabledSpecialRoles.push('revenger');
    if (document.getElementById('enable-ghost')?.checked) enabledSpecialRoles.push('ghost');
    if (document.getElementById('enable-goddess')?.checked) enabledSpecialRoles.push('goddess');
    if (document.getElementById('enable-doublevoter')?.checked) enabledSpecialRoles.push('doublevoter');
    if (document.getElementById('enable-distractor')?.checked) enabledSpecialRoles.push('distractor');
    if (document.getElementById('enable-secretally')?.checked) enabledSpecialRoles.push('secretally');
    if (document.getElementById('enable-mime')?.checked) enabledSpecialRoles.push('mime');
    if (document.getElementById('enable-justice')?.checked) enabledSpecialRoles.push('justice');
    if (document.getElementById('enable-liampower')?.checked) {
        enabledSpecialRoles.push('liampower');
        specialRoles.liampower.description = document.getElementById('liampower-description')?.value.trim() || "Her kan du fylle inn hva LiamPower skal gjøre.";
    }

    console.log('✅ Lagret spesialroller:', enabledSpecialRoles);
    console.log('💥 LiamPower beskrivelse:', specialRoles.liampower.description);

    showPage('main-menu');
}

// 🔄 Last inn innstillinger (kalles når settings-siden åpnes)
function loadSettings() {
    document.getElementById('enable-lovers').checked = enabledSpecialRoles.includes('lovers');
    document.getElementById('enable-revenger').checked = enabledSpecialRoles.includes('revenger');
    document.getElementById('enable-ghost').checked = enabledSpecialRoles.includes('ghost');
    document.getElementById('enable-goddess').checked = enabledSpecialRoles.includes('goddess');
    document.getElementById('enable-doublevoter').checked = enabledSpecialRoles.includes('doublevoter');
    document.getElementById('enable-distractor').checked = enabledSpecialRoles.includes('distractor');
    document.getElementById('enable-secretally').checked = enabledSpecialRoles.includes('secretally');
    document.getElementById('enable-mime').checked = enabledSpecialRoles.includes('mime');
    document.getElementById('enable-justice').checked = enabledSpecialRoles.includes('justice');
    document.getElementById('enable-liampower').checked = enabledSpecialRoles.includes('liampower');
    document.getElementById('liampower-description').value = (specialRoles.liampower.description === "Her kan du fylle inn hva LiamPower skal gjøre.") ? "" : (specialRoles.liampower.description || "");
}

document.addEventListener('DOMContentLoaded', function () {
    // For alle special-role checkboxes
    document.querySelectorAll('.special-role input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            this.closest('.special-role').classList.toggle('checked', this.checked);
        });
    });

    // For alle mode-setting checkboxes
    document.querySelectorAll('.mode-setting input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            this.closest('.mode-setting').classList.toggle('checked', this.checked);
        });
    });

    // For LiamPower-setting
    const liamPowerCheckbox = document.querySelector('.liam-power-setting input[type="checkbox"]');
    if (liamPowerCheckbox) {
        liamPowerCheckbox.addEventListener('change', function () {
            this.closest('.liam-power-setting').classList.toggle('checked', this.checked);
        });
    }
});
