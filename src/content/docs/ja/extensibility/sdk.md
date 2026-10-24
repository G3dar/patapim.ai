---
title: "TypeScript SDK"
description: "@patapim/sdk — ローカルAPI（HTTP + イベント）の型付きクライアント"
order: 2
---

## 概要

**[`@patapim/sdk`](https://www.npmjs.com/package/@patapim/sdk)** は、PATAPIMの[ローカルAPI](/docs/extensibility/local-api)のための依存ゼロのTypeScriptクライアントです。すべてのエンドポイントとWebSocketイベントストリームを、型付きで扱いやすいクライアントにラップします。

```bash
npm install @patapim/sdk
```

## 使い方

```ts
import { PatapimClient } from '@patapim/sdk';

const patapim = new PatapimClient({ token: process.env.PATAPIM_TOKEN! });

// ターミナル3にプロンプトを送信
await patapim.terminals.write('3', 'Fix the failing tests', true);

// プロジェクトのタスクを読み取り
const { tasks } = await patapim.tasks.list('C:/Users/me/my-project');

// イベントに反応
const events = await patapim.events(['notifications', 'tasks']);
events.on('notifications', (e) => console.log('terminal needs attention:', e.terminalId));
```

## 作れるもの

- **CI / 自動化フック** — 任意のスクリプトからタスク作成、プロンプト起動、ターミナル出力の読み取り。
- **カスタム通知ルーティング** — イベントストリームを購読し、「Claudeが完了／応答待ち」をSlack・Discord・ntfy・スマート電球などへ転送。
- **ダッシュボードとモニター** — ターミナルのライブ状態（処理中／プランモード／要対応）をHTTPで取得。
- **ブラウザ自動化** — PATAPIMの内蔵ブラウザを操作。

## ソース・サンプル・仕様

すべて **[github.com/G3dar/patapim-sdk](https://github.com/G3dar/patapim-sdk)** でオープンソース（MIT）です：

- `packages/sdk` — クライアント本体
- `openapi/openapi.json` — リリースごとにアプリから生成される完全なAPI仕様
- `examples/` — 実行可能なサンプル（CIからタスク投稿、ターミナルへのプロンプト、通知ルーター）
- `docs/` — 認証、スコープ、イベント、バージョニング
