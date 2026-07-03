---
title: "Request Lifecycle"
---

A typical API request follows this path:

```
1. HTTP request arrives at the Supervisor's HTTP server (default :7400)
   |  - Directly over localhost, or replayed onto 127.0.0.1 by the Morphy
   |    relay carrier (supervisor/relay-tunnel.ts) for remote traffic
   |
   v
2. Supervisor auth gate for /api/*
   |  - Internal supervisor calls carry a per-process x-internal secret
   |  - Otherwise, once a portal password is set, a valid Bearer token is
   |    required for every route outside the public pre-login allowlist
   |
   v
3. Request handed to the in-process Worker Express app (createWorkerApp())
   |
   v
4. Express JSON body parser (limit: 10mb)
   |
   v
5. Cache-Control middleware (sets no-store headers)
   |
   v
6. Route handler matched
   |  - Inline auth checks on self-protected routes (portal login, TOTP)
   |  - Request validation (missing params -> 400)
   |  - Business logic
   |
   v
7. Database operation (synchronous, better-sqlite3)
   |  - Queries execute on the main thread (no async)
   |  - WAL mode allows concurrent reads
   |
   v
8. JSON response sent
```

### Key architectural decisions

- **In-process Worker**: `worker/index.ts` exports `createWorkerApp()`, which
  the supervisor mounts inside its own process. There is no separate worker
  port, child process, or proxy hop for `/api/*`.

- **Synchronous database**: `better-sqlite3` operations are synchronous.
  This means database queries block the event loop, but for a single-user
  self-hosted application, this is acceptable and avoids callback complexity.

- **Secure-by-default auth gate**: The supervisor gates `/api/*` before the
  Worker app ever sees the request. Once a portal password is set, EVERY
  route requires a valid Bearer token except a small pre-login allowlist
  (health, login, TOTP login, onboarding status, non-secret settings).
  Internal supervisor calls authenticate with an `x-internal` secret
  generated per process at startup. Sensitive routes (portal login, TOTP
  setup/disable) additionally handle their own checks inline.

- **Config vs. Settings duality**: The system has TWO configuration stores:
  - `config.json` (`BotConfig`): File-based, holds AI provider credentials,
    tunnel config, the relay token. Read/written via `loadConfig()`/`saveConfig()`.
  - `settings` table (SQLite): Database-based, holds user preferences, portal
    credentials, VAPID keys, TOTP secrets. Read/written via
    `getSetting()`/`setSetting()`.

  This split exists because `config.json` is needed by the supervisor before
  the database is available, while settings are Worker-specific state.

- **No CORS headers**: The Worker does not set CORS headers because it is
  served from the same origin as the dashboard and chat UI, whether reached
  over localhost or through the bot's Morphy relay hostname. No cross-origin
  requests exist.

- **VAPID key persistence**: The VAPID keypair is generated once and stored
  in the settings table. It persists across restarts. The `mailto:` contact
  for VAPID is hardcoded to `push@morphyagent.com`.
