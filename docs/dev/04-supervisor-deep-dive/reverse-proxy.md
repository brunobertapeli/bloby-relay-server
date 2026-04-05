---
title: "Reverse Proxy"
---

The supervisor acts as a layer-7 HTTP reverse proxy. All proxying uses Node's native
`http.request()` to forward requests to internal child processes on `127.0.0.1`.
Responses are piped back using `proxyRes.pipe(res)`. Request bodies are piped
forward using `req.pipe(proxy)`.

### 3.1 Routing Rules (evaluated in order)

The request handler at line 218 evaluates URL prefixes in a strict priority order.
The first match wins:

1. **`/bloby/widget.js`** (line 220) -- Served directly from disk via
   `fs.readFileSync(paths.widgetJs)`. Not proxied.

2. **`/sw.js` or `/bloby/sw.js`** (line 228) -- Served from the embedded `SW_JS`
   constant. Not proxied.

3. **`/app/api/*`** (line 235) -- Proxied to the **backend** process on
   `backendPort`. The `/app/api` prefix is stripped before forwarding:

   ```typescript
   // supervisor/index.ts, line 236
   const backendPath = req.url.replace(/^\/app\/api/, '') || '/';
   ```

   If the backend is down (`!isBackendAlive()`), returns a 503 JSON error
   immediately (lines 238-242).

4. **`/api/*`** (line 262) -- Proxied to the **worker** process on `workerPort`.
   The path is forwarded as-is (no prefix stripping). If the worker is down, returns
   the `RECOVERING_HTML` page that auto-refreshes after 3 seconds (lines 265-268).
   **Auth enforcement** is applied here for mutation methods (see Section 4.2).

5. **`/bloby` or `/bloby/*`** (line 304) -- Served as static files from
   `dist-bloby/`. Not proxied.

6. **Everything else** (line 340) -- Proxied to the **Vite dashboard dev server**
   on `vitePorts.dashboard`. This is the catch-all that serves the dashboard UI
   during development.

### 3.2 Proxy Error Handling

Every proxy call has an `error` handler attached. The pattern is consistent:

```typescript
// supervisor/index.ts, lines 252-256 (backend proxy example)
proxy.on('error', (e) => {
  console.error(`[supervisor] Backend proxy error: ${req.url}`, e.message);
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Backend unavailable' }));
});
```

Backend proxy errors return JSON `{ error: 'Backend unavailable' }`. Worker and
Vite proxy errors return the `RECOVERING_HTML` page (lines 87-92), which displays
"Dashboard is restarting..." and auto-reloads after 3 seconds. The recovering page
also injects the chat widget script so users can interact with Bloby even while the
dashboard is down.

### 3.3 Worker API Helper

The supervisor also exposes an internal `workerApi()` function (lines 129-134) for
making programmatic requests to the worker from within the supervisor process itself
(not for proxying external requests). This is used extensively in the Bloby chat
WebSocket handler to persist conversations, validate tokens, and fetch context.

```typescript
// supervisor/index.ts, lines 129-134
async function workerApi(path: string, method = 'GET', body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${workerPort}${path}`, opts);
  return res.json();
}
```
