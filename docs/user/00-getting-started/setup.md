---
title: Setup (bloby init)
---

# Setup (bloby init)

After installing, run:

```bash
bloby init
```

This is the one-time setup that gets Bloby running. Here's what happens step by step.

## 1. Tunnel mode

You'll be asked how you want to access Bloby remotely. Use the arrow keys to pick one:

| Mode | What it does |
|------|-------------|
| **Quick Tunnel** | Gives you a random public URL instantly. No account needed. Best for most users. |
| **Named Tunnel** | Uses your own domain via Cloudflare. Permanent URL, requires a Cloudflare account. |
| **Private Network** | No public URL. Access only via your local network or VPN (Tailscale, WireGuard, etc). |

Most people should start with **Quick Tunnel**. You can change it later.

## 2. What happens next

After you pick a tunnel mode, Bloby runs through these steps automatically:

1. Creates your config file
2. Downloads the Cloudflare tunnel binary (if using a tunnel)
3. Starts the server
4. Connects the tunnel
5. Verifies the connection
6. Sets up the dashboard
7. Installs the daemon (macOS/Linux) so Bloby starts automatically

## 3. Named tunnel setup

If you chose **Named Tunnel**, you'll go through an extra setup:

1. Log in to your Cloudflare account (opens a browser)
2. A tunnel is created and linked to your account
3. You'll see DNS instructions — add a CNAME record pointing to your tunnel
4. Once DNS propagates, your domain points to Bloby

## 4. Done

When init finishes, your workspace opens at `localhost:3000`. The chat bubble in the bottom-right corner is where you'll complete the onboarding wizard.
