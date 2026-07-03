---
title: "Startup Sequence"
---

The exact order of operations when `startSupervisor()` runs (in `supervisor/index.ts`):

1. **Load configuration**: Read `~/.morphy/config.json` via `loadConfig()`. Legacy
   tunnel configs are migrated here: any old `quick`/`named` mode becomes `'relay'`.

2. **Calculate the backend port**: `getBackendPort(config.port)` returns
   `config.port + 4`. There is no worker port -- the worker runs in-process.

3. **Clear stale ports**: `killPort()` for the supervisor port, the Vite port
   (`config.port + 2`), and the backend port, so a crashed previous run cannot
   block startup.

4. **Create bare HTTP server**: `http.createServer()` with no request handler.
   This must happen before Vite startup.

5. **Start Vite dev server**: `startViteDevServers(config.port, server)` passes
   the server instance so Vite can attach its HMR WebSocket upgrade listener.
   This is awaited -- but a Vite failure only degrades the dashboard; the
   supervisor keeps booting so chat stays available.

6. **Ensure file directories**: `ensureFileDirs()` creates the
   `workspace/files/{audio,images,documents}` directories.

7. **Mount the worker in-process**: `createWorkerApp()` (from `worker/index.ts`)
   builds the worker's route handler inside the supervisor process. No child
   process, no separate port: `/api/*` requests are answered in-process.

8. **Initialize AI provider**: If an AI provider is configured in
   config, create the provider instance.

9. **Attach HTTP request handler**: `server.on('request', ...)` -- the
   main routing logic.

10. **Create the WebSocket servers**: `blobyWss` (Morphy chat) and `appWss`
    (app API proxy), both `new WebSocketServer({ noServer: true })`.

11. **Attach upgrade handler**: `server.on('upgrade', ...)` for
    dispatching WebSocket upgrades.

12. **Attach error handler and start listening**: `server.listen(config.port)`.
    The listen callback writes the runtime file `~/.morphy/supervisor.json`; if
    tunnel mode is `'off'`, it emits `__READY__` immediately.

13. **Spawn the backend**: `spawnBackend(backendPort)`. This is the only child
    process started at boot.

14. **Start channels, outbound, and scheduler**: create the `ChannelManager`
    (WhatsApp, Telegram, etc.) and the unified outbound delivery, then
    `startScheduler()` with callbacks for outbound delivery, backend restart,
    and model retrieval.

15. **Set up file watchers**: Self-healing `fs.watch` watchers on
    `workspace/backend/` and `workspace/` that debounce backend restarts and
    defer them while an agent turn is active.

16. **Housekeeping timers**: Resume any self-update that was queued before a
    restart, and start the 30-second WebSocket liveness heartbeat that pings
    chat/app clients and terminates half-open sockets.

17. **Start the carrier** (tunnel mode `'relay'`, the default):
    - Run a readiness probe loop (up to 30 attempts, 1 second apart) that polls
      `http://127.0.0.1:<port>/api/health` until the local server responds.
    - If no relay token exists yet (pre-onboarding), emit `__READY__`; the
      carrier connects after registration.
    - Otherwise instantiate `RelayTunnel` (`supervisor/relay-tunnel.ts`),
      persist the stable public URL, and dial the carrier with a ~15 second
      first-connection budget. Emit `__TUNNEL_URL__` and `__READY__`. If the
      first dial misses the budget, the carrier keeps retrying in the
      background -- the URL never changes, so the bot comes online as soon as
      the network allows.

18. **Start the carrier watchdog**: a 30-second interval that detects
    sleep/wake or network-change gaps and forces an immediate carrier redial
    instead of waiting out the WebSocket ping/pong deadline.

19. **Register shutdown handlers**: Attach `SIGINT` and `SIGTERM` handlers,
    with a 5-second hard-exit deadline so a hung teardown step can never block
    process exit.
