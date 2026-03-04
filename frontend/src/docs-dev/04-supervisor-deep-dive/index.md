---
title: "Supervisor"
---

This document provides a comprehensive technical breakdown of the Fluxy supervisor
process: the master orchestrator that binds the HTTP server, reverse proxy, WebSocket
layer, child process management, tunnel networking, file persistence, and the
injected chat widget into a single coherent runtime.

**Source files covered:**

| File | Purpose |
|---|---|
| `supervisor/index.ts` | Main supervisor entry point, HTTP server, WS handling, startup/shutdown |
| `supervisor/worker.ts` | Worker (API server) child process lifecycle |
| `supervisor/backend.ts` | User backend child process lifecycle |
| `supervisor/tunnel.ts` | Cloudflare Tunnel management (quick + named modes) |
| `supervisor/vite-dev.ts` | Vite dev server with HMR proxying |
| `supervisor/file-saver.ts` | Attachment persistence to disk |
| `supervisor/widget.js` | Injected iframe chat widget |
