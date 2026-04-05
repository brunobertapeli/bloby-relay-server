---
title: "Environment Variables"
---

## 5. Environment Variables

### Process environment variables (set by the supervisor)

These are injected into child processes by the supervisor -- you do not set them
manually:

| Variable | Set by | Used by | Value |
|----------|--------|---------|-------|
| `WORKER_PORT` | `supervisor/worker.ts` | `worker/index.ts` | `basePort + 1` (default `3001`) |
| `BACKEND_PORT` | `supervisor/backend.ts` | `workspace/backend/index.ts` | `basePort + 4` (default `3004`) |
| `BLOBY_REAL_HOME` | `bin/cli.js` (sudo re-exec) | `bin/cli.js` | Original user's home directory |
| `BLOBY_NODE_PATH` | `bin/cli.js` (daemon install) | systemd/launchd unit | Absolute path to `node` binary |

### `workspace/.env`

The user backend (`workspace/backend/index.ts`) reads `workspace/.env`
manually -- no `dotenv` dependency. It parses lines in `KEY=VALUE` format,
supporting `#` comments; quoted values have their outer quotes stripped.

This file does not exist by default. Users create it for their own backend
needs:

```env
# Example workspace/.env
DATABASE_URL=sqlite:./app.db
MY_API_KEY=sk-...
DEBUG=true
```

When `workspace/.env` is modified, the supervisor's file watcher detects the
change and auto-restarts the user backend.

### `~/.bloby/config.json`

This is the primary runtime configuration. It is **not** an environment
variable file -- it is JSON read by `shared/config.ts` via `loadConfig()`.

Key fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3000` | Base port for all services |
| `username` | string | `""` | Display name (set during onboarding) |
| `ai.provider` | string | `""` | `"anthropic"`, `"openai"`, or `"ollama"` |
| `ai.model` | string | `""` | Model identifier (e.g. `"claude-sonnet-4-20250514"`) |
| `ai.apiKey` | string | `""` | Provider API key |
| `ai.baseUrl` | string | undefined | Custom API endpoint (for Ollama or proxies) |
| `tunnel.mode` | string | `"quick"` | `"off"`, `"quick"`, or `"named"` |
| `tunnel.name` | string | undefined | Named tunnel identifier |
| `tunnel.domain` | string | undefined | Custom domain for named tunnel |
| `tunnel.configPath` | string | undefined | Path to cloudflared YAML config |
| `relay.token` | string | `""` | Bloby relay server auth token |
| `relay.url` | string | `""` | Public URL via relay (e.g. `https://my.bloby.bot/HANDLE`) |
| `tunnelUrl` | string | undefined | Written at runtime -- current tunnel URL |

---
