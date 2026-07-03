---
title: "Shutdown Sequence"
---

The `shutdown()` function in `supervisor/index.ts` performs an orderly teardown. A
`shuttingDown` guard makes it run once (both signals, or a repeat signal, call the same
function), and it arms a **5-second hard-exit deadline**
(`setTimeout(() => process.exit(0), 5000).unref()`) so a hung teardown step, such as a
relay notify on a dead network during sleep/wake, can never block process exit:

1. **Disconnect channels**: `await channelManager.disconnectAll()` (WhatsApp,
   Telegram, etc.).
2. **Stop scheduler**: `stopScheduler()`.
3. **Close file watchers**: `backendWatcher.close()`, `workspaceWatcher.close()`.
4. **Clear timers**: the WebSocket liveness heartbeat interval, the backend restart
   debounce timer, and the carrier wake/network-change watchdog interval.
5. **Notify the relay**: if a relay token exists, call `disconnect()` -- best-effort;
   presence is the live carrier socket (the edge posts presence on connect/drop), so
   this just marks the bot offline promptly.
6. **Close the database**: `closeDb()`.
7. **Stop backend**: `await stopBackend()` -- kills the backend child and waits for
   full exit (up to 3s before SIGKILL).
8. **Close the carrier**: `relayTunnel?.close()` -- tears down the persistent outbound
   WSS to the bot's Durable Object. The persisted `tunnelUrl` stays in config: the
   carrier URL is stable (derived from the bot's handle), so there is no stale URL to
   clear.
9. **Stop Vite**: `await stopViteDevServers()` -- closes the Vite dev server.
10. **Close HTTP server**: `server.close()`.
11. **Remove the runtime file**: `removeRuntimeFile()` deletes
    `~/.morphy/supervisor.json`, but only if it still records this process's pid.
12. **Exit**: `process.exit(0)`.

The shutdown is triggered by either `SIGINT` (Ctrl+C) or `SIGTERM` (daemon manager
signal):

```typescript
// supervisor/index.ts
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
```
