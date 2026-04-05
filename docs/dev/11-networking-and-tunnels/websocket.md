---
title: "WebSocket Networking"
---

Bloby uses WebSockets for two distinct purposes: the Bloby chat interface and Vite Hot Module Replacement (HMR).

### 6.1 Bloby Chat WebSocket

The chat WebSocket is served at the path `/bloby/ws`. It is implemented as a `noServer` WebSocket using the `ws` library:

```ts
const blobyWss = new WebSocketServer({ noServer: true });
```

The supervisor intercepts HTTP upgrade requests in the `server.on('upgrade')` handler:

```ts
server.on('upgrade', async (req, socket, head) => {
  if (!req.url?.startsWith('/bloby/ws')) {
    return; // Let Vite handle non-Bloby upgrades
  }
  // Auth check...
  blobyWss.handleUpgrade(req, socket, head, (ws) => {
    blobyWss.emit('connection', ws, req);
  });
});
```

If portal auth is configured, the WebSocket connection requires a `token` query parameter (`/bloby/ws?token=...`). The token is validated against the worker before the upgrade completes. Invalid or missing tokens result in `401 Unauthorized` and socket destruction.

The WebSocket protocol supports these message types:

| Direction       | Type                    | Purpose                                                    |
|-----------------|-------------------------|------------------------------------------------------------|
| Client -> Server | `ping` (raw string)    | Heartbeat keepalive, server responds with `pong`           |
| Client -> Server | `user:message`         | Chat message with optional `conversationId` and attachments |
| Client -> Server | `user:stop`            | Cancel an in-progress AI generation                        |
| Client -> Server | `user:clear-context`   | Reset conversation context                                 |
| Client -> Server | `whisper:transcribe`   | Voice transcription request (relayed to worker)            |
| Client -> Server | `settings:save`        | Save settings over WS (bypasses relay POST issues)         |
| Server -> Client | `bot:typing`           | AI is generating a response                                |
| Server -> Client | `bot:token`            | Streaming token from AI response                           |
| Server -> Client | `bot:response`         | Complete AI response                                       |
| Server -> Client | `bot:error`            | AI error message                                           |
| Server -> Client | `chat:conversation-created` | New conversation ID assigned                         |
| Server -> Client | `chat:state`           | Current stream state for reconnecting clients              |
| Server -> Client | `chat:cleared`         | Conversation context was cleared                           |
| Server -> Client | `chat:sync`            | Broadcast a message to other connected clients             |
| Server -> Client | `whisper:result`       | Transcription result                                       |
| Server -> Client | `settings:saved`       | Settings save confirmation                                 |

When a client reconnects, it receives a `chat:state` message containing the current streaming buffer if an AI response is in progress. This allows the client to resume displaying a partial response without missing content.

### 6.2 Vite HMR WebSocket

Vite's Hot Module Replacement WebSocket is attached directly to the supervisor's HTTP server. In `supervisor/vite-dev.ts`, the Vite dev server is created with:

```ts
hmr: { server: hmrServer }
```

Where `hmrServer` is the supervisor's `http.Server` instance. This means the HMR WebSocket shares the same port as the supervisor (3000 by default) rather than running on the Vite port (3002). This is critical for tunnel and relay operation -- the browser connects to WebSocket on the same origin the page was loaded from. Without this, HMR would break when accessed through a tunnel because the browser would try to connect to `localhost:3002` directly.

The `server.on('upgrade')` handler routes upgrade requests:

- If the URL starts with `/bloby/ws`, it is handled by the Bloby chat WebSocket.
- All other upgrade requests fall through to Vite's own upgrade listener (which Vite attached to the server when `hmr.server` was set).

No explicit `clientPort` is configured for HMR. The comment in `vite-dev.ts` explains: "the browser connects on the same origin the page is served from, so it works both locally (localhost:3000) and through the relay (riven.bloby.bot:443)."

### 6.3 WebSocket Through Tunnel Considerations

WebSocket connections through the Cloudflare Tunnel work transparently for most operations. However, the `ARCHITECTURE.md` in `supervisor/chat/` documents a known limitation: **HTTP POST requests from an iframe fail through the relay + tunnel chain** (502 or timeout). The mitigation is to route mutations through the WebSocket instead of HTTP POST when the chat is accessed through the relay. This is why `settings:save` and `whisper:transcribe` are implemented as WebSocket messages rather than REST endpoints.

The WebSocket `ping`/`pong` heartbeat (client sends raw `"ping"` string, server responds `"pong"`) serves as an application-level keepalive. This is important for tunneled connections where intermediate proxies (Cloudflare edge, relay) may time out idle connections.
