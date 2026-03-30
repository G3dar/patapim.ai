---
title: "Voice Dictation"
description: "Talk to your terminals with speech-to-text"
order: 3
---

## Overview

Built-in voice dictation powered by **Parakeet V3** via **sherpa-onnx**. Runs entirely on your device — no API key needed, no data leaves your machine.

## Usage

- **Push-to-talk**: Hold `Ctrl+Alt`, speak, release to transcribe
- **Dictation button**: Click the microphone in the lower-right corner

First use triggers a setup wizard for microphone permissions.

## How It Works

1. Audio captured via Web Audio API (webm/opus)
2. Converted to 16kHz mono Float32
3. Processed by Parakeet V3 in a separate Node.js process
4. Transcribed text sent to the active terminal

## Performance

- Model size: ~300 MB (bundled with installer)
- First transcription: few seconds (model loading)
- Subsequent: near-instant
- CPU-only — no GPU required

## Plan Limits

- **Free**: 30 minutes included
- **Pro / Lifetime**: Unlimited

## Privacy

All processing is local. No audio sent to any server. No background listening.
