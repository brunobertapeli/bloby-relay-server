---
title: "Debugging"
---

## 6. Debugging

### Reading logs

All processes log to stdout/stderr with timestamps and severity prefixes. The
logging system is defined in `shared/logger.ts`:

```
HH:MM:SS INFO  <message>
HH:MM:SS WARN  <message>
HH:MM:SS ERR   <message>
HH:MM:SS OK    <message>
```

When running `npm run dev`, `concurrently` interleaves output from all
processes. Look for these prefixes to identify the source:

| Prefix | Source |
|--------|--------|
| `[supervisor]` | `supervisor/index.ts` -- HTTP proxying, WebSocket routing |
| `[vite-dev]` | `supervisor/vite-dev.ts` -- Vite server lifecycle |
| (in-process) | `worker/index.ts` -- API routes, database (mounted by the supervisor via `createWorkerApp()`, so its output appears in the supervisor stream) |
| `[backend]` | `workspace/backend/index.ts` -- user's custom backend |
| `[watcher]` | Supervisor file watcher -- `.env` and backend file changes |
| `[morphy]` | `supervisor/bloby-agent.ts` -- AI agent interactions |

The user backend also writes logs to `workspace/.backend.log` (cleared on each
restart).

### Running individual processes manually

You can start each process independently for isolated debugging:

**Supervisor only** (runs the worker in-process, spawns the backend):

```bash
node --import tsx/esm supervisor/index.ts
```

The API routes have no standalone command: `worker/index.ts` exports
`createWorkerApp()` and is mounted in-process by the supervisor, so it always
serves on the supervisor's own port (no separate worker process or port).

**User backend only** (for testing custom backend logic):

```bash
BACKEND_PORT=7404 node --import tsx/esm workspace/backend/index.ts
```

**Dashboard Vite dev server only** (for pure frontend work):

```bash
npx vite --config vite.config.ts
```

This starts on port `5173` with proxying to `localhost:7400` (API) and
`localhost:7404` (app API).

**Chat UI Vite dev server only**:

```bash
npx vite --config vite.chat.config.ts
```

### Common issues and fixes

#### `Error: Port 7400 is already in use`

Another process is occupying the port. Either stop it or change `port` in
`~/.morphy/config.json` (`7400` is the default base port).

Find the process:

```bash
# Linux / macOS
lsof -i :7400

# Windows
netstat -ano | findstr :7400
```

#### `No config. Run 'morphy init'.`

The supervisor cannot find `~/.morphy/config.json`. Create it manually:

```bash
mkdir -p ~/.morphy
echo '{"port":7400,"username":"","ai":{"provider":"","model":"","apiKey":""},"tunnel":{"mode":"off"},"relay":{"token":"","tier":"","url":""}}' > ~/.morphy/config.json
```

Or run `morphy init` once to generate it interactively.

#### `better-sqlite3` build errors

This native module requires a C++ compiler. Ensure build tools are installed:

```bash
# macOS
xcode-select --install

# Ubuntu / Debian
sudo apt install build-essential python3

# Windows (from an elevated PowerShell)
npm install -g windows-build-tools
# Or install Visual Studio Build Tools manually
```

#### Backend crash loops

The user backend runs as a child process with auto-restart logic, capped at a
maximum of 3 retries (`MAX_RESTARTS`). If you see `"Backend failed too many
times"`, check:

- `workspace/.backend.log` for backend errors
- That the port is not occupied by another process

The restart counter resets after 30 seconds of stable uptime
(`STABLE_THRESHOLD`). The worker is not a separate process (it runs in-process
inside the supervisor), so it has no crash-loop of its own; an unhandled error
in a worker route surfaces in the supervisor's console output.

#### Vite HMR not working through the Morphy Relay

The HMR WebSocket is attached directly to the supervisor's HTTP server, so the
browser connects on the same origin the page is served from. That works both
locally and through the Morphy Relay carrier (the persistent outbound WSS in
`supervisor/relay-tunnel.ts` that routes to the bot's Durable Object), with no
separate WebSocket port. HMR live-reload over the carrier is verified end-to-end.
If HMR does not update, check that WebSocket upgrade requests are not being
blocked.

#### `dist-chat/` missing

If the chat UI build artifacts are missing, the supervisor tries to build them
on first run:

```js
if (!fs.existsSync(DIST_CHAT)) {
  execSync('npx vite build --config vite.chat.config.ts', { cwd: PKG_DIR });
}
```

You can also build manually: `npm run build:chat`.

### Port conflicts

The system uses three ports derived from the base port. If any conflict, change
`port` in `config.json`:

| Port | Derived as | Service |
|------|-----------|---------|
| `N` | `config.port` | Supervisor (also serves the in-process worker API) |
| `N+2` | `startViteDevServers()` | Dashboard Vite |
| `N+4` | `getBackendPort()` | User backend |

The default base port is `7400`, so a default install uses `7400` (supervisor),
`7402` (dashboard Vite), and `7404` (user backend).

---
