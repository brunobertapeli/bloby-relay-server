---
title: Configuration
---

# Configuration

Morphy stores its config at `~/.morphy/config.json`. Most settings are set during `morphy init` and onboarding, but you can edit them manually. Morphy keeps an automatic backup at `config.json.bak` and recovers from it if the main file is ever corrupted.

If you use a managed instance, all of this is set up for you on Morphy's servers. You can skip this page unless you are curious.

## Config file

```json
{
  "port": 7400,
  "tunnel": {
    "mode": "relay"
  }
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `port` | Base port for the server | `7400` |
| `tunnel.mode` | `relay` or `off` | `relay` |

`relay` connects your bot through the built-in Morphy carrier. It gives your bot a stable public URL at `<handle>.open.morphyagent.com` with nothing extra to install. `off` means no public URL (private network only). Run `morphy init -advanced` to choose the private option, or `morphy tunnel setup` to change it later. Bots updating from older versions that used cloudflared tunnels are moved to `relay` automatically on restart. Managed instances run with tunnel mode `off` because they are reached directly at `<handle>.morphyagent.com`.

The file also holds blocks you normally never touch: `username` (your handle), `ai` (provider, model, API key), `relay` (your relay token and tier), `channels` (WhatsApp, Telegram, Alexa), and `wallet`. Treat the file as a secret: `wallet` contains the private key of your bot's funded wallet.

## AI provider settings

AI provider, model, and API key are set through the onboarding wizard and saved to the `ai` block of `config.json`. If you sign in with a Claude or OpenAI subscription instead of pasting an API key, the tokens live in the provider's own credential files (`~/.claude/.credentials.json` and `~/.codex/auth.json`) and refresh automatically. You can change provider settings later through the chat by asking Morphy.

## Workspace environment

The workspace backend reads from `workspace/.env` for any custom environment variables your app needs. Changes to `.env` trigger an automatic backend restart.

## Ports

Morphy uses a base port (default 7400) with automatic offsets:

| Service | Port |
|---------|------|
| Supervisor (main) | 7400 |
| Dashboard (dev) | 7402 |
| Workspace backend | 7404 |

You can change the base port in `config.json`, and all offsets adjust automatically. Two environment variables also matter here: `MORPHY_PORT` sets the base port when you run `morphy init`, and `MORPHY_WORKSPACE` relocates the workspace directory.
