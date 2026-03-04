---
title: "Supervisor Role"
---

The supervisor is Fluxy's **master process**. It does not serve application logic
directly. Instead, it:

- Creates and owns the single public-facing HTTP server (the port the user configured).
- Acts as a reverse proxy, routing requests to child processes (worker, backend, Vite).
- Manages child process lifecycles with auto-restart and crash detection.
- Handles WebSocket upgrade requests, discriminating between Fluxy chat WS and
  Vite HMR WS.
- Manages Cloudflare Tunnel processes for external access.
- Watches the workspace filesystem for changes and triggers backend restarts.
- Orchestrates graceful startup and shutdown sequences.

The entry point is the `startSupervisor()` async function exported from
`supervisor/index.ts` (line 94). The file self-invokes at the bottom:

```typescript
// supervisor/index.ts, lines 957-960
startSupervisor().catch((err) => {
  log.error('Fatal', err);
  process.exit(1);
});
```
