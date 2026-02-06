---
title: "Voice Dictation"
description: "Talk to your terminals with speech-to-text"
order: 3
---

# Voice Dictation

Type commands and text using your voice. PATAPIM converts speech to text and sends it directly to your active terminal.

## How It Works

Voice dictation captures your speech, converts it to text, and inserts it into the active terminal as if you typed it. No special syntax - just speak naturally.

**Example:**
- Say: "git status"
- PATAPIM types: `git status`
- Press Enter to execute

## Two Dictation Modes

PATAPIM offers two speech-to-text engines with different trade-offs:

### 1. Whisper API (Primary)

**OpenAI's Whisper model** - High accuracy, multi-language support.

**Requirements:**
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- Internet connection

**Cost:**
- $0.006 per minute of audio
- ~$0.36 per hour of dictation
- Billed through your OpenAI account

**Accuracy:**
- Excellent recognition for technical terms
- Understands code-related vocabulary
- Punctuation and capitalization

**Setup:**
1. Get an OpenAI API key
2. Open PATAPIM Settings → Voice Dictation
3. Paste your API key
4. Click "Save"

### 2. Web Speech API (Fallback)

**Browser built-in** - Free, no setup required.

**Requirements:**
- Modern web browser (Chrome, Edge, Safari)
- No API key needed

**Cost:**
- Completely free

**Accuracy:**
- Good for general speech
- May struggle with technical terms
- Language support varies by browser

**Setup:**
- Works automatically if Whisper is not configured
- No configuration needed

## Using Voice Dictation

### One-Time Dictation

Perfect for typing a single command or sentence.

1. Click the microphone button in the toolbar
2. Speak your command
3. PATAPIM types it into the active terminal
4. Microphone stops automatically when you finish

### Persistent Dictation Mode

Keep the microphone active for continuous dictation.

1. Click the microphone button
2. Toggle "Persistent Mode" in the dropdown
3. Speak multiple commands without clicking again
4. Click the microphone button to stop

**Use cases:**
- Writing commit messages
- Editing configuration files
- Writing documentation
- Hands-free coding sessions

## Tips for Best Results

### Speaking Commands

**Good:**
- "git commit dash m quote fix typo quote"
- "npm run build"
- "cd projects slash my app"

**Better:**
- Use natural pauses between words
- Speak punctuation when needed ("dash" for -, "slash" for /)
- Say "quote" for quotation marks

### Whisper vs Web Speech

**Use Whisper when:**
- You need high accuracy
- You're dictating code or technical terms
- You're okay with small usage costs

**Use Web Speech when:**
- You want free dictation
- You're only speaking simple commands
- You don't want to manage an API key

## Privacy & Security

### Whisper API
- Audio is sent to OpenAI's servers for processing
- OpenAI retains audio for 30 days (abuse monitoring)
- See [OpenAI Privacy Policy](https://openai.com/privacy)

### Web Speech API
- Processing depends on browser:
  - Chrome/Edge: Audio may be sent to Google servers
  - Safari: Processing may be local on newer devices
- Check your browser's privacy settings

**Recommendation:**
- Avoid dictating sensitive information (passwords, API keys)
- Review what you've dictated before pressing Enter

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Start/stop dictation |
| `Ctrl+Shift+M` | Toggle persistent mode |

## Troubleshooting

**Microphone not working:**
- Check browser permissions (Settings → Privacy → Microphone)
- Verify your microphone is connected and working
- Refresh PATAPIM if permissions were just granted

**Whisper API errors:**
- Verify API key is correct and active
- Check OpenAI account has available credits
- Ensure you have internet connection

**Poor accuracy:**
- Speak clearly and at a moderate pace
- Use Whisper API for technical terms
- Reduce background noise
- Try switching to a better microphone

**Persistent mode not stopping:**
- Click the microphone button again
- Refresh PATAPIM if it's stuck
