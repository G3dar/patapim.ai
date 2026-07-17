---
title: "プラグイン開発"
description: "PATAPIMプラグインを作る：MCPツール、コマンド、パネル、ツールバーボタン、スケジュールタスク、コンテキストブロック"
order: 3
---

## 概要

PATAPIMプラグインは `~/.patapim/plugins/<name>/` に置くフォルダで、アプリから**隔離**して実行され、承認した権限だけを持つスコープ付きトークンで動きます。目玉となる機能は、**PATAPIM内で動くすべてのClaude Code / Codexセッションに、プラグインがMCPツールを登録できる**こと — 自動的に、セッションごとの設定は不要です。

> これはClaude Code独自のプラグイン（`~/.claude/plugins/`）とは別物です。違いは[プラグインシステム](/docs/features/plugin-system)の概要を参照してください。

## 構成

```
~/.patapim/plugins/my-plugin/
  plugin.json      # マニフェスト
  index.js         # エントリモジュール（CommonJS）
```

`plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "何をするか",
  "main": "index.js",
  "permissions": ["terminals:read", "notifications"],
  "contributes": {
    "instructionBlocks": [{ "text": "This project uses pnpm, not npm." }],
    "commands": [{ "id": "sync", "title": "Sync now" }],
    "scheduledTasks": [{ "command": "sync", "cron": "*/30 * * * *" }]
  }
}
```

- `permissions` は[ローカルAPIのスコープ](/docs/extensibility/local-api)そのものです — プラグインのトークンが持つ権限そのもの。ユーザーがプラグインを有効化する際に、ブラウザ拡張のように承認します。

## エントリモジュール

```js
module.exports.activate = async (patapim) => {
  // すべてのAI CLIセッションで `plugin_my-plugin_summarize` になる
  patapim.registerMcpTool({
    name: 'summarize',
    description: 'Summarize the state of all open terminals',
    inputSchema: { type: 'object', properties: {} },
  }, async () => {
    const { terminals } = await patapim.get('/terminals');
    return terminals.map(t => ({ id: t.terminalId, busy: t.isProcessing }));
  });

  patapim.registerCommand('sync', async () => { /* ... */ return 'synced'; });
};

module.exports.deactivate = async () => { /* 任意のクリーンアップ */ };
```

## コントリビューションポイント

| コントリビューション | 内容 |
|--------------|--------------|
| **MCPツール** | `registerMcpTool` — Claude Code / Codexに `plugin_<name>_<tool>` として表示 |
| **コマンド** | プラグインのカードに表示され、ハンドラを呼び出すボタン |
| **ツールバーボタン** | ターミナルツールバー上のボタン（コマンドに紐づく） |
| **パネル** | ローカルAPIと通信するサンドボックス化されたUIウィンドウ（`panel.html`） |
| **コンテキストブロック** | 有効化中、AIメモリファイルに注入される常設コンテキスト |
| **スケジュールタスク** | プラグイン稼働中、cronスケジュールでコマンドを実行 |

## セキュリティモデル

有効化された各プラグインは独立したプロセスで実行され、**Electron・レンダラー・アプリ内部へのアクセスは一切ありません** — 唯一の権限は、承認された権限にスコープされたトークンでのローカルAPIアクセスだけです。すべては `~/.patapim` 配下にあるため、アプリ更新後も残ります。

## 完全ガイド

完全なリファレンス — `patapim` ホストAPI、パネル、正確なランタイム契約、動作する `hello-world` サンプル — はSDKリポジトリにあります：**[docs/plugins.md](https://github.com/G3dar/patapim-sdk/blob/main/docs/plugins.md)**。
