---
title: Quick Reference
---

**Processes and ports (default base=7400):**

```plain
Supervisor  :7400  -- HTTP server, reverse proxy, WebSocket, process orchestrator
Vite Dev    :7402  -- Dashboard HMR (dev mode only)
Backend     :7404  -- User's custom Express server
```

The worker (Express API, SQLite database, auth) runs in-process inside the supervisor, mounted from `worker/index.ts` (`createWorkerApp()`), so it has no port of its own.

**Key directories:**

```plain
bin/            CLI entry point (morphy init/start/stop/status)
supervisor/     Master process, chat UI source, agent harnesses, scheduler, carrier client
worker/         Data layer, API routes, OAuth, database (runs in-process in the supervisor)
shared/         Cross-cutting utilities (config, paths, relay, AI, logger)
workspace/      Agent-editable workspace (dashboard, backend, memory, skills)
scripts/        Installation scripts (bash, PowerShell, postinstall)
dist-chat/      Pre-built chat UI (do not edit directly)
```

**Runtime data:**

```plain
~/.morphy/config.json    User configuration
~/.morphy/memory.db      SQLite database
~/.morphy/workspace/     Deployed workspace copy
```
