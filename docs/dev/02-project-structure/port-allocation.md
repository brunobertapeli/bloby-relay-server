---
title: "Port Allocation"
---

All ports are derived from a single `basePort` (default 3000, configurable in `config.json`):

| Port                  | Service                                   | Module                       |
| --------------------- | ----------------------------------------- | ---------------------------- |
| `basePort` (3000)     | Supervisor HTTP + WebSocket server        | `supervisor/index.ts`        |
| `basePort + 1` (3001) | Worker API (Express)                      | `worker/index.ts`            |
| `basePort + 2` (3002) | Vite dev server (dashboard HMR, dev only) | `supervisor/vite-dev.ts`     |
| `basePort + 4` (3004) | User backend (Express)                    | `workspace/backend/index.ts` |

---
