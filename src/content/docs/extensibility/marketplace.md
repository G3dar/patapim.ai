---
title: "Plugin Marketplace"
description: "Browse, install and publish PATAPIM plugins"
order: 4
---

## Browse & install

In PATAPIM: **Preferences → Local API → Marketplace**. The default catalog is the official community index; you can add any other catalog repo or URL alongside it.

You can also **install from a URL directly** — paste a link to a plugin's `.tar.gz` (any GitHub repo tarball works) and PATAPIM downloads, verifies and stages it.

Every plugin installs **disabled**: you review and approve its permissions (browser-extension style) before it can run.

## The community index

The official catalog lives at **[github.com/G3dar/patapim-plugins](https://github.com/G3dar/patapim-plugins)** — a `marketplace.json` listing community plugins. It's the default entry in the app, and it's open for submissions.

## Publish your plugin

1. Host your plugin in its own public repo with `plugin.json` at the root. Minimal example: [patapim-plugin-hello-world](https://github.com/G3dar/patapim-plugin-hello-world).
2. Open a PR adding an entry to [`marketplace.json`](https://github.com/G3dar/patapim-plugins) in the community index.

Guidelines: request the minimum permissions your plugin needs, don't circumvent plan limits, and don't imply official status. See the [plugin terms](https://github.com/G3dar/patapim-sdk/blob/main/PLUGIN_TERMS.md).

Anyone can also install your plugin directly from your repo URL without the index — the marketplace is optional discovery, not a gatekeeper.
