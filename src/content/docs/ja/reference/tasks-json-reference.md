---
title: "tasks.jsonリファレンス"
description: "tasks.jsonタスク追跡ファイルのリファレンス"
order: 5
---

## tasks.jsonとは

プロジェクトルートにあるタスク追跡ファイルで、PATAPIMのタスクパネルと同期します。

## フォーマット

```json
{
  "tasks": [
    { "id": "a1b2c3", "text": "認証フローを修正", "status": "in_progress", "createdAt": "2026-01-15T10:00:00Z", "updatedAt": "2026-01-15T14:30:00Z" }
  ]
}
```

## フィールド

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | string | 一意識別子（UUID） |
| `text` | string | タスクの説明 |
| `status` | string | 現在のステータス |
| `createdAt` | string | ISO 8601作成日時 |
| `updatedAt` | string | ISO 8601更新日時 |

## ステータス値

`pending` → `in_progress` → `ready_to_test` → `completed`

## タスクパネル

フィルター表示、追加、更新、削除、並べ替え、プレイボタンでアクティブターミナルにタスクを送信できます。
