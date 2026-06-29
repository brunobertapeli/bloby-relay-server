---
title: Morphy Relay
---

# Morphy Relay

The Morphy Relay gives you a permanent, memorable URL — even when using Quick Tunnel (which generates random URLs on every restart).

## How it works

1. You register a username during onboarding (or later via settings)
2. Morphy sends heartbeats to the relay server every 30 seconds
3. When someone visits your relay URL, the relay proxies the request to your current tunnel URL

```
Your phone → morphyagent.com/username → Relay → Quick Tunnel → Your machine
```

## URL tiers

| Tier | URL format | Cost |
|------|-----------|------|
| **Free** | `username.open.morphyagent.com` | Free |
| **Premium** | `morphyagent.com/username` | $3 one-time |

## When do you need it?

- **Quick Tunnel users** — Yes, strongly recommended. Without the relay, your URL changes every restart.
- **Named Tunnel users** — No, you already have a permanent domain.
- **Private Network users** — No, there's no public URL to relay.

## Offline detection

If Morphy stops sending heartbeats for 2 minutes, the relay marks your bot as offline and shows a friendly offline page to visitors.
