---
title: "タスク管理"
description: "PATAPIM内でタスクを追跡・委任"
order: 5
---

## 概要
プロジェクトルートの`tasks.json`と同期するビルトインタスクパネル。

## フォーマット
```json
{ "tasks": [{ "id": "uuid", "text": "説明", "status": "pending", "createdAt": "ISO", "updatedAt": "ISO" }] }
```

## ステータスフロー
`pending` → `in_progress` → `ready_to_test` → `completed`

## タスクパネル
- ステータスでフィルタリング
- タスクの追加、更新、削除、並べ替え
- **プレイボタン**: タスクテキストをアクティブターミナルに送信
- クイックタスクオーバーレイ（テキストまたは音声入力）

## AI連携
Claude Codeは会話中にタスクを検出し、保存を提案できます。ユーザーの承認が常に必要です。
