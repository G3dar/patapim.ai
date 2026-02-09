---
title: "MCP Browser Control"
description: "Let Claude control a browser via MCP"
order: 8
---

# MCP Browser Control

PATAPIM integrates the Model Context Protocol (MCP) to enable Claude Code to control a browser directly from the terminal interface.

## What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that allows AI models like Claude to interact with external tools and services. MCP provides a standardized way for AI assistants to:

- Access external data sources
- Control applications and services
- Perform actions beyond text generation
- Interact with APIs and system resources

## How MCP Works with PATAPIM

PATAPIM includes an MCP server that exposes browser control capabilities to Claude Code. When you interact with Claude in the terminal:

1. Claude can invoke MCP browser control functions
2. The MCP server launches or connects to a browser instance
3. Claude sends commands (navigate, click, fill forms, etc.)
4. The browser executes the commands
5. Results are returned to Claude for processing

The browser control panel is integrated into the PATAPIM sidebar, allowing you to see what Claude is doing in real-time.

## Auto-Registration

PATAPIM automatically registers its MCP browser server in supported AI CLI tools:

- **Claude Code**: Adds to `.claude/settings/mcp.json`
- **Gemini CLI**: Adds to `.gemini/settings.json`
- **Codex CLI**: Adds to Codex MCP configuration

Registration happens on startup. You don't need to manually configure MCP in any of these tools — PATAPIM handles it for you.

## Setup Requirements

Browser control functionality is available out of the box with PATAPIM. The system requires:

- **Electron BrowserView**: PATAPIM uses Electron BrowserView to provide an integrated browser panel directly within the application
- **Node.js**: Already included with PATAPIM installation
- **MCP Server**: Pre-configured and runs automatically when needed

No additional configuration is required. Claude Code will automatically detect and use the MCP browser control capabilities when appropriate.

## Use Cases

### Web Automation

Automate repetitive web tasks by asking Claude to:

- Fill out forms with test data
- Navigate through multi-step processes
- Download files from websites
- Submit forms or perform actions

**Example**:
```
You: "Go to example.com and fill out the contact form"
Claude: [Uses MCP to navigate, find form fields, and submit data]
```

### Web Scraping

Extract data from websites without writing scraping scripts:

- Scrape product information
- Extract table data
- Collect links or images
- Monitor website changes

**Example**:
```
You: "Get all product names and prices from catalog.example.com"
Claude: [Navigates to site, extracts data, formats results]
```

### Testing UIs

Test web applications interactively:

- Verify form validation
- Test navigation flows
- Check responsive behavior
- Validate content rendering

**Example**:
```
You: "Test the login flow on localhost:3000"
Claude: [Opens site, fills credentials, submits, reports results]
```

## Per-Terminal Browsers

Each terminal can have its own independent browser instance:

- Browser state is isolated per terminal
- Navigate different URLs in different terminals simultaneously
- Screenshots and page content are terminal-specific
- The browser panel in the sidebar shows the active terminal's browser

## REST API

PATAPIM exposes browser control via REST endpoints at `http://localhost:31415/browser/*`:

- All endpoints require MCP token authentication via the `Authorization` header
- The MCP token is auto-generated and stored in the `PATAPIM_MCP_TOKEN` environment variable
- Endpoints mirror the MCP tools: navigate, click, fill, screenshot, evaluate, content, info, etc.

This allows external tools and scripts to control the PATAPIM browser programmatically.

## Available MCP Tools

Claude and other AI tools can use these MCP tools:

- **browser_navigate**: Go to a URL
- **browser_screenshot**: Capture the current page as an image
- **browser_click**: Click elements by CSS selector
- **browser_fill**: Fill input fields with text
- **browser_evaluate**: Execute JavaScript on the page
- **browser_content**: Get page HTML or text content
- **browser_info**: Get current URL and page title
- **browser_back**: Go back in browser history
- **browser_forward**: Go forward in browser history
- **browser_refresh**: Reload the current page
- **browser_status**: Check if browser panel is available

## Browser Panel

The browser control panel in the sidebar shows:

- Current browser status (active/inactive)
- URL of the current page
- Screenshot preview of the browser viewport
- Recent actions performed by Claude

You can manually take control of the browser session at any time by clicking "Open Browser DevTools" in the panel.

## Privacy and Security

- Browser sessions are isolated per project
- No data is sent to external servers (MCP runs locally)
- You can disable browser control in settings if not needed
- All browser actions are logged in the terminal for transparency
