---
title: "Architecture"
---

```
Browser / Relay
      |
      v
  Supervisor  (:3000)  -- proxies /api/* -->  Worker  (:3001)
                                                 |
                                                 v
                                         ~/.bloby/memory.db   (SQLite, WAL mode)
                                         ~/.bloby/config.json  (BotConfig)
                                         ~/.claude/.credentials.json (Claude OAuth)
                                         ~/.codex/codedeck-auth.json (Codex OAuth)
```

### Startup sequence

1. `loadConfig()` reads `~/.bloby/config.json`.
2. `initDb()` opens (or creates) `~/.bloby/memory.db`, runs the schema DDL,
   and executes any pending migrations.
3. `ensureFileDirs()` creates the workspace file directories
   (`workspace/files/audio`, `workspace/files/images`,
   `workspace/files/documents`).
4. `initWebPush()` loads or generates VAPID keys and configures the `web-push`
   library.
5. Express starts listening on the configured port.
6. A `SIGTERM` handler closes the database and HTTP server.
