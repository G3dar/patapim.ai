---
title: "PassKey認証"
description: "リモートセッション用の生体認証"
order: 11
---

## 概要
**@simplewebauthn/server v13+**を使用したWebAuthn/PassKey認証でリモートアクセスセッションを保護します。

## 仕組み
1. リモートアクセスUIからPassKeyを登録（Touch ID、Windows Hello、ハードウェアキー）
2. 認証情報は`~/.patapim/passkeys.json`に保存
3. `~/.patapim/trusted-passkeys.json`の信頼リストに追加
4. 生体認証でリモートセッションを認証

## セキュリティ
- チャレンジ有効期限: **5分**
- 信頼済みPassKeyのみ認証可能（ホワイトリスト方式）
- JWTトークンはPassKey信頼ステータスに対して検証

## 対応方法
- Touch ID（macOS）
- Windows Hello（Windows）
- ハードウェアセキュリティキー（YubiKeyなど）
