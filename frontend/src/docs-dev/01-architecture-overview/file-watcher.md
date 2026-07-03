---
title: "File Watcher"
---

The supervisor watches the workspace for file changes to auto-restart the backend. This catches edits from VS Code, the CLI, or any external tool -- not just the agent.

```plain
supervisor/index.ts (armBackendWatcher / armWorkspaceWatcher)

fs.watch(workspace/backend/, { recursive: true })
  |
  +-- *.ts, *.js, *.json changed --> scheduleBackendRestart()

fs.watch(workspace/, { non-recursive })
  |
  +-- .env changed                     --> scheduleBackendRestart()
  +-- package.json / package-lock.json --> scheduleBackendRestart()
  +-- .restart created (deprecated)    --> consume file, scheduleBackendRestart()
  +-- .update created (deprecated)     --> consume file, queueUpdate()
```

The `.restart` and `.update` trigger files are deprecated fallbacks, kept so a human or external script touching them still works. The agent uses the acknowledged control endpoints instead: `POST /__bloby/control/restart-backend` and `POST /__bloby/control/update`.

The `scheduleBackendRestart()` function uses a 1-second debounce timer. While any surface is mid-turn (`aTurnIsActive()`: dashboard chat via `agentQueryActive`, a live channel conversation, or a pulse/cron one-shot), restarts are deferred by setting `pendingBackendRestart = true`. The deferred restart executes when the turn ends: `bot:turn-complete` for dashboard turns, the channel manager and scheduler `onTurnComplete` callbacks for the rest.

This prevents mid-turn restarts that would interrupt the agent's work. Both watchers are self-healing: on a watcher error they close and re-arm with a short backoff instead of dying silently.

---
