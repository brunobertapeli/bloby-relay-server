---
title: "Process Lifecycle"
---

### Startup Sequence

The entry point is `bin/cli.js`, which spawns the supervisor:

```plain
bin/cli.js
  |
  | node --import tsx/esm supervisor/index.ts
  v
startSupervisor()                              supervisor/index.ts:94
  |
  +-- createServer()                           Raw http.createServer (no Express)
  +-- startViteDevServers(port, server)        Vite attaches HMR WebSocket to supervisor's server
  +-- ensureFileDirs()                         Create workspace/files/ subdirectories
  +-- createProvider()                         Initialize AI provider from config
  +-- server.listen(port)                      Bind to base port
  +-- spawnWorker(workerPort)                  Fork worker child process
  +-- spawnBackend(backendPort)                Fork backend child process
  +-- startScheduler(opts)                     Start 60s tick loop (in-process)
  +-- startTunnel(port)                        Spawn cloudflared (if tunnel.mode != 'off')
  +-- startHeartbeat(token, url)               Begin relay heartbeats (if relay configured)
```

The CLI waits for readiness markers on stdout:

- `__VITE_WARM__` -- Vite finished pre-transforming modules
- `__TUNNEL_URL__=<url>` -- Tunnel established
- `__RELAY_URL__=<url>` -- Relay registration succeeded
- `__READY__` -- All systems go
- `__TUNNEL_FAILED__` -- Tunnel could not start (non-fatal)

Timeout: 45 seconds.

### Child Process Spawning

Both `worker.ts` and `backend.ts` use an identical spawning pattern. The child is not spawned directly from the TypeScript file. Instead, an inline loader wrapper is constructed and passed via `-e`:

```typescript
// From supervisor/worker.ts:27-32
const workerUrl = 'file://' + workerPath.replace(/\\/g, '/');
const wrapper = [
    `import('${workerUrl}')`,
    `  .catch(e => { console.error('[worker] Fatal:', e); process.exit(1); });`,
    `setInterval(() => {}, 60000);`, // keepalive -- prevents event loop drain
].join('\n');

child = spawn(
    process.execPath,
    ['--import', 'tsx/esm', '--input-type=module', '-e', wrapper],
    {
        cwd: PKG_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WORKER_PORT: String(port) },
    },
);
```

This wrapper solves three problems:

1. `tsx` handles TypeScript compilation transparently
2. The `setInterval` keepalive prevents premature exit under systemd (where the event loop can drain to zero and Node exits with code 0)
3. Import errors are caught and logged instead of silently exiting

### Auto-Restart (Crash Recovery)

Both the worker and backend use the same restart logic:

```plain
                      Process exits unexpectedly
                              |
                              v
                   Was it intentionally stopped?
                    (intentionallyStopped flag)
                      /              \
                    YES               NO
                     |                 |
                   (done)      Was it alive > 30 seconds?
                                 (STABLE_THRESHOLD)
                                /              \
                              YES               NO
                               |                 |
                        Reset counter      Keep counter
                               |                 |
                               +--------+--------+
                                        |
                                        v
                               restarts < MAX_RESTARTS (3)?
                                /              \
                              YES               NO
                               |                 |
                       Wait (restarts * 1s)    Log error:
                       then respawn            "Use Bloby chat to debug"
```

Key parameters (from `supervisor/worker.ts` and `supervisor/backend.ts`):

| Parameter          | Value                | Purpose                                               |
| ------------------ | -------------------- | ----------------------------------------------------- |
| `MAX_RESTARTS`     | 3                    | Maximum consecutive restart attempts                  |
| `STABLE_THRESHOLD` | 30,000 ms            | If process lived this long, reset the restart counter |
| Backoff delay      | `1000 * restarts` ms | Linear backoff: 1s, 2s, 3s                            |

The backend has an additional `resetBackendRestarts()` export that the supervisor calls before intentional restarts (e.g., after the agent edits files). This prevents intentional restarts from consuming the crash budget.

### Shutdown Sequence

On SIGINT or SIGTERM, `startSupervisor()` executes a graceful teardown (line 928-950 of `supervisor/index.ts`):

```plain
SIGINT/SIGTERM received
  |
  +-- stopScheduler()               Clear 60s interval
  +-- backendWatcher.close()         Stop fs.watch on workspace/backend/
  +-- workspaceWatcher.close()       Stop fs.watch on workspace root
  +-- clearTimeout(backendRestartTimer)
  +-- clearInterval(watchdogInterval)
  +-- stopHeartbeat()                Clear relay heartbeat interval
  +-- disconnect(relay.token)        POST /api/disconnect to relay
  +-- delete config.tunnelUrl        Clear stale tunnel URL from config
  +-- saveConfig(config)
  +-- stopWorker()                   Kill worker child process
  +-- stopBackend()                  Kill backend, wait for exit (up to 3s, then SIGKILL)
  +-- stopTunnel()                   Kill cloudflared
  +-- stopViteDevServers()           Close Vite dev server
  +-- server.close()                 Close HTTP server
  +-- process.exit(0)
```

The backend stop is async with a `Promise`-based wait and a 3-second SIGKILL safety net to prevent port collisions on restart (see `supervisor/backend.ts:80-98`).

---
