---
title: "Supervisor"
---

This document provides a comprehensive technical breakdown of the Morphy supervisor
process: the master orchestrator that binds the HTTP server, reverse proxy, WebSocket
layer, backend process management, carrier networking, file persistence, and the
injected chat widget into a single coherent runtime.

**Source files covered:**

| File | Purpose |
|---|---|
| `supervisor/index.ts` | Main supervisor entry point, HTTP server, WS handling, startup/shutdown |
| `worker/index.ts` | Worker API app (`createWorkerApp()`), mounted in-process by the supervisor |
| `supervisor/backend.ts` | User backend child process lifecycle |
| `supervisor/relay-tunnel.ts` | Morphy carrier: persistent outbound WSS to the bot's edge Durable Object |
| `supervisor/vite-dev.ts` | Vite dev server with HMR proxying |
| `supervisor/file-saver.ts` | Attachment persistence to disk |
| `supervisor/widget.js` | Injected iframe chat widget |
