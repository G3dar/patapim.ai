---
title: "Auto-Updates"
description: "Keep PATAPIM up to date automatically"
order: 12
---

# Auto-Updates

PATAPIM includes an automatic update system that keeps your installation up to date with the latest features, bug fixes, and security patches.

## How Auto-Updates Work

The update system checks for new versions and notifies you when updates are available.

### Update Checks

PATAPIM checks for updates:

- **On startup**: Every time you launch PATAPIM
- **Every 30 minutes**: While PATAPIM is running
- **Manual check**: Click "Check for Updates" in the menu

Update checks are lightweight and don't interfere with your work.

### Version Source

PATAPIM fetches version information from a **GitHub Gist**:

```
https://gist.githubusercontent.com/patapim/abc123/raw/latest-version.json
```

The Gist contains:
- Latest version number
- Release notes
- Download URL (for reference)
- Minimum required version for force updates

This approach is lightweight and doesn't require a dedicated server.

## Update Notifications

When a new version is available, you'll see a **green update button** in the toolbar:

```
[🔄 Update Available]
```

Click the button to see:
- New version number
- Release notes
- Update button

You can:
- **Update now**: Apply the update immediately
- **Remind me later**: Dismiss the notification (will reappear on next check)
- **Skip this version**: Don't notify about this version again

## Update Process

The update process is designed to preserve your changes and minimize downtime.

### Steps

1. **Stash changes**: `git stash` saves any uncommitted changes
2. **Pull updates**: `git pull` fetches the latest code from the repository
3. **Install dependencies**: `npm install` updates Node.js packages
4. **Build**: `npm run build` compiles the updated code
5. **Restore changes**: `git stash pop` restores your uncommitted changes
6. **Restart prompt**: PATAPIM prompts you to restart

### What Gets Updated

The update process updates:

- Core PATAPIM code (renderer, main process, shared modules)
- Dependencies (npm packages)
- Built-in plugins
- Configuration schema (if changed)

### What Doesn't Get Updated

The update process preserves:

- Your project data
- User settings and preferences
- Custom plugins installed in `~/.patapim/plugins/`
- Terminal logs and session history
- Uncommitted changes in your projects

## Restarting After Update

After the update completes, PATAPIM prompts you to restart:

```
Update complete! Restart PATAPIM to apply changes.

[Restart Now] [Restart Later]
```

- **Restart Now**: Closes PATAPIM and reopens with the new version
- **Restart Later**: Continue using the current version (restart manually later)

Changes take effect only after restarting.

## Automatic Restart

You can enable automatic restart after updates in settings:

1. Open PATAPIM settings
2. Navigate to **Updates > Auto-Update Behavior**
3. Check "Restart automatically after updates"
4. Click "Save"

With this enabled, PATAPIM will restart automatically after successful updates without prompting.

## Update Conflicts

If the update process encounters conflicts (e.g., you modified core files):

1. PATAPIM attempts to auto-merge changes
2. If auto-merge fails, you'll see a conflict notification
3. You can:
   - **Abort update**: Keep your current version
   - **Discard local changes**: Apply update and lose your modifications
   - **Manually resolve**: Fix conflicts in Git and retry

It's recommended to avoid modifying core PATAPIM files to prevent update conflicts.

## Release Pipeline (For Maintainers)

This section is for PATAPIM maintainers managing releases.

### Creating a Release

1. **Update version**: Bump version in `package.json`
2. **Write release notes**: Document changes in `CHANGELOG.md`
3. **Commit and tag**: Create a Git tag (e.g., `v1.2.0`)
4. **Push tag**: `git push origin v1.2.0`
5. **Update Gist**: Update the version Gist with new version info

### Gist Format

The version Gist should contain:

```json
{
  "version": "1.2.0",
  "releaseDate": "2026-02-06",
  "releaseNotes": "Added feature X, fixed bug Y",
  "downloadUrl": "https://github.com/patapim/patapim/releases/tag/v1.2.0",
  "minimumVersion": "1.0.0"
}
```

### Force Updates

If a version has critical security issues, set `minimumVersion` in the Gist:

```json
{
  "version": "1.2.1",
  "minimumVersion": "1.2.1",
  "forceUpdate": true,
  "forceUpdateReason": "Critical security patch"
}
```

PATAPIM will enforce the update and prevent users from skipping it.

## Disabling Auto-Updates

To disable automatic updates:

1. Open PATAPIM settings
2. Navigate to **Updates > Auto-Update Behavior**
3. Uncheck "Check for updates automatically"
4. Click "Save"

You can still manually check for updates from the menu.

## Troubleshooting Updates

### Update Failed

If an update fails:

1. Check your internet connection
2. Ensure Git is installed and in PATH
3. Verify you have write permissions to the PATAPIM directory
4. Check the error message in the update dialog

Try running the update steps manually:

```bash
cd /path/to/patapim
git stash
git pull
npm install
npm run build
git stash pop
```

### Update Loop

If PATAPIM keeps prompting for the same update:

1. Close PATAPIM
2. Delete the update cache: `~/.patapim/update-cache.json`
3. Reopen PATAPIM and check for updates again

### Corrupted Installation

If the update corrupts your installation:

1. Close PATAPIM
2. Reset to the last working version: `git reset --hard v<version>`
3. Rebuild: `npm install && npm run build`
4. Reopen PATAPIM

Report the issue on GitHub so maintainers can investigate.
