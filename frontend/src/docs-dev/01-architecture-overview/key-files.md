---
title: "Key Files"
---

All paths are relative to the repository root.

### Core Infrastructure (agent must never modify)

| File                          | Responsibility                                                     |
| ----------------------------- | ------------------------------------------------------------------ |
| `supervisor/index.ts`         | HTTP server, reverse proxy, WebSocket, process orchestration       |
| `supervisor/backend.ts`       | Backend process spawn/stop/restart with crash recovery             |
| `supervisor/relay-tunnel.ts`  | Persistent carrier client: outbound WSS to the bot's edge Durable Object |
| `supervisor/vite-dev.ts`      | Vite dev server startup, HMR attachment to supervisor server       |
| `supervisor/bloby-agent.ts`   | Agent harness dispatcher (routes calls to the active harness by provider) |
| `supervisor/harnesses/`       | Harness implementations: `claude.ts` (Claude Agent SDK), `codex.ts` (Codex app-server), `pi/` |
| `supervisor/channels/`        | Messaging channel adapters (WhatsApp, Telegram, Alexa) + channel manager |
| `supervisor/scheduler.ts`     | PULSE + CRON 60s tick loop, scheduled agent turns, push dispatch   |
| `supervisor/file-saver.ts`    | Attachment storage (audio, images, documents)                      |
| `supervisor/widget.js`        | Chat bubble + slide-out panel injected into dashboard              |
| `worker/index.ts`             | Worker API (`createWorkerApp`, mounted in-process by the supervisor): SQLite, auth, conversations, push |
| `worker/db.ts`                | SQLite schema, CRUD, auto-migrations                               |
| `worker/claude-auth.ts`       | Claude OAuth PKCE, token refresh, Keychain integration             |
| `worker/codex-auth.ts`        | OpenAI OAuth paste-back flow, credentials in `~/.codex/auth.json`  |
| `worker/prompts/prompt-assembler.ts` | Dynamic system prompt assembly for the agent harnesses      |
| `shared/config.ts`            | Load/save `~/.morphy/config.json`, defaults, legacy config migration |
| `shared/paths.ts`             | Path constants: PKG_DIR, DATA_DIR, WORKSPACE_DIR                   |
| `shared/relay.ts`             | Relay API client (handle register/claim/release, carrier tickets, disconnect) |
| `shared/ai.ts`                | AI provider abstraction (Anthropic, OpenAI, Ollama) with streaming |
| `shared/logger.ts`            | Colored console logging with timestamps                            |

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
| `workspace/skills/`          | Skill folders (`SKILL.md` with name+description frontmatter) |
| `workspace/MCP.json`         | MCP server configuration                            |
| `workspace/files/`           | Uploaded file storage (audio/, images/, documents/) |

### Data Locations (on disk)

| Path                       | Contents                                              |
| -------------------------- | ----------------------------------------------------- |
| `~/.morphy/config.json`     | Port, AI provider, tunnel mode, relay token           |
| `~/.morphy/memory.db`       | SQLite -- conversations, messages, settings, sessions |
| `~/.morphy/supervisor.json` | Runtime marker (pid, port, version) the CLI reads to detect a running supervisor |
| `~/.morphy/workspace/`      | User's workspace copy (runtime)                       |

---
