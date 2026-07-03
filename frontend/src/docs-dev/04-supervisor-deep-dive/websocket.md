---
title: "WebSocket Handling"
---

### 5.1 Upgrade Dispatch

The supervisor manages three distinct WebSocket protocols on the same port:

1. **Morphy Chat WebSocket** -- Path: `/bloby/ws*`
2. **App API WebSocket** -- Path: `/app/ws*` (routes `/app/api` calls over WS;
   no supervisor auth, the workspace backend handles its own)
3. **Vite HMR WebSocket** -- Any other upgrade path (handled by Vite)

Dispatch happens in the `server.on('upgrade', ...)` handler in `supervisor/index.ts`:

```typescript
// supervisor/index.ts (upgrade handler, simplified)
server.on('upgrade', async (req, socket: net.Socket, head) => {
  if (req.url?.startsWith('/app/ws')) {
    appWss.handleUpgrade(req, socket, head, (ws) => appWss.emit('connection', ws, req));
    return;
  }
  if (!req.url?.startsWith('/bloby/ws')) {
    // Let Vite handle this upgrade
    return;
  }
  // Auth check, then hand off to blobyWss
  blobyWss.handleUpgrade(req, socket, head, (ws) =>
    blobyWss.emit('connection', ws, req)
  );
});
```

The key insight is that Vite's HMR WebSocket listener was already attached to the
server **before** the supervisor's upgrade handler (because `startViteDevServers()`
runs early in `startSupervisor()`, well before `server.on('upgrade')` is attached).
By simply returning without consuming the socket for paths that are neither
`/bloby/ws` nor `/app/ws`, the upgrade event bubbles to Vite's listener.

### 5.2 Morphy Chat WebSocket

The `blobyWss` is a `WebSocketServer` created with `{ noServer: true }`,
meaning it does not bind to any port -- it relies on manual `handleUpgrade()` calls.

**Authentication**: For WebSocket connections, the token is passed as a query
parameter (`?token=...`). If a portal password is set (`isAuthRequired()`), the
supervisor parses the URL, extracts the token, and validates it with
`validateToken()` -- an in-process session lookup against the worker's database,
fronted by a short-lived token cache. Failed auth results in a raw
`401 Unauthorized` HTTP response written to the socket before destroying it:

```typescript
socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
socket.destroy();
```

**Connection lifecycle** (the `blobyWss.on('connection', ...)` handler):

- On connection: a random conversation ID is generated, the conversation history
  is initialized as an empty array, and if an agent query is currently streaming,
  the connection receives a `chat:state` catch-up message with the current buffer.
  A `?client=mac` query parameter tags the socket as the Mac app so Mac-targeted
  frames can find it.
- On message: supports `ping`/`pong` heartbeats, `whisper:transcribe`,
  `push:subscribe`/`push:unsubscribe`, `settings:save`, `tunnel:switch`,
  `user:message`, `user:stop`, `user:stop-task`, and `user:clear-context`
  message types.
- On close: the conversation history and client conversation mapping are cleaned up.
- Liveness: a 30-second heartbeat pings every chat and app socket and terminates
  any that missed the previous pong, so half-open connections still fire `close`
  and get cleaned up.

**Broadcasting**: The two main broadcast functions (both also fan out to the
workspace SSE chat subscribers):

- `broadcastBloby(type, data)` -- sends to all connected clients.
- `broadcastBlobyExcept(sender, type, data)` -- sends to all
  clients except the sender, used for `chat:sync` to avoid echoing a user's own
  message back.

Two narrower variants exist: `sendToMacClients()` (frames for Mac-app sockets
only) and `broadcastBlobyExceptSubscriber()` (skips the workspace subscriber
that originated an event).

### 5.3 Vite HMR WebSocket

Vite's HMR WebSocket is attached directly to the supervisor's HTTP server via the
`hmr.server` configuration option in `supervisor/vite-dev.ts`:

```typescript
// supervisor/vite-dev.ts
hmr: { server: hmrServer },
```

This means the browser connects to `ws://localhost:7400` (the supervisor port) for
HMR, not to the Vite dev server port (7402). The `clientPort` is intentionally
omitted so it works seamlessly both locally and through the bot's stable relay URL.
