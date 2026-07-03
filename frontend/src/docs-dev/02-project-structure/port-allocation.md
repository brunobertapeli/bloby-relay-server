---
title: "Port Allocation"
---

All ports are derived from a single `basePort` (default 7400, configurable in `config.json`):

| Port                  | Service                                   | Module                       |
| --------------------- | ----------------------------------------- | ---------------------------- |
| `basePort` (7400)     | Supervisor HTTP + WebSocket server        | `supervisor/index.ts`        |
| `basePort + 2` (7402) | Vite dev server (dashboard HMR, dev only) | `supervisor/vite-dev.ts`     |
| `basePort + 4` (7404) | User backend (Express)                    | `workspace/backend/index.ts` |

The worker API has no port of its own. `worker/index.ts` exports `createWorkerApp()`, which the supervisor mounts in-process, so `/api/*` requests are served directly on `basePort` with no extra process and no proxy hop.

---
