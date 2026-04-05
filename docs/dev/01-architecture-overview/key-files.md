---
title: "Key Files"
---

All paths are relative to the repository root.

### Core Infrastructure (agent must never modify)

| File                        | Responsibility                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| `supervisor/index.ts`       | HTTP server, reverse proxy, WebSocket, process orchestration       |
| `supervisor/worker.ts`      | Worker process spawn/stop/restart with crash recovery              |
| `supervisor/backend.ts`     | Backend process spawn/stop/restart with crash recovery             |
| `supervisor/tunnel.ts`      | Cloudflare tunnel lifecycle (quick + named), binary management     |
| `supervisor/vite-dev.ts`    | Vite dev server startup, HMR attachment to supervisor server       |
| `supervisor/bloby-agent.ts` | Claude Agent SDK wrapper, memory injection, session management     |
| `supervisor/scheduler.ts`   | PULSE + CRON 60s tick loop, push notification dispatch             |
| `supervisor/file-saver.ts`  | Attachment storage (audio, images, documents)                      |
| `supervisor/widget.js`      | Chat bubble + slide-out panel injected into dashboard              |
| `worker/index.ts`           | Express API server, SQLite, auth, conversations, push              |
| `worker/db.ts`              | SQLite schema, CRUD, auto-migrations                               |
| `worker/claude-auth.ts`     | Claude OAuth PKCE, token refresh, Keychain integration             |
| `shared/config.ts`          | Load/save `~/.bloby/config.json`                                   |
| `shared/paths.ts`           | Path constants: PKG_DIR, DATA_DIR, WORKSPACE_DIR                   |
| `shared/relay.ts`           | Relay API client (register, heartbeat, disconnect, tunnel update)  |
| `shared/ai.ts`              | AI provider abstraction (Anthropic, OpenAI, Ollama) with streaming |
| `shared/logger.ts`          | Colored console logging with timestamps                            |

### Workspace (agent can freely modify)

| File                         | Responsibility                                      |
| ---------------------------- | --------------------------------------------------- |
| `workspace/client/`          | React + Vite + Tailwind dashboard (served via HMR)  |
| `workspace/backend/index.ts` | User's custom Express server template               |
| `workspace/.env`             | Environment variables for the backend               |
| `workspace/MYSELF.md`        | Agent identity and personality                      |
| `workspace/MYHUMAN.md`       | User profile (agent-maintained)                     |
| `workspace/MEMORY.md`        | Long-term curated knowledge                         |
| `workspace/memory/`          | Daily notes (`YYYY-MM-DD.md`, append-only)          |
| `workspace/PULSE.json`       | Periodic wake-up configuration                      |
| `workspace/CRONS.json`       | Scheduled task definitions                          |
| `workspace/skills/`          | Plugin directories (`.claude-plugin/plugin.json`)   |
| `workspace/MCP.json`         | MCP server configuration                            |
| `workspace/files/`           | Uploaded file storage (audio/, images/, documents/) |

### Data Locations (on disk)

| Path                       | Contents                                              |
| -------------------------- | ----------------------------------------------------- |
| `~/.bloby/config.json`     | Port, AI provider, tunnel mode, relay token           |
| `~/.bloby/memory.db`       | SQLite -- conversations, messages, settings, sessions |
| `~/.bloby/bin/cloudflared` | Cloudflare tunnel binary                              |
| `~/.bloby/workspace/`      | User's workspace copy (runtime)                       |

---
