---
title: "Process Management"
---

### 6.1 Worker (in-process, `worker/index.ts`)

The worker is the internal API server (an Express app). It is no longer a separate
child process: the supervisor creates it in-process during startup by calling
`createWorkerApp()` (exported from `worker/index.ts`) and dispatches every `/api/*`
request to it from inside its own HTTP request handler.

```typescript
// supervisor/index.ts (startup)
// Initialize worker routes in-process (no separate child process)
const workerApp = createWorkerApp();
```

Consequences of the in-process design:

1. There is no worker port and no `WORKER_PORT` environment variable. `/api` requests
   never leave the supervisor's HTTP server (see the Reverse Proxy section).
2. There is no worker health check, spawn wrapper, or auto-restart logic. The worker
   lives and dies with the supervisor process itself.
3. Internal calls from the supervisor to the worker go through the `workerApi()`
   helper, which fetches the supervisor's own port with a per-process `x-internal`
   secret header (see Section 3.3 in the Reverse Proxy doc).

The child-process machinery described in the rest of this chapter now applies only to
the user backend.

### 6.2 Backend Spawning (`backend.ts`)

The backend is the user's custom server code located at `workspace/backend/index.ts`.
It is spawned as a child process using an inline ESM wrapper passed via `node -e`
(with `--import tsx/esm` for TypeScript compilation). The wrapper (built inside
`spawnBackend`) achieves four things:

1. Registers `node:module` resolution hooks that block imports from resolving outside
   the workspace boundary (workspace isolation; requires Node 22.15+, warns and
   continues without it otherwise).
2. Dynamically imports the user's backend entry point through tsx.
3. Catches and logs import-time errors that would otherwise cause a silent exit.
4. Adds a 60-second keepalive `setInterval` to prevent the event loop from draining
   under systemd (which would cause an unexpected exit code 0).

**Key spawn parameters**:

- **CWD**: Set to `workspace/`, so user code can use relative paths within the
  workspace.
- **Port env var**: `BACKEND_PORT` (base port + 4, from `getBackendPort()`). Extra
  env vars registered via `setBackendEnv()` (e.g. `MORPHY_AGENT_SECRET`) are injected
  into every spawn, including auto-restarts.
- **Log file**: All stdout/stderr is piped to the supervisor's own stdout/stderr and
  appended to `workspace/.backend.log`. The log file is truncated on each spawn; on a
  crash, the just-crashed run's output is first copied to `.backend.log.prev` so the
  originating error survives the restart (readable via `readBackendLogTail(n, prev)`).
- **Graceful stop**: `stopBackend()` returns a Promise that resolves only after the
  child process has fully exited. This prevents port collisions when restarting. A
  3-second SIGKILL safety timeout ensures the function always resolves, and concurrent
  callers share the same in-flight stop promise to avoid double-spawn races.
- **Serialized restart**: `restartBackend()` is the single funnel for every deliberate
  restart (file watcher, turn-complete, scheduler pulse, channel manager). Concurrent
  callers share one in-flight stop-then-spawn cycle; a request arriving mid-restart
  triggers exactly one more cycle afterward.
- **Reset function**: `resetBackendRestarts()` resets the restart counter (and the
  rolling crash window, below) to zero. It runs before intentional restarts so that
  deliberate restarts never count toward the crash limit.

### 6.3 Auto-Restart Logic (`backend.ts`)

The backend's `exit` handler implements crash-loop protection with these parameters:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_RESTARTS` | 3 | Maximum consecutive restart attempts |
| `STABLE_THRESHOLD` | 30,000 ms | Time the process must survive to reset the counter |
| `CRASH_WINDOW_MS` / `CRASH_WINDOW_MAX` | 5 min / 6 | Rolling-window backstop against slow crash loops |

The logic in the `exit` handler:

1. If `intentionallyStopped` is true (the supervisor called `stopBackend()`), exit
   silently with no restart.
2. Preserve the crashed run's log to `.backend.log.prev`, then log the unexpected
   exit and record the crash timestamp in the rolling window.
3. If the process ran for longer than `STABLE_THRESHOLD` (30 seconds), reset
   `restarts` to 0: a process that runs successfully for 30+ seconds before crashing
   gets a fresh set of retry attempts. The rolling window exists precisely because of
   this reset; a backend that crashes every ~35 seconds would otherwise restart
   forever, so more than 6 crashes within 5 minutes forces a give-up regardless.
4. If neither limit is exceeded, increment `restarts` and schedule a respawn with
   backoff: `Math.min(1000 * restarts, 5000)` ms (1s, 2s, 3s).
5. If the limits are exhausted, set the `gaveUp` flag and log a fatal error:
   "Backend failed too many times. Use Morphy chat to debug." The `gaveUp` state
   (exposed as `isBackendDead()`) drives the supervisor's "backend down" interstitial,
   and a one-shot `setBackendGiveUpHandler` callback lets the supervisor broadcast a
   chat event telling the user to fix their code.

### 6.4 Carrier Management (`relay-tunnel.ts`)

Self-hosted bots are exposed to the internet through the Morphy carrier, not a
third-party tunnel binary (cloudflared was retired in v0.3.8; `supervisor/tunnel.ts`
no longer exists). `tunnel.mode` in config is `'relay'` (the default) or `'off'`
(managed/hosted bots reached directly); legacy `quick`/`named` configs are migrated to
`'relay'` automatically by `loadConfig()` in `shared/config.ts`.

**The connection** (`RelayTunnel`): one long-lived outbound WSS from the supervisor to
the bot's own Durable Object at the edge, `wss://<host>/__morphy/carrier`. The host is
derived from the bot's handle and tier: `<handle>.open.morphyagent.com` (free) or
`<handle>.morphyagent.com` (premium). Because the URL is derived, it is stable
forever: no URL rotation, no relay re-registration, no DNS propagation wait. A
reconnect is just a redial of the same endpoint.

**Authentication**: each dial fetches a short-lived Ed25519-signed ticket from the
relay control plane (`fetchTicket` in `shared/relay.ts`, cached for ~4 minutes) and
presents it as a Bearer token. The edge verifies with the public key only; no minting
secret ever leaves the relay.

**Multiplexing**: the Durable Object muxes browser HTTP and WebSocket traffic down the
carrier as binary frames (`OPEN`/`RESP`/`DATA`/`CLOSE`/`RESET`, plus
`PING`/`PONG`/`GOAWAY`). The client demuxes each stream and replays it to the local
supervisor on `127.0.0.1:<port>`, exactly where cloudflared used to deliver it.
Response bodies stream back in 64 KB `DATA` chunks with backpressure: when the
socket's `bufferedAmount` exceeds 8 MB the local response is paused, resuming once it
drains below 1 MB.

**Liveness**: protocol-level ping/pong. The client pings every 15 seconds and forces a
reconnect if no pong arrives within 30 seconds (two missed pings). Reconnects use
jittered exponential backoff (500 ms doubling, capped at 30 seconds). There is no
heartbeat to the relay: presence is the live carrier socket itself.

**Security**: replayed requests arrive on loopback, so the client strips any
client-supplied `cf-connecting-ip`, `cf-ray`, or `x-morphy-tunnel` headers and then
unconditionally stamps `x-morphy-tunnel: 1` plus the real client IP in
`cf-connecting-ip`. The supervisor's loopback-only guards reject both markers, keeping
the sensitive endpoints (`/__bloby/control/*`, channel mutations, agent API)
unreachable from the public path.

### 6.5 Carrier Watchdog

The supervisor runs a watchdog interval every 30 seconds whose only job is fast
sleep/wake and network-change recovery:

```typescript
// supervisor/index.ts (watchdog)
const wakeGap = now - lastTick > 60_000;
if (wakeGap) relayTunnel?.reconnectNow(); // wake/network change: redial immediately
```

If the gap between ticks exceeds 60 seconds, the machine likely slept, so the watchdog
calls `reconnectNow()` to tear down and redial the carrier immediately instead of
waiting out the pong deadline. Ongoing liveness is entirely the ws ping/pong described
above; there are no periodic health probes, and because the carrier URL is stable a
reconnect never changes the public URL or touches config.

### 6.6 Vite Dev Server (`vite-dev.ts`)

The Vite dev server provides Hot Module Replacement (HMR) for the dashboard during
development.

**Startup** (`startViteDevServers`):

Creates a Vite dev server programmatically via `createViteServer()` with these
critical settings:

- `port`: `supervisorPort + 2`
- `host`: `'127.0.0.1'` (only listens locally)
- `strictPort: true` (fails if port is taken)
- `allowedHosts: true` (permits carrier hostnames)
- `hmr: { server: hmrServer }` -- binds the HMR WebSocket to the supervisor's HTTP
  server, so the browser connects on the same origin the page is served from (works
  locally and through the carrier)
- `customLogger` -- mirrors Vite errors/warnings to stdout while also capturing them
  into the server-side frontend log ring, so compile errors surface even when the
  browser never ran a line of JS

**Warm-up**: after starting, the supervisor fetches the dashboard entry page once
(the HTML transform is not covered by `server.warmup`), then waits for the warmup
module graph to finish transforming via `waitForRequestsIdle()`, with a 20-second
timeout guard so a wedged transform can never hang the boot signal.

**Dashboard reload** (`reloadDashboard`): provides a mechanism to trigger full browser
reloads via Vite's HMR channel:

```typescript
// vite-dev.ts
export function reloadDashboard(): void {
  if (!dashboardVite) return;
  dashboardVite.hot.send({ type: 'full-reload', path: '*' });
}
```

**Shutdown** (`stopViteDevServers`): closes the Vite dev server cleanly and nulls the
reference.
