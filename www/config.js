// config.js - Konfigurasjon og konstanter

// Supabase konfigurasjon
const SUPABASE_CONFIG = {
    url: 'https://rajqlpstkevirxyabejk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhanFscHN0a2V2aXJ4eWFiZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjYyMDIsImV4cCI6MjA2NDYwMjIwMn0.5rQIV1QnqIrURgnvf7CD2L5t3B_UHxKySJU-dw0ZJ9M'
};

// Spillkonstanter
const GAME_CONFIG = {
    MIN_PLAYERS: 3,
    MAX_PLAYERS_LOCAL: 12,
    MAX_PLAYERS_ONLINE: 20,
    DEFAULT_TIMER: 300, // 5 minutter
    GAME_CODE_LENGTH: 6,
    GAME_CODE_CHARS: 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789', // Unngår O og 0
    POLLING_INTERVAL: 2000, 
    NOTIFICATION_DURATION: 3000 
};

// Spillstatus
const GAME_STATUS = {
    WAITING: 'waiting',
    REVEALING: 'revealing',
    DISCUSSION: 'discussion',
    VOTING: 'voting',
    RESULTS: 'results',
    FINISHED: 'finished'
};

// Spillerroller
const PLAYER_ROLES = {
    NORMAL: 'normal',
    UNDERCOVER: 'undercover',
    MR_WHITE: 'mr-white',
    LOVERS: 'lovers',
    REVENGER: 'revenger',
    GHOST: 'ghost',
    GUARDIAN_ANGEL: 'goddess',
    DOUBLE_VOTER: 'doublevoter',
    DISTRACTOR: 'distractor',
    SECRET_ALLY: 'secretally',
    MIME: 'mime',
    JUSTICE: 'justice',
    LIAMPOWER: 'liampower'
};

// Spesialroller beskrivelser
const SPECIAL_ROLES = {
    [PLAYER_ROLES.LOVERS]: {
        name: '💕 The Lovers',
        description: 'To spillere er hemmelig forelsket. Hvis én elimineres, dør den andre automatisk.',
        showOnReveal: true
    },
    [PLAYER_ROLES.REVENGER]: {
        name: '⚔️ The Revenger',
        description: 'Om stemt ut, kan velge én annen spiller som også dør med ham/henne.',
        showOnReveal: true
    },
    [PLAYER_ROLES.GHOST]: {
        name: '👻 The Ghost',
        description: 'Etter død kan Ghost sende et hint til de gjenværende spillerne én gang.',
        showOnReveal: true
    },
    [PLAYER_ROLES.GUARDIAN_ANGEL]: {
        name: '⚖️ Guardian Angel',
        description: 'Kan én gang redde en spiller fra å bli stemt ut.',
        showOnReveal: true
    },
    [PLAYER_ROLES.DOUBLE_VOTER]: {
        name: '🎲 Double Voter',
        description: 'Kan stemme to ganger på samme spiller eller to forskjellige.',
        showOnReveal: true
    },
    [PLAYER_ROLES.DISTRACTOR]: {
        name: '🎭 Distractor / Jester',
        description: 'Hvis stemt ut vinner Distractor umiddelbart, og resten taper.',
        showOnReveal: true
    },
    [PLAYER_ROLES.SECRET_ALLY]: {
        name: '🕵️‍♂️ Secret Ally',
        description: 'Er en skjult alliert av Mr. White. Jobber for å hjelpe Mr. White vinne.',
        showOnReveal: true
    },
    [PLAYER_ROLES.MIME]: {
        name: '🤐 Mr. Mime',
        description: 'Kan kun bruke kroppsspråk, har ikke lov til å snakke.',
        showOnReveal: true,
        warning: 'Du kan IKKE snakke! Kun kroppsspråk og mimikk er tillatt.'
    },
    [PLAYER_ROLES.JUSTICE]: {
        name: '⚖️ Justice',
        description: 'Du avgjør hvem som blir stemt ut om det blir uavgjort.',
        showOnReveal: true
    },
    [PLAYER_ROLES.LIAMPOWER]: {
        name: '💥 LiamPower',
        description: 'Egendefinert rolle - se innstillinger for beskrivelse.',
        showOnReveal: true
    }
};

// Ordpar for spillet
const WORD_PAIRS = [
    { normal: "Kaffe", undercover: "Te" },
    { normal: "Pizza", undercover: "Hamburger" },
    { normal: "Hund", undercover: "Katt" },
    { normal: "Bil", undercover: "Motorsykkel" },
    { normal: "Strand", undercover: "Fjell" },
    { normal: "Sommer", undercover: "Vinter" },
    { normal: "Fotball", undercover: "Basketball" },
    { normal: "Bøker", undercover: "Filmer" },
    { normal: "Sjokolade", undercover: "Vanilje" },
    { normal: "Morgen", undercover: "Kveld" },
    { normal: "Regn", undercover: "Snø" },
    { normal: "Eple", undercover: "Appelsin" },
    { normal: "Rød", undercover: "Blå" },
    { normal: "Høy", undercover: "Lav" },
    { normal: "Varm", undercover: "Kald" },
    { normal: "Stor", undercover: "Liten" },
    { normal: "Raskt", undercover: "Sakte" },
    { normal: "Lys", undercover: "Mørk" },
    { normal: "Høyre", undercover: "Venstre" },
    { normal: "Opp", undercover: "Ned" },
    { normal: "Inn", undercover: "Ut" },
    { normal: "Start", undercover: "Slutt" },
    { normal: "Søt", undercover: "Salt" },
    { normal: "Ung", undercover: "Gammel" },
    { normal: "Rik", undercover: "Fattig" },
    { normal: "Glad", undercover: "Trist" },
    { normal: "Sterk", undercover: "Svak" },
    { normal: "Smart", undercover: "Dum" },
    { normal: "Pen", undercover: "Stygg" },
    { normal: "Kjent", undercover: "Ukjent" },
    { normal: "Ny", undercover: "Gammel" },
    { normal: "Ren", undercover: "Skitten" },
    { normal: "Enkel", undercover: "Vanskelig" },
    { normal: "Trygg", undercover: "Farlig" },
    { normal: "Åpen", undercover: "Lukket" },
    { normal: "Full", undercover: "Tom" },
    { normal: "Tykk", undercover: "Tynn" },
    { normal: "Lang", undercover: "Kort" },
    { normal: "Bred", undercover: "Smal" },
    { normal: "Dyp", undercover: "Grunn" },
    { normal: "Tung", undercover: "Lett" },
    { normal: "Hard", undercover: "Myk" },
    { normal: "Glatt", undercover: "Ru" },
    { normal: "Spiss", undercover: "Butt" },
    { normal: "Rett", undercover: "Krokete" },
    { normal: "Rundt", undercover: "Kvadratisk" },
    { normal: "iPhone", undercover: "Samsung" },
    { normal: "McDonald's", undercover: "Burger King" },
    { normal: "Coca-Cola", undercover: "Pepsi" },
    { normal: "Netflix", undercover: "Disney+" },
    { normal: "Spotify", undercover: "Apple Music" },
    { normal: "Instagram", undercover: "TikTok" },
    { normal: "YouTube", undercover: "Twitch" },
    { normal: "Google", undercover: "Bing" },
    { normal: "Chrome", undercover: "Safari" },
    { normal: "WhatsApp", undercover: "Snapchat" },
    { normal: "Facebook", undercover: "Twitter" },
    { normal: "Amazon", undercover: "eBay" },
    { normal: "Tesla", undercover: "BMW" },
    { normal: "Adidas", undercover: "Nike" },
    { normal: "Minecraft", undercover: "Fortnite" },
    { normal: "PlayStation", undercover: "Xbox" },
    { normal: "Mario", undercover: "Sonic" },
    { normal: "Pokémon", undercover: "Digimon" },
    { normal: "Harry Potter", undercover: "Lord of the Rings" },
    { normal: "Star Wars", undercover: "Star Trek" }
];

// Standard innstillinger
const DEFAULT_SETTINGS = {
    timerDuration: GAME_CONFIG.DEFAULT_TIMER,
    enableMrWhite: true,
    undercoverCount: 1,
    specialRoles: {
        lovers: false,
        revenger: false,
        ghost: false,
        goddess: false,
        doublevoter: false,
        distractor: false,
        secretally: false,
        mime: false,
        justice: false,
        liampower: false
    },
    liampowerDescription: ''
};

// Notifikasjonstyper
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

// Tilkoblingsstatuser
const CONNECTION_STATUS = {
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

// Timer statuser
const TIMER_STATUS = {
    STOPPED: 'stopped',
    RUNNING: 'running',
    PAUSED: 'paused',
    FINISHED: 'finished'
};

// Eksporter alle konstanter som globale variabler
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.GAME_CONFIG = GAME_CONFIG;
window.GAME_STATUS = GAME_STATUS;
window.PLAYER_ROLES = PLAYER_ROLES;
window.SPECIAL_ROLES = SPECIAL_ROLES;
window.WORD_PAIRS = WORD_PAIRS;
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
window.CONNECTION_STATUS = CONNECTION_STATUS;
window.TIMER_STATUS = TIMER_STATUS;