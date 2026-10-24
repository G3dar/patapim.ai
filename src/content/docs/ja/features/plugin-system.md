---
title: "プラグインシステム"
description: "プラグインでPATAPIMを拡張"
order: 7
---

## 概要

PATAPIMは**2種類**のプラグインに対応しています：

1. **Claude Codeプラグイン** — Claude Code独自のプラグイン（`~/.claude/plugins/`）を読み込み、設定画面から閲覧・オン/オフ・お気に入り登録ができます。
2. **PATAPIMプラグイン** — PATAPIM自体を拡張するプラグイン。スコープ付きトークンで隔離実行され、すべてのAIセッションにMCPツールを追加したり、UIパネル・ツールバーボタン・スケジュールタスクなどを提供できます。PATAPIM独自の拡張レイヤーです。

## Claude Codeプラグイン

**設定**（`Ctrl+,`）から：

- マーケットプレイスを閲覧
- プラグインのオン/オフ切替
- お気に入り登録
- 設定は`~/.claude/settings.json`に保存

PATAPIMとClaude Code間で変更が同期されます。

## PATAPIMプラグイン

`~/.patapim/plugins/`に配置し、**設定 → ローカルAPI**から管理します。PATAPIMの[ローカルAPI](/docs/extensibility/local-api)を基盤としており、プラグインのツールはすべてのClaude Code / Codexセッションに自動的にMCPツールとして表示されます。

- [プラグイン開発](/docs/extensibility/building-plugins)
- [プラグインマーケットプレイス](/docs/extensibility/marketplace)
- [ローカルAPI](/docs/extensibility/local-api) & [TypeScript SDK](/docs/extensibility/sdk)
