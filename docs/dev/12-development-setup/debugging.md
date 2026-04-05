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
| `[worker]` | `worker/index.ts` -- API routes, database |
| `[backend]` | `workspace/backend/index.ts` -- user's custom backend |
| `[watcher]` | Supervisor file watcher -- `.env` and backend file changes |
| `[bloby]` | `supervisor/bloby-agent.ts` -- AI agent interactions |

The user backend also writes logs to `workspace/.backend.log` (cleared on each
restart).

### Running individual processes manually

You can start each process independently for isolated debugging:

**Supervisor only** (spawns worker + backend automatically):

```bash
node --import tsx/esm supervisor/index.ts
```

**Worker only** (for testing API routes):

```bash
WORKER_PORT=3001 node --import tsx/esm worker/index.ts
```

**User backend only** (for testing custom backend logic):

```bash
BACKEND_PORT=3004 node --import tsx/esm workspace/backend/index.ts
```

**Dashboard Vite dev server only** (for pure frontend work):

```bash
npx vite --config vite.config.ts
```

This starts on port `5173` with proxying to `localhost:3000` (API) and
`localhost:3004` (app API).

**Chat UI Vite dev server only**:

```bash
npx vite --config vite.bloby.config.ts
```

### Common issues and fixes

#### `Error: Port 3000 is already in use`

Another process is occupying the port. Either stop it or change `port` in
`~/.bloby/config.json`.

Find the process:

```bash
# Linux / macOS
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

#### `No config. Run 'bloby init'.`

The supervisor cannot find `~/.bloby/config.json`. Create it manually:

```bash
mkdir -p ~/.bloby
echo '{"port":3000,"username":"","ai":{"provider":"","model":"","apiKey":""},"tunnel":{"mode":"off"},"relay":{"token":"","tier":"","url":""}}' > ~/.bloby/config.json
```

Or run `bloby init` once to generate it interactively.

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

#### Worker or backend crash loops

Both the worker and user backend have auto-restart logic with a maximum of 3
retries. If you see `"Worker failed too many times"` or `"Backend failed too
many times"`, check:

- `workspace/.backend.log` for backend errors
- The console output for worker stack traces
- That the ports are not occupied by another process

The restart counter resets after 30 seconds of stable uptime
(`STABLE_THRESHOLD`).

#### Vite HMR not working through tunnel

HMR WebSocket is attached to the supervisor's HTTP server. If you access the
dashboard through a cloudflare tunnel, HMR uses the same origin (no separate
WebSocket port). This should work out of the box. If it does not, check that
WebSocket upgrade requests are not being blocked.

#### `dist-bloby/` missing

If the chat UI build artifacts are missing, the supervisor tries to build them
on first run:

```js
if (!fs.existsSync(DIST_BLOBY)) {
  execSync('npx vite build --config vite.bloby.config.ts', { cwd: PKG_DIR });
}
```

You can also build manually: `npm run build:bloby`.

### Port conflicts

The system uses four ports derived from the base port. If any conflict, change
`port` in `config.json`:

| Port | Derived as | Service |
|------|-----------|---------|
| `N` | `config.port` | Supervisor |
| `N+1` | `getWorkerPort()` | Worker |
| `N+2` | `startViteDevServers()` | Dashboard Vite |
| `N+4` | `getBackendPort()` | User backend |

For example, setting `"port": 4000` uses ports 4000, 4001, 4002, and 4004.

---
