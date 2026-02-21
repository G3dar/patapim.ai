# Remote Voice Dictation Design

**Date:** 2026-02-21
**Feature:** Microphone recording with transcription in remote.astro
**Status:** Approved

## Summary

Add a microphone button to the mobile remote interface (`remote.astro`) that lets users record their voice, preview the transcribed text, and send it to the active terminal via the existing WebSocket connection.

## Approach

**Web Speech API (browser-side)** — 100% client-side, no server changes, no API keys, free.

Rejected alternatives:
- OpenAI Whisper via proxy: requires `OPENAI_API_KEY` in Cloudflare env, adds latency and cost
- Forward audio to desktop device: requires changes to the desktop app (separate repo)

## User Flow

```
[Tap 🎤 in keys-bar]
  → button turns red + pulsing
  → SpeechRecognition.start()
  → interim results shown in preview panel (real-time)
[Speech ends / tap 🎤 again]
  → SpeechRecognition.stop()
  → preview panel locks with final text
[Tap ✓ Send]
  → ws.send({ type: 'input', data: text })   // no \r, user decides Enter
[Tap ✗ Cancel]
  → discard, close preview
```

## Components

### 1. Mic button (`keys-bar`)

- Added before the "Select" button in the existing keys-bar
- Icon: 🎤 with `key-btn` base styles
- Active state: red color + pulse animation (reuses `state-busy` pattern)

### 2. Preview panel

- Positioned above the keys-bar (absolute, bottom of terminal-wrap)
- Background: `var(--bg-elevated)`, border: `var(--border)`, border-radius: `var(--radius)`
- Contains:
  - `<textarea>` showing recognized text (editable before sending)
  - **Send** button (green, `var(--success)` style)
  - **Cancel** button (neutral)
- Updates in real time while speech is recognized (`interimResults: true`)

## Web Speech API Config

```js
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = navigator.language || 'es-ES';
recognition.interimResults = true;
recognition.continuous = false;   // auto-stops on silence
recognition.maxAlternatives = 1;
```

## Error Handling

| Scenario | Response |
|---|---|
| API not supported | Toast: "Tu navegador no soporta dictado por voz" |
| Mic permission denied | Toast: "Permiso de micrófono denegado" |
| No speech detected | Toast: "No se detectó audio" |
| WebSocket disconnected | Toast: "No conectado" |

## Sending to Terminal

```js
ws.send(JSON.stringify({
  type: 'input',
  terminalId: currentTerminalId,
  data: recognizedText   // no \r — user presses Enter manually
}));
```

## Scope

- Changes only in `src/pages/remote.astro`
- No new API routes, no env changes, no desktop app changes
- Works on: iOS Safari 14.5+, Android Chrome, Desktop Chrome/Edge
- Does not work on: Firefox (no Web Speech API support)
