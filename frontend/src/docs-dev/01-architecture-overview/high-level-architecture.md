---
title: "High-Level Architecture"
---

```plain
+------------------------------------------------------------------+
|                     USER'S MACHINE                               |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |              SUPERVISOR  (port 7400)                       |  |
|  |              supervisor/index.ts                           |  |
|  |                                                            |  |
|  |   raw http.createServer  +  WebSocketServer (noServer)     |  |
|  |   reverse proxy  |  auth middleware  |  file server        |  |
|  |                                                            |  |
|  |   +---------------+  +----------------+  +--------------+  |  |
|  |   |  SCHEDULER    |  |  MORPHY AGENT  |  |  WORKER      |  |  |
|  |   |  (in-process) |  |  (in-process)  |  | (in-process) |  |  |
|  |   |  scheduler.ts |  |  bloby-agent.ts|  | worker/      |  |  |
|  |   |  60s tick loop|  |  harnesses:    |  |  index.ts    |  |  |
|  |   |  PULSE + CRON |  |  Claude/Codex/ |  | Express +    |  |  |
|  |   |               |  |  Pi            |  | SQLite       |  |  |
|  |   +---------------+  +----------------+  +--------------+  |  |
|  |                                                            |  |
|  |   +---------------+  +----------------------------------+  |  |
|  |   |  VITE DEV     |  |  CARRIER (in-process)            |  |  |
|  |   |  :7402        |  |  relay-tunnel.ts (RelayTunnel)   |  |  |
|  |   |  Dashboard    |  |  one outbound WSS, Ed25519       |  |  |
|  |   |  HMR          |  |  ticket auth                     |  |  |
|  |   +---------------+  +----------------------------------+  |  |
|  +------------------------------------------------------------+  |
|         | spawn                                    |             |
|         v                                          |             |
|  +-----------+                                     |             |
|  |  BACKEND  |                                     |             |
|  |  :7404    |                                     |             |
|  |  User's   |                                     |             |
|  |  Express  |                                     |             |
|  |  server   |                                     |             |
|  +-----------+                                     |             |
+----------------------------------------------------|-------------+
                                                     | outbound WSS
                                                     v
                                       +---------------------------+
                                       | CLOUDFLARE EDGE           |
                                       | Worker + per-bot          |
                                       | Durable Object            |
                                       +---------------------------+
                                          ^                  ^
                          Ed25519 tickets |                  | HTTPS + WS
                          + presence      |                  |
                          +-------------------+   +----------------------------+
                          | MORPHY RELAY      |   | USER'S PHONE / BROWSER     |
                          | api.morphyagent.com    |   | <handle>.open.morphyagent.com   |
                          | (control plane)   |   | <handle>.morphyagent.com (premium)|
                          +-------------------+   +----------------------------+
```

There are no cloudflared processes and no random tunnel URLs. The carrier is an in-process WSS client (`RelayTunnel`) holding one persistent connection to the bot's Durable Object; the edge muxes browser HTTP and WebSocket traffic down that socket, and the supervisor replays it against `127.0.0.1:7400`. A reconnect is a redial of the same Durable Object, so the public URL never changes. The Morphy Relay is a pure control plane (handles, tickets, billing, presence); it is not in the data path.

### Port Allocation

All ports are derived from the configured base port (default `7400`):

| Process    | Port Formula | Default | Source                                         |
| ---------- | ------------ | ------- | ---------------------------------------------- |
| Supervisor | `base`       | 7400    | `supervisor/index.ts`                          |
| Vite Dev   | `base + 2`   | 7402    | `supervisor/vite-dev.ts:startViteDevServers()` |
| Backend    | `base + 4`   | 7404    | `supervisor/backend.ts:getBackendPort()`       |

The worker has no port of its own: its Express app (`worker/index.ts:createWorkerApp()`) is mounted in-process, so `/api/*` requests are handled directly by the supervisor with no proxy hop.

The base port is read from `~/.morphy/config.json` via `shared/config.ts:loadConfig()`.

---
