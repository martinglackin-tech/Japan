'use strict';

const { categories, categoryOrder, phrases, words, CHEF_CARD_SPEECH, toSpeechText } = globalThis.PHRASEBOOK;

// --- STORAGE ---
function loadString(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function loadJSON(key, fallback) {
    try {
        return JSON.parse(loadString(key, null)) ?? fallback;
    } catch (e) {
        return fallback;
    }
}

function store(key, value) {
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {}
}

// --- HELPERS ---
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

// Turns {漢字|かな} furigana markup into <ruby>; falls back to the plain Japanese.
function rubyHtml(item) {
    return escapeHtml(item.ruby || item.japanese).replace(/\{([^|}]+)\|([^}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Lets "arigatou", "arigato" and "Arigatō" all match: strips accents and collapses long vowels.
function normalizeForSearch(text) {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/ou/g, 'o')
        .replace(/([aeiou])\1+/g, '$1')
        .trim();
}

function findItem(id) {
    return phrases.find(p => p.id === id) || words.find(w => w.id === id);
}

// --- ICONS (outline style, 24px grid) ---
const ICON_PATHS = {
    book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
    shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    cards: 'M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122',
    check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    x: 'M6 18L18 6M6 6l12 12',
    settings: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75',
    speaker: 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z',
    star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
    rotate: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
    search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
    'chevron-left': 'M15.75 19.5L8.25 12l7.5-7.5',
    'chevron-right': 'M8.25 4.5l7.5 7.5-7.5 7.5',
    'chevron-down': 'M19.5 8.25l-7.5 7.5-7.5-7.5',
    alert: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    expand: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15'
};

function icon(name, classes = 'w-5 h-5', filled = false) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${classes} pointer-events-none" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICON_PATHS[name]}"/></svg>`;
}

// Static markup marks icons as <span data-icon="name" class="w-5 h-5">.
function hydrateIcons(root) {
    root.querySelectorAll('[data-icon]').forEach(el => {
        el.outerHTML = icon(el.dataset.icon, el.className || 'w-5 h-5');
    });
}

// --- STATE ---
let searchQuery = "";
let selectedCategoryFilter = "all";
let savedPhraseIds = loadJSON('jf_japan_favorites', []);
let currentTheme = loadString('jf_japan_theme', 'day'); // 'day' or 'izakaya'
let voiceEngine = loadString('jf_japan_voice_engine', 'studio'); // 'studio' or 'device'
let speechRate = parseFloat(loadString('jf_japan_speech_rate', '1.0')) || 1.0;

let flashcardItems = [];
let masteredIds = new Set(loadJSON('jf_japan_mastered', []));
let currentFlashcardIndex = 0;
let flashcardStudyMode = 'en_to_jp'; // 'en_to_jp', 'jp_to_en', 'audio_listen'

let quizQuestions = [];
let currentQuizQuestionIndex = 0;
let quizScore = 0;
let quizResults = [];
let quizAnsweredId = null;
let quizRound = 0; // lets a pending "next question" timer notice the quiz was restarted

// --- DOM ---
const mainContent = document.getElementById('main-content');
const navButtons = document.querySelectorAll('[data-nav]');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const audioToast = document.getElementById('audio-toast');
const toastMessage = document.getElementById('toast-message');
const gfFullscreenOverlay = document.getElementById('gf-fullscreen-overlay');
const phraseOverlay = document.getElementById('phrase-overlay');
const phraseOverlaySpeakerBtn = document.getElementById('phrase-overlay-speaker-btn');
const gfFsCardSpeakerBtn = document.getElementById('gf-fs-card-speaker-btn');

function showToast(msg, duration = 1800) {
    toastMessage.textContent = msg;
    audioToast.classList.remove('opacity-0');
    audioToast.classList.add('opacity-100');
    clearTimeout(audioToast._timer);
    audioToast._timer = setTimeout(() => {
        audioToast.classList.remove('opacity-100');
        audioToast.classList.add('opacity-0');
    }, duration);
}

// --- SETTINGS (theme, voice, speed) ---
function applyTheme() {
    const isDark = currentTheme === 'izakaya';
    document.documentElement.classList.toggle('dark', isDark);
    document.getElementById('meta-theme-color').setAttribute('content', isDark ? '#171412' : '#faf7f2');
}

function updateSettingsUI() {
    const current = { theme: currentTheme, voice: voiceEngine, speed: String(speechRate) };
    settingsPanel.querySelectorAll('[data-setting]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(current[btn.dataset.setting] === btn.dataset.value));
    });
}

function changeSetting(setting, value) {
    if (setting === 'theme') {
        currentTheme = value;
        store('jf_japan_theme', currentTheme);
        applyTheme();
    } else if (setting === 'voice') {
        voiceEngine = value;
        store('jf_japan_voice_engine', voiceEngine);
    } else if (setting === 'speed') {
        speechRate = parseFloat(value);
        store('jf_japan_speech_rate', String(speechRate));
    }
    updateSettingsUI();
}

function toggleSettings(open = settingsPanel.classList.contains('hidden')) {
    settingsPanel.classList.toggle('hidden', !open);
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) settingsPanel.querySelector('[aria-pressed="true"]').focus();
}

// --- VOICES ---
let cachedVoices = [];

function populateVoices() {
    if ('speechSynthesis' in window) {
        try {
            cachedVoices = window.speechSynthesis.getVoices();
        } catch (e) {
            console.warn("Voice list access note:", e);
        }
    }
}

function getBestJapaneseVoice() {
    if (!cachedVoices || cachedVoices.length === 0) {
        populateVoices();
    }
    let jpVoices = cachedVoices.filter(v =>
        (v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('ja')) ||
        (v.name && (v.name.toLowerCase().includes('japan') || v.name.includes('日本語')))
    );
    // Network voices need a connection and stay silent offline, so only offer on-device ones.
    if (!navigator.onLine) jpVoices = jpVoices.filter(v => v.localService !== false);

    if (jpVoices.length === 0) return null;

    const scoreVoice = (v) => {
        const name = (v.name || '').toLowerCase();
        const uri = (v.voiceURI || '').toLowerCase();
        let score = 0;
        if (name.includes('network') || uri.includes('network') || name.includes('online')) score += 70;
        if (name.includes('neural') || name.includes('natural')) score += 60;
        if (name.includes('enhanced') || name.includes('premium')) score += 50;
        if (name.includes('siri') || name.includes('apple')) score += 40;
        if (name.includes('google')) score += 35;
        if (name.includes('kyoko') || name.includes('nanami') || name.includes('otoya') || name.includes('haruka') || name.includes('keita')) score += 30;
        if (v.lang === 'ja-JP') score += 10;
        if (name.includes('ichiro')) score -= 40;
        if (name.includes('desktop') && !name.includes('natural')) score -= 30;
        return score;
    };
    return [...jpVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

// --- RECORDED AUDIO ---
// audio/index.json maps speech text -> mp3 file name. It is written by tools/generate-audio.mjs.
const AUDIO_CACHE = 'jf-japan-audio-v1';
const recordingUrls = new Map(); // speech text -> blob: URL

// Recordings are loaded into blob URLs up front so that playback can start synchronously
// inside the tap handler (iOS blocks play() after an await), and are stored in
// CacheStorage so they keep working offline.
async function loadRecordings() {
    let cache = null;
    try {
        if ('caches' in window) cache = await caches.open(AUDIO_CACHE);
    } catch (e) {}

    // Prefer the latest index; fall back to the cached copy when offline.
    const indexUrl = new URL('audio/index.json', location.href).href;
    let index;
    try {
        const response = await fetch(indexUrl, { cache: 'no-cache' });
        if (!response.ok) return;
        if (cache) await cache.put(indexUrl, response.clone());
        index = await response.json();
    } catch (e) {
        try {
            const cached = cache && await cache.match(indexUrl);
            if (!cached) return;
            index = await cached.json();
        } catch (err) {
            return;
        }
    }

    const wanted = new Set(Object.values(index).map(file => new URL(`audio/${file}`, location.href).href));
    wanted.add(indexUrl);
    for (const [text, file] of Object.entries(index)) {
        const url = new URL(`audio/${file}`, location.href).href;
        try {
            let response = cache && await cache.match(url);
            if (!response) {
                response = await fetch(url);
                if (!response.ok) continue;
                if (cache) await cache.put(url, response.clone());
            }
            recordingUrls.set(text, URL.createObjectURL(await response.blob()));
        } catch (e) {}
    }

    // Drop recordings from an older index.
    if (cache) {
        try {
            for (const request of await cache.keys()) {
                if (!wanted.has(request.url)) await cache.delete(request);
            }
        } catch (e) {}
    }
}

// --- PLAYBACK ---
// Google's TTS endpoint rejects text much over 200 characters.
const MAX_TTS_CHUNK_LENGTH = 180;

// Bumped on every new playback so stale async work can tell it has been superseded.
let playbackToken = 0;
let currentTriggerBtn = null;
let currentPlayingAudio = null;

// Split on sentence ends only, packing sentences into chunks under the TTS limit.
function splitIntoTtsChunks(text) {
    if (text.length <= MAX_TTS_CHUNK_LENGTH) return [text];
    const sentences = text.match(/[^。？！]+[。？！]?/g) || [text];
    const chunks = [];
    let current = '';
    sentences.forEach(sentence => {
        if (current && (current + sentence).length > MAX_TTS_CHUNK_LENGTH) {
            chunks.push(current);
            current = '';
        }
        current += sentence;
    });
    if (current) chunks.push(current);
    return chunks.map(s => s.trim()).filter(s => s.length > 0);
}

function silence(audio) {
    try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    } catch (e) {}
}

function stopPlayback() {
    playbackToken++;
    if (currentPlayingAudio) {
        silence(currentPlayingAudio);
        currentPlayingAudio = null;
    }
    if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (currentTriggerBtn) {
        currentTriggerBtn.classList.remove('speaking-pulse');
        currentTriggerBtn = null;
    }
}

function finishPlayback(token) {
    if (token !== playbackToken) return;
    if (currentTriggerBtn) currentTriggerBtn.classList.remove('speaking-pulse');
    currentTriggerBtn = null;
    currentPlayingAudio = null;
}

const NO_VOICE_MESSAGE = "No Japanese voice on this device. Install one in your phone's text-to-speech settings.";

function playDeviceVoice(cleanText, token) {
    if (token !== playbackToken) return;
    if (!('speechSynthesis' in window)) {
        showToast("Audio playback not supported on this device");
        finishPlayback(token);
        return;
    }

    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = speechRate;
        utterance.pitch = 1.0;

        const voice = getBestJapaneseVoice();
        if (voice) {
            utterance.voice = voice;
        } else if (cachedVoices.length > 0) {
            // The device listed its voices and none of them can speak Japanese right now.
            showToast(NO_VOICE_MESSAGE, 4000);
        }

        utterance.onend = () => finishPlayback(token);
        utterance.onerror = (e) => {
            // 'interrupted' and 'canceled' come from stopPlayback, not a failure.
            if (token === playbackToken && e.error !== 'interrupted' && e.error !== 'canceled') {
                showToast(NO_VOICE_MESSAGE, 4000);
            }
            finishPlayback(token);
        };

        window.speechSynthesis.speak(utterance);
    } catch (err) {
        console.warn("SpeechSynthesis error:", err);
        finishPlayback(token);
    }
}

// Resolves true when the source played to the end, false if it failed or was stopped.
// play() is called synchronously, so this keeps the tap's user-gesture permission.
function playMediaSource(src, token) {
    return new Promise((resolve) => {
        if (token !== playbackToken) return resolve(false);

        const audio = new Audio();
        currentPlayingAudio = audio;
        audio.defaultPlaybackRate = speechRate;
        audio.playbackRate = speechRate;
        audio.addEventListener('loadedmetadata', () => {
            audio.playbackRate = speechRate;
        });
        audio.addEventListener('play', () => {
            audio.playbackRate = speechRate;
        });

        let settled = false;
        const settle = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(loadTimer);
            // Silence a failed element so a late load can't play over the fallback voice.
            if (!ok) silence(audio);
            resolve(ok);
        };

        // Slow connections: give up on this source if nothing has loaded yet.
        const loadTimer = setTimeout(() => {
            if (audio.readyState === 0) settle(false);
        }, 2500);

        audio.onended = () => settle(true);
        audio.onerror = () => settle(false);
        // pause() fires no ended/error event, so watch for it to avoid hanging.
        audio.addEventListener('pause', () => {
            if (!audio.ended) settle(false);
        });

        audio.src = src;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => settle(false));
        }
    });
}

async function playOnlineVoice(chunks, token) {
    for (let i = 0; i < chunks.length; i++) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(chunks[i])}`;
        const ok = await playMediaSource(url, token);
        if (token !== playbackToken) return;
        if (!ok) {
            // Hand whatever hasn't been spoken yet to the device voice.
            playDeviceVoice(chunks.slice(i).join(''), token);
            return;
        }
    }
    finishPlayback(token);
}

// Order of preference: bundled recording, online voice, device voice.
async function speak(cleanText, token) {
    if (voiceEngine !== 'device') {
        const recording = recordingUrls.get(cleanText);
        if (recording) {
            const ok = await playMediaSource(recording, token);
            if (token !== playbackToken) return;
            if (ok) return finishPlayback(token);
        }
        if (navigator.onLine) return playOnlineVoice(splitIntoTtsChunks(cleanText), token);
    }
    playDeviceVoice(cleanText, token);
}

function playAudio(text, triggerBtn) {
    const cleanText = toSpeechText(text);
    if (!cleanText) return;

    stopPlayback();
    const token = playbackToken;

    if (triggerBtn) {
        currentTriggerBtn = triggerBtn;
        triggerBtn.classList.add('speaking-pulse');
    }

    speak(cleanText, token);
}


// --- FULL SCREEN OVERLAYS (chef card and single phrases) ---
let activeOverlay = null;
let focusBeforeOverlay = null;
let wakeLock = null;
const backgroundRegions = document.querySelectorAll('body > header, body > main, body > nav');

// Keep the screen on while staff are reading.
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {}
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
}

function openOverlay(overlay) {
    if (activeOverlay) closeOverlay();
    toggleSettings(false);
    focusBeforeOverlay = document.activeElement;
    activeOverlay = overlay;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    // Keep keyboard and screen reader focus inside the overlay.
    backgroundRegions.forEach(el => { el.inert = true; });
    document.body.style.overflow = 'hidden';
    overlay.querySelector('[data-overlay-close]').focus();
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
    requestWakeLock();
}

function closeOverlay() {
    if (!activeOverlay) return;
    const overlay = activeOverlay;
    activeOverlay = null;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    overlay.querySelector('[data-overlay-content]').classList.remove('rotate-180');
    backgroundRegions.forEach(el => { el.inert = false; });
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    releaseWakeLock();
    stopPlayback();
    if (focusBeforeOverlay && document.contains(focusBeforeOverlay)) focusBeforeOverlay.focus();
}

// Longer phrases get smaller type so they still fit on one screen.
const PHRASE_SIZE_CLASSES = [
    { maxLength: 6, classes: ['text-7xl', 'sm:text-8xl'] },
    { maxLength: 12, classes: ['text-5xl', 'sm:text-7xl'] },
    { maxLength: 20, classes: ['text-4xl', 'sm:text-6xl'] },
    { maxLength: Infinity, classes: ['text-3xl', 'sm:text-5xl'] }
];

// Staff read kanji, so the full screen view leaves out furigana.
function showPhraseFullscreen(item) {
    const jp = document.getElementById('phrase-overlay-jp');
    PHRASE_SIZE_CLASSES.forEach(size => jp.classList.remove(...size.classes));
    jp.classList.add(...PHRASE_SIZE_CLASSES.find(size => item.japanese.length <= size.maxLength).classes);
    jp.textContent = item.japanese;
    document.getElementById('phrase-overlay-romaji').textContent = item.romaji;
    document.getElementById('phrase-overlay-en').textContent = item.english;
    phraseOverlaySpeakerBtn.dataset.text = item.japanese;
    openOverlay(phraseOverlay);
}

function showFullscreenChefCard() {
    openOverlay(gfFullscreenOverlay);
}

// --- NAVIGATION ---
let currentView = 'phrases';

const views = {
    phrases: () => showPhrasesView(),
    coeliac: () => showCoeliacView(),
    flashcards: () => showFlashcardsView(),
    quiz: () => showQuizView()
};

function setView(view) {
    currentView = view;
    navButtons.forEach(btn => {
        if (btn.dataset.nav === view) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
}

function goTo(view) {
    stopPlayback();
    views[view]();
    window.scrollTo({ top: 0 });
}

// --- SHARED PHRASE LIST ---
function renderPhraseRow(phrase) {
    const isStarred = savedPhraseIds.includes(phrase.id);
    const english = escapeHtml(phrase.english);
    return `
        <li class="flex items-center gap-1 pl-4 pr-2 py-3">
            <button type="button" class="flex-1 min-w-0 text-left rounded-lg" data-action="show-phrase" data-id="${phrase.id}">
                <span class="sr-only">Show full screen: </span>
                <span class="block text-[15px] font-medium leading-snug">${english}</span>
                <span lang="ja" class="block font-jp text-[22px] leading-[1.85] mt-1">${rubyHtml(phrase)}</span>
                <span class="block text-sm text-accent">${escapeHtml(phrase.romaji)}</span>
            </button>
            <button type="button" class="icon-btn ${isStarred ? 'text-amber-600 dark:text-amber-400' : 'text-muted'}" data-action="fav" data-id="${phrase.id}" aria-pressed="${isStarred}" aria-label="Save “${english}”">
                ${icon('star', 'w-5 h-5', isStarred)}
            </button>
            <button type="button" class="play-btn" data-action="play" data-text="${escapeHtml(phrase.japanese)}" aria-label="Listen to “${english}”">
                ${icon('speaker')}
            </button>
        </li>
    `;
}

function toggleFavorite(phraseId) {
    const index = savedPhraseIds.indexOf(phraseId);
    if (index > -1) {
        savedPhraseIds.splice(index, 1);
        showToast("Removed from saved");
    } else {
        savedPhraseIds.push(phraseId);
        showToast("Saved");
    }
    store('jf_japan_favorites', savedPhraseIds);
    if (currentView === 'phrases') renderPhraseResults();
    else if (currentView === 'coeliac') renderCoeliacPhrases();
}

// --- PHRASES VIEW ---
function filteredPhrases() {
    const q = normalizeForSearch(searchQuery);
    return phrases.filter(p => {
        if (selectedCategoryFilter === 'saved') {
            if (!savedPhraseIds.includes(p.id)) return false;
        } else if (selectedCategoryFilter !== 'all') {
            if (p.category !== selectedCategoryFilter) return false;
        }
        if (!q) return true;
        return normalizeForSearch(p.english).includes(q) ||
               normalizeForSearch(p.romaji).includes(q) ||
               normalizeForSearch(p.japanese).includes(q);
    });
}

function showPhrasesView() {
    setView('phrases');
    mainContent.innerHTML = `
        <h1 class="sr-only">Phrases</h1>
        <div class="relative">
            <label for="phrase-search-input" class="sr-only">Search phrases</label>
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">${icon('search')}</span>
            <input
                type="search"
                id="phrase-search-input"
                value="${escapeHtml(searchQuery)}"
                placeholder="Search in English, romaji or Japanese"
                autocomplete="off"
                class="w-full rounded-xl border border-line bg-surface pl-11 pr-4 py-3 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
        </div>
        <div id="phrase-results"></div>
    `;

    // Only the results are re-rendered, so the input (and any IME composition in it) survives.
    const searchInput = document.getElementById('phrase-search-input');
    const onSearch = () => {
        searchQuery = searchInput.value;
        renderPhraseResults();
    };
    searchInput.addEventListener('input', (e) => {
        if (!e.isComposing) onSearch();
    });
    searchInput.addEventListener('compositionend', onSearch);

    renderPhraseResults();
}

function renderFilterChips() {
    const chips = [
        { key: 'all', label: 'All' },
        { key: 'saved', label: `Saved${savedPhraseIds.length ? ` · ${savedPhraseIds.length}` : ''}` },
        ...categoryOrder.map(key => ({ key, label: categories[key].short }))
    ];
    return `
        <div class="-mx-4 mt-4 overflow-x-auto no-scrollbar">
            <div class="flex gap-2 w-max px-4" role="group" aria-label="Filter by category">
                ${chips.map(chip => `
                    <button type="button" class="chip" data-action="filter" data-category="${chip.key}" aria-pressed="${selectedCategoryFilter === chip.key}">${escapeHtml(chip.label)}</button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPhraseResults() {
    const results = document.getElementById('phrase-results');
    if (!results) return;
    const matches = filteredPhrases();

    let content = `
        ${renderFilterChips()}
        <p class="mt-4 text-sm text-muted" aria-live="polite">${matches.length} ${matches.length === 1 ? 'phrase' : 'phrases'} · tap one to show it full screen</p>
    `;

    if (matches.length === 0) {
        const saved = selectedCategoryFilter === 'saved' && !searchQuery.trim();
        content += `
            <div class="panel mt-4 px-6 py-12 text-center">
                <p class="font-display text-lg font-bold">${saved ? 'Nothing saved yet' : 'No matching phrases'}</p>
                <p class="mt-1 text-sm text-muted max-w-xs mx-auto">
                    ${saved
                        ? 'Tap the star on any phrase to keep it here for quick access.'
                        : 'Try "bill", "two", "soy sauce", "mizu" or "すみません".'}
                </p>
            </div>
        `;
        results.innerHTML = content;
        return;
    }

    categoryOrder.forEach(catKey => {
        const cat = categories[catKey];
        const catPhrases = matches.filter(p => p.category === catKey);
        if (catPhrases.length === 0) return;

        content += `
            <section class="mt-7">
                <div class="flex items-baseline justify-between gap-3 mb-2 px-1">
                    <h2 class="font-display text-lg font-bold">${escapeHtml(cat.name)}</h2>
                    <span lang="ja" class="font-jp text-xs text-muted whitespace-nowrap">${cat.jp}</span>
                </div>
                ${catKey === 'coeliac' ? `
                    <button type="button" data-action="go" data-view="coeliac" class="w-full mb-2 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-left text-sm font-medium text-accent">
                        <span>Chef card, food guide and label kanji are in the Coeliac tab</span>
                        ${icon('chevron-right', 'w-4 h-4 flex-shrink-0')}
                    </button>
                ` : ''}
                <ul class="panel divide-y divide-line overflow-hidden">${catPhrases.map(renderPhraseRow).join('')}</ul>
            </section>
        `;
    });

    results.innerHTML = content;
}

// --- COELIAC VIEW ---
function showCoeliacView() {
    setView('coeliac');
    mainContent.innerHTML = '';
    mainContent.appendChild(document.getElementById('coeliac-template').content.cloneNode(true));
    hydrateIcons(mainContent);
    renderCoeliacPhrases();
}

function renderCoeliacPhrases() {
    const list = document.getElementById('coeliac-phrases');
    if (list) list.innerHTML = phrases.filter(p => p.category === 'coeliac').map(renderPhraseRow).join('');
}

// --- FLASHCARDS ---
// Single words that repeat a phrase (e.g. こんにちは / こんにちは。) would be duplicate cards.
function flashcardDeck() {
    const stripPunctuation = (text) => text.replace(/[。！？!?\s]/g, '');
    const eligiblePhrases = phrases.filter(p => p.category !== 'coeliac');
    const phraseTexts = new Set(eligiblePhrases.map(p => stripPunctuation(p.japanese)));
    const eligibleWords = words.filter(w => w.category !== 'coeliac' && !phraseTexts.has(stripPunctuation(w.japanese)));
    return [...eligiblePhrases, ...eligibleWords];
}

function showFlashcardsView() {
    setView('flashcards');
    flashcardItems = shuffle(flashcardDeck().filter(item => !masteredIds.has(item.id)));
    currentFlashcardIndex = 0;
    renderFlashcard();
}

function resetFlashcardProgress() {
    masteredIds.clear();
    store('jf_japan_mastered', []);
    showFlashcardsView();
}

function triggerHapticFeedback() {
    if (navigator.vibrate) {
        try {
            navigator.vibrate(18);
        } catch (e) {}
    }
}

function flipFlashcard() {
    const flashcard = document.getElementById('flashcard');
    if (!flashcard) return;
    triggerHapticFeedback();
    flashcard.classList.toggle('is-flipped');
}

function moveFlashcard(step) {
    if (flashcardItems.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex + step + flashcardItems.length) % flashcardItems.length;
    renderFlashcard();
}

function renderFlashcard() {
    if (flashcardItems.length === 0) {
        mainContent.innerHTML = `
            <div class="panel max-w-md mx-auto mt-6 px-6 py-12 text-center">
                <p class="eyebrow">Deck complete</p>
                <p class="font-display text-2xl font-bold mt-2">You've mastered all ${masteredIds.size} cards</p>
                <p class="text-muted mt-2">Sugoi! Reset to practise them again.</p>
                <button type="button" data-action="fc-reset" class="btn-primary mt-6">Reset and shuffle</button>
            </div>
        `;
        return;
    }

    if (currentFlashcardIndex >= flashcardItems.length) {
        currentFlashcardIndex = 0;
    }

    const item = flashcardItems[currentFlashcardIndex];
    const english = escapeHtml(item.english);
    const romaji = escapeHtml(item.romaji);
    const total = flashcardItems.length + masteredIds.size;
    const progress = Math.round((masteredIds.size / total) * 100);

    const modes = [
        { key: 'en_to_jp', label: 'English → 日本語' },
        { key: 'jp_to_en', label: '日本語 → English' },
        { key: 'audio_listen', label: 'Listening' }
    ];

    const backPlayButton = `
        <button type="button" class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-paper/15 text-paper hover:bg-paper/25 transition" data-action="play" data-text="${escapeHtml(item.japanese)}" aria-label="Play pronunciation">
            ${icon('speaker')}
        </button>
    `;

    let frontHTML;
    let backHTML;
    if (flashcardStudyMode === 'en_to_jp') {
        frontHTML = `
            <p class="eyebrow">English</p>
            <h2 class="font-display text-3xl font-bold leading-snug mt-3">${english}</h2>
        `;
        backHTML = `
            <p lang="ja" class="font-jp text-4xl leading-[1.7] font-medium">${rubyHtml(item)}</p>
            <p class="text-paper/75 mt-1">${romaji}</p>
            <div class="mt-4">${backPlayButton}</div>
        `;
    } else if (flashcardStudyMode === 'jp_to_en') {
        frontHTML = `
            <p class="eyebrow">Japanese</p>
            <p lang="ja" class="font-jp text-4xl leading-[1.7] font-medium mt-3">${rubyHtml(item)}</p>
            <p class="text-accent mt-1">${romaji}</p>
        `;
        backHTML = `
            <h2 class="font-display text-3xl font-bold leading-snug">${english}</h2>
            <div class="mt-4">${backPlayButton}</div>
        `;
    } else {
        frontHTML = `
            <p class="eyebrow">Listen</p>
            <button type="button" class="mt-4 inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent text-paper shadow-lg transition hover:scale-105 active:scale-95" data-action="play" data-text="${escapeHtml(item.japanese)}" aria-label="Play the phrase">
                ${icon('speaker', 'w-8 h-8')}
            </button>
            <p class="text-muted mt-4">Listen, then flip to check</p>
        `;
        backHTML = `
            <h2 class="font-display text-2xl font-bold leading-snug">${english}</h2>
            <p lang="ja" class="font-jp text-3xl leading-[1.7] font-medium mt-2">${rubyHtml(item)}</p>
            <p class="text-paper/75">${romaji}</p>
            <div class="mt-3">${backPlayButton}</div>
        `;
    }

    mainContent.innerHTML = `
        <h1 class="sr-only">Flashcards</h1>
        <div class="segmented max-w-md mx-auto" role="group" aria-label="Study mode">
            ${modes.map(mode => `
                <button type="button" data-action="fc-mode" data-mode="${mode.key}" aria-pressed="${flashcardStudyMode === mode.key}">${mode.label}</button>
            `).join('')}
        </div>

        <div class="max-w-xl mx-auto mt-6">
            <div class="flex items-center justify-between text-sm text-muted">
                <span>Card ${currentFlashcardIndex + 1} of ${flashcardItems.length}</span>
                <span>${masteredIds.size} of ${total} mastered</span>
            </div>
            <div class="h-1 rounded-full bg-surface-2 mt-2 overflow-hidden" role="progressbar" aria-label="Cards mastered" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${masteredIds.size}">
                <div class="h-full bg-accent rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
        </div>

        <div class="perspective-1000 h-[22rem] max-w-xl mx-auto mt-5">
            <div id="flashcard" class="card relative w-full h-full cursor-pointer select-none" tabindex="0" role="button" aria-label="Flashcard. Press to flip." data-action="flip">
                <div class="card-face absolute inset-0 panel shadow-sm flex flex-col items-center justify-center p-6 text-center">
                    ${frontHTML}
                </div>
                <div class="card-back card-face absolute inset-0 rounded-2xl bg-ink text-paper shadow-sm flex flex-col items-center justify-center p-6 text-center">
                    ${backHTML}
                    <div class="mt-6 flex items-center gap-2">
                        <button type="button" data-action="fc-again" class="rounded-full border border-paper/30 px-4 py-2 text-sm font-semibold hover:bg-paper/10 transition">Practise again</button>
                        <button type="button" data-action="fc-gotit" class="rounded-full bg-paper text-ink px-4 py-2 text-sm font-semibold hover:opacity-90 transition">Got it</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between max-w-xl mx-auto mt-4">
            <button type="button" data-action="fc-prev" class="icon-btn border border-line bg-surface" aria-label="Previous card">${icon('chevron-left')}</button>
            <p class="text-sm text-muted">Tap the card to flip · swipe to move</p>
            <button type="button" data-action="fc-next" class="icon-btn border border-line bg-surface" aria-label="Next card">${icon('chevron-right')}</button>
        </div>
    `;

    if (flashcardStudyMode === 'audio_listen') {
        setTimeout(() => playAudio(item.japanese, null), 300);
    }
}

function markFlashcard(mastered) {
    const item = flashcardItems[currentFlashcardIndex];
    if (!item) return;
    if (mastered) {
        masteredIds.add(item.id);
        store('jf_japan_mastered', [...masteredIds]);
        flashcardItems.splice(currentFlashcardIndex, 1);
        showToast("Mastered");
        renderFlashcard();
    } else {
        moveFlashcard(1);
    }
}

// --- QUIZ ---
function showQuizView() {
    setView('quiz');
    startQuiz();
}

function startQuiz() {
    quizRound++;
    quizScore = 0;
    currentQuizQuestionIndex = 0;
    quizResults = [];
    quizAnsweredId = null;
    quizQuestions = generateQuizQuestions();
    if (currentView === 'quiz') renderQuizQuestion();
}

function generateQuizQuestions() {
    const eligiblePhrases = phrases.filter(p => p.category !== 'coeliac');

    return shuffle(eligiblePhrases).slice(0, 10).map((correct, index) => {
        const wrong = shuffle(eligiblePhrases.filter(p => p.id !== correct.id && p.japanese !== correct.japanese)).slice(0, 3);
        return {
            phrase: correct,
            isListening: index % 3 === 2,
            options: shuffle([correct, ...wrong])
        };
    });
}

function renderQuizQuestion() {
    if (currentQuizQuestionIndex >= quizQuestions.length) {
        renderQuizResults();
        return;
    }
    const q = quizQuestions[currentQuizQuestionIndex];
    const answered = quizAnsweredId !== null;
    const progress = Math.round((currentQuizQuestionIndex / quizQuestions.length) * 100);

    const prompt = q.isListening ? `
        <p class="eyebrow">Listening</p>
        <button type="button" class="mt-4 inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent text-paper shadow-lg transition hover:scale-105 active:scale-95" data-action="play" data-text="${escapeHtml(q.phrase.japanese)}" aria-label="Play the phrase again">
            ${icon('speaker', 'w-8 h-8')}
        </button>
        <p class="text-muted mt-3">What does it mean?</p>
    ` : `
        <p class="eyebrow">Choose the Japanese for</p>
        <h2 class="font-display text-3xl font-bold leading-snug mt-2">${escapeHtml(q.phrase.english)}</h2>
    `;

    const optionHTML = (option) => {
        const isCorrect = option.id === q.phrase.id;
        const isSelected = option.id === quizAnsweredId;
        let state = 'border-line bg-surface hover:border-accent/60';
        if (answered && isCorrect) state = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40';
        else if (answered && isSelected) state = 'border-red-600 bg-red-50 dark:bg-red-950/40 animate-shake';
        else if (answered) state = 'border-line bg-surface opacity-60';

        // Listening questions answer in English, without per-option audio that would give it away.
        const body = q.isListening
            ? `<span class="font-medium">${escapeHtml(option.english)}</span>`
            : `<span lang="ja" class="block font-jp text-xl leading-[1.8]">${rubyHtml(option)}</span>
               <span class="block text-sm text-accent">${escapeHtml(option.romaji)}</span>`;
        const speaker = q.isListening ? '' : `
            <button type="button" class="px-4 border-l border-line text-accent hover:bg-surface-2 transition-colors" data-action="play" data-text="${escapeHtml(option.japanese)}" aria-label="Listen to ${escapeHtml(option.romaji)}">
                ${icon('speaker')}
            </button>`;

        return `
            <li class="flex items-stretch rounded-xl border-2 ${state} overflow-hidden transition-colors">
                <button type="button" class="flex-1 min-w-0 text-left px-4 py-3" data-action="quiz-answer" data-id="${option.id}" ${answered ? 'disabled' : ''}>${body}</button>
                ${speaker}
            </li>
        `;
    };

    let feedback = '';
    if (answered) {
        const correctLabel = q.isListening ? q.phrase.english : q.phrase.romaji;
        feedback = quizAnsweredId === q.phrase.id
            ? '<span class="text-emerald-700 dark:text-emerald-400">Correct</span>'
            : `<span class="text-red-700 dark:text-red-400">Not quite. It's “${escapeHtml(correctLabel)}”.</span>`;
    }

    mainContent.innerHTML = `
        <h1 class="sr-only">Quiz</h1>
        <div class="max-w-xl mx-auto">
            <div class="flex items-center justify-between text-sm text-muted">
                <span>Question ${currentQuizQuestionIndex + 1} of ${quizQuestions.length}</span>
                <span>Score ${quizScore}</span>
            </div>
            <div class="h-1 rounded-full bg-surface-2 mt-2 overflow-hidden">
                <div class="h-full bg-accent rounded-full transition-all" style="width: ${progress}%"></div>
            </div>

            <div class="mt-8 text-center">${prompt}</div>

            <ul class="mt-8 space-y-3">${q.options.map(optionHTML).join('')}</ul>
            <p class="mt-4 min-h-[1.5rem] text-center font-medium" aria-live="polite">${feedback}</p>
        </div>
    `;

    if (q.isListening && !answered) {
        setTimeout(() => playAudio(q.phrase.japanese, null), 300);
    }
}

function triggerQuizConfetti() {
    if (typeof confetti === 'function') {
        try {
            confetti({
                particleCount: 40,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#b7381f', '#bc002d', '#f0785c', '#e7e0d6', '#1c1917'],
                disableForReducedMotion: true
            });
        } catch (e) {}
    }
}

function handleQuizAnswer(optionId) {
    if (quizAnsweredId !== null) return;
    const q = quizQuestions[currentQuizQuestionIndex];
    const selected = q.options.find(o => o.id === optionId);
    const isCorrect = optionId === q.phrase.id;
    const label = (p) => q.isListening ? p.english : p.romaji;

    quizAnsweredId = optionId;
    quizResults.push({
        question: q.isListening ? q.phrase.japanese : q.phrase.english,
        isListening: q.isListening,
        selectedAnswer: label(selected),
        correctAnswer: label(q.phrase),
        isCorrect
    });
    if (isCorrect) {
        quizScore++;
        triggerQuizConfetti();
    }
    renderQuizQuestion();

    const round = quizRound;
    setTimeout(() => {
        if (round !== quizRound) return;
        quizAnsweredId = null;
        currentQuizQuestionIndex++;
        if (currentView === 'quiz') renderQuizQuestion();
    }, 1400);
}

function renderQuizResults() {
    const scorePercentage = Math.round((quizScore / quizQuestions.length) * 100);
    let feedback = "Good effort. Keep practising and try again.";
    if (scorePercentage === 100) feedback = "Sugoi! A perfect score. You're ready for Japan.";
    else if (scorePercentage >= 80) feedback = "Brilliant. You've got the essentials down.";
    else if (scorePercentage >= 60) feedback = "Nice work. A little flashcard practice and you'll have it.";

    mainContent.innerHTML = `
        <div class="max-w-xl mx-auto text-center">
            <p class="eyebrow">Quiz complete</p>
            <h1 class="font-display text-6xl font-bold mt-3">${scorePercentage}%</h1>
            <p class="text-muted mt-3">${quizScore} of ${quizQuestions.length} correct. ${feedback}</p>
            <button type="button" data-action="quiz-restart" class="btn-primary mt-6">Try again</button>

            <ul class="panel divide-y divide-line mt-10 text-left overflow-hidden">
                ${quizResults.map(result => `
                    <li class="flex gap-3 px-4 py-3">
                        <span class="mt-0.5 ${result.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">
                            ${icon(result.isCorrect ? 'check' : 'x')}
                            <span class="sr-only">${result.isCorrect ? 'Correct' : 'Incorrect'}</span>
                        </span>
                        <div class="min-w-0">
                            <p class="font-medium"${result.isListening ? ' lang="ja"' : ''}>${escapeHtml(result.question)}</p>
                            ${result.isCorrect
                                ? `<p class="text-sm text-muted">${escapeHtml(result.correctAnswer)}</p>`
                                : `<p class="text-sm text-muted"><span class="line-through">${escapeHtml(result.selectedAnswer)}</span> → ${escapeHtml(result.correctAnswer)}</p>`}
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// --- EVENTS ---
// One delegated handler for everything rendered into #main-content.
mainContent.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !mainContent.contains(target)) return;
    const id = parseInt(target.dataset.id, 10);

    switch (target.dataset.action) {
        case 'play':
            e.stopPropagation();
            playAudio(target.dataset.text, target);
            break;
        case 'fav':
            toggleFavorite(id);
            break;
        case 'filter':
            selectedCategoryFilter = target.dataset.category;
            renderPhraseResults();
            break;
        case 'show-phrase':
            showPhraseFullscreen(findItem(id));
            break;
        case 'go':
            goTo(target.dataset.view);
            break;
        case 'open-chef-fullscreen':
            showFullscreenChefCard();
            break;
        case 'speak-chef':
            playAudio(CHEF_CARD_SPEECH, target);
            break;
        case 'flip':
            flipFlashcard();
            break;
        case 'fc-mode':
            flashcardStudyMode = target.dataset.mode;
            renderFlashcard();
            break;
        case 'fc-gotit':
            markFlashcard(true);
            break;
        case 'fc-again':
            markFlashcard(false);
            break;
        case 'fc-prev':
            moveFlashcard(-1);
            break;
        case 'fc-next':
            moveFlashcard(1);
            break;
        case 'fc-reset':
            resetFlashcardProgress();
            break;
        case 'quiz-answer':
            handleQuizAnswer(id);
            break;
        case 'quiz-restart':
            startQuiz();
            break;
    }
});

// Flashcard swipes
let touchStartX = 0;
mainContent.addEventListener('touchstart', (e) => {
    if (e.target.closest('#flashcard')) touchStartX = e.changedTouches[0].screenX;
}, { passive: true });
mainContent.addEventListener('touchend', (e) => {
    if (!e.target.closest('#flashcard')) return;
    const swipeDist = e.changedTouches[0].screenX - touchStartX;
    if (swipeDist > 55) moveFlashcard(-1);
    else if (swipeDist < -55) moveFlashcard(1);
}, { passive: true });

navButtons.forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.nav)));

document.getElementById('header-chef-btn').addEventListener('click', showFullscreenChefCard);
gfFsCardSpeakerBtn.addEventListener('click', () => playAudio(CHEF_CARD_SPEECH, gfFsCardSpeakerBtn));
phraseOverlaySpeakerBtn.addEventListener('click', () => playAudio(phraseOverlaySpeakerBtn.dataset.text, phraseOverlaySpeakerBtn));

settingsBtn.addEventListener('click', () => toggleSettings());
settingsPanel.addEventListener('click', (e) => {
    const option = e.target.closest('[data-setting]');
    if (option) changeSetting(option.dataset.setting, option.dataset.value);
});
document.addEventListener('click', (e) => {
    if (!settingsPanel.classList.contains('hidden') && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
        toggleSettings(false);
    }
});

[gfFullscreenOverlay, phraseOverlay].forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target.closest('[data-overlay-close]')) closeOverlay();
        else if (e.target.closest('[data-overlay-rotate]')) overlay.querySelector('[data-overlay-content]').classList.toggle('rotate-180');
    });
});

// The wake lock is dropped whenever the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeOverlay) requestWakeLock();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (activeOverlay) {
            closeOverlay();
        } else if (!settingsPanel.classList.contains('hidden')) {
            toggleSettings(false);
            settingsBtn.focus();
        }
        return;
    }

    if (currentView !== 'flashcards' || activeOverlay) return;
    // Leave keys alone while a real control has focus.
    const tag = e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flipFlashcard();
    } else if (e.key === 'ArrowRight') {
        moveFlashcard(1);
    } else if (e.key === 'ArrowLeft') {
        moveFlashcard(-1);
    }
});

// --- OFFLINE ---
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

// --- INIT ---
populateVoices();
if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
}
hydrateIcons(document);
applyTheme();
updateSettingsUI();
showPhrasesView();
loadRecordings();
