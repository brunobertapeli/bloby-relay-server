---
title: Quick Reference
---

**Processes and ports (default base=3000):**

```plain
Supervisor  :3000  -- HTTP reverse proxy, WebSocket, process orchestrator
Worker      :3001  -- Express API, SQLite database, auth
Vite Dev    :3002  -- Dashboard HMR (dev mode only)
Backend     :3004  -- User's custom Express server
```

**Key directories:**

```plain
bin/            CLI entry point (fluxy init/start/stop/status)
supervisor/     Master process, chat UI source, agent, scheduler
worker/         Data layer, API routes, OAuth, database
shared/         Cross-cutting utilities (config, paths, relay, AI, logger)
workspace/      Agent-editable workspace (dashboard, backend, memory, skills)
scripts/        Installation scripts (bash, PowerShell, postinstall)
dist-fluxy/     Pre-built chat UI (do not edit directly)
```

**Runtime data:**

```plain
~/.fluxy/config.json    User configuration
~/.fluxy/memory.db      SQLite database
~/.fluxy/workspace/     Deployed workspace copy
```
