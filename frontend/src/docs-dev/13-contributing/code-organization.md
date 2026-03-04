---
title: "Code Organization"
---

Fluxy has a strict separation between four top-level directories, plus a built output directory. Every file should live in exactly one of these areas.

### `supervisor/` -- Orchestration Layer

The supervisor is the entry point and process manager. It:

- Routes HTTP requests to the correct backend (worker, Vite, user backend, static files)
- Manages WebSocket connections for the chat
- Spawns and monitors child processes (worker, Vite, backend, cloudflared)
- Runs the Claude Agent SDK for agent queries
- Runs the PULSE/CRON scheduler

**Rule: The supervisor contains NO business logic and NO database access.** It never imports `better-sqlite3`. All data operations go through HTTP calls to the worker on `localhost:3001`.

Key files:

| File | Role |
|---|---|
| `supervisor/index.ts` | HTTP server, request routing, WebSocket handler, lifecycle management |
| `supervisor/fluxy-agent.ts` | Claude Agent SDK wrapper, system prompt injection, memory file loading |
| `supervisor/worker.ts` | Spawns and monitors the worker child process |
| `supervisor/backend.ts` | Spawns and monitors the user's workspace backend |
| `supervisor/tunnel.ts` | Cloudflare tunnel lifecycle (quick and named) |
| `supervisor/vite-dev.ts` | Vite dev server management |
| `supervisor/scheduler.ts` | PULSE + CRON job runner |
| `supervisor/file-saver.ts` | File attachment storage (images, audio, documents) |
| `supervisor/widget.js` | Chat bubble/iframe injector script (served to the dashboard) |

### `worker/` -- Data Layer

The worker is an Express server that owns the SQLite database and all platform API logic. Every database read and write goes through this process.

**Rule: ALL database operations live here.** The supervisor and chat UI never touch the database directly.

Key files:

| File | Role |
|---|---|
| `worker/index.ts` | Express app with all API route handlers |
| `worker/db.ts` | Database schema, migrations, and all query functions |
| `worker/prompts/fluxy-system-prompt.txt` | The agent's system prompt template |
| `worker/claude-auth.ts` | Claude OAuth flow (browser-based) |
| `worker/codex-auth.ts` | Codex OAuth flow |

### `shared/` -- Cross-Cutting Utilities

Shared modules are imported by both supervisor and worker. They contain **only** configuration, path resolution, logging, and provider abstractions -- nothing process-specific.

| File | Role |
|---|---|
| `shared/config.ts` | `BotConfig` type, `loadConfig()`, `saveConfig()` |
| `shared/paths.ts` | All filesystem paths (`PKG_DIR`, `DATA_DIR`, `WORKSPACE_DIR`, `paths.*`) |
| `shared/logger.ts` | Colorized console logger (`log.info`, `log.warn`, `log.error`, `log.ok`) |
| `shared/ai.ts` | AI provider abstraction (OpenAI, Anthropic, Ollama) |
| `shared/relay.ts` | Relay registration, heartbeats, handle management |

**Rule: Do not put process-specific logic in `shared/`.** If it only makes sense in one process, it belongs in that process's directory.

### `workspace/` -- User-Facing, Agent-Editable Code

This is the "playground" that the AI agent modifies at runtime. It contains the user's dashboard, backend, memory files, and skills.

| Path | Role |
|---|---|
| `workspace/client/` | Dashboard SPA (React + Vite + Tailwind). Root for `vite.config.ts` |
| `workspace/client/src/` | Dashboard source: `App.tsx`, `components/`, `lib/`, `styles/` |
| `workspace/backend/` | User's custom Express server, served at `/app/api/*` |
| `workspace/MYSELF.md` | Agent's self-description (agent-editable) |
| `workspace/MYHUMAN.md` | Notes about the user (agent-editable) |
| `workspace/MEMORY.md` | Long-term memory (agent-editable) |
| `workspace/PULSE.json` | Periodic task configuration |
| `workspace/CRONS.json` | Cron schedule configuration |
| `workspace/skills/` | Skill plugins (Claude Agent SDK plugin format) |

**Rule: The workspace is the agent's domain.** Platform code should not depend on workspace internals. The workspace depends on the platform API (`/api/*`), not the other way around.

### `supervisor/chat/` -- Chat UI (Source)

The chat interface is a separate React SPA that compiles to `dist-fluxy/`. It runs inside an iframe on the dashboard, fully isolated from the main application.

| File | Role |
|---|---|
| `supervisor/chat/fluxy.html` | Chat entry point HTML |
| `supervisor/chat/fluxy-main.tsx` | Chat app bootstrap, WebSocket connection, wizard integration |
| `supervisor/chat/OnboardWizard.tsx` | Setup wizard |
| `supervisor/chat/onboard.html` | Onboarding entry point HTML |
| `supervisor/chat/src/` | Shared components, hooks, and utilities for the chat |
| `supervisor/chat/ARCHITECTURE.md` | Detailed chat architecture documentation |

**Rule: The chat UI is self-contained and crash-isolated from the dashboard.** It has its own React tree, styles, and WebSocket connection. A crash in the chat never takes down the dashboard, and vice versa.

### `dist-fluxy/` -- Built Chat Output

Pre-built static files for the chat SPA. Served by the supervisor at `/fluxy/*`.

**Rule: Never edit `dist-fluxy/` directly.** It is generated by `vite build --config vite.fluxy.config.ts` from `supervisor/chat/`. Run `npm run build:fluxy` to rebuild it.
