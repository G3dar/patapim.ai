---
title: "プラグインマーケットプレイス"
description: "PATAPIMプラグインの閲覧・インストール・公開"
order: 4
---

## 閲覧とインストール

PATAPIMで **設定 → ローカルAPI → マーケットプレイス** を開きます。デフォルトのカタログは公式コミュニティインデックスで、他のカタログのリポジトリやURLを追加することもできます。

**URLから直接インストール**も可能です — プラグインの `.tar.gz` へのリンク（任意のGitHubリポジトリのtarballでOK）を貼れば、PATAPIMがダウンロード・検証・ステージングします。

すべてのプラグインは**無効の状態**でインストールされます：実行前に、その権限を確認して承認します（ブラウザ拡張と同じ方式）。

## コミュニティインデックス

公式カタログは **[github.com/G3dar/patapim-plugins](https://github.com/G3dar/patapim-plugins)** にあります — コミュニティのプラグインを列挙した `marketplace.json` です。アプリのデフォルトエントリであり、投稿を受け付けています。

## プラグインを公開する

1. プラグインを、ルートに `plugin.json` を置いた公開リポジトリでホストします。最小のサンプル：[patapim-plugin-hello-world](https://github.com/G3dar/patapim-plugin-hello-world)。
2. コミュニティインデックスの [`marketplace.json`](https://github.com/G3dar/patapim-plugins) にエントリを追加するPRを開きます。

ガイドライン：必要最小限の権限だけを要求し、プラン制限を回避せず、公式であるかのように見せないこと。[プラグイン規約](https://github.com/G3dar/patapim-sdk/blob/main/PLUGIN_TERMS.md)を参照してください。

インデックスを介さず、リポジトリURLから直接インストールすることもできます — マーケットプレイスは任意の発見手段であり、ゲートキーパーではありません。
