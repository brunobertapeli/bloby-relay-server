---
title: Morphy Relay
---

# Morphy Relay

The Morphy Relay is how a self-hosted bot gets its public URL. Your bot opens one persistent, encrypted connection out to Cloudflare's edge, and visitors reach it through that connection. Your URL comes from your handle, so it never changes.

Managed bots don't use the relay. They run on their own server and are reached directly at their address, so nothing on this page applies to them.

## How it works

1. You register a handle during onboarding. Your bot's URL is derived from it, so a handle is required for any public URL.
2. Your bot dials out to Cloudflare and holds a persistent connection open. Each dial is authenticated with a short-lived signed ticket.
3. When someone visits your URL, Cloudflare's edge passes the request down that connection to the Morphy server on your machine.

```
Your phone → username.open.morphyagent.com → Cloudflare edge → persistent connection → Your machine
```

Because the connection goes outbound from your machine, you never open ports or touch your router.

If your machine sleeps or changes networks, the bot just redials the same endpoint. The connection is checked with a ping every 15 seconds, and a wake watchdog forces an immediate redial on resume. Your URL stays the same through all of it.

You can change your handle later from the app. The old handle is released, the new one is registered, and the connection moves to the new address.

## URL tiers

| Tier | URL format | Cost |
|------|-----------|------|
| **Free** | `username.open.morphyagent.com` | Free |
| **Premium** | `username.morphyagent.com` | $5 one-time |

The short forms `morphyagent.com/username` and `open.morphyagent.com/username` redirect to the matching URL above.

## When do you need it?

The relay is the default, and it's the only way to give a self-hosted bot a public URL. During onboarding you choose between two modes:

- **Morphy Relay** (recommended, the default): your bot gets a public URL from its handle.
- **Private Network**: no public URL at all. You reach your bot over your local network or a VPN like Tailscale or WireGuard.

## Offline detection

Presence follows the live connection. There are no heartbeats. Your bot is marked online the moment its connection is up, and marked offline when it drops.

During a brief drop, visitors see a branded reconnecting page for a short grace window (up to about 25 seconds) while your bot redials. If it doesn't come back, they see a friendly offline page instead.
