---
title: "File Editor"
description: "Multi-tab editor for quick file editing"
order: 9
---

# File Editor

PATAPIM includes a built-in multi-tab file editor integrated directly into the terminal interface. The editor provides syntax highlighting, find and replace, and keyboard shortcuts for efficient file editing.

## Opening Files

You can open files in the editor in several ways:

### From File Tree

Click any file in the file tree sidebar to open it in a new editor tab.

### From Terminal

You can also open files by clicking on file paths in terminal output (if the terminal supports clickable links) or by using the built-in `open` command if available.

### Multiple Files

Open multiple files simultaneously. Each file opens in its own tab in the terminal tab bar, appearing alongside your terminal tabs.

## Editor Interface

The editor tab bar integrates seamlessly with the terminal tab bar:

```
[Terminal 1] [Terminal 2] [config.js] [README.md] [+]
```

- Terminal tabs and editor tabs coexist in the same tab bar
- Active tab is highlighted
- Close button (×) on each tab
- Click tabs to switch between files and terminals

## Syntax Highlighting

The editor automatically detects file types and applies syntax highlighting:

- **JavaScript/TypeScript**: JS, TS, JSX, TSX files
- **Web**: HTML, CSS, SCSS, JSON
- **Markdown**: MD files
- **Configuration**: YAML, TOML, INI
- **Shell**: Bash, PowerShell, batch files
- **And more**: Python, Ruby, Go, Rust, etc.

Syntax highlighting adapts to PATAPIM's dark theme for comfortable reading.

## Find & Replace

Use the Find & Replace feature to search and modify text within files.

### Opening Find & Replace

Press **Ctrl+F** (Windows/Linux) or **Cmd+F** (Mac) while in the editor.

The Find & Replace panel appears at the top of the editor:

```
Find: [search term]        [↑] [↓] [×]
Replace: [replacement]     [Replace] [Replace All]
```

### Search Options

- **Case sensitive**: Toggle with the Aa button
- **Whole word**: Toggle with the W button
- **Regex**: Toggle with the .* button

### Keyboard Shortcuts

- **Ctrl+F**: Open find
- **Ctrl+H**: Open find and replace
- **F3** or **Enter**: Find next
- **Shift+F3**: Find previous
- **Escape**: Close find panel

## Saving Files

Save your changes with:

- **Ctrl+S** (Windows/Linux) or **Cmd+S** (Mac): Save current file
- **Ctrl+Shift+S**: Save as (choose new filename/location)

Unsaved changes are indicated by:
- A dot (•) next to the filename in the tab
- The tab title appears in italic

## Closing Editor Tabs

Close editor tabs by:

- Clicking the × button on the tab
- **Ctrl+W** keyboard shortcut
- Middle-clicking the tab (if your mouse supports it)

If you have unsaved changes, PATAPIM will prompt you to save before closing.

## Editor Keyboard Shortcuts

### Navigation

- **Ctrl+G**: Go to line
- **Ctrl+Home**: Go to file start
- **Ctrl+End**: Go to file end
- **Ctrl+Left/Right**: Move by word
- **Home/End**: Move to line start/end

### Selection

- **Ctrl+A**: Select all
- **Shift+Arrow**: Extend selection
- **Ctrl+Shift+Left/Right**: Select word
- **Ctrl+D**: Select next occurrence of current word

### Editing

- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo
- **Ctrl+X**: Cut
- **Ctrl+C**: Copy
- **Ctrl+V**: Paste
- **Ctrl+/**: Toggle line comment
- **Tab**: Indent
- **Shift+Tab**: Outdent

### Multiple Cursors

- **Alt+Click**: Add cursor at position
- **Ctrl+Alt+Up/Down**: Add cursor above/below

## Dark Theme

The file editor automatically matches PATAPIM's dark theme:

- Background: Dark gray (#1e1e1e)
- Text: Light gray (#d4d4d4)
- Syntax colors: Carefully selected for readability
- Cursor: High contrast for visibility
- Selection: Subtle highlight

Theme colors are consistent with the terminal and sidebar for a cohesive experience.

## Editor Settings

Customize editor behavior in PATAPIM settings:

- **Font size**: Adjust editor font size
- **Tab size**: Set spaces per tab (default: 2)
- **Word wrap**: Enable/disable line wrapping
- **Minimap**: Show/hide code minimap
- **Auto-save**: Save automatically after delay

Access settings from the menu: **Edit > Editor Settings**
