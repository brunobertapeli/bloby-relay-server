---
title: "Architecture"
---

```
Browser / Morphy Relay carrier
      |
      v
  Supervisor  (:7400 by default)  -- auth gate, then in-process dispatch of /api/*
      |
      v
  Worker Express app  (createWorkerApp() in worker/index.ts)
      |
      v
  ~/.morphy/memory.db           (SQLite, WAL mode)
  ~/.morphy/config.json         (BotConfig)
  ~/.claude/.credentials.json   (Claude OAuth)
  ~/.codex/auth.json            (Codex OAuth; a legacy codedeck-auth.json is auto-migrated on read)
```

The worker is not a separate process and has no port of its own.
`createWorkerApp()` builds an Express app that the supervisor mounts
in-process: every `/api/*` request passes the supervisor's auth gate and is
then handed straight to the worker app, with no proxy hop.

### Startup sequence

1. The supervisor's `loadConfig()` reads `~/.morphy/config.json` (running
   any pending config migrations).
2. The supervisor calls `createWorkerApp()`, which runs:
   - `initDb()` opens (or creates) `~/.morphy/memory.db`, runs the schema
     DDL, and executes any pending schema migrations.
   - `ensureFileDirs()` creates the workspace file directories
     (`workspace/files/audio`, `workspace/files/images`,
     `workspace/files/documents`).
   - `initWebPush()` loads or generates VAPID keys and configures the
     `web-push` library.
3. The supervisor's HTTP server starts listening on the configured port
   (default 7400) and dispatches `/api/*` requests to the worker app.
4. The supervisor's `SIGINT`/`SIGTERM` shutdown handler calls `closeDb()`
   and closes the HTTP server as part of its teardown.
