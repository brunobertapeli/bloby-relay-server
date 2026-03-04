---
title: "File Watcher"
---

The supervisor watches the workspace for file changes to auto-restart the backend. This catches edits from VS Code, the CLI, or any external tool -- not just the agent.

```plain
supervisor/index.ts, lines 732-778

fs.watch(workspace/backend/, { recursive: true })
  |
  +-- *.ts, *.js, *.json changed --> scheduleBackendRestart()

fs.watch(workspace/, { non-recursive })
  |
  +-- .env changed      --> scheduleBackendRestart()
  +-- .restart created   --> consume file, scheduleBackendRestart()
  +-- .update created    --> consume file, runDeferredUpdate() or defer
```

The `scheduleBackendRestart()` function uses a 1-second debounce timer. During an active agent turn (`agentQueryActive === true`), restarts are deferred by setting `pendingBackendRestart = true`. The restart executes when the agent's `bot:done` event fires.

This prevents mid-turn restarts that would interrupt the agent's work.

---
