---
title: "How They Connect"
---

# How They Connect

The dashboard and chat UI are two separate applications that share a single origin through the supervisor's HTTP reverse proxy. This page explains the routing, embedding, HMR, and communication mechanisms that tie them together.

## The Supervisor as Reverse Proxy

The supervisor process (`supervisor/index.ts`) creates a single HTTP server on the configured port (default 3000). It acts as a reverse proxy, routing every incoming request to the correct backend based on the URL path:

```
Browser request to :3000
    |
    +-- /bloby/widget.js    --> Serve widget.js directly from supervisor/
    +-- /sw.js, /bloby/sw.js --> Serve embedded service worker constant
    +-- /app/api/*           --> Proxy to user's backend server (:3004)
    +-- /api/*               --> Proxy to worker process (:3001)
    +-- /bloby/*             --> Serve static files from dist-bloby/
    +-- /* (everything else) --> Proxy to dashboard Vite dev server (:3002)
```

### Port Allocation

Ports are derived from the supervisor's base port using fixed offsets:

| Service | Port | Calculation |
|---|---|---|
| Supervisor (main) | 3000 | User-configured `config.port` |
| Worker API | 3001 | `config.port + 1` |
| Dashboard Vite | 3002 | `config.port + 2` |
| User Backend | 3004 | `config.port + 4` |

The supervisor is the only service exposed to the network. All others bind to `127.0.0.1`.

### Dashboard Routing

All requests that do not match `/api/*`, `/app/api/*`, `/bloby/*`, `/sw.js`, or `/bloby/widget.js` are forwarded to the dashboard's Vite dev server. This includes the initial HTML page load (`/`), JavaScript modules, CSS files, static assets, and source maps.

```ts
// supervisor/index.ts — fallback route
const proxy = http.request(
  { host: '127.0.0.1', port: vitePorts.dashboard, path: req.url, method: req.method, headers: req.headers },
  (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res);
  },
);
req.pipe(proxy);
```

If the Vite dev server is down, the supervisor returns a "Dashboard is restarting" HTML page (`RECOVERING_HTML`) that auto-refreshes after 3 seconds and still loads the chat widget so the user can interact with the AI.

### Chat Routing

Requests to `/bloby/*` are served as static files from the pre-built `dist-bloby/` directory. The URL prefix `/bloby/` is stripped before resolving the file path. Security: a directory traversal check ensures the resolved path stays within `dist-bloby/`.

Cache headers differ by file type:
- **HTML files** (`bloby.html`, `onboard.html`): `Cache-Control: no-cache` so rebuilds are picked up immediately.
- **Hashed assets** (`.js`, `.css`): `Cache-Control: public, max-age=31536000, immutable` since filenames include content hashes.

The MIME type is resolved from the file extension via a static map supporting `.html`, `.js`, `.css`, `.png`, `.jpg`, `.svg`, `.webm`, `.woff2`, and `.json`.

## The Widget: Injecting the Chat Bubble

The chat is embedded into the dashboard via `widget.js` (located at `supervisor/widget.js`). This script is loaded by the dashboard's `index.html`:

```html
<script src="/bloby/widget.js"></script>
```

The widget creates three DOM elements:

1. **Backdrop** (`#bloby-widget-backdrop`) -- A semi-transparent overlay behind the panel.
2. **Panel** (`#bloby-widget-panel`) -- A fixed-position panel (480px wide, full height) that slides in from the right. Contains an iframe pointing to `/bloby/` (the chat app).
3. **Bubble** (`#bloby-widget-bubble`) -- A 60px circular button in the bottom-right corner. Shows an animated `.webm` video on non-Safari browsers, and a static `.png` on Safari (which lacks WebM alpha support).

### Toggle Behavior

Clicking the bubble opens the panel (slides in with CSS `transform: translateX(0)`), shows the backdrop, and hides the bubble. Clicking the backdrop or pressing Escape closes it. The panel width is 480px on desktop and 100vw on mobile (`@media(max-width:480px)`).

### Communication with the Iframe

The widget listens for `postMessage` events from the chat iframe:

- **`bloby:close`** -- Closes the panel (user tapped the back arrow in chat).
- **`bloby:install-app`** -- Triggers the PWA install prompt. If `beforeinstallprompt` was captured, calls `prompt()`. Otherwise, sends `bloby:show-ios-install` back to the iframe so the chat can show manual iOS instructions.

### Onboarding Integration

On load, the widget fetches `/api/settings` to check `onboard_complete`. If onboarding is not complete, it hides the chat bubble entirely. It listens for `bloby:onboard-complete` from the onboarding iframe to re-show the bubble.

### HMR Persistence

When the dashboard Vite server triggers an HMR update or full page reload, the widget would normally be destroyed and re-created. To preserve the open/close state across reloads:

```js
try {
  if (sessionStorage.getItem('bloby_widget_open') === '1') {
    sessionStorage.removeItem('bloby_widget_open');
    toggle();
  }
} catch (e) {}
```

However, the chat iframe itself is not affected by dashboard HMR because it is served from `dist-bloby/` (static files). The iframe's WebSocket connection, message history, and streaming state survive a full dashboard page reload.

## HMR: Dashboard vs Chat

### Dashboard HMR

The dashboard uses Vite's native Hot Module Replacement. The HMR WebSocket is attached directly to the supervisor's HTTP server (not the Vite dev server's port):

```ts
// supervisor/vite-dev.ts
dashboardVite = await createViteServer({
  server: {
    port: ports.dashboard,
    hmr: { server: hmrServer }, // hmrServer = supervisor's http.createServer()
  },
});
```

This means the browser's HMR WebSocket connects on the same origin the page is served from (port 3000), not to the Vite dev server's port (3002). This is critical for two reasons:

1. **Works through the Cloudflare tunnel and relay** -- The tunnel proxies all traffic to `:3000`. If HMR connected to `:3002`, it would be unreachable from outside the network.
2. **No `clientPort` needed** -- Because HMR attaches to the same server, there is no port mismatch to deal with.

The supervisor handles WebSocket upgrades by letting Vite handle any upgrade request that does not match `/bloby/ws`:

```ts
server.on('upgrade', async (req, socket, head) => {
  if (!req.url?.startsWith('/bloby/ws')) {
    // Vite's HMR handler (attached via hmr.server) handles this
    return;
  }
  // Bloby chat WebSocket
  blobyWss.handleUpgrade(req, socket, head, (ws) => blobyWss.emit('connection', ws, req));
});
```

When the agent modifies dashboard source files, Vite picks up the changes and pushes updates to the browser via HMR. No manual reload is needed for most changes. The chat iframe listens for `app:hmr-update` events on the WebSocket and forwards them to the dashboard via `postMessage`, but the dashboard intentionally does not force a reload -- it lets Vite handle it natively.

### Chat: No HMR (Static)

The chat app has no HMR and no dev server in production. It is pre-built into `dist-bloby/` and served as static files. To update the chat UI:

1. Modify source files in `supervisor/chat/`.
2. Run `npm run build:bloby`.
3. The new `dist-bloby/` files are served immediately (HTML has `no-cache` headers).
4. Users need a page reload to pick up the new bundle (hashed filenames change).

This is intentional: the chat must never be affected by a failed build or broken HMR update that would prevent the user from communicating with the agent.

## WebSocket Routing

The supervisor runs a single HTTP server that handles two types of WebSocket connections:

1. **Vite HMR WebSocket** -- Handled by Vite's built-in handler (attached via `hmr.server`). The URL path is `/__vite_hmr` or similar (managed by Vite internals).
2. **Bloby Chat WebSocket** -- Handled by a `WebSocketServer` instance (`blobyWss`). URL path: `/bloby/ws`.

The routing logic in the `upgrade` event listener:

```ts
server.on('upgrade', async (req, socket, head) => {
  if (!req.url?.startsWith('/bloby/ws')) {
    return; // Let Vite handle it
  }
  // Auth check for chat WebSocket
  // ...
  blobyWss.handleUpgrade(req, socket, head, (ws) => blobyWss.emit('connection', ws, req));
});
```

Chat WebSocket connections require authentication (if a portal password is configured). The auth token is passed as a query parameter: `/bloby/ws?token=...`. The supervisor validates it against the worker's `/api/portal/validate-token` endpoint (with a 60-second TTL cache).

## Auth Flow Across Both Apps

Both apps share the same authentication layer:

1. The chat UI shows `LoginScreen` if `/api/onboard/status` reports `portalConfigured: true` and no valid token exists in `localStorage`.
2. Login hits `/api/portal/login` with Basic auth. If TOTP is enabled, a second step hits `/api/portal/login/totp`.
3. The returned JWT is stored in `localStorage` (key `bloby_token`) and sent as `Authorization: Bearer` on all API requests and as `?token=` on WebSocket connections.
4. The supervisor enforces auth on mutation API routes (POST/PUT/DELETE) and on WebSocket upgrades. GET/HEAD requests are exempt.
5. The dashboard itself does not require auth directly -- it proxies through the supervisor, which enforces auth at the API level.

## Iframe Security Considerations

The chat iframe and the dashboard are same-origin (both served from `:3000`), so `postMessage` communication works without CORS restrictions. The widget does not specify a target origin for `postMessage` (uses `'*'`), which is acceptable because:

- Both applications run on the same host.
- The messages contain no sensitive data (just UI coordination events).
- The chat validates the types it acts on and ignores unknown message types.
