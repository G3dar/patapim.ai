---
title: "設定"
description: "PATAPIMの設定ファイルと環境変数"
order: 2
---

## グローバル設定ディレクトリ

`~/.patapim/`にすべてのPATAPIM設定が保存されます：

| ファイル | 目的 |
|---------|------|
| `workspaces.json` | プロジェクトリスト、アクティブワークスペース |
| `sessions.json` | プロジェクトごとのターミナルセッションと状態 |
| `account.json` | 認証トークン、メール、ライセンスティア |
| `passkeys.json` | WebAuthn/PassKey認証情報 |
| `trusted-passkeys.json` | 信頼済みPassKeyホワイトリスト |
| `downloads/` | ブラウザダウンロードディレクトリ |
| `mcp-token` | MCPサーバー認証トークン |

## 環境変数

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| `PATAPIM_INSTANCE=dev` | 開発インスタンスとして実行（CDPポート9223を使用） | 未設定 |
| `PATAPIM_DEBUG=1` | 起動時にDevToolsを開く | 未設定 |
| `PATAPIM_PORT` | リモートアクセスサーバーポートを上書き | `31415` |
| `PATAPIM_MCP_TOKEN` | MCPサーバー認証トークン | 自動生成 |
| `PATAPIM_TERMINAL_ID` | MCP用ターミナルID | 自動設定 |

## マルチインスタンス（開発モード）

2つのPATAPIMインスタンスを同時実行可能：

| 項目 | 安定版 | 開発版 |
|-----|-------|-------|
| CDPポート | 9222 | 9223 |
| userData | `PATAPIM/` | `PATAPIM-dev/` |
| ウィンドウタイトル | `PATAPIM` | `PATAPIM [DEV]` |

`PATAPIM_INSTANCE=dev npm start`で開発インスタンスを起動します。
