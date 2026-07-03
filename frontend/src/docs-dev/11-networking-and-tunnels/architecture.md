---
title: "Network Architecture"
---

Morphy runs entirely on the user's local machine. The supervisor process (`supervisor/index.ts`) is the single point of entry -- it listens on one port (default `7400`) and routes traffic to the internal services. To make this local server reachable from the public internet, Morphy opens a persistent outbound WebSocket carrier (`supervisor/relay-tunnel.ts`) to the Cloudflare edge, where a Worker and a per-bot Durable Object multiplex browser traffic down the carrier to the local machine. No inbound ports need to be opened on the firewall.

The full network topology, from the browser to the local services, looks like this:

```
Browser (HTTPS)
  |
  v
Cloudflare Edge (Worker + per-bot Durable Object)
  -- username.open.morphyagent.com (standard)
  -- username.morphyagent.com (premium)
  |
  |  Persistent WSS carrier (outbound from local machine)
  v
Supervisor (localhost:7400)       -- HTTP server, router
  |
  |--- /api/*         --> Worker      (in-process)       -- DB, settings, AI providers
  |--- /app/api/*     --> Backend     (localhost:7404)   -- user's application backend
  |--- /* (default)   --> Vite        (localhost:7402)   -- dashboard dev server
  |--- /bloby/*       --> static      (dist-chat/)       -- pre-built chat UI
  |--- /bloby/ws      --> WebSocket   (in-process)       -- Morphy chat
```

TLS terminates at the Cloudflare edge. The worker API (`worker/index.ts`, mounted via `createWorkerApp()`) runs inside the supervisor process, so `/api/*` requests never cross a port boundary. All local traffic between the supervisor, the user's backend, and the Vite dev server is plain HTTP over the loopback interface (`127.0.0.1`).

The Morphy Relay (`api.morphyagent.com`) is a control plane only: it registers handles and mints the short-lived tickets the carrier authenticates with. It does not sit in the data path. Managed bots run with `tunnel.mode: 'off'` and are reached directly, with no carrier.
