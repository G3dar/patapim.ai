---
title: "インストール"
description: "PATAPIMのインストール方法"
order: 1
---

## ワンラインインストール

最も簡単な方法です。ターミナルを開いてコマンドを1つ実行するだけです。

### Windows（PowerShell）

```powershell
irm https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.ps1 | iex
```

### Windows（CMD）

```cmd
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.cmd -o "%TEMP%\patapim-install.cmd" && "%TEMP%\patapim-install.cmd"
```

### macOS（ターミナル）

```bash
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install-mac.sh | bash
```

## インストーラーをダウンロード

[patapim.ai/download](https://patapim.ai/download)から直接ダウンロード：

- **Windows**: NSISインストーラー（.exe）— Windows 10以降
- **macOS**: DMG — macOS 12+（Apple SiliconとIntel用の別ビルド）

macOSでは初回起動時に右クリックして「開く」を選択する必要がある場合があります。

## ソースからインストール

```bash
git clone https://github.com/G3dar/patapim.git
cd patapim
npm install
npm start
```

Node.js 18+とGitが必要です。macOSではXcodeコマンドラインツール（`xcode-select --install`）も必要な場合があります。

## インストール確認

インストール後、PATAPIMを起動してください。左にサイドバー、中央にターミナルエリア、右にトグル可能なパネルがある3パネルインターフェースが表示されます。

## 前提条件

PATAPIMのAI機能を使用する前に、少なくとも1つのAI CLIをインストールしてください：

- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Codex**: `npm install -g @openai/codex`
- **Gemini CLI**: `npm install -g @anthropic-ai/gemini-cli`

PATAPIMはインストール済みのAI CLIを自動検出し、初回使用時に自動インストールすることもできます。
