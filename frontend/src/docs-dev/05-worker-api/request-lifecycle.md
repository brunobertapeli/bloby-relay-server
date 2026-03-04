---
title: "Request Lifecycle"
---

A typical API request follows this path:

```
1. HTTP request arrives at Supervisor (:3000)
   |
   v
2. Supervisor proxies /api/* to Worker (:3001)
   |
   v
3. Express JSON body parser (limit: 10mb)
   |
   v
4. Cache-Control middleware (sets no-cache headers)
   |
   v
5. Route handler matched
   |  - Inline auth checks (if required by the route)
   |  - Request validation (missing params -> 400)
   |  - Business logic
   |
   v
6. Database operation (synchronous, better-sqlite3)
   |  - Queries execute on the main thread (no async)
   |  - WAL mode allows concurrent reads
   |
   v
7. JSON response sent
```

### Key architectural decisions

- **Synchronous database**: `better-sqlite3` operations are synchronous.
  This means database queries block the event loop, but for a single-user
  self-hosted application, this is acceptable and avoids callback complexity.

- **No authentication middleware**: Routes are individually responsible for
  checking auth. This is intentional -- many routes (health, conversations,
  settings) are called internally by the supervisor process over localhost
  and do not need authentication. The portal login routes and TOTP routes
  handle their own auth inline.

- **Config vs. Settings duality**: The system has TWO configuration stores:
  - `config.json` (`BotConfig`): File-based, holds AI provider credentials,
    tunnel config, relay tokens. Read/written via `loadConfig()`/`saveConfig()`.
  - `settings` table (SQLite): Database-based, holds user preferences, portal
    credentials, VAPID keys, TOTP secrets. Read/written via
    `getSetting()`/`setSetting()`.

  This split exists because `config.json` is needed by the supervisor before
  the database is available, while settings are Worker-specific state.

- **No CORS headers**: The Worker does not set CORS headers because it is
  only accessed via the supervisor's reverse proxy on the same origin, or
  directly over localhost.

- **VAPID key persistence**: The VAPID keypair is generated once and stored
  in the settings table. It persists across restarts. The `mailto:` contact
  for VAPID is hardcoded to `push@fluxy.bot`.
