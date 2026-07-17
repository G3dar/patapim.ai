---
title: "ローカルAPI"
description: "ローカルのHTTP + WebSocket APIから、自分のスクリプトでPATAPIMを操作・自動化する"
order: 1
---

## 概要

PATAPIMは `http://127.0.0.1:31415` でローカルの**HTTP + WebSocket API**を提供します（内蔵のMCPサーバーが使うのと同じAPIです）。マシン上のあらゆるスクリプトやツールから、ターミナルの作成、AI CLIへのプロンプト送信、出力の読み取り、タスク管理、通知送信、内蔵ブラウザの操作ができます。

APIは**デフォルトで無効**です。**設定 → ローカルAPI**から有効化し、トークンを作成してください。

## トークンとスコープ

すべてのリクエストにはスコープ付きトークン（`ppat_…`）が必要です。**設定 → ローカルAPI → トークン作成**で発行します。トークンは一度だけ表示されるので、パスワードのように保管してください。`x-patapim-token` ヘッダー（または `Authorization: Bearer`）で渡します。

各トークンは作成時にチェックしたスコープのみを持ちます：

| スコープ | 権限 |
|-------|--------|
| `terminals:read` | ターミナルの一覧、バッファと状態の読み取り |
| `terminals:write` | ターミナルの作成、入力送信、リサイズ、クローズ |
| `tasks` | プロジェクトタスクとスケジュールコマンドの読み書き |
| `notifications` | 設定済みチャンネルへの通知送信 |
| `browser` | 内蔵ブラウザの操作（ナビゲート、クリック、入力、スクショ） |
| `files:read` | プロジェクトディレクトリのファイル読み取り |
| `files:write` | プロジェクトディレクトリへのファイル書き込み |
| `events` | WebSocketイベントストリームの購読 |

## クイックスタート

```bash
# このトークンで何ができる？
curl http://127.0.0.1:31415/api/v1/meta -H "x-patapim-token: ppat_..."

# ターミナル一覧（スコープ: terminals:read）
curl http://127.0.0.1:31415/api/v1/terminals -H "x-patapim-token: ppat_..."

# ターミナル3にプロンプトを送信（スコープ: terminals:write）
curl -X POST http://127.0.0.1:31415/api/v1/terminals/3/write \
  -H "x-patapim-token: ppat_..." -H "Content-Type: application/json" \
  -d '{"data": "Summarize the failing tests", "pressEnter": true}'
```

## イベントストリーム

`ws://127.0.0.1:31415?token=ppat_...` にWebSocketで接続し（トークンに `events` スコープが必要）、トピックを購読します — `terminals`、`terminal-output:<id>`、`tasks`、`notifications`。`notifications` トピックはPATAPIM自身がベル/トーストを出すのと同じタイミングで発火するため、「Claudeが応答待ち」をSlackやDiscordなどへ転送するのに最適です。

## バージョニングと安全性

- すべては **`/api/v1`** 配下にあり、**追加のみ**です：ルート・パラメータ・レスポンスフィールドが削除・改名されることはありません。
- プラン制限（無料枠のターミナル上限など）はリクエストの発生元に関わらず適用されます — APIがそれを回避することはありません。
- 機械可読な完全仕様はOpenAPIドキュメントとして[SDKリポジトリ](https://github.com/G3dar/patapim-sdk)で公開されています。

次は、これらすべてを型付きクライアントでラップする[TypeScript SDK](/docs/extensibility/sdk)です。
