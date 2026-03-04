---
title: "WebSocket Authentication"
---

## 5. WebSocket Authentication

### 5.1 Token Passed as Query Parameter

WebSocket connections to `/fluxy/ws` carry the session token as a query parameter:

**File:** `supervisor/index.ts`, lines 634--657

```typescript
server.on('upgrade', async (req, socket: net.Socket, head) => {
  if (!req.url?.startsWith('/fluxy/ws')) {
    return; // Let Vite handle non-Fluxy upgrades (HMR)
  }

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

  fluxyWss.handleUpgrade(req, socket, head, (ws) => fluxyWss.emit('connection', ws, req));
});
```

### 5.2 Validation on Upgrade

The token validation uses the same `validateToken()` function as HTTP requests (with the same in-memory cache). If validation fails, the raw TCP socket receives a `401 Unauthorized` HTTP response and is destroyed -- no WebSocket connection is established.

Note: WebSocket upgrade requests that do not target `/fluxy/ws` are passed through to Vite for HMR handling (line 639).
