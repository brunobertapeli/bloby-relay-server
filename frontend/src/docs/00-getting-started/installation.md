---
title: Installation
---

# Installation

Fluxy runs on macOS, Windows, and Linux. Pick your method:

## macOS / Linux

```bash
curl -fsSL https://www.fluxy.bot/install | sh
```

This downloads Fluxy, bundles Node.js if needed, and installs everything to `~/.fluxy/`. The `fluxy` command is added to your PATH automatically.

## Windows

```powershell
iwr -useb https://www.fluxy.bot/install.ps1 | iex
```

## npm

```bash
npm i -g fluxy-bot
```

After npm install, everything is copied to `~/.fluxy/` and the CLI is linked.

## What gets installed

After installation, your Fluxy home looks like this:

```
~/.fluxy/
├── config.json          # Your settings
├── memory.db            # Conversations & data
├── workspace/           # The app you and Fluxy build together
├── supervisor/          # Manages all processes
├── worker/              # API server
├── dist-fluxy/          # Chat interface
└── bin/                 # Cloudflare tunnel binary
```

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 4 GB minimum
- **Disk:** 500 MB
- **Node.js:** 18+ (bundled automatically if missing)

## Next step

Run `fluxy init` to set everything up. See the **Setup** page for details.
