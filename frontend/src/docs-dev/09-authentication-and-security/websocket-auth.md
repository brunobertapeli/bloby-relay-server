---
title: "WebSocket Authentication"
---

## 5. WebSocket Authentication

### 5.1 Token Passed as Query Parameter

WebSocket connections to `/bloby/ws` carry the session token as a query parameter:

**File:** `supervisor/index.ts` (the `server.on('upgrade', ...)` handler)

```typescript
server.on('upgrade', async (req, socket: net.Socket, head) => {
  // App API WebSocket -- no auth (the user's backend handles its own auth)
  if (req.url?.startsWith('/app/ws')) {
    appWss.handleUpgrade(req, socket, head, (ws) => appWss.emit('connection', ws, req));
    return;
  }

  if (!req.url?.startsWith('/bloby/ws')) {
    return; // Vite's own upgrade listener handles HMR sockets
  }

  // Auth check for WebSocket
  const needsAuth = await isAuthRequired();
  if (needsAuth) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const token = urlObj.searchParams.get('token');
    if (!token || !(await validateToken(token))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  blobyWss.handleUpgrade(req, socket, head, (ws) => blobyWss.emit('connection', ws, req));
});
```

### 5.2 Validation on Upgrade

The token validation uses the same `validateToken()` function as HTTP requests (with the same in-memory 60-second token cache). If validation fails, the raw TCP socket receives a `401 Unauthorized` HTTP response and is destroyed -- no WebSocket connection is established.

Two other upgrade paths exist on the same server. Requests to `/app/ws` are routed to `appWss` (the bridge to the user's app backend) without a supervisor auth check, since the backend enforces its own auth. Any other upgrade request (Vite HMR) is left untouched: the supervisor's Vite dev servers are created with `hmr: { server: hmrServer }` pointing at the supervisor's HTTP server (see `startViteDevServers()` in `supervisor/vite-dev.ts`), so Vite registers its own `upgrade` listener and handles those sockets itself.
