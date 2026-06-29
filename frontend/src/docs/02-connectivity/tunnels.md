---
title: Tunnels & Remote Access
---

# Tunnels & Remote Access

Morphy runs on your machine, but you can access it from anywhere using tunnels.

## Quick Tunnel (default)

Zero configuration. Morphy spins up a Cloudflare tunnel automatically and gives you a public URL.

- **No account needed** — works out of the box
- **Random URL** — changes every time Morphy restarts (e.g., `random-words.trycloudflare.com`)
- **Pair with Morphy Relay** for a permanent, memorable URL

This is set up during `morphy init`. Nothing to configure.

## Named Tunnel

Use your own domain for a permanent, branded URL.

### Setup

Run the tunnel setup:

```bash
morphy tunnel setup
```

This walks you through:
1. Logging into your Cloudflare account
2. Creating a tunnel
3. Getting DNS instructions (add a CNAME record)

Once DNS propagates, your domain points directly to your Morphy instance.

### Requirements

- A Cloudflare account (free)
- A domain managed by Cloudflare

## Private Network (no tunnel)

If you don't want any public URL, choose "Private Network" during `morphy init`. Access Morphy only via:

- Your local network (`http://192.168.x.x:3000`)
- A VPN like Tailscale or WireGuard

## Tunnel commands

| Command | What it does |
|---------|-------------|
| `morphy tunnel setup` | Interactive named tunnel setup |
| `morphy tunnel status` | Show current tunnel mode and URL |
| `morphy tunnel reset` | Switch back to quick tunnel mode |

## Security

All tunnel traffic is encrypted through Cloudflare. Remote access is protected by your portal password. If you have 2FA enabled, logging in from a new device requires a 6-digit code from your authenticator app. You can also choose to "trust" a device for 90 days so you don't have to enter the code every time.

## Health monitoring

Morphy checks tunnel health every 30 seconds. If the tunnel dies (laptop sleep, network change, etc.), it automatically restarts and reconnects. For quick tunnels, a new URL is generated and the relay is updated.
