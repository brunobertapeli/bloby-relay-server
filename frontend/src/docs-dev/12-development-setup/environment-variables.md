---
title: "Environment Variables"
---

## 5. Environment Variables

### Process environment variables (set by the supervisor)

These are injected into child processes by the supervisor -- you do not set them
manually:

| Variable | Set by | Used by | Value |
|----------|--------|---------|-------|
| `BACKEND_PORT` | `supervisor/backend.ts` | `workspace/backend/index.ts` | `basePort + 4` (default `7404`) |
| `MORPHY_REAL_HOME` | `bin/cli.js` (sudo re-exec) | `bin/cli.js` | Original user's home directory |
| `MORPHY_NODE_PATH` | `bin/cli.js` (daemon install) | systemd/launchd unit | Absolute path to `node` binary |

The worker has no port of its own: `worker/index.ts` exports `createWorkerApp()`
and the supervisor mounts it in-process, so there is no `WORKER_PORT` and no
separate worker process.

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

### `~/.morphy/config.json`

This is the primary runtime configuration. It is **not** an environment
variable file -- it is JSON read by `shared/config.ts` via `loadConfig()`.

Key fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `7400` | Base port for all services (Vite `+2`, backend `+4`) |
| `username` | string | `""` | Display name / handle (set during onboarding) |
| `ai.provider` | string | `""` | `"anthropic"`, `"openai"`, `"ollama"`, or `"pi"` |
| `ai.model` | string | `""` | Model identifier (e.g. `"claude-opus-4-8"`) |
| `ai.apiKey` | string | `""` | Provider API key |
| `ai.baseUrl` | string | undefined | Custom API endpoint (for Ollama or proxies) |
| `tunnel.mode` | string | `"relay"` | `"relay"` (persistent carrier, default) or `"off"` |
| `relay.token` | string | `""` | Morphy relay auth token (mints the carrier's Ed25519 tickets) |
| `relay.tier` | string | `""` | Carrier tier; selects the stable subdomain (open vs premium) |
| `relay.url` | string | `""` | Public URL via relay (e.g. `https://open.morphyagent.com/HANDLE`) |
| `tunnelUrl` | string | undefined | Written once at runtime; the carrier URL is derived and stable (no rotation) |

---
