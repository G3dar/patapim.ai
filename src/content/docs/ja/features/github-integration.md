---
title: "GitHub連携"
description: "PATAPIM内でGitHub Issueを直接表示"
order: 6
---

## 概要
`gh` CLI経由でIssue、プルリクエスト、コミットをサイドバーに表示。

## 要件
- `gh` CLIがインストール済み
- GitHub認証済み: `gh auth login`

## 機能
- **Issue & PR**: 状態でフィルター（open/closed/draft）。クリックでブラウザで開く
- **コミット**: 現在のブランチの最近のコミット履歴
- **プロジェクトステータス**: ブランチ名、リモートURL、未コミット変更
