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

Each plugin lives in its own subdirectory, named after the plugin's package name. When you install a plugin, PATAPIM clones its Git repository into this directory. Uninstalling a plugin removes its directory entirely.

## Plugin Panel

Access the plugin panel from the sidebar to manage your installed plugins. The panel displays:

- **Marketplace tab** — browse available plugins from the official repository
- **Installed tab** — view and manage plugins you've already installed
- **Plugin status** — each plugin shows an enabled/disabled toggle
- **Plugin metadata** — name, version, description, author, and icon
- **Install/Uninstall buttons** — one-click management for each plugin

The panel groups plugins by category and shows update indicators when newer versions are available in the marketplace.

## Installing Plugins

Plugins are installed directly from Git repositories listed in the official marketplace.

1. Open the plugin panel from the sidebar
2. Browse available plugins in the **Marketplace** tab
3. Click **"Install"** on the plugin you want
4. PATAPIM clones the plugin repository to `~/.patapim/plugins/<plugin-name>/`
5. Dependencies are installed automatically via `npm install`
6. The plugin is enabled and activated immediately

No restart is required. The plugin begins working as soon as installation completes.

## Enabling and Disabling Plugins

You can enable or disable plugins without uninstalling them:

- **Enable**: Click the toggle switch next to the plugin name
- **Disable**: Click the toggle switch again to turn it off
- Disabled plugins remain installed but won't load their functionality

Changes take effect immediately without requiring a restart.

### Toggle Persistence

Your enabled/disabled preferences are saved locally and persist across PATAPIM restarts. If you disable a plugin, it stays disabled until you explicitly re-enable it — even after closing and reopening PATAPIM. This state is stored alongside your other PATAPIM settings, not inside the plugin directory itself.

## Refreshing the Marketplace

The marketplace list is fetched from a remote Git repository. To get the latest available plugins:

1. Open the plugin panel
2. Click the **"Refresh Marketplace"** button
3. PATAPIM fetches the latest plugin list from the remote repository

The marketplace refreshes automatically on startup, but you can manually refresh to check for newly added plugins or updates to existing ones.

## Plugin Structure

Every PATAPIM plugin follows a standard Node.js module structure with three required files:

```
my-plugin/
  package.json    # Plugin metadata and dependencies
  index.js        # Main entry point
  README.md       # Documentation
```

### package.json

The `package.json` file defines your plugin's metadata and PATAPIM-specific configuration:

```json
{
  "name": "patapim-hello-world",
  "version": "1.0.0",
  "description": "A minimal example plugin for PATAPIM",
  "author": "Your Name",
  "main": "index.js",
  "patapim": {
    "displayName": "Hello World",
    "icon": "wave",
    "minVersion": "1.0.0"
  }
}
```

| Field | Description |
|-------|-------------|
| `name` | Package name, typically prefixed with `patapim-` |
| `version` | Semantic version (e.g., `1.0.0`) |
| `description` | Short description shown in the marketplace |
| `author` | Plugin author name or email |
| `main` | Entry point file (usually `index.js`) |
| `patapim.displayName` | Human-readable name shown in the plugin panel |
| `patapim.icon` | Icon identifier displayed next to the plugin name |
| `patapim.minVersion` | Minimum PATAPIM version required to run this plugin |

### index.js

The entry point must export two functions:

```javascript
function activate(context) {
  // Called when the plugin is enabled
  // Use 'context' to access PATAPIM APIs
  console.log('Hello World plugin activated');
}

function deactivate() {
  // Called when the plugin is disabled
  // Clean up resources, event listeners, etc.
  console.log('Hello World plugin deactivated');
}

module.exports = { activate, deactivate };
```

- **`activate(context)`** — called when the plugin is enabled or when PATAPIM starts with the plugin already enabled. The `context` object provides access to PATAPIM's internal APIs.
- **`deactivate()`** — called when the plugin is disabled or when PATAPIM shuts down. Use this to clean up any resources, timers, or event listeners your plugin created.

### README.md

Include a README with:

- What the plugin does
- Installation instructions (if any extra setup is needed)
- Configuration options
- Usage examples

## Hello World Example

Here is a complete minimal plugin:

**package.json:**

```json
{
  "name": "patapim-hello-world",
  "version": "1.0.0",
  "description": "Logs a greeting when activated",
  "author": "PATAPIM Community",
  "main": "index.js",
  "patapim": {
    "displayName": "Hello World",
    "icon": "wave",
    "minVersion": "1.0.0"
  }
}
```

**index.js:**

```javascript
function activate(context) {
  console.log('Hello from the Hello World plugin!');

  // Example: register a simple command
  context.registerCommand('hello-world.greet', () => {
    context.showNotification('Hello, PATAPIM!');
  });
}

function deactivate() {
  console.log('Goodbye from the Hello World plugin!');
}

module.exports = { activate, deactivate };
```

**README.md:**

```markdown
# Hello World Plugin

A minimal PATAPIM plugin that shows a greeting notification.

## Usage

After installation, the plugin registers a `hello-world.greet` command
that displays a "Hello, PATAPIM!" notification.
```

To test this plugin locally, place the folder in `~/.patapim/plugins/patapim-hello-world/` and restart PATAPIM. It will appear in the **Installed** tab of the plugin panel.

## Creating Plugins

To create your own plugin:

1. Create a new directory in `~/.patapim/plugins/` with your plugin name
2. Add a `package.json` with the required fields and `patapim` configuration block
3. Write your `index.js` with `activate` and `deactivate` exports
4. Add a `README.md` describing your plugin
5. Restart PATAPIM or refresh the plugin panel — your plugin will appear in the **Installed** tab
6. Enable it with the toggle switch to test

Once your plugin is working locally, you can publish it to the marketplace (see below).

**Tips:**

- Use `context` in your `activate` function to interact with PATAPIM APIs
- Always clean up in `deactivate` — remove listeners, clear timers, close connections
- Test with the plugin toggle to verify enable/disable cycles work cleanly
- Check the DevTools console (`PATAPIM_DEBUG=1`) for errors during development

## Official Marketplace

The official marketplace is maintained as a community Git repository containing verified plugins. All marketplace plugins are:

- **Reviewed** for security and compatibility before listing
- **Versioned** using Git tags for reliable installation
- **Documented** with installation and usage instructions

### Submitting a Plugin

To add your plugin to the marketplace:

1. Host your plugin in a public Git repository
2. Ensure your plugin follows the standard structure (package.json, index.js, README.md)
3. Open a pull request to the marketplace repository with your plugin listing
4. The community and maintainers will review your submission
5. Once approved, your plugin appears in the marketplace for all users

The marketplace is community-maintained. Contributions, feedback, and plugin submissions are welcome.
