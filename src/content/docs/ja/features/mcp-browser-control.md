---
title: "MCPブラウザ操作"
description: "MCPを通じてClaudeがブラウザを操作"
order: 8
---

## 概要
Electronの**WebContentsView** APIと**Chrome DevTools Protocol（CDP）**を使用してブラウザパネルを埋め込みます。MCPサーバーがClaude Codeのブラウザ操作を自動化します。

## MCPツール

| ツール | 説明 |
|-------|------|
| `browser_navigate` | URLに移動 |
| `browser_click` | セレクターまたはテキストで要素をクリック |
| `browser_fill` | 入力フィールドに入力 |
| `browser_screenshot` | スクリーンショットを撮影 |
| `browser_scroll` | ページをスクロール |
| `browser_wait` | 要素を待機 |
| `browser_press_key` | キー入力を送信 |
| `browser_evaluate` | JavaScriptを実行 |

## デバイスエミュレーション
iPhone、iPad、Android、デスクトップのエミュレーション対応。

## 制限事項
- 最大**10個**の同時MCPブラウザ（アイドル時自動クリーンアップ）
- `X-PATAPIM-TOKEN`ヘッダーで認証
- ダウンロードは`~/.patapim/downloads/`に保存
- 起動時に`~/.claude.json`に自動登録
