---
title: CLI Commands
---

# CLI Commands

Everything in Morphy is controlled through the `morphy` command.

## Main commands

| Command | What it does |
|---------|-------------|
| `morphy init` | First-time setup — tunnel mode, config, server boot, daemon install |
| `morphy start` | Start the server (or show status if daemon is running) |
| `morphy status` | Show health info — uptime, tunnel URL, relay URL |
| `morphy update` | Download and install the latest version |

## Tunnel commands

| Command | What it does |
|---------|-------------|
| `morphy tunnel setup` | Interactive named tunnel setup (Cloudflare) |
| `morphy tunnel status` | Show current tunnel mode and URL |
| `morphy tunnel reset` | Switch back to quick tunnel mode |

## Daemon commands

| Command | What it does |
|---------|-------------|
| `morphy daemon install` | Set up auto-start on boot |
| `morphy daemon start` | Start the daemon |
| `morphy daemon stop` | Stop the daemon |
| `morphy daemon restart` | Restart the daemon |
| `morphy daemon status` | Check if the daemon is running |
| `morphy daemon logs` | View daemon logs |
| `morphy daemon uninstall` | Remove auto-start |

## Updates

```bash
morphy update
```

This checks the npm registry for a newer version, downloads it, updates the code, rebuilds the UI, and restarts the daemon. Your workspace and data are preserved.
