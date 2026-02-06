---
title: "Plugin System"
description: "Extend PATAPIM with plugins"
order: 7
---

# Plugin System

PATAPIM features a Git-based plugin system that allows you to extend the IDE with custom functionality. Plugins are managed through an official marketplace and stored locally in your user directory.

## Plugin Storage

All plugins are stored in your home directory:

```
~/.patapim/plugins/
```

On Windows, this translates to:

```
C:\Users\<username>\.patapim\plugins\
```

## Plugin Panel

Access the plugin panel from the sidebar to manage your installed plugins. The panel displays:

- Available plugins from the official marketplace
- Currently installed plugins
- Plugin status (enabled/disabled)
- Plugin metadata (name, version, description, author)

## Installing Plugins

Plugins are installed directly from Git repositories listed in the official marketplace.

1. Open the plugin panel from the sidebar
2. Browse available plugins in the marketplace
3. Click "Install" on the plugin you want
4. PATAPIM will clone the plugin repository to `~/.patapim/plugins/`
5. The plugin will be automatically enabled after installation

## Enabling and Disabling Plugins

You can enable or disable plugins without uninstalling them:

- **Enable**: Click the toggle switch next to the plugin name
- **Disable**: Click the toggle switch again to turn it off
- Disabled plugins remain installed but won't load their functionality

Changes take effect immediately without requiring a restart.

## Refreshing the Marketplace

The marketplace list is fetched from a remote Git repository. To get the latest available plugins:

1. Open the plugin panel
2. Click the "Refresh Marketplace" button
3. PATAPIM will fetch the latest plugin list

The marketplace refreshes automatically on startup, but you can manually refresh to check for new plugins or updates.

## Creating Plugins

PATAPIM plugins are Node.js modules that follow a specific structure. A basic plugin includes:

- **package.json**: Plugin metadata and dependencies
- **index.js**: Main entry point with plugin logic
- **README.md**: Plugin documentation

For detailed information on creating custom plugins, see the [Plugin Development Guide](/docs/guides/plugin-development).

## Official Marketplace

The official marketplace is maintained as a Git repository containing verified plugins. All marketplace plugins are:

- Reviewed for security and compatibility
- Versioned using Git tags
- Documented with installation and usage instructions
- Open source and community-maintained

To submit a plugin to the official marketplace, see the [Plugin Submission Guidelines](/docs/guides/plugin-submission).
