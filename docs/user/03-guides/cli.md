---
title: CLI Commands
---

# CLI Commands

Everything in Bloby is controlled through the `bloby` command.

## Main commands

| Command | What it does |
|---------|-------------|
| `bloby init` | First-time setup — tunnel mode, config, server boot, daemon install |
| `bloby start` | Start the server (or show status if daemon is running) |
| `bloby status` | Show health info — uptime, tunnel URL, relay URL |
| `bloby update` | Download and install the latest version |

## Tunnel commands

| Command | What it does |
|---------|-------------|
| `bloby tunnel setup` | Interactive named tunnel setup (Cloudflare) |
| `bloby tunnel status` | Show current tunnel mode and URL |
| `bloby tunnel reset` | Switch back to quick tunnel mode |

## Daemon commands

| Command | What it does |
|---------|-------------|
| `bloby daemon install` | Set up auto-start on boot |
| `bloby daemon start` | Start the daemon |
| `bloby daemon stop` | Stop the daemon |
| `bloby daemon restart` | Restart the daemon |
| `bloby daemon status` | Check if the daemon is running |
| `bloby daemon logs` | View daemon logs |
| `bloby daemon uninstall` | Remove auto-start |

## Updates

```bash
bloby update
```

This checks the npm registry for a newer version, downloads it, updates the code, rebuilds the UI, and restarts the daemon. Your workspace and data are preserved.
