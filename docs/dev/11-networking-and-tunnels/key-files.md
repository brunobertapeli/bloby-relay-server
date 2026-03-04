---
title: "Key Files"
---

| File                          | Purpose                                                          |
|-------------------------------|------------------------------------------------------------------|
| `supervisor/tunnel.ts`        | Cloudflare Tunnel management: install, start, stop, health check |
| `shared/relay.ts`             | Fluxy Relay client: registration, heartbeat, disconnect          |
| `shared/config.ts`            | Configuration loading/saving, port and tunnel mode definitions   |
| `supervisor/index.ts`         | HTTP server, reverse proxy, WebSocket handler, tunnel watchdog   |
| `supervisor/vite-dev.ts`      | Vite dev server setup, HMR WebSocket attachment                  |
| `supervisor/worker.ts`        | Worker process management, port offset (`base + 1`)              |
| `supervisor/backend.ts`       | Backend process management, port offset (`base + 4`)             |
| `shared/paths.ts`             | File paths including `cloudflared` binary location               |
| `supervisor/chat/ARCHITECTURE.md` | Chat architecture, relay POST workaround documentation      |
