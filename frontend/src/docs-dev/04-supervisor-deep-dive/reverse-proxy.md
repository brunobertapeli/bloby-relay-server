---
title: "Reverse Proxy"
---

The supervisor acts as a layer-7 HTTP router. Two destinations are true proxies using
Node's native `http.request()` to `127.0.0.1`: the user backend and the Vite dashboard
dev server. Responses are piped back using `proxyRes.pipe(res)` and request bodies are
piped forward using `req.pipe(proxy)`. The worker API is not proxied at all: it is an
in-process Express app (`createWorkerApp()` from `worker/index.ts`) that the
supervisor dispatches to directly.

### 3.1 Routing Rules (evaluated in order)

The request handler in `supervisor/index.ts` evaluates URL prefixes in a strict
priority order. The first match wins:

1. **`/bloby/widget.js`, `/bloby/app-ws.js`, `/bloby/workspace-guard.js`** -- Served
   directly from the package's `supervisor/` directory through `serveCachedText()`
   (in-memory cache with gzip and ETag/304 support). Not proxied.

2. **`/sw.js` or `/bloby/sw.js`** -- Served from the embedded `SW_JS` constant. Not
   proxied.

3. **`/__bloby/*` supervisor endpoints** -- Handled directly: `backend-status` and
   `version` for the interstitial and chat shell, and the agent control surface
   `/__bloby/control/*` (restarts, self-update, log tails), which is loopback-only
   and rejects carrier-marked requests.

4. **`/app/api/*`** -- Proxied to the **backend** process on `backendPort`. Only the
   `/app` prefix is stripped, so the backend sees `/api/...`:

   ```typescript
   // supervisor/index.ts (backend proxy)
   const backendPath = req.url.replace(/^\/app/, '');
   ```

   If the backend is down (`!isBackendAlive()`), returns a 503 JSON error
   immediately.

5. **Supervisor-handled `/api` subsets** -- A few API families are handled by the
   supervisor itself, before the worker app: `/api/channels/*` (WhatsApp/Telegram/
   Alexa, with loopback-only guards on mutation routes), `/api/env`,
   `/api/schedule` and `/api/crons/*`, and `/api/agent/*`.

6. **`/api/*`** -- Dispatched to the in-process **worker** Express app via
   `workerApp(req, res)`. No proxy hop and no separate port. **Auth enforcement**
   happens here first: once a portal password is set, every `/api` route requires a
   valid token except a small public pre-login allowlist; internal supervisor calls
   bypass with the per-process `x-internal` secret (see Section 4).

7. **`/bloby` or `/bloby/*`** -- Served as static files from `dist-chat/`. Not
   proxied.

8. **Everything else** -- Proxied to the **Vite dashboard dev server** on
   `vitePorts.dashboard`. This is the catch-all that serves the dashboard UI. Two
   pre-checks run first: if the backend has crash-looped and given up, HTML
   navigations get the "backend down" interstitial instead; if Vite failed to boot,
   the supervisor serves `RECOVERING_HTML` directly. The proxy also injects the
   `workspace-guard.js` script into dashboard HTML documents and gzips text
   responses on the fly.

### 3.2 Proxy Error Handling

Every proxy call has an `error` handler attached. The pattern is consistent:

```typescript
// supervisor/index.ts (backend proxy example)
proxy.on('error', (e) => {
  console.error(`[supervisor] Backend proxy error: ${req.url}`, e.message);
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Backend unavailable' }));
});
```

Backend proxy errors return JSON `{ error: 'Backend unavailable' }`. Vite proxy
errors return the `RECOVERING_HTML` page, which displays a branded "Reconnecting"
screen that polls the current URL (starting after 1.8 seconds, with backoff) and
reloads itself the moment Vite answers again. The recovering page also loads the chat
widget script so users can interact with Morphy even while the dashboard is down.

### 3.3 Worker API Helper

The supervisor also exposes an internal `workerApi()` function for making
programmatic requests to the worker routes from within the supervisor process itself
(not for proxying external requests). This is used extensively in the Morphy chat
WebSocket handler to persist conversations, manage context, and call transcription
and push endpoints. It fetches the supervisor's own port (the worker app is mounted
there) and attaches the per-process `x-internal` secret so the call bypasses portal
auth:

```typescript
// supervisor/index.ts
async function workerApi(apiPath: string, method = 'GET', body?: any, timeoutMs?: number) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json', 'x-internal': internalSecret } };
  if (body) opts.body = JSON.stringify(body);
  if (timeoutMs) opts.signal = AbortSignal.timeout(timeoutMs);
  const res = await fetch(`http://127.0.0.1:${config.port}${apiPath}`, opts);
  return res.json();
}
```
