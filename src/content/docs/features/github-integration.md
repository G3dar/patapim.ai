---
title: "GitHub Integration"
description: "View GitHub issues directly in PATAPIM"
order: 6
---

# GitHub Integration

PATAPIM integrates with GitHub to display issues from your repositories directly in the sidebar. Track bugs, features, and tasks without leaving your workspace.

## Git Panel

PATAPIM includes a floating Git panel in the top-right corner of the terminal area for quick Git operations:

### Branch Selector

- Shows the **current branch name** at a glance
- Click to open a **branch switching dropdown** with all local branches
- Switch branches directly without typing Git commands

### Commit & Push

When Claude Code is detected running in a terminal, a **Commit & Push** button appears in the Git panel:

- Click to stage all changes, commit, and push in one action
- Useful for quickly shipping work after Claude finishes a task
- The button is contextual — it only appears when Claude is active

The Git panel complements the full GitHub Issues integration described below.

---

## Requirements

### GitHub CLI (gh)

PATAPIM uses the GitHub CLI to fetch issues.

**Installation:**

**macOS:**
```bash
brew install gh
```

**Windows:**
```bash
winget install --id GitHub.cli
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install gh

# Fedora
sudo dnf install gh
```

**Verify installation:**
```bash
gh --version
```

### Authentication

Authenticate the GitHub CLI with your account:

```bash
gh auth login
```

Follow the prompts:
1. Select "GitHub.com"
2. Choose authentication method (browser or token)
3. Complete authentication

**Verify authentication:**
```bash
gh auth status
```

### Git Repository

The project must be:
- A Git repository (initialized with `git init`)
- Have a GitHub remote configured

**Check remote:**
```bash
git remote -v
```

**Expected output:**
```
origin  https://github.com/username/repo.git (fetch)
origin  https://github.com/username/repo.git (push)
```

## Using GitHub Issues

### View Issues

Access the GitHub panel from the sidebar.

**Open GitHub panel:**
- Click the GitHub icon in the sidebar
- Press `Ctrl+Shift+I`

**Panel shows:**
- Issue number and title
- State (open/closed)
- Labels (if any)
- Last updated date

### Filter by State

Use the state filter to show only the issues you care about.

**Filter options:**
- **Open**: Show only open issues (default)
- **Closed**: Show only closed issues
- **All**: Show both open and closed

**Change filter:**
- Click the dropdown at the top of the panel
- Select desired state

### Issue Labels

Labels appear as colored badges next to each issue.

**Common labels:**
- `bug` - Something isn't working
- `feature` - New feature request
- `enhancement` - Improvement to existing feature
- `documentation` - Documentation updates
- `good first issue` - Good for newcomers

**Label colors:**
- Match GitHub's label colors
- Multiple labels shown per issue
- Long label names truncated with ellipsis

### Open in Browser

Click any issue to open it in your default browser.

**What opens:**
- Full issue page on GitHub.com
- Comments and discussion
- Issue timeline
- Related PRs and commits

**Use cases:**
- Read full issue description
- Add comments
- Change labels or assignees
- Close/reopen issues

### Refresh Issues

PATAPIM caches issues for performance. Refresh to get the latest data.

**Refresh options:**
- Click the refresh button in the panel
- Press `Ctrl+R` while focused on the panel
- Issues auto-refresh every 5 minutes

## Workflow Integration

### Working on Issues

1. Browse issues in the GitHub panel
2. Click an issue to read details
3. Create a task in PATAPIM for the issue
4. Start working and reference the issue number in commits

**Commit message example:**
```bash
git commit -m "Fix: Resolve login redirect (#42)"
```

### Issue to Task

Convert a GitHub issue to a PATAPIM task:

1. Right-click an issue in the panel
2. Select "Create Task from Issue"
3. Task created with:
   - Title: Issue title
   - Description: Issue number + link
   - Category: Based on labels (bug → fix, feature → feature)
   - Priority: Based on labels or default to medium

### Closing Issues

When work is complete:

1. Mark your PATAPIM task as complete
2. Push your changes to GitHub
3. Create a PR that references the issue
4. Merge the PR (issue auto-closes if you used "Fixes #42" in PR description)

## Troubleshooting

### No Issues Showing

**Check:**
1. GitHub CLI is installed (`gh --version`)
2. Authenticated with GitHub (`gh auth status`)
3. Project has a GitHub remote (`git remote -v`)
4. Repository actually has issues on GitHub
5. You have access to the repository

**Fix:**
- Authenticate: `gh auth login`
- Add remote: `git remote add origin https://github.com/username/repo.git`
- Refresh the panel

### "Not a Git Repository" Error

The current project folder must be a Git repository.

**Fix:**
```bash
cd /path/to/project
git init
git remote add origin https://github.com/username/repo.git
```

### Authentication Expired

GitHub CLI tokens expire periodically.

**Fix:**
```bash
gh auth refresh
```

Or re-authenticate:
```bash
gh auth login
```

### Rate Limiting

GitHub API has rate limits (60 requests/hour for unauthenticated, 5000/hour for authenticated).

**If you hit the limit:**
- Wait for the rate limit to reset (shown in error message)
- Ensure you're authenticated (uses higher limit)
- Reduce refresh frequency

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+I` | Open GitHub panel |
| `Ctrl+R` | Refresh issues |
| `↑` / `↓` | Navigate issues |
| `Enter` | Open selected issue in browser |
| `Ctrl+F` | Filter issues |

## Privacy & Permissions

**What PATAPIM accesses:**
- Repository issues (read-only)
- Issue metadata (title, state, labels, dates)
- No access to code or commits

**What PATAPIM doesn't do:**
- Create or modify issues
- Access private repositories (unless you're authenticated)
- Store issue data permanently (cached temporarily)

**Permissions:**
- Uses GitHub CLI's authentication
- Same permissions as your GitHub account
- Revoke access via GitHub settings → Applications

## Tips

**Use labels effectively:**
- Filter PATAPIM tasks based on GitHub labels
- Use label colors for visual priority
- Sync label strategy between GitHub and PATAPIM

**Link tasks and issues:**
- Reference issue numbers in task descriptions
- Create tasks for issues you're actively working on
- Keep both in sync manually

**Multi-repository workflow:**
- Switch projects to see different repos' issues
- Each project shows its own GitHub issues
- Use workspace to manage multiple repos
