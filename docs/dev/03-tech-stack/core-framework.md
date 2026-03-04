---
title: "Core Framework"
---

Fluxy is not a typical Express app. It uses a **tri-process architecture** orchestrated by a supervisor:

```
                 http.createServer (supervisor)
                 /       |        \          \
           Vite HMR   /fluxy/*   /api/*    /app/api/*
           (dashboard)  (static)  (proxy)   (proxy)
                                    |          |
                              Worker         Backend
                           (Express v5)   (User's app)
```

### The Supervisor (supervisor/index.ts)

- Built on **Node's native `http.createServer`** -- not Express.
- Owns the single public-facing port (default 3000).
- Routes requests by URL prefix:
  - `/api/*` -- reverse-proxied to the **worker** (Express v5, port + 1).
  - `/app/api/*` -- reverse-proxied to the **user's backend** (port + 4).
  - `/fluxy/*` -- served as static files from `dist-fluxy/` (pre-built chat UI).
  - `/fluxy/widget.js` -- served directly from `supervisor/widget.js`.
  - `/sw.js` -- service worker served from an embedded string constant.
  - Everything else -- proxied to the **Vite dev server** (dashboard, port + 2).
- Manages **WebSocket** connections for real-time chat (`/fluxy/ws`).
- Spawns and supervises child processes: worker, backend, tunnel, Vite dev servers.
- Implements a **file watcher** on `workspace/backend/` for auto-restart on code changes.
- Includes a **tunnel watchdog** with sleep/wake detection and periodic health checks.

### The Worker (worker/index.ts)

- **Express ^5.2.1** HTTP API server.
- Owns the SQLite database, all REST endpoints, auth, push notifications, and 2FA.
- Spawned as a child process by the supervisor via tsx.

### The Backend (workspace/backend/)

- The user's own Express application, also spawned by the supervisor.
- Independently restartable -- the supervisor watches for file changes and auto-restarts.
