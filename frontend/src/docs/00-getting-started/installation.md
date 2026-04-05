---
title: Installation
---

# Installation

Bloby runs on macOS, Windows, and Linux. Pick your method:

## macOS / Linux

```bash
curl -fsSL https://www.bloby.bot/install | sh
```

This downloads Bloby, bundles Node.js if needed, and installs everything to `~/.bloby/`. The `bloby` command is added to your PATH automatically.

## Windows

```powershell
iwr -useb https://www.bloby.bot/install.ps1 | iex
```

## npm

```bash
npm i -g bloby-bot
```

After npm install, everything is copied to `~/.bloby/` and the CLI is linked.

## What gets installed

After installation, your Bloby home looks like this:

```
~/.bloby/
├── config.json          # Your settings
├── memory.db            # Conversations & data
├── workspace/           # The app you and Bloby build together
├── supervisor/          # Manages all processes
├── worker/              # API server
├── dist-bloby/          # Chat interface
└── bin/                 # Cloudflare tunnel binary
```

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 4 GB minimum
- **Disk:** 500 MB
- **Node.js:** 18+ (bundled automatically if missing)

## Next step

Run `bloby init` to set everything up. See the **Setup** page for details.
