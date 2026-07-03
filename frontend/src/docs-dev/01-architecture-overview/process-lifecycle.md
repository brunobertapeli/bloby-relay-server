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
startSupervisor()                              supervisor/index.ts
  |
  +-- loadConfig() + killPort(...)             Clear stale processes on the supervisor/Vite/backend ports
  +-- http.createServer()                      Raw http.createServer (no Express at the outer layer)
  +-- startViteDevServers(port, server)        Vite attaches HMR WebSocket to supervisor's server
  +-- ensureFileDirs()                         Create workspace/files/ subdirectories
  +-- createWorkerApp()                        Mount worker API routes in-process (no child process)
  +-- createProvider()                         Initialize AI provider from config
  +-- server.listen(port)                      Bind to base port, write ~/.morphy/supervisor.json
  +-- spawnBackend(backendPort)                Fork backend child process (the only child)
  +-- channelManager.init()                    Connect messaging channels (WhatsApp, Telegram, Alexa)
  +-- startScheduler(opts)                     Start 60s tick loop (in-process)
  +-- new RelayTunnel(config).connect()        Dial the persistent carrier (if tunnel.mode == 'relay')
```

The CLI waits for readiness markers on stdout:

- `__VITE_WARM__` -- Vite finished pre-transforming modules
- `__TUNNEL_URL__=<url>` -- Carrier URL known (stable, derived from the bot's handle)
- `__RELAY_URL__=<url>` -- Relay registration in place
- `__READY__` -- All systems go

Timeout: 45 seconds. A carrier that has not connected yet is non-fatal: `RelayTunnel` keeps redialing in the background, and because the URL never changes the bot comes online as soon as the network allows.

### Child Process Spawning

The workspace backend is the only child process (the worker API runs in-process inside the supervisor). `backend.ts` does not spawn the TypeScript file directly. Instead, an inline loader wrapper is constructed and passed via `-e`:

```typescript
// From spawnBackend() in supervisor/backend.ts (abridged)
const backendUrl = 'file://' + backendPath.replace(/\\/g, '/');
const wrapper = [
    // ...node:module registerHooks that reject any import resolving
    //    outside the workspace/ boundary...
    `import('${backendUrl}')`,
    `  .catch(e => { console.error('[backend] Fatal:', e); process.exit(1); });`,
    `setInterval(() => {}, 60000);`, // keepalive -- prevents event loop drain
].join('\n');

child = spawn(
    process.execPath,
    ['--import', 'tsx/esm', '--input-type=module', '-e', wrapper],
    {
        cwd: WORKSPACE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...extraEnv, BACKEND_PORT: String(port) },
    },
);
```

This wrapper solves four problems:

1. `tsx` handles TypeScript compilation transparently
2. Module resolution hooks confine the user's backend to `workspace/node_modules`, so it can never walk up into the package's own dependencies
3. The `setInterval` keepalive prevents premature exit under systemd (where the event loop can drain to zero and Node exits with code 0)
4. Import errors are caught and logged instead of silently exiting

### Auto-Restart (Crash Recovery)

When the backend exits unexpectedly, the supervisor applies this restart logic:

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
                       then respawn            "Use Morphy chat to debug"
```

Key parameters (from `supervisor/backend.ts`):

| Parameter          | Value                | Purpose                                               |
| ------------------ | -------------------- | ----------------------------------------------------- |
| `MAX_RESTARTS`     | 3                    | Maximum consecutive restart attempts                  |
| `STABLE_THRESHOLD` | 30,000 ms            | If process lived this long, reset the restart counter |
| Backoff delay      | `1000 * restarts` ms | Linear backoff (1s, 2s, 3s), capped at 5s             |
| Crash window       | > 6 crashes in 5 min | Give up even if each run outlived the 30s reset       |

The rolling crash window closes the loophole where a backend that crashes every ~40 seconds would keep resetting the consecutive counter forever.

The backend also exposes a `resetBackendRestarts()` export that the supervisor calls before intentional restarts (e.g., after the agent edits files). This prevents intentional restarts from consuming the crash budget.

### Shutdown Sequence

On SIGINT or SIGTERM, the supervisor runs a single guarded `shutdown()` (both signals share it, repeat signals are ignored). A hard-exit deadline is armed first so a hung step (e.g. the relay `disconnect` call on a dead network after sleep/wake) can never block process exit:

```plain
SIGINT/SIGTERM received
  |
  +-- setTimeout(exit, 5000).unref()  Hard-exit deadline for the whole teardown
  +-- channelManager.disconnectAll()  Close WhatsApp/Telegram/Alexa connections
  +-- stopScheduler()                 Clear 60s interval
  +-- backendWatcher.close()          Stop fs.watch on workspace/backend/
  +-- workspaceWatcher.close()        Stop fs.watch on workspace root
  +-- clearInterval(wsHeartbeat)      Stop the WebSocket ping/liveness loop
  +-- clearTimeout(backendRestartTimer)
  +-- clearInterval(watchdogInterval) Stop the carrier wake/network watchdog
  +-- disconnect(relay.token)         Tell the relay this bot is going offline
  +-- closeDb()                       Close the SQLite handle
  +-- stopBackend()                   Kill backend, wait for exit (up to 3s, then SIGKILL)
  +-- relayTunnel.close()             Close the carrier WebSocket
  +-- stopViteDevServers()            Close Vite dev server
  +-- server.close()                  Close HTTP server
  +-- removeRuntimeFile()             Delete ~/.morphy/supervisor.json
  +-- process.exit(0)
```

The backend stop is async with a `Promise`-based wait and a 3-second SIGKILL safety net to prevent port collisions on restart (see `stopBackend()` in `supervisor/backend.ts`). Note that nothing tunnel-related needs cleaning from config at shutdown: the carrier URL is derived from the bot's handle and stays stable across restarts.

---
