---
title: "Reverse Proxy"
---

The supervisor's HTTP server acts as a reverse proxy, routing incoming requests to the appropriate internal service based on the URL path. This is implemented directly with Node.js `http.request()` -- no third-party proxy library is used.

### 5.1 Routing Rules

Requests are matched in order. The first match wins.

| Path Pattern       | Target                                    | Notes                                              |
|--------------------|-------------------------------------------|----------------------------------------------------|
| `/bloby/widget.js` | Served directly from `paths.widgetJs`     | Not part of any Vite build                         |
| `/sw.js`, `/bloby/sw.js` | Served from embedded `SW_JS` constant | Service worker for PWA + push notifications        |
| `/app/api/*`       | Backend (`127.0.0.1:<backendPort>`)       | Strips the `/app` prefix before proxying           |
| `/api/*`           | Worker Express app, in-process            | No network hop; auth gate applied first (see 5.4)  |
| `/bloby`, `/bloby/*` | Static files from `dist-chat/`         | Pre-built chat UI SPA, directory traversal guarded |
| `/*` (default)     | Vite Dashboard (`127.0.0.1:<vitePort>`)   | All other routes go to the dashboard dev server    |

The worker is not a separate process. `worker/index.ts` exports `createWorkerApp()`, and the supervisor mounts the returned Express app in-process: `/api/*` requests are dispatched to it as a plain function call (`workerApp(req, res)` in `supervisor/index.ts`), so API traffic never takes a loopback HTTP hop.

### 5.2 Proxy Implementation

The two proxied targets (backend and Vite dashboard) follow the same pattern using `http.request()`:

```ts
const proxy = http.request(
  { host: '127.0.0.1', port: targetPort, path: reqPath, method: req.method, headers: stripHopByHop(req.headers), agent: loopbackAgent },
  (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res);
  },
);
proxy.on('error', (e) => { /* error handling */ });
req.pipe(proxy);
```

Key details:

- **Header forwarding**: request headers are forwarded after hop-by-hop headers are stripped (`stripHopByHop`). End-to-end headers (`Authorization`, `Content-Type`, cookies, and the relay carrier's `cf-connecting-ip` / `x-morphy-tunnel` markers) pass through unchanged. A shared keep-alive agent (`loopbackAgent`) reuses loopback connections.
- **Response streaming**: the proxy response is piped directly back to the client (`proxyRes.pipe(res)`). The dashboard route additionally injects `/bloby/workspace-guard.js` into HTML documents and gzips compressible text responses on the fly; everything else streams through verbatim.
- **Request body streaming**: the incoming request body is piped to the proxy target (`req.pipe(proxy)`). This handles any `Content-Length` or chunked transfer encoding automatically.

### 5.3 Error Handling

When a proxy target is unreachable (the service has crashed, is restarting, or has not started yet):

- **Backend (`/app/api/*`)**: returns HTTP 503 with `{ "error": "Backend unavailable" }`. Before attempting the proxy, it checks `isBackendAlive()` and returns 503 with `{ "error": "Backend is starting..." }` if the process is not running.
- **Vite Dashboard (default)**: returns HTTP 503 with an HTML page (`RECOVERING_HTML`) that polls and reloads itself the moment Vite is back. If Vite failed to boot at all, the supervisor serves the same page directly instead of dialing a dead port; if the backend has crash-looped and given up, top-level document navigations get a dedicated "backend down" interstitial instead.

The worker cannot be unreachable: it runs inside the supervisor process, so `/api/*` needs no recovery page of its own.

### 5.4 Auth Middleware

API routes (`/api/*`) are secure by default. Once a portal password is set, every `/api` route requires a valid `Bearer` token except the public pre-login allowlist (`PUBLIC_PRELOGIN_ROUTES` and `PUBLIC_PRELOGIN_PREFIXES` in `supervisor/index.ts`: login, onboarding status, health check, and similar). Internal supervisor calls bypass the gate by carrying a per-process secret in the `x-internal` header.

Tokens are validated with `getSession()` against the worker's session store (in-process, no HTTP round-trip). Validation results are cached for 60 seconds (`TOKEN_CACHE_TTL`).
