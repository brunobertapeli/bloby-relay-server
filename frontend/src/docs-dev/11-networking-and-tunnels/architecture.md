---
title: "Network Architecture"
---

Fluxy runs entirely on the user's local machine. The supervisor process (`supervisor/index.ts`) is the single point of entry -- it listens on one port and proxies traffic to the internal services. To make this local server reachable from the public internet, Fluxy creates a Cloudflare Tunnel, which establishes an outbound connection from the local machine to Cloudflare's edge network. No inbound ports need to be opened on the firewall.

The full network topology, from the browser to the local services, looks like this:

```
Browser (HTTPS)
  |
  v
Fluxy Relay (optional)            -- username.fluxy.bot
  OR Cloudflare Edge              -- *.trycloudflare.com or custom domain
  |
  |  Cloudflare Tunnel (outbound from local machine)
  v
Supervisor (localhost:3000)       -- HTTP server, reverse proxy
  |
  |--- /api/*         --> Worker      (localhost:3001)  -- DB, settings, AI providers
  |--- /app/api/*     --> Backend     (localhost:3004)  -- user's application backend
  |--- /* (default)   --> Vite        (localhost:3002)  -- dashboard dev server
  |--- /fluxy/*       --> static      (dist-fluxy/)     -- pre-built chat UI
  |--- /fluxy/ws      --> WebSocket   (in-process)      -- Fluxy chat
```

TLS terminates at the Cloudflare edge. All local traffic between the supervisor, worker, backend, and Vite dev server is plain HTTP over the loopback interface (`127.0.0.1`).
