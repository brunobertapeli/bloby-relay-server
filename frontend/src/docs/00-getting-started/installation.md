---
title: Installation
---

# Installation

Morphy runs on macOS, Windows, and Linux, on x64, arm64, and armv7l. A Raspberry Pi works. Pick your method.

On a managed plan there is nothing to install. Your instance comes ready to use, so skip ahead to **Setup**.

## macOS / Linux

```bash
curl -fsSL https://www.morphyagent.com/install | sh
```

This downloads Morphy, installs everything to `~/.morphy/`, and bundles its own Node.js runtime so Morphy never depends on your system setup. The `morphy` command is added to your PATH automatically.

One exception: on Alpine Linux the bundled Node.js cannot run (it needs glibc), so install Node.js 18+ first (for example `apk add nodejs npm`) and re-run the installer.

## Windows

```powershell
iwr -useb https://www.morphyagent.com/install.ps1 | iex
```

## npm

```bash
npm i -g morphyagent
```

The npm method needs Node.js 18+ already on your machine. After npm install, everything is copied to `~/.morphy/` and the CLI is linked.

## What gets installed

After installation, your Morphy home looks like this:

```
~/.morphy/
├── config.json          # Your settings
├── memory.db            # Conversations & data
├── workspace/           # The app you and Morphy build together
├── supervisor/          # Manages all processes
├── worker/              # API server
├── dist-chat/           # Chat interface
├── tools/               # Bundled Node.js runtime (installer methods)
└── bin/                 # The morphy command
```

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 2 GB minimum, 4 GB recommended
- **Disk:** about 2 GB free
- **Node.js:** none needed for the installers above. Only the npm method needs your own Node.js 18+.

If the install fails while building native modules, install build tools and re-run: `xcode-select --install` on macOS, or `sudo apt-get install -y build-essential python3` on Debian and Ubuntu.

## Next step

Run `morphy init` to set everything up. See the **Setup** page for details.
