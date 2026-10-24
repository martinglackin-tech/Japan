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
const navButtons = {
    learn: document.getElementById('nav-learn'),
    flashcards: document.getElementById('nav-flashcards'),
    quiz: document.getElementById('nav-quiz')
};
const quizModal = document.getElementById('quiz-modal');
const seeAnswersBtn = document.getElementById('see-answers-btn');
const answersBreakdown = document.getElementById('answers-breakdown');
const audioToast = document.getElementById('audio-toast');
const toastMessage = document.getElementById('toast-message');
const gfChefModal = document.getElementById('gf-chef-modal');
const gfSafetyModal = document.getElementById('gf-safety-modal');
const gfFullscreenOverlay = document.getElementById('gf-fullscreen-overlay');
const phraseOverlay = document.getElementById('phrase-overlay');
const phraseOverlaySpeakerBtn = document.getElementById('phrase-overlay-speaker-btn');
const speakChefCardBtn = document.getElementById('speak-chef-card-btn');
const gfFsCardSpeakerBtn = document.getElementById('gf-fs-card-speaker-btn');

const speakerIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>`;

const expandIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
    </svg>`;

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

// --- THEME / IZAKAYA MODE ---
function applyTheme() {
    const isDark = currentTheme === 'izakaya';
    document.documentElement.classList.toggle('dark', isDark);
    document.getElementById('izakaya-mode-icon').textContent = isDark ? '☀️' : '🏮';
    document.getElementById('izakaya-mode-label').textContent = isDark ? 'Day Mode' : 'Izakaya Mode';
    document.getElementById('meta-theme-color').setAttribute('content', isDark ? '#141416' : '#ea580c');
}

function toggleTheme() {
    currentTheme = currentTheme === 'izakaya' ? 'day' : 'izakaya';
    store('jf_japan_theme', currentTheme);
    applyTheme();
    showToast(currentTheme === 'izakaya' ? '🏮 Izakaya Low-Light Mode Enabled' : '☀️ Day Mode Enabled');
}

// --- AUDIO SETTINGS ---
function updateSpeedButtonUI() {
    const slow = speechRate <= 0.75;
    document.getElementById('audio-speed-icon').textContent = slow ? '🐢' : '⚡';
    document.getElementById('audio-speed-label').textContent = slow ? '0.75x' : '1.0x';
}

function toggleAudioSpeed() {
    speechRate = speechRate === 1.0 ? 0.75 : 1.0;
    store('jf_japan_speech_rate', String(speechRate));
    updateSpeedButtonUI();
    showToast(`Audio speed: ${speechRate}x ${speechRate < 1 ? '(Slow & Clear)' : '(Normal)'}`);
}

function updateVoiceEngineUI() {
    const device = voiceEngine === 'device';
    document.getElementById('audio-engine-icon').textContent = device ? '📱' : '✨';
    document.getElementById('audio-engine-label').textContent = device ? 'Device' : 'Studio';
}

function toggleVoiceEngine() {
    voiceEngine = voiceEngine === 'studio' ? 'device' : 'studio';
    store('jf_japan_voice_engine', voiceEngine);
    updateVoiceEngineUI();
    showToast(voiceEngine === 'device' ? "Switched to this device's voice" : "Switched to the natural voice");
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
    const jpVoices = cachedVoices.filter(v =>
        (v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('ja')) ||
        (v.name && (v.name.toLowerCase().includes('japan') || v.name.includes('日本語')))
    );

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
        if (voice) utterance.voice = voice;

        utterance.onend = () => finishPlayback(token);
        utterance.onerror = () => finishPlayback(token);

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

// --- MODALS ---
let focusBeforeModal = null;

function showModal(modal) {
    focusBeforeModal = document.activeElement;
    const box = modal.querySelector('.modal-box');
    modal.classList.remove('hidden');
    setTimeout(() => {
        box.classList.remove('scale-95', 'opacity-0');
        box.focus();
    }, 10);
}

function hideModal(modal) {
    if (modal.classList.contains('hidden')) return;
    const box = modal.querySelector('.modal-box');
    box.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
    if (focusBeforeModal && document.contains(focusBeforeModal)) focusBeforeModal.focus();
}

function closeModal(modal) {
    hideModal(modal);
    if (modal === quizModal) {
        answersBreakdown.classList.add('hidden');
        seeAnswersBtn.classList.remove('hidden');
        startQuiz();
    }
}

function isOpen(el) {
    return !el.classList.contains('hidden');
}

// --- FULL SCREEN OVERLAYS (chef card and single phrases) ---
let activeOverlay = null;
let wakeLock = null;

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
    activeOverlay = overlay;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.body.style.overflow = 'hidden';
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
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    releaseWakeLock();
    stopPlayback();
}

// Longer phrases get smaller type so they still fit on one screen.
const PHRASE_SIZE_CLASSES = [
    { maxLength: 6, classes: ['text-7xl', 'sm:text-8xl'] },
    { maxLength: 12, classes: ['text-5xl', 'sm:text-7xl'] },
    { maxLength: 20, classes: ['text-4xl', 'sm:text-6xl'] },
    { maxLength: Infinity, classes: ['text-3xl', 'sm:text-5xl'] }
];

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
    hideModal(gfChefModal);
    openOverlay(gfFullscreenOverlay);
}

// --- NAVIGATION ---
let currentView = 'learn';

function setView(view) {
    currentView = view;
    Object.entries(navButtons).forEach(([key, btn]) => {
        btn.classList.toggle('active', key === view);
        btn.setAttribute('aria-current', key === view ? 'page' : 'false');
    });
}

// --- LEARN VIEW ---
const filterPillBase = 'px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all shadow-sm whitespace-nowrap';
const filterPillIdle = 'bg-white/90 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300';

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

function showLearnView() {
    setView('learn');
    mainContent.innerHTML = `
        <div class="w-full mb-4 relative flex items-center">
            <label for="phrase-search-input" class="sr-only">Search phrases</label>
            <span class="absolute left-4 text-gray-400 text-lg" aria-hidden="true">🔍</span>
            <input
                type="search"
                id="phrase-search-input"
                value="${escapeHtml(searchQuery)}"
                placeholder="Search English, romaji or Japanese…"
                autocomplete="off"
                class="w-full pl-11 pr-4 py-3 rounded-2xl border shadow-sm text-base font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white border-gray-200 text-gray-800 placeholder-gray-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
        </div>
        <div id="learn-results" class="w-full"></div>
    `;

    // Only the results are re-rendered, so the input (and any IME composition in it) survives.
    const searchInput = document.getElementById('phrase-search-input');
    const onSearch = () => {
        searchQuery = searchInput.value;
        renderLearnResults();
    };
    searchInput.addEventListener('input', (e) => {
        if (!e.isComposing) onSearch();
    });
    searchInput.addEventListener('compositionend', onSearch);

    renderLearnResults();
}

function renderFilterPills() {
    const pills = [
        { key: 'all', label: `✨ All (${phrases.length})`, active: 'bg-orange-600 text-white shadow-orange-300' },
        { key: 'saved', label: `⭐ Saved (${savedPhraseIds.length})`, active: 'bg-amber-500 text-white shadow-amber-300' },
        ...categoryOrder.map(key => ({
            key,
            label: `${categories[key].icon} ${categories[key].short}`,
            active: 'bg-orange-600 text-white shadow-orange-300'
        }))
    ];
    return `
        <div class="w-full overflow-x-auto pb-2 mb-6 no-scrollbar">
            <div class="flex items-center space-x-2 w-max min-w-full justify-start md:justify-center px-1">
                ${pills.map(pill => `
                    <button type="button" class="${filterPillBase} ${selectedCategoryFilter === pill.key ? pill.active : filterPillIdle}" data-action="filter" data-category="${pill.key}" aria-pressed="${selectedCategoryFilter === pill.key}">
                        ${escapeHtml(pill.label)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPhraseCard(phrase) {
    const isStarred = savedPhraseIds.includes(phrase.id);
    const english = escapeHtml(phrase.english);
    return `
        <div class="bg-white/95 border-white/80 dark:bg-zinc-900 dark:border-zinc-800 backdrop-blur-sm p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md flex items-center justify-between gap-2 transition-shadow duration-200 border h-full cursor-pointer" data-action="show-phrase" data-id="${phrase.id}">
            <div class="flex-grow min-w-0">
                <div class="flex items-start gap-2">
                    <button type="button" class="fav-star-btn text-lg leading-none ${isStarred ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400 dark:text-zinc-500'}" data-action="fav" data-id="${phrase.id}" aria-pressed="${isStarred}" aria-label="${isStarred ? 'Remove' : 'Save'} “${english}”">
                        ${isStarred ? '★' : '☆'}
                    </button>
                    <p class="font-bold text-base md:text-lg leading-snug text-gray-900 dark:text-zinc-100">${english}</p>
                </div>
                <p class="text-orange-700 dark:text-orange-400 font-medium text-sm md:text-base mt-0.5 pl-7">${escapeHtml(phrase.romaji)}</p>
                <p lang="ja" class="jp-font text-gray-900 dark:text-zinc-100 text-xl md:text-2xl font-bold tracking-wide mt-2 pl-7">${escapeHtml(phrase.japanese)}</p>
            </div>
            <div class="flex flex-col items-center gap-2 flex-shrink-0">
                <button type="button" class="play-audio-btn p-3 rounded-full border shadow-sm bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-orange-400 dark:border-zinc-700" data-action="play" data-text="${escapeHtml(phrase.japanese)}" aria-label="Listen to “${english}”">
                    ${speakerIconSVG}
                </button>
                <button type="button" class="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800" data-action="show-phrase" data-id="${phrase.id}" aria-label="Show “${english}” full screen">
                    ${expandIconSVG}
                </button>
            </div>
        </div>
    `;
}

function renderLearnResults() {
    const results = document.getElementById('learn-results');
    if (!results) return;
    const matches = filteredPhrases();

    let content = `
        <div class="w-full mb-3 flex items-center justify-between px-1">
            <p class="text-xs md:text-sm font-semibold text-gray-600 dark:text-zinc-400">Tap 🔊 to hear • Tap a card to show staff • ⭐ to save</p>
            <span class="text-xs bg-teal-100 text-teal-800 font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">${matches.length} ${matches.length === 1 ? 'Phrase' : 'Phrases'}</span>
        </div>
        ${renderFilterPills()}
    `;

    if (matches.length === 0) {
        const saved = selectedCategoryFilter === 'saved' && !searchQuery.trim();
        content += `
            <div class="text-center py-12 px-4 rounded-3xl bg-white/95 border-white/80 dark:bg-zinc-900 dark:border-zinc-800 border shadow-sm">
                <span class="text-4xl block mb-2" aria-hidden="true">${saved ? '⭐' : '🔎'}</span>
                <h3 class="text-lg font-bold mb-1">${saved ? 'No Saved Phrases Yet' : 'No Matching Phrases'}</h3>
                <p class="text-xs md:text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
                    ${saved
                        ? 'Tap the star icon (☆) on any phrase card to pin your daily essentials right here for instant access!'
                        : 'Try searching for words like "bill", "two", "soy sauce", "mizu", or "すみません".'}
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
            <section class="w-full mb-8">
                <div class="flex items-center justify-between mb-4 px-2 border-b border-teal-200/60 dark:border-zinc-800 pb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl" aria-hidden="true">${cat.icon}</span>
                        <div>
                            <h3 class="font-bold text-lg md:text-xl text-gray-900 dark:text-zinc-100">${escapeHtml(cat.name)}</h3>
                            <p lang="ja" class="text-xs font-semibold text-teal-800/80 dark:text-amber-400 jp-font">${cat.jp}</p>
                        </div>
                    </div>
                    <span class="text-xs bg-white/90 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300 font-semibold px-2.5 py-1 rounded-full shadow-sm">${catPhrases.length}</span>
                </div>
        `;

        if (catKey === "coeliac") {
            content += `
                <div class="mb-4 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" data-action="open-chef" class="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white p-3.5 md:p-4 rounded-2xl shadow-md hover:shadow-xl flex items-center justify-between transition-all duration-200 hover:scale-[1.01] border border-red-300 text-left">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl bg-white/20 p-2 rounded-xl backdrop-blur-sm flex-shrink-0" aria-hidden="true">⚠️</span>
                            <div>
                                <p class="font-extrabold text-sm md:text-base leading-tight">Show Staff (Coeliac Card)</p>
                                <p class="text-[11px] text-red-100 font-medium mt-0.5">Fullscreen Japanese Chef Allergy Notice</p>
                            </div>
                        </div>
                        <span class="text-lg font-bold ml-2" aria-hidden="true">➜</span>
                    </button>
                    <button type="button" data-action="open-guide" class="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-3.5 md:p-4 rounded-2xl shadow-md hover:shadow-xl flex items-center justify-between transition-all duration-200 hover:scale-[1.01] border border-amber-300 text-left">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl bg-white/20 p-2 rounded-xl backdrop-blur-sm flex-shrink-0" aria-hidden="true">🔍</span>
                            <div>
                                <p class="font-extrabold text-sm md:text-base leading-tight">Food Safety Cheat Sheet</p>
                                <p class="text-[11px] text-amber-100 font-medium mt-0.5">Safe vs Danger Foods + Kanji Scanner</p>
                            </div>
                        </div>
                        <span class="text-lg font-bold ml-2" aria-hidden="true">➜</span>
                    </button>
                </div>
            `;
        }

        content += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4 w-full">${catPhrases.map(renderPhraseCard).join('')}</div></section>`;
    });

    results.innerHTML = content;
}

function toggleFavorite(phraseId) {
    const index = savedPhraseIds.indexOf(phraseId);
    if (index > -1) {
        savedPhraseIds.splice(index, 1);
        showToast("Removed from Saved ⭐");
    } else {
        savedPhraseIds.push(phraseId);
        showToast("Saved to Quick-Access ⭐");
    }
    store('jf_japan_favorites', savedPhraseIds);
    renderLearnResults();
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
    const cardFront = 'bg-white border-teal-50 text-gray-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100';

    if (flashcardItems.length === 0) {
        mainContent.innerHTML = `
            <div class="text-center p-8 ${cardFront} border rounded-3xl max-w-md mx-auto shadow-md">
                <span class="text-5xl block mb-3" aria-hidden="true">🎉</span>
                <h3 class="text-xl font-black mb-2 text-emerald-600">Deck Complete!</h3>
                <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">Sugoi! You've mastered all ${masteredIds.size} cards.</p>
                <button type="button" data-action="fc-reset" class="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-full shadow-md transition-all">
                    Reset Progress &amp; Shuffle
                </button>
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
    const japanese = escapeHtml(item.japanese);

    const modes = [
        { key: 'en_to_jp', label: 'EN ➜ JP (Recall)' },
        { key: 'jp_to_en', label: 'JP ➜ EN (Reading)' },
        { key: 'audio_listen', label: '🎧 Audio ➜ Reveal' }
    ];
    const modeSelectorHTML = `
        <div class="w-full mb-4 overflow-x-auto no-scrollbar">
            <div class="flex items-center space-x-1 sm:space-x-2 w-max min-w-full justify-start sm:justify-center px-1">
            ${modes.map(mode => `
                <button type="button" class="text-xs font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${flashcardStudyMode === mode.key ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300'}" data-action="fc-mode" data-mode="${mode.key}" aria-pressed="${flashcardStudyMode === mode.key}">
                    ${mode.label}
                </button>
            `).join('')}
            </div>
        </div>
    `;

    const playButton = (size) => `
        <button type="button" class="play-audio-btn ${size} bg-white text-orange-600 hover:text-orange-700 rounded-full shadow-lg" data-action="play" data-text="${japanese}" aria-label="Pronounce">
            ${speakerIconSVG}
        </button>
    `;
    const frontLabel = (text, margin) => `<span class="text-xs uppercase font-extrabold tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full ${margin}">${text}</span>`;
    const backLabel = (text, margin) => `<span class="text-xs uppercase font-bold tracking-widest text-orange-100 bg-black/25 px-3 py-1 rounded-full ${margin}">${text}</span>`;

    let frontHTML = '';
    let backHTML = '';

    if (flashcardStudyMode === 'en_to_jp') {
        frontHTML = `
            ${frontLabel('English', 'mb-3')}
            <h2 class="text-2xl md:text-3xl font-extrabold leading-snug">${english}</h2>
            <span class="text-xs text-orange-700 dark:text-orange-400 font-bold mt-6 tracking-wide">Tap or press Space to reveal Japanese &rarr;</span>
        `;
        backHTML = `
            ${backLabel('日本語 (Japanese)', 'mb-2')}
            <p class="text-xl md:text-2xl font-bold tracking-wide text-orange-100 mb-2">${romaji}</p>
            <p lang="ja" class="jp-font text-3xl md:text-4xl font-black mb-3 drop-shadow-sm">${japanese}</p>
            ${playButton('p-3')}
        `;
    } else if (flashcardStudyMode === 'jp_to_en') {
        frontHTML = `
            ${frontLabel('日本語 (Read)', 'mb-3')}
            <p lang="ja" class="jp-font text-3xl md:text-4xl font-black mb-2">${japanese}</p>
            <p class="text-base md:text-lg font-bold text-orange-700 dark:text-orange-400">${romaji}</p>
            <span class="text-xs text-orange-700 dark:text-orange-400 font-bold mt-5 tracking-wide">Tap to reveal English meaning &rarr;</span>
        `;
        backHTML = `
            ${backLabel('English Translation', 'mb-3')}
            <h2 class="text-2xl md:text-3xl font-black text-white leading-snug mb-4">${english}</h2>
            ${playButton('p-3')}
        `;
    } else {
        frontHTML = `
            ${frontLabel('Listening Challenge', 'mb-4')}
            <button type="button" class="play-audio-btn p-5 bg-orange-600 text-white hover:bg-orange-700 rounded-full shadow-xl mb-3" data-action="play" data-text="${japanese}" aria-label="Play the phrase">
                ${speakerIconSVG}
            </button>
            <span class="text-xs text-gray-500 dark:text-zinc-400 font-bold mt-3">Listen, test your memory, then tap to reveal</span>
        `;
        backHTML = `
            ${backLabel('Answer', 'mb-2')}
            <h2 class="text-xl md:text-2xl font-black text-white leading-snug mb-1">${english}</h2>
            <p class="text-base text-orange-200 font-bold mb-1">${romaji}</p>
            <p lang="ja" class="jp-font text-2xl md:text-3xl font-black mb-3">${japanese}</p>
            ${playButton('p-2.5')}
        `;
    }

    const navBtn = 'btn-nav font-bold py-2.5 px-5 rounded-full flex items-center space-x-1 text-sm';
    mainContent.innerHTML = `
        ${modeSelectorHTML}
        <div class="text-center mb-2">
            <p class="text-xs text-gray-500 dark:text-zinc-400 font-semibold">Swipe, tap, or press Space to flip card</p>
        </div>
        <div class="perspective-1000 h-80 max-w-xl mx-auto">
            <div id="flashcard" class="card relative w-full h-full mx-auto cursor-pointer select-none" tabindex="0" role="button" aria-label="Flashcard, press to flip" data-action="flip">
                <div class="card-face absolute w-full h-full ${cardFront} rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 text-center border">
                    ${frontHTML}
                </div>
                <div class="card-back card-face absolute w-full h-full bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 text-white rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 text-center">
                    ${backHTML}
                    <div class="mt-4 flex items-center space-x-2 z-10">
                        <button type="button" data-action="fc-again" class="bg-black/30 hover:bg-black/50 text-white text-xs font-bold py-1.5 px-3 rounded-full border border-white/30 transition-all flex items-center space-x-1">
                            <span aria-hidden="true">🔁</span><span>Practice Again</span>
                        </button>
                        <button type="button" data-action="fc-gotit" class="bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-black py-1.5 px-3 rounded-full shadow-md transition-all flex items-center space-x-1">
                            <span aria-hidden="true">✅</span><span>Got It!</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex justify-between items-center max-w-xl mx-auto mt-5 px-2">
            <button type="button" data-action="fc-prev" class="${navBtn}">
                <span aria-hidden="true">&larr;</span><span>Prev</span>
            </button>
            <div class="flex flex-col items-center">
                <span class="font-bold text-gray-700 bg-white/90 border-gray-100 dark:text-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 px-3.5 py-1 rounded-full shadow-sm text-xs sm:text-sm border">
                    ${currentFlashcardIndex + 1} / ${flashcardItems.length}
                </span>
                <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">Mastered: ${masteredIds.size}</span>
            </div>
            <button type="button" data-action="fc-next" class="${navBtn}">
                <span>Next</span><span aria-hidden="true">&rarr;</span>
            </button>
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
        showToast("Card mastered! 🎉");
        renderFlashcard();
    } else {
        showToast("Keep practicing! 🔁");
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
        showQuizResults();
        return;
    }
    const q = quizQuestions[currentQuizQuestionIndex];
    const answered = quizAnsweredId !== null;

    let questionPromptHTML;
    if (q.isListening) {
        questionPromptHTML = `
            <div class="mb-4">
                <span class="inline-block bg-teal-100 text-teal-800 font-extrabold text-[11px] px-3 py-1 rounded-full uppercase tracking-wider mb-2">🎧 Listening Question</span>
                <div class="flex items-center justify-center my-2">
                    <button type="button" class="play-audio-btn p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg flex items-center space-x-2 font-bold" data-action="play" data-text="${escapeHtml(q.phrase.japanese)}">
                        ${speakerIconSVG}
                        <span>Tap to Replay Sound</span>
                    </button>
                </div>
                <p class="text-sm text-gray-500 dark:text-zinc-400 font-semibold mt-1">What does it mean?</p>
            </div>
        `;
    } else {
        questionPromptHTML = `
            <div class="mb-5">
                <p class="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-1">Choose the Japanese for:</p>
                <h2 class="text-2xl md:text-3xl font-extrabold">${escapeHtml(q.phrase.english)}</h2>
            </div>
        `;
    }

    const optionHTML = (option) => {
        const isCorrect = option.id === q.phrase.id;
        const isSelected = option.id === quizAnsweredId;
        let state = 'bg-gray-50 border-gray-200/80 hover:border-orange-400 hover:bg-orange-50/50 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:border-orange-500';
        let textColor = 'text-gray-900 dark:text-zinc-100';
        let subColor = 'text-orange-700 dark:text-orange-400';
        if (answered && isSelected) {
            state = isCorrect
                ? 'bg-emerald-500 border-emerald-600 shadow-lg scale-[1.02]'
                : 'bg-rose-500 border-rose-600 shadow-lg animate-shake';
            textColor = 'text-white';
            subColor = isCorrect ? 'text-emerald-100' : 'text-rose-100';
        } else if (answered && isCorrect) {
            state = 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/50';
            textColor = 'text-emerald-900 dark:text-emerald-200';
            subColor = 'text-emerald-700 dark:text-emerald-300';
        }

        const badge = answered && isSelected ? `
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div class="animate-pop-bounce flex items-center space-x-1.5 ${isCorrect ? 'bg-emerald-600' : 'bg-rose-600'} text-white font-extrabold px-4 py-2 rounded-full shadow-2xl border-2 border-white text-base md:text-lg">
                    <span class="text-xl" aria-hidden="true">${isCorrect ? '🎉' : '👎'}</span>
                    <span>${isCorrect ? 'Correct! ✓' : 'Incorrect'}</span>
                </div>
            </div>` : '';

        // Listening questions answer in English, without per-option audio that would give it away.
        const body = q.isListening
            ? `<span class="font-bold ${textColor} text-base md:text-lg leading-tight">${escapeHtml(option.english)}</span>`
            : `<span lang="ja" class="jp-font font-black ${textColor} text-lg md:text-xl leading-tight">${escapeHtml(option.japanese)}</span>
               <span class="${subColor} font-bold text-xs md:text-sm mt-0.5">${escapeHtml(option.romaji)}</span>`;
        const speaker = q.isListening ? '' : `
            <button type="button" class="play-audio-btn w-10 h-10 rounded-full ${answered && isSelected ? 'bg-white/20 text-white' : 'bg-orange-100/80 hover:bg-orange-200 text-orange-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-orange-400'} flex items-center justify-center flex-shrink-0 shadow-sm ml-2" data-action="play" data-text="${escapeHtml(option.japanese)}" aria-label="Listen to ${escapeHtml(option.romaji)}">
                ${speakerIconSVG}
            </button>`;

        return `
            <div class="relative flex items-center justify-between ${state} border-2 rounded-2xl shadow-sm transition-all duration-200 overflow-hidden p-3 ${answered ? 'pointer-events-none' : 'cursor-pointer'}" data-action="quiz-answer" data-id="${option.id}" role="button" tabindex="${answered ? -1 : 0}">
                <div class="flex flex-col items-start text-left flex-grow pl-2">${body}</div>
                ${speaker}
                ${badge}
            </div>
        `;
    };

    mainContent.innerHTML = `
        <div class="bg-white/95 border-orange-100 text-gray-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-xl text-center flex flex-col justify-center min-h-[22rem] max-w-2xl mx-auto border transition-colors">
            <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">Question ${currentQuizQuestionIndex + 1} of ${quizQuestions.length}</span>
                <span class="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">Score: ${quizScore}</span>
            </div>
            ${questionPromptHTML}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative">
                ${q.options.map(optionHTML).join('')}
            </div>
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
                particleCount: 50,
                spread: 70,
                origin: { y: 0.65 },
                colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'],
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
        question: q.isListening ? `🎧 ${q.phrase.japanese}` : q.phrase.english,
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
    }, 1300);
}

function showQuizResults() {
    const scorePercentage = Math.round((quizScore / quizQuestions.length) * 100);
    document.getElementById('modal-score').textContent = `${scorePercentage}%`;

    let feedback = "Good effort! Keep practicing Josey & Frankie's phrases.";
    if (scorePercentage === 100) feedback = "Sugoi! 🌟 Perfect score! You're ready for Japan!";
    else if (scorePercentage >= 80) feedback = "Brilliant job! You've got the essentials locked down.";
    else if (scorePercentage >= 60) feedback = "Great work! Review your flashcards and try again.";

    document.getElementById('modal-feedback').textContent = feedback;
    showModal(quizModal);
}

function showAnswersBreakdown() {
    answersBreakdown.innerHTML = `<ul class="space-y-2.5">${quizResults.map(result => result.isCorrect ? `
        <li class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-l-4 border-emerald-500">
            <p class="font-bold text-gray-800 dark:text-zinc-100">${escapeHtml(result.question)}</p>
            <p class="text-emerald-700 dark:text-emerald-300 font-semibold">✓ ${escapeHtml(result.selectedAnswer)}</p>
        </li>
    ` : `
        <li class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border-l-4 border-rose-500">
            <p class="font-bold text-gray-800 dark:text-zinc-100">${escapeHtml(result.question)}</p>
            <p class="text-rose-600 dark:text-rose-300 font-semibold line-through">✗ ${escapeHtml(result.selectedAnswer)}</p>
            <p class="text-emerald-700 dark:text-emerald-300 font-semibold">✓ Correct: ${escapeHtml(result.correctAnswer)}</p>
        </li>
    `).join('')}</ul>`;
    answersBreakdown.classList.remove('hidden');
    seeAnswersBtn.classList.add('hidden');
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
            renderLearnResults();
            break;
        case 'show-phrase':
            showPhraseFullscreen(findItem(id));
            break;
        case 'open-chef':
            showModal(gfChefModal);
            break;
        case 'open-guide':
            showModal(gfSafetyModal);
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

document.getElementById('izakaya-mode-btn').addEventListener('click', toggleTheme);
document.getElementById('audio-speed-btn').addEventListener('click', toggleAudioSpeed);
document.getElementById('audio-engine-btn').addEventListener('click', toggleVoiceEngine);
document.getElementById('header-emergency-gf-btn').addEventListener('click', () => showModal(gfChefModal));
document.getElementById('header-gf-safety-guide-btn').addEventListener('click', () => showModal(gfSafetyModal));
document.getElementById('gf-fullscreen-trigger-btn').addEventListener('click', showFullscreenChefCard);
document.getElementById('gf-safety-open-card-btn').addEventListener('click', () => {
    hideModal(gfSafetyModal);
    showModal(gfChefModal);
});
speakChefCardBtn.addEventListener('click', () => playAudio(CHEF_CARD_SPEECH, speakChefCardBtn));
gfFsCardSpeakerBtn.addEventListener('click', () => playAudio(CHEF_CARD_SPEECH, gfFsCardSpeakerBtn));
phraseOverlaySpeakerBtn.addEventListener('click', () => playAudio(phraseOverlaySpeakerBtn.dataset.text, phraseOverlaySpeakerBtn));
seeAnswersBtn.addEventListener('click', showAnswersBreakdown);

navButtons.learn.addEventListener('click', showLearnView);
navButtons.flashcards.addEventListener('click', showFlashcardsView);
navButtons.quiz.addEventListener('click', showQuizView);

[gfChefModal, gfSafetyModal, quizModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-modal-close]')) closeModal(modal);
    });
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
        if (activeOverlay) closeOverlay();
        else {
            const openModal = [gfChefModal, gfSafetyModal, quizModal].find(isOpen);
            if (openModal) closeModal(openModal);
        }
        return;
    }

    // Enter / Space on a focused quiz option (a div acting as a button).
    if (e.target.dataset && e.target.dataset.action === 'quiz-answer' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.target.click();
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
applyTheme();
updateSpeedButtonUI();
updateVoiceEngineUI();
showLearnView();
loadRecordings();
