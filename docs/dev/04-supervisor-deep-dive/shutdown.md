---
title: "Shutdown Sequence"
---

The `shutdown()` function (lines 928-952) performs an orderly teardown:

1. **Stop scheduler** (line 930): `stopScheduler()`.
2. **Close file watchers** (lines 931-932): `backendWatcher.close()`,
   `workspaceWatcher.close()`.
3. **Clear timers** (lines 933-934): Cancel the backend restart debounce timer and
   the tunnel watchdog interval.
4. **Stop relay heartbeat** (line 935): `stopHeartbeat()`.
5. **Disconnect from relay** (lines 936-939): If a relay token exists, call
   `disconnect()` to notify the relay server.
6. **Clear persisted tunnel URL** (lines 940-942): Remove `tunnelUrl` from config
   and save, so stale URLs are not reused on next startup.
7. **Stop worker** (line 943): `stopWorker()` -- kills the worker child process.
8. **Stop backend** (line 944): `await stopBackend()` -- kills the backend and waits
   for full exit (up to 3s SIGKILL timeout).
9. **Stop tunnel** (line 945): `stopTunnel()` -- kills the cloudflared process.
10. **Stop Vite** (lines 946-947): `await stopViteDevServers()` -- closes the Vite
    dev server.
11. **Close HTTP server** (line 948): `server.close()`.
12. **Exit** (line 949): `process.exit(0)`.

The shutdown is triggered by either `SIGINT` (Ctrl+C) or `SIGTERM` (daemon manager
signal), registered at lines 951-952:

```typescript
// supervisor/index.ts, lines 951-952
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
```
