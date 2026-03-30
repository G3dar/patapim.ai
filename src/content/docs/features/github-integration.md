---
title: "GitHub Integration"
description: "View GitHub issues directly in PATAPIM"
order: 6
---

## Overview

View issues, pull requests, and commits in the sidebar panel via the `gh` CLI.

## Requirements

- `gh` CLI installed
- Authenticated: `gh auth login`

## Features

- **Issues & PRs**: Filter by state (open, closed, draft). Click to open in browser.
- **Commits**: Recent commit history for the current branch.
- **Project status**: Current branch, remote URL, dirty status.

Falls back to git remote info if GitHub API is unavailable.
