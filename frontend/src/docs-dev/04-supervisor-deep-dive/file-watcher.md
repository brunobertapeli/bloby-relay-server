---
title: "File Watcher"
---

The supervisor sets up two filesystem watchers (lines 732-778):

### 7.1 Backend Code Watcher

Watches `workspace/backend/` recursively for changes to `.ts`, `.js`, and `.json`
files (lines 752-755):

```typescript
// supervisor/index.ts, lines 752-755
const backendWatcher = fs.watch(backendDir, { recursive: true }, (_event, filename) => {
  if (!filename || !filename.match(/\.(ts|js|json)$/)) return;
  scheduleBackendRestart(`Backend file changed: ${filename}`);
});
```

### 7.2 Workspace Root Watcher

Watches the `workspace/` root (non-recursive) for three specific files (lines
758-778):

- **`.env`**: Triggers a backend restart so environment variable changes take effect.
- **`.restart`**: A trigger file that is consumed (deleted) immediately, then
  triggers a backend restart. Used by external tools to signal a restart.
- **`.update`**: A trigger file consumed immediately. If an agent query is active,
  the update is deferred until the agent turn ends. Otherwise, `runDeferredUpdate()`
  is called immediately, which spawns a detached `fluxy update` process.

### 7.3 Agent-Aware Deferral

The `scheduleBackendRestart()` function (lines 736-749) implements intelligent
deferral during agent turns:

```typescript
// supervisor/index.ts, lines 736-749
function scheduleBackendRestart(reason: string) {
  if (agentQueryActive) {
    pendingBackendRestart = true;
    return;
  }
  if (backendRestartTimer) clearTimeout(backendRestartTimer);
  backendRestartTimer = setTimeout(async () => {
    // ... restart logic ...
  }, 1000);
}
```

If the AI agent is actively streaming a response (`agentQueryActive === true`), the
restart is deferred. The flag `pendingBackendRestart` is checked when the agent's
turn ends (in the `bot:done` handler at lines 543-549), and the restart is executed
at that point. This prevents disruptive mid-turn restarts when the agent is writing
files that change the backend.

All scheduled restarts use a 1-second debounce timer to coalesce rapid file system
events (e.g., saving multiple files in quick succession).
