---
title: "Agent Autonomy"
---

## 7. Agent Autonomy

### 7.1 The Self-Evolving Workspace

Bloby's workspace is designed from the ground up for agent autonomy. The agent has unrestricted write access to the `workspace/` directory, which contains both the user-facing application (frontend in `client/`, backend in `backend/`) and the agent's own memory and configuration files.

The system prompt establishes this concept (line 248-249):

> "Your working directory is the `workspace/` folder. This is your full-stack workspace."

The agent operates with `permissionMode: 'bypassPermissions'` (line 197 of `supervisor/bloby-agent.ts`), meaning it never needs human approval for file operations or shell commands. This is the foundation of autonomous behavior.

### 7.2 Dashboard Code Modification

The agent can modify the React frontend in `workspace/client/src/`. Changes are reflected immediately thanks to Vite HMR (Hot Module Replacement). The system prompt explicitly tells the agent (line 269):

> "NEVER run `npm run build`, `vite build`, or any build commands. Vite HMR handles frontend changes automatically."

The supervisor starts a Vite dev server via `startViteDevServers()` (line 105 of `supervisor/index.ts`) and proxies all non-API, non-Bloby requests to it (lines 340-354). This means the agent can add a new page, modify a component, or create an entirely new module, and the user sees it live in their browser without any explicit build step.

### 7.3 Backend Code Modification

The agent can modify the Express backend in `workspace/backend/`. The system prompt describes the auto-restart triggers (lines 276-279):

> - Editing `.ts`, `.js`, or `.json` files in `backend/` -> auto-restart
> - Editing `.env` -> auto-restart with the new values
> - Creating a `.restart` file -> force restart

The auto-restart mechanism operates at two levels:

**During an agent turn:** File changes are deferred. The `agentQueryActive` flag (line 678 of `supervisor/index.ts`) prevents the file watcher from triggering a restart mid-turn. Instead, `pendingBackendRestart` is set to `true` (line 739), and the restart happens when `bot:done` fires (lines 544-549).

```ts
if (eventData.usedFileTools || pendingBackendRestart) {
  pendingBackendRestart = false;
  resetBackendRestarts();
  stopBackend().then(() => spawnBackend(backendPort));
}
```

**Outside agent turns:** The file watcher triggers a debounced restart (1-second delay) via `scheduleBackendRestart()` (lines 736-749).

### 7.4 Auto-Rebuild After Changes

Two file watchers run in the supervisor:

1. **Backend watcher** (`supervisor/index.ts`, line 752): Watches `workspace/backend/` recursively for `.ts`, `.js`, and `.json` file changes.

2. **Workspace root watcher** (line 758): Watches for:
   - `.env` changes -- triggers backend restart
   - `.restart` file creation -- triggers backend restart (file is auto-deleted)
   - `.update` file creation -- triggers a deferred self-update process

### 7.5 Scheduled Autonomous Actions

The scheduler (`supervisor/scheduler.ts`) enables the agent to operate without any human interaction.

**Pulse** (lines 226-233): A periodic wake-up triggered by `PULSE.json`. When enabled, the scheduler calls `triggerAgent('<PULSE/>', 'pulse')` at the configured interval (default: 30 minutes), respecting quiet hours. The agent is expected to do memory maintenance, check the workspace for problems, and be proactive.

**Cron** (lines 237-273): Scheduled tasks defined in `CRONS.json`. The scheduler uses `cron-parser` to evaluate cron expressions against the system clock every 60 seconds (line 298). When a cron matches, it calls `triggerAgent()` with a `<CRON>id</CRON>` prompt. If a `tasks/{id}.md` file exists, its content is appended as `<CRON_TASK_DETAIL>`.

The `triggerAgent()` function (line 120) creates a conversation in the database, invokes `startBlobyAgentQuery()`, and handles the response:

1. Extracts `<Message>` blocks from the agent's response using regex (lines 165-166).
2. Saves messages to the user's current conversation in the database.
3. Broadcasts them to all connected WebSocket clients via `broadcastBloby('chat:sync', ...)` (line 188).
4. Sends push notifications via the worker's `/api/push/send` endpoint (lines 194-203).
5. If file tools were used, restarts the backend (lines 208-211).

**One-shot crons** (lines 252-260): Crons with `oneShot: true` are automatically removed after they fire. The removal is deferred until the agent completes its turn, so the agent can still read `CRONS.json` during execution. Both the JSON entry and the corresponding `tasks/{id}.md` file are cleaned up.

**Expired one-shot cleanup** (lines 276-292): The scheduler also cleans up one-shot crons whose schedule has passed without firing (e.g., if the system was off when the cron was supposed to fire).

### 7.6 Self-Update Mechanism

The agent can trigger its own update by creating a `.update` file in the workspace (from the system prompt, lines 158-160):

```
touch ~/.bloby/workspace/.update
```

The workspace watcher detects this file (lines 768-777 of `supervisor/index.ts`), deletes it, and either defers the update (if an agent turn is active) or runs it immediately via `runDeferredUpdate()` (lines 683-711).

The update runs in a detached child process that survives the supervisor's restart:

- On Linux: uses `systemd-run` to create a transient service unit.
- On macOS/other: spawns a detached child with `stdio: 'ignore'` and `unref()`.

### 7.7 Message Output from Autonomous Actions

When the agent runs autonomously (via Pulse or Cron), it can send messages to the user using a special `<Message>` XML tag in its response:

```xml
<Message title="Build Error" priority="high">Your markdown message here</Message>
```

The scheduler parses these with a regex (line 165):

```ts
const messageRegex = /<Message(?:\s+([^>]*))?>(([\s\S]*?))<\/Message>/g;
```

Each matched message is:

1. Persisted to the database as an assistant message.
2. Broadcast to all connected clients.
3. Sent as a push notification (title extracted from the `title` attribute, body truncated to 200 characters).

### 7.8 Sacred Boundaries

Despite its autonomy, the agent is told to never modify certain directories (lines 316-319 of the system prompt):

- `supervisor/` -- the chat UI, proxy, and process management
- `worker/` -- platform APIs and database
- `shared/` -- shared utilities
- `bin/` -- CLI entry point

The agent is also told to prefer recoverable operations (line 226): "Prefer `trash` over `rm` -- recoverable beats gone forever."

---
