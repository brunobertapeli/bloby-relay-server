---
title: Setup (morphy init)
---

# Setup (morphy init)

After installing, run:

```bash
morphy init
```

This is the one-time setup that gets Morphy running. There are no questions to answer. Here's what happens step by step.

> **Managed instance?** If you bought a hosted instance on the website, skip this page. Your bot is provisioned for you and lives at `<handle>.morphyagent.com`.

## 1. Connection mode

By default, `morphy init` connects your bot through **Morphy Relay**. You get a stable public URL, there is nothing to install, and no account with any third party is needed. Your free URL looks like `<handle>.open.morphyagent.com`. You can also reserve a premium handle (`<handle>.morphyagent.com`) for a $5 one-time fee.

If you don't want a public URL at all, run:

```bash
morphy init -advanced
```

This shows a chooser with two options:

| Mode | What it does |
|------|-------------|
| **Morphy Relay** | Stable public URL, always-on connection. Recommended for most users. |
| **Private Network** | No public URL. Access only via your local network or VPN (Tailscale, WireGuard, etc). |

## 2. What happens next

Init runs through these steps automatically:

1. Creates your config file and generates a local USDC wallet (used for x402 payments)
2. Prepares the install, including the daemon service files (macOS/Linux)
3. Starts the server
4. Connects the tunnel and verifies the connection (Relay mode)
5. Holds a few seconds while your URL goes live, so your first click doesn't 404

On Windows, or on Linux without systemd, there is no service manager. Morphy runs in the foreground instead of as a daemon.

## 3. Changing the mode later

You can switch modes any time without re-running the full setup:

- `morphy tunnel status` shows the current mode and URL
- `morphy tunnel setup` switches to Morphy Relay
- `morphy tunnel off` switches to private network (no public URL)

Re-running `morphy init` on a running install is safe. It leaves everything alone and points you to `morphy restart` and `morphy tunnel setup`.

## 4. Done

When init finishes, it prints your URLs. The main one is your stable relay URL (for example `https://<handle>.open.morphyagent.com`), and the dashboard is also available locally at `localhost:7400`. On macOS and Linux, Morphy auto-starts on login or boot.

Open the dashboard to finish setup. The chat bubble in the bottom-right corner is where you'll complete the onboarding wizard.
