---
title: "システム要件"
description: "PATAPIMを実行するためのシステム要件"
order: 3
---

## オペレーティングシステム

| プラットフォーム | 最小バージョン |
|----------------|--------------|
| Windows | Windows 10（64ビット） |
| macOS | macOS 12 Monterey（Intel & Apple Silicon） |

Linuxはプリビルトインストーラーでの公式サポートはありませんが、ソースからビルドできます。

## ハードウェア

| 要件 | 最小 | 推奨 |
|-----|------|------|
| RAM | 2 GB | 4 GB以上 |
| ディスク容量 | 約500 MB | 1 GB以上 |
| CPU | 任意の64ビット | マルチコア |

ディスク容量にはバンドルされたParakeet V3音声モデル（約300 MB）が含まれます。複数のターミナルは各約50-100 MBを使用します。

## ソフトウェア依存関係

| ソフトウェア | バージョン | 用途 |
|------------|----------|------|
| Node.js | 18以上 | ソースからのインストールおよびAI CLIに必要 |
| Git | 最新版 | ソースからのインストールおよび自動更新に必要 |

プリビルトインストーラー（Windows .exe、macOS DMG）はすべてのランタイム依存関係をバンドルしています。

## AI CLI（少なくとも1つ）

AI機能を使用するには、少なくとも1つのAI CLIが必要です：

- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Codex**: `npm install -g @openai/codex`
- **Gemini CLI**: `npm install -g @anthropic-ai/gemini-cli`

npmが利用可能な場合、PATAPIMは初回使用時にこれらを自動インストールできます。

## ネットワーク

- **HTTPS** — AI APIコールとライセンス認証に必要
- **WebSocket** — リモートアクセスに使用（オプション、ポート31415）
- **Cloudflare Tunnel** — パブリックリモートアクセスに使用（Pro機能、オプション）
