---
title: "High-Level Architecture"
---

```plain
+------------------------------------------------------------------+
|                     USER'S MACHINE                               |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |              SUPERVISOR  (port 3000)                       |  |
|  |              supervisor/index.ts                           |  |
|  |                                                            |  |
|  |   raw http.createServer  +  WebSocketServer (noServer)     |  |
|  |   reverse proxy  |  auth middleware  |  file server        |  |
|  |                                                            |  |
|  |   +------------------+    +----------------------------+   |  |
|  |   |   SCHEDULER      |    |   BLOBY AGENT              |   |  |
|  |   |   (in-process)   |    |   (in-process)             |   |  |
|  |   |   scheduler.ts   |    |   bloby-agent.ts           |   |  |
|  |   |   60s tick loop  |    |   Claude Agent SDK         |   |  |
|  |   |   PULSE + CRON   |    |   query() with tools       |   |  |
|  |   +------------------+    +----------------------------+   |  |
|  +------------------------------------------------------------+  |
|         |              |              |              |           |
|         | spawn        | spawn        | spawn        | spawn     |
|         v              v              v              v           |
|  +-----------+  +------------+  +-----------+  +-------------+   |
|  |  WORKER   |  |  VITE DEV  |  |  BACKEND  |  | cloudflared |   |
|  |  :3001    |  |  :3002     |  |  :3004    |  | (tunnel)    |   |
|  |           |  |            |  |           |  |             |   |
|  | Express   |  | Dashboard  |  | User's    |  | Quick or    |   |
|  | SQLite    |  | HMR        |  | Express   |  | Named       |   |
|  | Auth      |  | React+Vite |  | server    |  | tunnel      |   |
|  | API       |  |            |  |           |  |             |   |
|  +-----------+  +------------+  +-----------+  +-------------+   |
|                                                       |          |
+-------------------------------------------------------|----------+
                                                        |
                                                        | HTTPS
                                                        v
                                              +-------------------+
                                              | CLOUDFLARE EDGE   |
                                              +-------------------+
                                                        |
                                    +-------------------|---+
                                    |                       |
                                    v                       v
                          +----------------+     +-------------------+
                          | BLOBY RELAY    |     | DIRECT ACCESS     |
                          | api.bloby.bot  |     | *.trycloudflare   |
                          | (optional)     |     | or user's domain  |
                          +----------------+     +-------------------+
                                    |
                                    v
                            +---------------+
                            | USER'S PHONE  |
                            | / BROWSER     |
                            +---------------+
```

### Port Allocation

All ports are derived from the configured base port (default `3000`):

| Process    | Port Formula | Default | Source                                         |
| ---------- | ------------ | ------- | ---------------------------------------------- |
| Supervisor | `base`       | 3000    | `supervisor/index.ts`                          |
| Worker     | `base + 1`   | 3001    | `supervisor/worker.ts:getWorkerPort()`         |
| Vite Dev   | `base + 2`   | 3002    | `supervisor/vite-dev.ts:startViteDevServers()` |
| Backend    | `base + 4`   | 3004    | `supervisor/backend.ts:getBackendPort()`       |

The base port is read from `~/.bloby/config.json` via `shared/config.ts:loadConfig()`.

---
