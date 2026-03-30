---
title: "STRUCTURE.jsonリファレンス"
description: "STRUCTURE.jsonモジュールマップのリファレンス"
order: 4
---

## STRUCTURE.jsonとは

プロジェクトのモジュール構造、IPCチャネル、アーキテクチャノートをマッピングする自動生成ファイルです。

## フォーマット

```json
{
  "modules": {
    "main": ["index.js", "ptyManager.js", "remoteServer.js"],
    "renderer": ["index.js", "terminalManager.js", "fileTreeUI.js"]
  },
  "ipc": {
    "terminal": ["terminal-create", "terminal-destroy", "terminal-input-id"],
    "browser": ["browser:create", "browser:navigate", "browser:screenshot"]
  },
  "architecture": "main/rendererプロセス分離のElectronアプリ..."
}
```

## セクション

- **modules**: プロセス別のソースファイルリスト（main/renderer）
- **ipc**: カテゴリ別のIPCチャネルリスト
- **architecture**: プロジェクトアーキテクチャのテキスト説明

## AIエージェントの活用方法

Claude Codeはこのファイルを読むことで、コードベース全体をスキャンせずに正しいファイルに移動し、既存のIPCチャネルを把握し、アーキテクチャを理解できます。
