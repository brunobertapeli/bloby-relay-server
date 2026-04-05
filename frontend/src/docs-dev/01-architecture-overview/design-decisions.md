---
title: "Design Decisions"
---

### Why supervisor + worker split (process isolation)?

The supervisor and worker are separate OS processes. The worker owns SQLite and all API logic. The supervisor never touches the database directly -- everything goes through HTTP to `127.0.0.1:3001`.

**Rationale**: If the worker crashes (bad migration, OOM, unhandled exception), the supervisor keeps running. The tunnel stays up. The chat WebSocket stays connected. The user can still talk to Claude. The supervisor auto-restarts the worker up to 3 times.

The same logic applies to the backend: if Claude writes buggy Express code, only the backend process dies. The supervisor, worker, and chat are unaffected.

```plain
                Crash Isolation Boundaries
    +--------------------------------------------------+
    |  SUPERVISOR (port 3000)                           |
    |  - Always alive                                  |
    |  - Chat WebSocket handler                        |
    |  - Tunnel management                             |
    |  - File serving (dist-bloby/)                    |
    |                                                   |
    |    +----------------+  +---------------------+   |
    |    | WORKER (:3001) |  | BACKEND (:3004)     |   |
    |    | Can crash      |  | Can crash            |   |
    |    | independently  |  | independently        |   |
    |    +----------------+  +---------------------+   |
    +--------------------------------------------------+
```

### Why pre-built chat (crash resilience)?

The Bloby chat UI is built at publish time by `vite.bloby.config.ts` and shipped as static files in `dist-bloby/`. The supervisor serves these files directly from disk -- no Vite process, no build step, no dependency on the workspace.

**Rationale**: The chat is the user's lifeline. If Vite crashes, or the workspace frontend throws a runtime error, or the agent introduces a bug in the dashboard code, the chat SPA still loads because it is just static HTML/JS/CSS served by the supervisor.

The chat runs in an iframe injected by `supervisor/widget.js`. The iframe and the dashboard are completely isolated -- different React trees, different build outputs, different error boundaries.

### Why WebSocket for chat instead of HTTP?

The original motivation was a relay bug: `express.json()` middleware consumed POST request bodies before `http-proxy` could forward them. Sending chat messages, settings, and whisper audio over WebSocket bypassed this entirely.

The relay bug has since been fixed (body parser scoped to `/api` routes only), but WebSocket remains as the primary transport because it provides:

1. **Bidirectional streaming** -- Token-by-token response streaming without SSE complexity
2. **Multi-device sync** -- All connected clients receive every event via `broadcastBloby()`
3. **Reconnection state** -- `chat:state` event catches up reconnecting clients with the current stream buffer
4. **Heartbeat detection** -- 25-second ping interval with `pong` response
5. **Defense-in-depth** -- WebSocket messages bypass the relay's HTTP pipeline entirely

### Why bypassPermissions on the agent?

The entire point of Bloby is that the user talks to Claude from their phone while the host machine runs unattended. There is no terminal session to confirm tool usage. Confirmation prompts would make the agent useless in this context.

Safety is enforced by two boundaries:

1. **Directory boundary**: The agent's `cwd` is set to `workspace/`. The system prompt explicitly forbids touching `supervisor/`, `worker/`, `shared/`, or `bin/`.
2. **System prompt**: `worker/prompts/bloby-system-prompt.txt` constrains the agent's behavior.

### Why file-based memory instead of a database?

The Claude Agent SDK has built-in file tools (Read, Write, Edit, Bash, Grep, Glob). Files are the SDK's natural interface. By storing memory as markdown files in the workspace, the agent can manage its own memory using the exact same tools it uses to edit code.

No custom tool was needed. No API integration. The agent reads `MYSELF.md` to know who it is, reads `MYHUMAN.md` to know its user, reads `MEMORY.md` for long-term knowledge, and writes to `memory/YYYY-MM-DD.md` for daily notes. All four files are injected into the system prompt at query time by `supervisor/bloby-agent.ts:readMemoryFiles()`.

```plain
Memory files read at query time:

  MYSELF.md        --> Agent identity and personality
  MYHUMAN.md       --> User profile (agent-maintained)
  MEMORY.md        --> Long-term curated knowledge
  PULSE.json       --> Periodic wake-up config
  CRONS.json       --> Scheduled task definitions
```

### Why two Vite configurations?

The project has two separate SPAs that must be built independently:

| Config                 | Entry                         | Output                        | Serving                             |
| ---------------------- | ----------------------------- | ----------------------------- | ----------------------------------- |
| `vite.config.ts`       | `workspace/client/index.html` | (dev server, no build output) | Vite dev server on `:3002` with HMR |
| `vite.bloby.config.ts` | `supervisor/chat/bloby.html`  | `dist-bloby/`                 | Static files served by supervisor   |

The dashboard (workspace/client) is served via Vite dev server with HMR so the agent's edits show up instantly. The chat SPA (supervisor/chat) is pre-built and served as static files so it survives crashes.

---
