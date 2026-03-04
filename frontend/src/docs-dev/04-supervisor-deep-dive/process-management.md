---
title: "Process Management"
---

### 6.1 Worker Spawning (`worker.ts`)

The worker is the internal API server (likely Express/Fastify). It is spawned as a
child process using an inline ESM wrapper pattern.

**Spawn mechanism** (`spawnWorker`, lines 18-66):

```typescript
// worker.ts, lines 27-32
const workerUrl = 'file://' + workerPath.replace(/\\/g, '/');
const wrapper = [
  `import('${workerUrl}')`,
  `  .catch(e => { console.error('[worker] Fatal:', e); process.exit(1); });`,
  `setInterval(() => {}, 60000);`,
].join('\n');
```

The wrapper is an inline JavaScript string passed via `node -e`. It achieves three
things:

1. Dynamically imports the worker entry point (`worker/index.ts`) through tsx for
   TypeScript compilation.
2. Catches and logs import-time errors that would otherwise cause a silent exit.
3. Adds a 60-second keepalive `setInterval` to prevent the event loop from draining
   under systemd (which would cause an unexpected exit code 0).

The child process is spawned with:

```typescript
// worker.ts, line 34
child = spawn(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '-e', wrapper], {
  cwd: PKG_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, WORKER_PORT: String(port) },
});
```

The port is passed via the `WORKER_PORT` environment variable. Stdout and stderr
are piped to the supervisor's own stdout/stderr (lines 40-46).

**Health check** (`isWorkerAlive`, lines 74-76): Returns `true` if the child process
reference is non-null and `exitCode` is null (meaning the process has not exited).

**Stop** (`stopWorker`, lines 68-72): Sets the `intentionallyStopped` flag to
prevent the auto-restart handler from firing, then kills the process.

### 6.2 Backend Spawning (`backend.ts`)

The backend is the user's custom server code located at `workspace/backend/index.ts`.
It uses the same inline-wrapper spawn pattern as the worker.

**Key differences from the worker**:

- **CWD**: Set to `workspace/` (not `PKG_DIR`), so user code can use relative paths
  within their workspace (line 40).
- **Port env var**: Uses `BACKEND_PORT` instead of `WORKER_PORT` (line 42).
- **Log file**: All stdout/stderr is also appended to `workspace/.backend.log`
  (lines 45-53). The log file is truncated on each restart (line 26).
- **Graceful stop**: `stopBackend()` returns a Promise that resolves only after the
  child process has fully exited (lines 80-98). This prevents port collisions when
  restarting. A 3-second SIGKILL safety timeout ensures the function always resolves:

```typescript
// backend.ts, lines 80-98
export function stopBackend(): Promise<void> {
  return new Promise((resolve) => {
    // ... setup ...
    dying.once('exit', () => resolve());
    dying.kill();
    // Safety: force kill after 3s if SIGTERM doesn't work
    setTimeout(() => {
      try { dying.kill('SIGKILL'); } catch {}
      resolve();
    }, 3000);
  });
}
```

- **Reset function**: `resetBackendRestarts()` (lines 104-106) manually resets the
  restart counter to zero. This is called by the supervisor before intentional
  restarts triggered by file changes, agent tool usage, or the scheduler -- so that
  these deliberate restarts do not count toward the crash limit.

### 6.3 Auto-Restart Logic (shared by worker and backend)

Both `worker.ts` and `backend.ts` implement identical auto-restart logic with these
parameters:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_RESTARTS` | 3 | Maximum consecutive restart attempts |
| `STABLE_THRESHOLD` | 30,000 ms | Time a process must survive to reset the counter |

The logic in the `exit` handler (worker.ts lines 48-62, backend.ts lines 55-72):

1. If `intentionallyStopped` is true, exit silently (no restart).
2. Log the unexpected exit.
3. If the process ran for longer than `STABLE_THRESHOLD` (30 seconds), reset
   `restarts` to 0. This means a process that runs successfully for 30+ seconds
   before crashing gets a fresh set of 3 retry attempts.
4. If `restarts < MAX_RESTARTS`, increment and schedule a restart with exponential
   backoff: `setTimeout(() => spawnWorker(port), 1000 * restarts)`. This means:
   - 1st retry: 1 second delay
   - 2nd retry: 2 second delay
   - 3rd retry: 3 second delay
5. If all retries exhausted, log a fatal error: "failed too many times. Use Fluxy
   chat to debug."

### 6.4 Tunnel Management (`tunnel.ts`)

The tunnel module manages Cloudflare Tunnel (`cloudflared`) processes for exposing
the local server to the internet.

**Binary discovery** (`findBinary`, lines 12-25):

1. First checks for a system-wide `cloudflared` install via `which`/`where`.
2. Falls back to a local install at `~/.fluxy/bin/cloudflared`.
3. Validates local binaries by file size (must be >= 10 MB, line 10). If undersized
   (corrupt download), the file is deleted and treated as missing.

**Auto-installation** (`installCloudflared`, lines 27-58):

Downloads the correct binary for the current platform and architecture from GitHub
releases. Handles:

- Windows: direct `.exe` download via `curl.exe`.
- macOS: `.tgz` archive, piped through `tar xz`.
- Linux: direct binary download with `chmod 755`.
- Architectures: amd64, arm64, arm.

**Quick mode** (`startTunnel`, lines 60-82):

Spawns `cloudflared tunnel --url http://localhost:<port> --no-autoupdate`. Parses
stdout/stderr for a `*.trycloudflare.com` URL using a regex match. Returns a
Promise that resolves with the tunnel URL or rejects after a 30-second timeout.

```typescript
// tunnel.ts, lines 65-74
proc = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let buf = '';
const onData = (d: Buffer) => {
  buf += d.toString();
  const m = buf.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
  if (m) { clearTimeout(timeout); resolve(m[0]); }
};
```

**Named mode** (`startNamedTunnel`, lines 84-96):

Spawns `cloudflared tunnel --config <path> run <name>` for pre-configured tunnels
with stable domain names. Does not need to parse a URL because the domain is already
known from configuration.

**Health checking** (`isTunnelAlive`, lines 124-146):

A two-layer check:

1. Process-level: Is the `cloudflared` child process still running?
2. Network-level: Can `http://127.0.0.1:<port>/api/health` be reached within 3
   seconds?

Importantly, the health check probes localhost directly rather than the tunnel URL.
This avoids a macOS issue where the server cannot reach itself through the Cloudflare
tunnel due to DNS/firewall configuration.

**Restart** (`restartTunnel` / `restartNamedTunnel`, lines 148-156):

Simple stop-then-start sequences. Quick mode generates a new URL; named mode
reconnects with the same domain.

### 6.5 Tunnel Watchdog

The supervisor runs a watchdog interval (lines 877-925) every 30 seconds that detects
two conditions:

1. **Sleep/wake detection**: If the gap between ticks exceeds 60 seconds, the machine
   likely slept. This is implemented by comparing `Date.now()` against `lastTick`:

   ```typescript
   // supervisor/index.ts, lines 883-884
   const wakeGap = now - lastTick > 60_000;
   ```

2. **Periodic health check**: Every 10th tick (roughly every 5 minutes):

   ```typescript
   const periodicCheck = ++healthCounter % 10 === 0;
   ```

When either condition triggers, `isTunnelAlive()` is called. If the tunnel is dead:

- **Named mode**: The tunnel process is restarted; the URL stays the same.
- **Quick mode**: The tunnel process is restarted, generating a new URL. The new URL
  is persisted to config, and if a relay token exists, the relay is updated with the
  new URL and heartbeats are restarted.

### 6.6 Vite Dev Server (`vite-dev.ts`)

The Vite dev server provides Hot Module Replacement (HMR) for the dashboard during
development.

**Startup** (`startViteDevServers`, lines 9-56):

Creates a Vite dev server programmatically via `createViteServer()` with these
critical settings:

- `port`: `supervisorPort + 2`
- `host`: `'127.0.0.1'` (only listens locally)
- `strictPort: true` (fails if port is taken)
- `allowedHosts: true` (permits tunnel/relay hostnames)
- `hmr: { server: hmrServer }` -- binds HMR WebSocket to the supervisor's HTTP
  server

**Warm-up** (lines 43-53): After starting, the supervisor fetches the dashboard
entry page, extracts `<script src="...tsx">` references via regex, and pre-fetches
each to trigger Vite's module transformation ahead of the first real browser request.

**Dashboard reload** (`reloadDashboard`, lines 59-63): Provides a mechanism to
trigger full browser reloads via Vite's HMR channel:

```typescript
// vite-dev.ts, lines 59-63
export function reloadDashboard(): void {
  if (!dashboardVite) return;
  dashboardVite.hot.send({ type: 'full-reload', path: '*' });
}
```

**Shutdown** (`stopViteDevServers`, lines 65-72): Closes the Vite dev server
cleanly and nulls the reference.
