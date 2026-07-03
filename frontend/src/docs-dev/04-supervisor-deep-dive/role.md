---
title: "Supervisor Role"
---

The supervisor is Morphy's **master process**. It does not serve application logic
directly. Instead, it:

- Creates and owns the single public-facing HTTP server (the port the user configured,
  default 7400).
- Acts as a reverse proxy, routing dashboard requests to the Vite dev server and
  user-app requests to the backend child process. Worker API routes (`/api/*`) are
  served in-process via `createWorkerApp()` from `worker/index.ts` (no separate
  worker process, no proxy hop).
- Manages the backend child process lifecycle with auto-restart and crash detection.
- Handles WebSocket upgrade requests, discriminating between the Morphy chat WS
  (`/bloby/ws`), the app WS (`/app/ws`), and Vite's HMR WS (attached directly to the
  same server).
- Maintains external access through the Morphy carrier: a persistent outbound WSS
  connection from `supervisor/relay-tunnel.ts` to the bot's edge Durable Object.
- Watches the workspace filesystem for changes and triggers backend restarts.
- Orchestrates graceful startup and shutdown sequences.

The entry point is the `startSupervisor()` async function exported from
`supervisor/index.ts`. The file self-invokes at the bottom:

```typescript
// supervisor/index.ts (bottom of file)
startSupervisor().catch((err) => {
  log.error('Fatal', err);
  process.exit(1);
});
```
