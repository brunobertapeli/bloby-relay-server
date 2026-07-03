---
title: "File Watcher"
---

The supervisor arms two self-healing filesystem watchers via `armBackendWatcher()`
and `armWorkspaceWatcher()` in `supervisor/index.ts`. Each ensures its target
directory exists first (`fs.watch` throws if it is missing), attaches an `error`
listener, and re-arms itself with a backoff if the watcher dies (e.g. EMFILE under
load, or the watched inode removed during a workspace swap).

### 7.1 Backend Code Watcher

Watches `workspace/backend/` recursively for changes to `.ts`, `.js`, and `.json`
files:

```typescript
// supervisor/index.ts (inside armBackendWatcher)
const w = fs.watch(backendDir, { recursive: true }, (_event, filename) => {
  if (!filename || !filename.toString().match(/\.(ts|js|json)$/)) return;
  scheduleBackendRestart(`Backend file changed: ${filename}`);
});
```

### 7.2 Workspace Root Watcher

Watches the `workspace/` root (non-recursive). The `onWorkspaceChange()` handler
reacts to specific filenames:

- **`.env`**: Triggers a backend restart so environment variable changes take effect.
- **`package.json` / `package-lock.json`**: Triggers a backend restart. This catches
  an agent running `npm install` to add or fix a dependency (`node_modules/` itself
  is intentionally unwatched).
- **`.restart`**: Deprecated fallback. The trigger file is consumed (deleted), then a
  backend restart is scheduled. Agents now use `POST /__bloby/control/restart-backend`
  instead, which gives a synchronous acknowledgement.
- **`.update`**: Deprecated fallback. The trigger file is consumed, then routed
  through `queueUpdate()`: an acknowledged, idempotent self-update queue that runs
  the update at the next turn-complete via `runDeferredUpdate()`, which spawns
  `bin/cli.js update` as a child process and relaunches the daemon on success.
  Agents now use `POST /__bloby/control/update` instead.

### 7.3 Agent-Aware Deferral

The `scheduleBackendRestart()` function defers restarts while any surface is
mid-turn:

```typescript
// supervisor/index.ts
const aTurnIsActive = () => agentQueryActive || anyConversationBusy() || anyOneShotActive();

function scheduleBackendRestart(reason: string) {
  if (aTurnIsActive()) {
    pendingBackendRestart = true;
    return;
  }
  // ... 1s debounce timer, then doRestart() ...
}
```

`aTurnIsActive()` covers dashboard chat turns (`agentQueryActive`), live channel
conversations (`anyConversationBusy()`), and pulse/cron or one-shot turns
(`anyOneShotActive()`). If any is active, `pendingBackendRestart` is set instead of
restarting. The flag is flushed when the turn ends: the `bot:turn-complete` handler
for dashboard turns, and the `onTurnComplete` callbacks of the channel manager and
scheduler for the other surfaces. All paths funnel into `doRestart()`, which clears
the flag and delegates to the serialized `restartBackend()` in `backend.ts`. This
prevents disruptive mid-turn restarts when the agent is writing files that change
the backend.

All scheduled restarts use a 1-second debounce timer to coalesce rapid file system
events (e.g., saving multiple files in quick succession). The timer re-checks
`aTurnIsActive()` when it fires (a turn may have started during the debounce
window) and skips if a backend stop/restart is already in progress.
