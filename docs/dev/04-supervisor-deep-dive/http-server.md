---
title: "HTTP Server"
---

### 2.1 Server Creation

The supervisor creates a raw `http.createServer()` with **no initial request handler**
(line 101). The request handler is attached later via `server.on('request', ...)` at
line 218. This two-phase setup is intentional: the Vite dev server needs the `server`
instance passed in at creation time so it can attach its HMR WebSocket upgrade
listener before the supervisor adds its own.

```typescript
// supervisor/index.ts, line 101
const server = http.createServer();
```

### 2.2 Port Allocation Scheme

The supervisor allocates ports relative to the user-configured base port:

| Service | Port | Calculated by |
|---|---|---|
| Supervisor (public) | `config.port` | User configuration |
| Worker API | `config.port + 1` | `getWorkerPort()` in `worker.ts`, line 11 |
| Dashboard Vite | `config.port + 2` | Computed in `vite-dev.ts`, line 11 |
| Backend | `config.port + 4` | `getBackendPort()` in `backend.ts`, line 17 |

For example, if the user configures port 3000, the worker listens on 3001, Vite on
3002, and the backend on 3004.

### 2.3 Port Conflict Handling

The server listens for `EADDRINUSE` errors (lines 660-667) and exits with a clear
error message pointing the user to the config file:

```typescript
// supervisor/index.ts, lines 660-667
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    log.error(`Port ${config.port} is already in use. ...`);
  } else {
    log.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});
```

### 2.4 Static Asset Serving

Two categories of static content are served directly by the supervisor without
proxying:

**Fluxy chat UI** (`/fluxy` and `/fluxy/*`, lines 304-337): Pre-built static files
from `dist-fluxy/`. The supervisor resolves files from the `DIST_FLUXY` directory
(line 22), applies directory traversal protection (line 312), and serves them with
appropriate MIME types from the `MIME_TYPES` map (lines 38-48). HTML files get
`Cache-Control: no-cache`; hashed assets (JS, CSS) get immutable caching with a
one-year max-age (line 325).

**Service worker** (`/sw.js` or `/fluxy/sw.js`, lines 228-231): Served from an
embedded string constant `SW_JS` (lines 51-85) rather than a file on disk. This
guarantees the service worker is always in sync with the supervisor version. The
service worker handles PWA installability, push notifications, and notification
click routing.

**First-run build**: If `dist-fluxy/` does not exist on startup (lines 24-36), the
supervisor runs `npx vite build --config vite.fluxy.config.ts` synchronously to
build the chat UI. This handles cases where the postinstall script failed silently.
