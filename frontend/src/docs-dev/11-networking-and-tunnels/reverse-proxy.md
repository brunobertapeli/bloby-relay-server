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
| `/app/api/*`       | Backend (`127.0.0.1:<backendPort>`)       | Strips `/app/api` prefix before proxying           |
| `/api/*`           | Worker (`127.0.0.1:<workerPort>`)         | Auth middleware applied for mutation routes         |
| `/bloby`, `/bloby/*` | Static files from `dist-bloby/`         | Pre-built chat UI SPA, directory traversal guarded |
| `/*` (default)     | Vite Dashboard (`127.0.0.1:<vitePort>`)   | All other routes go to the dashboard dev server    |

### 5.2 Proxy Implementation

Each proxy route follows the same pattern using `http.request()`:

```ts
const proxy = http.request(
  { host: '127.0.0.1', port: targetPort, path: reqPath, method: req.method, headers: req.headers },
  (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res);
  },
);
proxy.on('error', (e) => { /* error handling */ });
req.pipe(proxy);
```

Key details:

- **Header forwarding**: all request headers from the incoming request (`req.headers`) are forwarded as-is to the target service. This includes `Host`, `Authorization`, `Content-Type`, cookies, and any headers added by Cloudflare.
- **Response streaming**: the proxy response is piped directly back to the client (`proxyRes.pipe(res)`). Response headers and status codes are forwarded verbatim.
- **Request body streaming**: the incoming request body is piped to the proxy target (`req.pipe(proxy)`). This handles any `Content-Length` or chunked transfer encoding automatically.

### 5.3 Error Handling

When a proxy target is unreachable (the service has crashed, is restarting, or has not started yet), each route has specific error behavior:

- **Backend (`/app/api/*`)**: returns HTTP 503 with `{ "error": "Backend unavailable" }`. Before attempting the proxy, it checks `isBackendAlive()` and returns 503 with `{ "error": "Backend is starting..." }` if the process is not running.
- **Worker (`/api/*`)**: returns HTTP 503 with an HTML page (`RECOVERING_HTML`) that auto-refreshes after 3 seconds. The pre-check uses `isWorkerAlive()`.
- **Vite Dashboard (default)**: returns HTTP 503 with the same `RECOVERING_HTML` auto-refresh page.

### 5.4 Auth Middleware

For API routes (`/api/*`), the supervisor enforces authentication on mutation methods (`POST`, `PUT`, `DELETE`). Read-only methods (`GET`, `HEAD`) bypass auth. Certain routes are exempt (login, onboard status, health check, etc.) as listed in `AUTH_EXEMPT_ROUTES`.

Authentication works by validating a bearer token against the worker's `/api/portal/validate-token` endpoint. Token validation results are cached for 60 seconds (`TOKEN_CACHE_TTL`) to avoid per-request round-trips.
