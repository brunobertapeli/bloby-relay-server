---
title: CLI Commands
---

# CLI Commands

Everything in Morphy is controlled through the `morphy` command.

Managed instances come with all of this already set up on the website. You only need the CLI if you self-host.

## Main commands

| Command | What it does |
|---------|-------------|
| `morphy init` | First-time setup (config, wallet, connection, daemon install) |
| `morphy start` | Start Morphy in the background |
| `morphy stop` | Stop Morphy |
| `morphy restart` | Restart Morphy |
| `morphy status` | Show status, URLs, and health |
| `morphy logs` | Show recent logs (`-f` to follow, `-n <lines>` to set how many) |
| `morphy update` | Download and install the latest version |
| `morphy help` | List all commands |
| `morphy version` | Print the installed version |

Running bare `morphy` starts the bot, or runs first-time setup if there is no config yet.

Useful flags:

- `morphy init -advanced` shows the connection chooser, which includes private network mode (no public URL).
- `morphy start --foreground` runs Morphy attached to your terminal, handy for debugging.

## Tunnel commands

Self-hosted bots go online through Morphy Relay, a built-in carrier with a stable URL at `<handle>.open.morphyagent.com`. There is nothing to install and no third-party account. Managed instances are reached directly and do not use it.

| Command | What it does |
|---------|-------------|
| `morphy tunnel status` | Show the current connection mode and URL |
| `morphy tunnel on` | Use Morphy Relay (stable public URL) |
| `morphy tunnel off` | Private network mode, no public URL (for Tailscale, WireGuard, or LAN-only setups) |

Restart Morphy after switching modes.

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

## Other commands

| Command | What it does |
|---------|-------------|
| `morphy password-reset` | Reset the dashboard password |
| `morphy x402 <url>` | Pay an x402-protected endpoint with USDC on Base |

## Updates

```bash
morphy update
```

This checks the npm registry for a newer version, downloads it, updates the code, and installs the pre-built interface. If Morphy was running, it restarts on the new version. If it was stopped, it stays stopped until you run `morphy start`. Your workspace and data are preserved.
