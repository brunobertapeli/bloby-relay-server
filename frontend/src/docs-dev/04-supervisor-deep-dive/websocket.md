---
title: "WebSocket Handling"
---

### 5.1 Upgrade Dispatch

The supervisor manages two distinct WebSocket protocols on the same port:

1. **Fluxy Chat WebSocket** -- Path: `/fluxy/ws*`
2. **Vite HMR WebSocket** -- Any other upgrade path (handled by Vite)

Dispatch happens in the `server.on('upgrade', ...)` handler (lines 634-657):

```typescript
// supervisor/index.ts, lines 634-657
server.on('upgrade', async (req, socket: net.Socket, head) => {
  if (!req.url?.startsWith('/fluxy/ws')) {
    // Let Vite handle this upgrade
    return;
  }
  // Auth check, then hand off to fluxyWss
  fluxyWss.handleUpgrade(req, socket, head, (ws) =>
    fluxyWss.emit('connection', ws, req)
  );
});
```

The key insight is that Vite's HMR WebSocket listener was already attached to the
server **before** the supervisor's upgrade handler (because `startViteDevServers()`
is called at line 105, before the `server.on('upgrade')` at line 634). By simply
returning without consuming the socket for non-`/fluxy/ws` paths, the upgrade event
bubbles to Vite's listener.

### 5.2 Fluxy Chat WebSocket

The `fluxyWss` is a `WebSocketServer` created with `{ noServer: true }` (line 357),
meaning it does not bind to any port -- it relies on manual `handleUpgrade()` calls.

**Authentication**: For WebSocket connections, the token is passed as a query
parameter (`?token=...`). The supervisor parses the URL, extracts the token, and
validates it against the worker (lines 644-653). Failed auth results in a raw
`401 Unauthorized` HTTP response written to the socket before destroying it:

```typescript
// supervisor/index.ts, lines 649-651
socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
socket.destroy();
```

**Connection lifecycle** (lines 367-631):

- On connection: a random conversation ID is generated, the conversation history
  is initialized as an empty array, and if an agent query is currently streaming,
  the connection receives a `chat:state` catch-up message with the current buffer.
- On message: supports `ping`/`pong` heartbeats, `whisper:transcribe`,
  `settings:save`, `user:message`, `user:stop`, and `user:clear-context` message
  types.
- On close: the conversation history and client conversation mapping are cleaned up.

**Broadcasting**: Two broadcast functions exist:

- `broadcastFluxy(type, data)` (lines 360-365) -- sends to all connected clients.
- `broadcastFluxyExcept(sender, type, data)` (lines 137-142) -- sends to all
  clients except the sender, used for `chat:sync` to avoid echoing a user's own
  message back.

### 5.3 Vite HMR WebSocket

Vite's HMR WebSocket is attached directly to the supervisor's HTTP server via the
`hmr.server` configuration option in `vite-dev.ts` (line 29):

```typescript
// supervisor/vite-dev.ts, lines 27-29
hmr: { server: hmrServer },
```

This means the browser connects to `ws://localhost:3000` (the supervisor port) for
HMR, not to the Vite dev server port (3002). The `clientPort` is intentionally
omitted so it works seamlessly both locally and through remote tunnels/relay URLs.
