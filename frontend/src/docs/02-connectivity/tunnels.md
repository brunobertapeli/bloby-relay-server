---
title: Tunnels & Remote Access
---

# Tunnels & Remote Access

Morphy runs on your machine, but you can reach it from anywhere. Self-hosted bots connect through Morphy Relay. Managed instances skip tunnels entirely (they are reached directly at their own address), so this page only applies if you self-host.

## Morphy Relay (default)

Zero configuration. Your bot opens one persistent, encrypted outbound connection to Cloudflare's edge, and your public URL is served through it.

- **No account needed.** Nothing to install, nothing to configure.
- **Stable URL.** Your address never changes, even across restarts and reconnects.
- **Free handle:** `https://yourbot.open.morphyagent.com`
- **Premium handle:** `https://yourbot.morphyagent.com` ($5 one-time reservation)

This is set up during `morphy init`. At startup, Morphy gives the connection about 15 seconds. If the network is down, it keeps retrying in the background and your bot comes online at the same URL as soon as it can connect.

If you used an older version of Morphy with Cloudflare quick or named tunnels, your config is migrated to Morphy Relay automatically when you update. Your bot gets a stable URL instead of a random one.

## Private Network (no tunnel)

If you don't want any public URL, run `morphy init -advanced` and choose "Private Network", or run `morphy tunnel off`. Access Morphy only via:

- Your local network (`http://192.168.x.x:7400`)
- A VPN like Tailscale or WireGuard

## Tunnel commands

| Command | What it does |
|---------|-------------|
| `morphy tunnel status` | Show current tunnel mode and URL |
| `morphy tunnel on` | Switch to Morphy Relay (stable public URL) |
| `morphy tunnel off` | Switch to private network mode (no public URL) |

`morphy tunnel` with no subcommand shows status. Restart Morphy after switching modes.

## Security

Traffic between your machine and Cloudflare's edge travels over an encrypted connection, and each connection is authenticated with a short-lived signed ticket. Remote access is protected by your portal password. If you have 2FA enabled, logging in from a new device requires a 6-digit code from your authenticator app. You can also choose to "trust" a device for 90 days so you don't have to enter the code every time.

## Health monitoring

Morphy pings the relay connection every 15 seconds and treats it as dead after 30 seconds without a reply. A separate watchdog detects laptop sleep and network changes and reconnects immediately on wake. A reconnect is just a redial of the same address, so your URL never changes.
