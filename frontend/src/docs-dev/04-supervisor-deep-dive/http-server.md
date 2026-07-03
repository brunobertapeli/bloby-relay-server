---
title: "HTTP Server"
---

### 2.1 Server Creation

The supervisor creates a raw `http.createServer()` with **no initial request handler**.
The request handler is attached later via `server.on('request', ...)`. This two-phase
setup is intentional: the Vite dev server needs the `server` instance passed in at
creation time so it can attach its HMR WebSocket upgrade listener before the
supervisor adds its own.

```typescript
// supervisor/index.ts
const server = http.createServer();
```

### 2.2 Port Allocation Scheme

The supervisor allocates ports relative to the configured base port (`config.port`,
default `7400` in `shared/config.ts`):

| Service | Port | Calculated by |
|---|---|---|
| Supervisor (public) | `config.port` | User configuration |
| Dashboard Vite | `config.port + 2` | `startViteDevServers()` in `vite-dev.ts` |
| User backend | `config.port + 4` | `getBackendPort()` in `backend.ts` |

With the default base port 7400, Vite listens on 7402 and the backend on 7404.

The worker API is not a separate process and has no port of its own: the supervisor
calls `createWorkerApp()` (`worker/index.ts`) and dispatches `/api/*` requests to the
resulting Express app in-process, with no proxy hop.

### 2.3 Port Conflict Handling

The server listens for `EADDRINUSE` errors and exits with a clear error message
pointing the user to the config file:

```typescript
// supervisor/index.ts
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

**Morphy chat UI** (`/bloby` and `/bloby/*`): Pre-built static files from
`dist-chat/`. The supervisor resolves files from the `DIST_CHAT` directory, applies
directory traversal protection, and serves them with appropriate MIME types from
the `MIME_TYPES` map. HTML files get `Cache-Control: no-cache`; hashed assets (JS,
CSS) get immutable caching with a one-year max-age. Text assets under 5 MB are
served through an in-memory cache (`serveCachedText`) that adds gzip compression
and ETag/304 revalidation.

**Service worker** (`/sw.js` or `/bloby/sw.js`): Served from an embedded string
constant `SW_JS` rather than a file on disk. This guarantees the service worker is
always in sync with the supervisor version. The service worker handles app-shell
caching (offline fallback), push notifications, and notification click routing.

**First-run build**: If `dist-chat/` does not exist on startup, the supervisor runs
`npx vite build --config vite.chat.config.ts` synchronously to build the chat UI.
This handles cases where the postinstall script failed silently.
