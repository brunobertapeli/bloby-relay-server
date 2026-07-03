---
title: "Key Files"
---

| File                          | Purpose                                                          |
|-------------------------------|------------------------------------------------------------------|
| `supervisor/relay-tunnel.ts`  | Morphy Relay carrier client: persistent outbound WSS to the bot's Durable Object, Ed25519 tickets, stream mux/demux to `127.0.0.1:<port>` |
| `shared/relay.ts`             | Relay API client: handle registration/claim/release, carrier ticket minting, disconnect |
| `shared/config.ts`            | Configuration loading/saving, port and tunnel mode definitions, legacy tunnel-config migration |
| `supervisor/index.ts`         | HTTP server, reverse proxy, WebSocket handler, carrier startup and wake/network-change watchdog |
| `supervisor/vite-dev.ts`      | Vite dev server setup, HMR WebSocket attachment                  |
| `worker/index.ts`             | In-process worker API (`createWorkerApp()`), mounted on the supervisor, no separate port |
| `supervisor/backend.ts`       | Backend process management, port offset (`base + 4`)             |
| `shared/paths.ts`             | File paths: package dir, data dir (`~/.morphy`), workspace, files |
| `supervisor/chat/ARCHITECTURE.md` | Chat architecture, POST-over-WebSocket workaround documentation |
