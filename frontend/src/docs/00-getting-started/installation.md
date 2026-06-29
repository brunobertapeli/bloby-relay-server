---
title: Installation
---

# Installation

Morphy runs on macOS, Windows, and Linux. Pick your method:

## macOS / Linux

```bash
curl -fsSL https://www.morphyagent.com/install | sh
```

This downloads Morphy, bundles Node.js if needed, and installs everything to `~/.morphy/`. The `morphy` command is added to your PATH automatically.

## Windows

```powershell
iwr -useb https://www.morphyagent.com/install.ps1 | iex
```

## npm

```bash
npm i -g morphyagent
```

After npm install, everything is copied to `~/.morphy/` and the CLI is linked.

## What gets installed

After installation, your Morphy home looks like this:

```
~/.morphy/
├── config.json          # Your settings
├── memory.db            # Conversations & data
├── workspace/           # The app you and Morphy build together
├── supervisor/          # Manages all processes
├── worker/              # API server
├── dist-chat/          # Chat interface
└── bin/                 # Cloudflare tunnel binary
```

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 4 GB minimum
- **Disk:** 500 MB
- **Node.js:** 18+ (bundled automatically if missing)

## Next step

Run `morphy init` to set everything up. See the **Setup** page for details.
