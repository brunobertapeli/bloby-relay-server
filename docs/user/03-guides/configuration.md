---
title: Configuration
---

# Configuration

Bloby stores its config at `~/.bloby/config.json`. Most settings are configured during `bloby init` and onboarding, but you can edit them manually.

## Config file

```json
{
  "port": 3000,
  "tunnel": {
    "mode": "quick"
  }
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `port` | Base port for the server | `3000` |
| `tunnel.mode` | `quick`, `named`, or `off` | `quick` |

## AI provider settings

AI provider, model, and API keys are configured through the onboarding wizard and stored in the database. You can change them later through the chat by asking Bloby.

## Workspace environment

The workspace backend reads from `workspace/.env` for any custom environment variables your app needs. Changes to `.env` trigger an automatic backend restart.

## Ports

Bloby uses a base port (default 3000) with automatic offsets:

| Service | Port |
|---------|------|
| Supervisor (main) | 3000 |
| Worker API | 3001 |
| Dashboard (dev) | 3002 |
| Workspace backend | 3004 |

You can change the base port in `config.json` — all offsets adjust automatically.
