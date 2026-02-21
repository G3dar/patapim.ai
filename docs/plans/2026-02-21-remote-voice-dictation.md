# Remote Voice Dictation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a microphone button to the mobile remote interface that lets users dictate text via Web Speech API and send it to the active terminal.

**Architecture:** Everything lives in `src/pages/remote.astro`. Web Speech API runs client-side in the phone browser — no server changes, no API keys. Transcribed text is sent to the terminal via the existing WebSocket connection using the `input` message type.

**Tech Stack:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), existing WebSocket protocol, Astro inline `<script>`.

---

### Task 1: Add mic button CSS + recording animation

**Files:**
- Modify: `src/pages/remote.astro` — CSS block (inside `<style is:inline>`)

Find the existing `.key-btn.active` rule (around line 606) and add immediately after it:

```css
.key-btn.recording {
  color: var(--error);
  border-color: var(--error);
  background: rgba(212, 120, 120, 0.12);
  animation: mic-pulse 1.2s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

Also add styles for the preview panel (add anywhere in the CSS block, e.g. after `.fab-toast`):

```css
/* Voice dictation preview */
.voice-preview {
  display: none;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.voice-preview.visible {
  display: flex;
}

.voice-text {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  padding: 8px;
  border-radius: var(--radius);
  resize: none;
  line-height: 1.4;
}

.voice-text:focus {
  outline: none;
  border-color: var(--accent);
}

.voice-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.voice-btn {
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.15s;
}

.voice-cancel {
  background: none;
  border-color: var(--border);
  color: var(--text-dim);
}

.voice-cancel:hover {
  border-color: var(--text-dim);
  color: var(--text);
}

.voice-send {
  background: rgba(124, 179, 130, 0.12);
  border-color: rgba(124, 179, 130, 0.4);
  color: var(--success);
}

.voice-send:hover {
  background: rgba(124, 179, 130, 0.2);
  border-color: var(--success);
}
```

**Verify:** No broken styles. The file still has valid CSS (no unclosed braces).

**Commit:**
```bash
git add src/pages/remote.astro
git commit -m "feat: add voice dictation CSS — mic button recording state + preview panel"
```

---

### Task 2: Add HTML — mic button and preview panel

**Files:**
- Modify: `src/pages/remote.astro` — HTML body

**Step 1: Add mic button to keys-bar**

Find the keys-bar section (look for `id="key-select"`). Add the mic button immediately before the Select button:

```html
<button class="key-btn" id="key-mic">🎤</button>
<button class="key-btn" id="key-select" style="margin-left:auto; ...">Select</button>
```

The full line to find:
```html
          <button class="key-btn" id="key-select" style="margin-left:auto; border-color:var(--accent); color:var(--accent);">Select</button>
```

Replace with:
```html
          <button class="key-btn" id="key-mic" title="Dictado por voz">🎤</button>
          <button class="key-btn" id="key-select" style="margin-left:auto; border-color:var(--accent); color:var(--accent);">Select</button>
```

**Step 2: Add preview panel**

Find the `.keys-bar` div (look for `class="keys-bar" id="keys-bar"`). Add the voice preview panel BEFORE it (so it appears above the keys-bar):

```html
        <!-- Voice dictation preview -->
        <div class="voice-preview" id="voice-preview">
          <textarea class="voice-text" id="voice-text" rows="3" placeholder="Habla ahora..."></textarea>
          <div class="voice-actions">
            <button class="voice-btn voice-cancel" id="voice-cancel">✕ Cancelar</button>
            <button class="voice-btn voice-send" id="voice-send">↵ Enviar</button>
          </div>
        </div>
        <div class="keys-bar" id="keys-bar">
```

**Verify:** Open the page in a browser. The 🎤 button should appear in the keys-bar. The preview panel should be invisible (display:none). Inspect element to confirm both exist in the DOM.

**Commit:**
```bash
git add src/pages/remote.astro
git commit -m "feat: add mic button to keys-bar and voice preview panel HTML"
```

---

### Task 3: Wire up DOM references and state variables

**Files:**
- Modify: `src/pages/remote.astro` — JS block (inside `<script is:inline type="module">`)

**Step 1: Add DOM refs**

Find the block of DOM element selections near the top of the script (look for `const keyShiftTab = document.getElementById('key-shift-tab');`). Add after it:

```js
    const keyMic = document.getElementById('key-mic');
    const voicePreview = document.getElementById('voice-preview');
    const voiceText = document.getElementById('voice-text');
    const voiceSend = document.getElementById('voice-send');
    const voiceCancel = document.getElementById('voice-cancel');
```

**Step 2: Add state variables**

Find the state variables block (look for `let selectMode = false;`). Add after it:

```js
    let recognition = null;
    let isRecording = false;
    let voiceFinalText = '';
```

**Verify:** No JS errors in the browser console on load.

**Commit:**
```bash
git add src/pages/remote.astro
git commit -m "feat: add voice dictation DOM refs and state variables"
```

---

### Task 4: Implement Web Speech API logic

**Files:**
- Modify: `src/pages/remote.astro` — JS block

Find the section after `// ── Text selection mode` (or any logical grouping area near the end of the script). Add a new section:

```js
    // ── Voice dictation (Web Speech API) ─────────────────────────

    function initSpeechRecognition() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return null;

      const r = new SR();
      r.lang = navigator.language || 'es-ES';
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;

      r.onresult = (e) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        voiceFinalText = final || interim;
        voiceText.value = voiceFinalText;
      };

      r.onend = () => {
        stopRecording();
        if (voiceFinalText.trim()) {
          showVoicePreview();
        } else {
          showToast('No se detectó audio');
        }
      };

      r.onerror = (e) => {
        stopRecording();
        if (e.error === 'not-allowed') showToast('Permiso de micrófono denegado');
        else if (e.error === 'no-speech') showToast('No se detectó audio');
        else showToast('Error de voz: ' + e.error);
      };

      return r;
    }

    function startRecording() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showToast('Tu navegador no soporta dictado por voz');
        return;
      }
      voiceFinalText = '';
      voiceText.value = '';
      recognition = initSpeechRecognition();
      if (!recognition) return;
      try {
        recognition.start();
        isRecording = true;
        keyMic.classList.add('recording');
      } catch (e) {
        showToast('Error al iniciar el micrófono');
      }
    }

    function stopRecording() {
      isRecording = false;
      keyMic.classList.remove('recording');
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
        recognition = null;
      }
    }

    function showVoicePreview() {
      voicePreview.classList.add('visible');
      voiceText.focus();
    }

    function hideVoicePreview() {
      voicePreview.classList.remove('visible');
      voiceFinalText = '';
      voiceText.value = '';
    }

    // Mic button: toggle recording
    keyMic.addEventListener('click', () => {
      if (!isAuthenticated) return;
      if (isRecording) {
        // Tapping again stops — onend fires → showVoicePreview if text exists
        if (recognition) recognition.stop();
      } else {
        startRecording();
      }
    });

    // Send: write transcribed text to terminal
    voiceSend.addEventListener('click', () => {
      const text = voiceText.value.trim();
      if (text && ws && ws.readyState === WebSocket.OPEN && currentTerminalId) {
        ws.send(JSON.stringify({ type: 'input', terminalId: currentTerminalId, data: text }));
      }
      hideVoicePreview();
      term.focus();
      syncTerminalFocus();
    });

    // Cancel: discard
    voiceCancel.addEventListener('click', () => {
      if (isRecording) stopRecording();
      hideVoicePreview();
    });
```

**Note:** `showToast()` is already defined in the file — this reuses it.

**Verify (manual test):**
1. Open remote on mobile Chrome or desktop Chrome (Web Speech API required)
2. Tap 🎤 — browser should ask for mic permission
3. Speak something (e.g. "git status")
4. Button turns red and pulses while recording
5. When you stop speaking, preview panel appears with the transcribed text
6. Tap ✓ Enviar — text appears in the terminal
7. Tap 🎤 mid-recording → stops and shows preview
8. Tap ✕ Cancelar → panel closes, nothing sent

**Verify edge cases:**
- Deny mic permission → toast "Permiso de micrófono denegado"
- Say nothing → toast "No se detectó audio"
- On Firefox → toast "Tu navegador no soporta dictado por voz"

**Commit:**
```bash
git add src/pages/remote.astro
git commit -m "feat: implement Web Speech API voice dictation with push-to-talk and preview"
```

---

### Task 5: Clean up and hide mic on desktop

The keys-bar is already hidden on desktop (`display: none` at > 768px). No extra work needed — the mic button lives inside it and hides automatically.

However, double-check: the voice preview panel also needs to be hidden on desktop. Find the `@media (max-width: 768px)` rule and verify `.voice-preview` inherits correctly.

Since `.voice-preview` starts as `display: none` and only shows via `.visible`, and it sits inside `.main-area` (which is always visible), add a guard to the media query to be safe:

```css
@media (min-width: 769px) {
  .voice-preview { display: none !important; }
}
```

Add this after the existing `@media (max-width: 768px)` block.

**Verify:** On desktop browser, resize to > 768px — mic button and preview panel should not be visible.

**Commit:**
```bash
git add src/pages/remote.astro
git commit -m "fix: hide voice preview panel on desktop viewport"
```

---

## Done

The feature is complete. Summary of what was added:
- 🎤 button in keys-bar (mobile only) with red pulse animation while recording
- Push-to-talk via Web Speech API — one tap to start, auto-stops on silence (or tap again)
- Editable preview textarea so user can fix recognition errors before sending
- Text sent to terminal via existing WebSocket `input` message (no `\r` — user presses Enter)
- Toast messages for all error states (no support, denied, no speech)
