---
title: CLI Commands
---

# CLI Commands

Everything in Fluxy is controlled through the `fluxy` command.

## Main commands

| Command | What it does |
|---------|-------------|
| `fluxy init` | First-time setup — tunnel mode, config, server boot, daemon install |
| `fluxy start` | Start the server (or show status if daemon is running) |
| `fluxy status` | Show health info — uptime, tunnel URL, relay URL |
| `fluxy update` | Download and install the latest version |

## Tunnel commands

| Command | What it does |
|---------|-------------|
| `fluxy tunnel setup` | Interactive named tunnel setup (Cloudflare) |
| `fluxy tunnel status` | Show current tunnel mode and URL |
| `fluxy tunnel reset` | Switch back to quick tunnel mode |

## Daemon commands

| Command | What it does |
|---------|-------------|
| `fluxy daemon install` | Set up auto-start on boot |
| `fluxy daemon start` | Start the daemon |
| `fluxy daemon stop` | Stop the daemon |
| `fluxy daemon restart` | Restart the daemon |
| `fluxy daemon status` | Check if the daemon is running |
| `fluxy daemon logs` | View daemon logs |
| `fluxy daemon uninstall` | Remove auto-start |

## Updates

```bash
fluxy update
```

This checks the npm registry for a newer version, downloads it, updates the code, rebuilds the UI, and restarts the daemon. Your workspace and data are preserved.
