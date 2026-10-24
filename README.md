# Josey & Frankie's Japanese Phrasebook

A small offline-capable web app: phrases with audio, a coeliac chef card to show restaurant staff, flashcards and a quiz.

## Files

| File | What it is |
|---|---|
| `index.html` | Page markup, including the chef card and food safety guide |
| `data.js` | Phrases, words, categories and the chef card's spoken text |
| `app.js` | App logic |
| `src/input.css` → `styles.css` | Tailwind source and the built stylesheet (commit both) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and "Add to Home Screen" |
| `audio/` | Pre-generated recordings and `index.json` (optional, see below) |
| `vendor/` | Third-party scripts served locally so they work offline |

Everything the app needs is committed, so the repository can be served as-is (e.g. GitHub Pages). It must be served over http(s) for offline mode to work; opening `index.html` from disk works but won't install the service worker.

## Editing

```sh
npm install
npm run build        # rebuild styles.css (needed after changing Tailwind classes) and vendor/
python3 -m http.server 8000   # then open http://localhost:8000
```

If you change the list of core files in `sw.js`, bump `CORE_CACHE` there.

## Audio

The app picks the first voice available:

1. **Recordings** in `audio/`, which play offline and sound the same on every phone.
2. **Online voice** (Google Translate's unofficial endpoint) when there's no recording and the phone is online.
3. **The phone's built-in Japanese voice** otherwise, or always when the toolbar is set to "Device".

To create or refresh the recordings, make a Google Cloud API key with the Text-to-Speech API enabled, then run:

```sh
GOOGLE_TTS_API_KEY=your-key npm run build:audio
```

It only synthesises text that doesn't have a recording yet, and removes recordings for text that no longer exists. Set `TTS_VOICE` to try another voice (default `ja-JP-Neural2-B`). Commit the `audio/` folder afterwards.
