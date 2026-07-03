---
title: "Core Framework"
---

Morphy is not a typical Express app. It runs as a **two-process architecture** orchestrated by a supervisor:

```
                 http.createServer (supervisor)
                 /       |          |          \
           Vite HMR   /bloby/*    /api/*     /app/api/*
           (dashboard)  (static)  (worker,     (proxy)
                                 in-process)      |
                                               Backend
                                            (User's app)
```

### The Supervisor (supervisor/index.ts)

- Built on **Node's native `http.createServer`** -- not Express.
- Owns the local port (default 7400, overridable via `MORPHY_PORT`). Self-hosted bots are reached through the **Morphy carrier**: a persistent outbound WSS from `supervisor/relay-tunnel.ts` to the edge, so no local port is ever exposed to the internet.
- Routes requests by URL prefix:
  - `/api/*` -- handled **in-process** by the worker's Express app (no proxy hop, no separate port).
  - `/app/api/*` -- reverse-proxied to the **user's backend** (port + 4).
  - `/bloby/*` -- served as static files from `dist-chat/` (pre-built chat UI).
  - `/bloby/widget.js` -- served directly from `supervisor/widget.js`.
  - `/sw.js` -- service worker served from an embedded string constant.
  - Everything else -- proxied to the **Vite dev server** (dashboard, port + 2, run in-process via the Vite JS API).
- Manages **WebSocket** connections for real-time chat (`/bloby/ws`).
- Spawns and supervises the **user backend** child process (the worker and Vite run in-process).
- Implements a **file watcher** on `workspace/backend/` for auto-restart on code changes.
- Detects **sleep/wake and network changes** and immediately redials the carrier; presence is simply the live carrier socket, with no heartbeats or URL rotation.

### The Worker (worker/index.ts)

- **Express ^5.2.1** HTTP API, exported as `createWorkerApp()`.
- Owns the SQLite database, all REST endpoints, auth, push notifications, and 2FA.
- Mounted **in-process** by the supervisor -- there is no worker child process or dedicated worker port.

### The Backend (workspace/backend/)

- The user's own Express application, spawned by the supervisor as a child process.
- Independently restartable -- the supervisor watches for file changes and auto-restarts.
