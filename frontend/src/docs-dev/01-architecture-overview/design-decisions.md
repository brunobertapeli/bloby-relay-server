---
title: "Design Decisions"
---

### Why the worker runs in-process (and the backend does not)?

The worker owns SQLite and all `/api` logic, but it is not a separate OS process. `worker/index.ts` exports `createWorkerApp()`, which the supervisor mounts on its own HTTP server -- `workerApi()` calls in `supervisor/index.ts` are loopback requests to `127.0.0.1:<port>` (default `7400`) handled in-process. Earlier releases ran the worker as a child process on its own port with crash-restart machinery; that split was removed: one process, one port, no proxy hop for `/api/*`.

**Rationale**: Process isolation is reserved for the code that actually crashes in the field: the user's generated backend. Worker code ships with the package and is identical on every install, so a crash there is a bug to fix, not a fault to firewall -- the extra process bought only latency and lifecycle code. The backend is different: if the agent writes buggy Express code, only the backend child process dies. The supervisor (chat WebSocket, tunnel carrier, worker API) keeps running and restarts it.

```plain
                Crash Isolation Boundaries
    +--------------------------------------------------+
    |  SUPERVISOR (port 7400)                          |
    |  - Always alive                                  |
    |  - Chat WebSocket handler                        |
    |  - Carrier tunnel (relay-tunnel.ts)              |
    |  - Worker API + SQLite (in-process)              |
    |  - File serving (dist-chat/)                     |
    |                                                  |
    |    +---------------------+                       |
    |    | BACKEND (:7404)     |                       |
    |    | Child process       |                       |
    |    | Can crash           |                       |
    |    | independently       |                       |
    |    +---------------------+                       |
    +--------------------------------------------------+
```

### Why pre-built chat (crash resilience)?

The Morphy chat UI is built at publish time by `vite.chat.config.ts` and shipped as static files in `dist-chat/`. The supervisor serves these files directly from disk -- no Vite process, no build step, no dependency on the workspace.

**Rationale**: The chat is the user's lifeline. If Vite crashes, or the workspace frontend throws a runtime error, or the agent introduces a bug in the dashboard code, the chat SPA still loads because it is just static HTML/JS/CSS served by the supervisor.

The chat runs in an iframe injected by `supervisor/widget.js`. The iframe and the dashboard are completely isolated -- different React trees, different build outputs, different error boundaries.

### Why WebSocket for chat instead of HTTP?

The original motivation was a relay bug: `express.json()` middleware consumed POST request bodies before `http-proxy` could forward them. Sending chat messages, settings, and whisper audio over WebSocket bypassed this entirely.

That relay proxy no longer exists (self-hosted traffic now rides the Morphy carrier, which forwards opaque frames and never parses request bodies), but WebSocket remains the primary transport because it provides:

1. **Bidirectional streaming** -- Token-by-token response streaming without SSE complexity
2. **Multi-device sync** -- All connected clients receive every event via `broadcastBloby()`
3. **Reconnection state** -- `chat:state` event catches up reconnecting clients with the current stream buffer
4. **Heartbeat detection** -- 30-second ping interval; clients that miss a pong are terminated so half-open sockets get cleaned up
5. **Transport simplicity** -- One persistent socket per client instead of a request pipeline, so chat traffic is immune to any HTTP middleware between phone and supervisor

### Why bypassPermissions on the agent?

The entire point of Morphy is that the user talks to their agent from their phone while the host machine runs unattended. There is no terminal session to confirm tool usage. Confirmation prompts would make the agent useless in this context. (`bypassPermissions` is the Claude Agent SDK setting; the Codex and Pi harnesses run with their equivalent unattended configurations.)

Safety is enforced by two boundaries:

1. **Directory boundary**: The agent's `cwd` is set to `workspace/`. The system prompt explicitly forbids touching `supervisor/`, `worker/`, `shared/`, or `bin/`.
2. **System prompt**: The base prompts in `worker/prompts/` (`bloby-system-prompt.txt` and its `-codex` / `-pi` variants, assembled with dynamic fragments by `prompt-assembler.ts`) constrain the agent's behavior.

### Why file-based memory instead of a database?

The Claude Agent SDK has built-in file tools (Read, Write, Edit, Bash, Grep, Glob). Files are the SDK's natural interface. By storing memory as markdown files in the workspace, the agent can manage its own memory using the exact same tools it uses to edit code.

No custom tool was needed. No API integration. The agent reads `MYSELF.md` to know who it is, reads `MYHUMAN.md` to know its user, reads `MEMORY.md` for long-term knowledge, and writes to `memory/YYYY-MM-DD.md` for daily notes. `MYSELF.md`, `MYHUMAN.md`, and `MEMORY.md` (plus `PULSE.json` and `CRONS.json`) are injected into the system prompt at query time by each harness's `readMemoryFiles()` (`supervisor/harnesses/claude.ts`, `codex.ts`, `pi/`).

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

| Config                 | Entry                                        | Output                        | Serving                                            |
| ---------------------- | -------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `vite.config.ts`       | `workspace/client/index.html`                | (dev server, no build output) | Vite dev server on `:7402` (base port + 2) with HMR |
| `vite.chat.config.ts` | `supervisor/chat/chat.html` (+ `onboard.html`) | `dist-chat/`                 | Static files served by supervisor                  |

The dashboard (workspace/client) is served via Vite dev server with HMR so the agent's edits show up instantly. The chat SPA (supervisor/chat) is pre-built and served as static files so it survives crashes.

---
