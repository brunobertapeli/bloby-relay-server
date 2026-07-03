---
title: "Agent Autonomy"
---

## 7. Agent Autonomy

### 7.1 The Self-Evolving Workspace

Morphy's workspace is designed from the ground up for agent autonomy. The agent has unrestricted write access to the `workspace/` directory, which contains both the user-facing application (frontend in `client/`, backend in `backend/`) and the agent's own memory and configuration files.

The system prompt (`worker/prompts/bloby-system-prompt.txt`) establishes this concept:

> "Your working directory is the `workspace/` folder. This is your full-stack workspace."

The Claude harness (`supervisor/harnesses/claude.ts`) runs every query with `permissionMode: 'bypassPermissions'`, meaning the agent never needs human approval for file operations or shell commands. This is the foundation of autonomous behavior.

### 7.2 Dashboard Code Modification

The agent can modify the React frontend in `workspace/client/src/`. Changes are reflected immediately thanks to Vite HMR (Hot Module Replacement). The system prompt explicitly tells the agent:

> "NEVER run `npm run build`, `vite build`, or any build commands. Vite HMR handles frontend changes automatically."

The supervisor starts a Vite dev server via `startViteDevServers()` (`supervisor/vite-dev.ts`) and proxies all non-API, non-Morphy requests to it. This means the agent can add a new page, modify a component, or create an entirely new module, and the user sees it live in their browser without any explicit build step.

### 7.3 Backend Code Modification

The agent can modify the Express backend in `workspace/backend/`. The system prompt describes the auto-restart triggers:

> - Editing `.ts`, `.js`, or `.json` files in `backend/` -> auto-restart
> - Editing `.env` -> auto-restart with the new values
> - After your turn ends, if you used Write or Edit tools -> auto-restart

The auto-restart mechanism operates at two levels:

**During an agent turn:** File changes are deferred. The supervisor treats a turn as active when the dashboard's `agentQueryActive` flag is set, a live conversation is busy, or a one-shot query is in flight (`aTurnIsActive()` in `supervisor/index.ts`), and the file watcher then sets `pendingBackendRestart` instead of restarting mid-turn. The restart happens when `bot:turn-complete` fires:

```ts
if (eventData.usedFileTools || pendingBackendRestart) {
  log.info('[orchestrator] Restarting backend (file tools used / pending watcher change)');
  void doRestart();
}
```

`doRestart()` funnels every deliberate restart through `restartBackend()` in `supervisor/backend.ts`, which serializes and coalesces concurrent triggers so the backend can never double-spawn onto a contended port.

**Outside agent turns:** The file watcher triggers a debounced restart (1-second delay) via `scheduleBackendRestart()`. The agent can also restart-and-verify within its own turn via `POST /__bloby/control/restart-backend`, which blocks until the backend port is listening again.

### 7.4 Auto-Rebuild After Changes

Two self-healing file watchers run in the supervisor (`supervisor/index.ts`; both re-arm themselves on watcher errors):

1. **Backend watcher** (`armBackendWatcher()`): Watches `workspace/backend/` recursively for `.ts`, `.js`, and `.json` file changes.

2. **Workspace root watcher** (`armWorkspaceWatcher()`): Watches for:
   - `.env` changes -- triggers backend restart
   - `package.json` / `package-lock.json` changes -- triggers backend restart (covers `npm install` runs that add dependencies without editing code)
   - `.restart` file creation -- deprecated fallback for backend restart (file is auto-deleted); agents now use `POST /__bloby/control/restart-backend`
   - `.update` file creation -- deprecated fallback for self-update (routed through `queueUpdate()`); agents now use `POST /__bloby/control/update`

### 7.5 Scheduled Autonomous Actions

The scheduler (`supervisor/scheduler.ts`) enables the agent to operate without any human interaction.

**Pulse**: A periodic wake-up triggered by `PULSE.json`. When enabled, the scheduler calls `triggerAgent('<PULSE/>', 'pulse')` at the configured interval (default: 30 minutes), respecting quiet hours. The agent is expected to do memory maintenance, check the workspace for problems, and be proactive.

**Cron**: Scheduled tasks defined in `CRONS.json`. The scheduler uses `cron-parser` to evaluate cron expressions against the system clock every 60 seconds. When a cron matches, it calls `triggerAgent()` with a `<CRON>id</CRON>` prompt. If a `tasks/{id}.md` file exists, its content is appended as `<CRON_TASK_DETAIL>`. Crons with `paused: true` (user-controlled via `/api/crons/pause`) neither fire nor advance state.

The `triggerAgent()` function invokes `startBlobyAgentQuery()` as a one-shot query and handles the result when `bot:done` fires:

1. Extracts `<mac_push>` and `<Message>` blocks from the agent's output via `extractOutboundTags()` (`supervisor/outbound.ts`), the same parser and delivery path interactive turns use.
2. Delivers `<mac_push>` blocks to connected Morphy Mac apps via `outbound.deliverMac()`.
3. Delivers `<Message>` blocks via `outbound.deliverChat()`: persists to the chat timeline, syncs live clients, and fires a web-push notification.
4. If file tools were used, restarts the backend.

**One-shot crons**: Crons with `oneShot: true` are automatically removed after they fire. The removal is deferred until the agent completes its turn, so the agent can still read `CRONS.json` during execution. Both the JSON entry and the corresponding `tasks/{id}.md` file are cleaned up.

**Expired one-shot cleanup**: The scheduler also cleans up one-shot crons whose schedule has passed without firing (e.g., if the system was off when the cron was supposed to fire).

### 7.6 Self-Update Mechanism

The agent triggers its own update through the supervisor's control surface (from the system prompt):

```
curl -s -X POST http://127.0.0.1:${SUPERVISOR_PORT:-7400}/__bloby/control/update
```

The endpoint calls `queueUpdate()` in `supervisor/index.ts`: the update is acknowledged, idempotent, and deferred. It runs at the next turn-complete, so the agent's current turn always finishes first. A persisted marker file survives supervisor restarts in the queue-to-flush window, and the agent can verify progress via `GET /__bloby/control/update-status`. (Creating a `.update` file in the workspace still works as a deprecated fallback; the watcher routes it through the same `queueUpdate()` path.)

When the update flushes, `runDeferredUpdate()` spawns `morphy update` as a child process (`bin/cli.js` with `MORPHY_SELF_UPDATE=1`), logging to `update.log`. On success the supervisor relaunches the daemon onto the new version: under systemd it exits so `Restart=on-failure` respawns it, and on macOS it reloads the launchd job. Failed attempts leave the marker in place and retry on the next turn or boot, bounded by an attempt counter.

### 7.7 Message Output from Autonomous Actions

When the agent runs autonomously (via Pulse or Cron), it can send messages to the user using a special `<Message>` XML tag in its response:

```xml
<Message title="Build Error" priority="high">Your markdown message here</Message>
```

The shared outbound parser (`extractOutboundTags()` in `supervisor/outbound.ts`) pulls these blocks out of agent output with a regex:

```ts
/<Message(?:\s+([^>]*))?>([\s\S]*?)<\/Message>/g
```

Each matched message is delivered by `deliverChat()`:

1. Persisted to the chat timeline as an assistant message.
2. Broadcast to all connected clients via `chat:sync`.
3. Sent as a web-push notification (title extracted from the `title` attribute, body truncated to 200 characters).

The same parser also handles `<mac_push>` blocks, which surface as a notch card on a connected Morphy Mac app. Because the parser and delivery are shared with the interactive pipeline, the tags behave identically on every kind of turn.

### 7.8 Sacred Boundaries

Despite its autonomy, the agent is told to never modify certain directories (from the system prompt):

- `supervisor/` -- the chat UI, proxy, and process management
- `worker/` -- platform APIs and database
- `shared/` -- shared utilities
- `bin/` -- CLI entry point

The agent is also told to prefer recoverable operations: "Prefer `trash` over `rm` -- recoverable beats gone forever."

---
