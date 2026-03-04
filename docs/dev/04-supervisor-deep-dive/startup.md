---
title: "Startup Sequence"
---

The exact order of operations when `startSupervisor()` is called (line 94):

1. **Load configuration** (line 95): Read `~/.fluxy/config.json` via `loadConfig()`.

2. **Calculate child ports** (lines 96-97): `workerPort = config.port + 1`,
   `backendPort = config.port + 4`.

3. **Create bare HTTP server** (line 101): `http.createServer()` with no request
   handler. This must happen before Vite startup.

4. **Start Vite dev server** (line 105): `startViteDevServers(config.port, server)`
   passes the server instance so Vite can attach its HMR WebSocket upgrade listener.
   This is awaited -- the supervisor blocks until Vite is ready.

5. **Ensure file directories** (line 110): `ensureFileDirs()` creates the
   `workspace/files/{audio,images,documents}` directories.

6. **Initialize AI provider** (lines 113-116): If an AI provider is configured in
   config, create the provider instance.

7. **Attach HTTP request handler** (line 218): `server.on('request', ...)` -- the
   main routing logic.

8. **Create Fluxy WebSocket server** (line 357): `new WebSocketServer({ noServer: true })`.

9. **Attach upgrade handler** (line 634): `server.on('upgrade', ...)` for
   dispatching WebSocket upgrades.

10. **Attach error handler and start listening** (lines 660-675):
    `server.listen(config.port)`. If tunnel mode is `'off'`, emits `__READY__`
    immediately.

11. **Spawn worker and backend** (lines 714-715):

    ```typescript
    spawnWorker(workerPort);
    spawnBackend(backendPort);
    ```

12. **Start scheduler** (lines 718-727): `startScheduler()` with callbacks for
    broadcasting, worker API access, backend restart, and model retrieval.

13. **Set up file watchers** (lines 732-778): Watch `workspace/backend/` and
    `workspace/` for file changes.

14. **Start tunnel** (lines 783-874): If tunnel mode is `'quick'` or `'named'`:
    - Start `cloudflared` and obtain the tunnel URL.
    - Run a readiness probe loop (up to 30 attempts, 1 second apart) that polls
      `http://127.0.0.1:<port>/api/health` until the local server responds.
    - For quick mode: register the URL with the relay and start heartbeats.
    - Emit `__READY__`.

15. **Start tunnel watchdog** (lines 877-925): If a tunnel is active, start the
    30-second periodic health check interval.

16. **Register shutdown handlers** (lines 928-952): Attach `SIGINT` and `SIGTERM`
    handlers.
