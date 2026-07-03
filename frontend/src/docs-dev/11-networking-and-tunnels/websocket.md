---
title: "WebSocket Networking"
---

Morphy uses WebSockets for three purposes: the Morphy chat interface, Vite Hot Module Replacement (HMR), and an App API proxy socket (`/app/ws`) that carries `/app/api` calls for the chat iframe (client served at `/bloby/app-ws.js`).

### 6.1 Morphy Chat WebSocket

The chat WebSocket is served at the path `/bloby/ws`. It is implemented as a `noServer` WebSocket using the `ws` library:

```ts
const blobyWss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });
```

The supervisor intercepts HTTP upgrade requests in the `server.on('upgrade')` handler:

```ts
server.on('upgrade', async (req, socket, head) => {
  if (req.url?.startsWith('/app/ws')) {
    appWss.handleUpgrade(req, socket, head, (ws) => appWss.emit('connection', ws, req));
    return;
  }
  if (!req.url?.startsWith('/bloby/ws')) {
    return; // Let Vite handle its own HMR upgrades
  }
  // Auth check...
  blobyWss.handleUpgrade(req, socket, head, (ws) => blobyWss.emit('connection', ws, req));
});
```

If portal auth is configured, the WebSocket connection requires a `token` query parameter (`/bloby/ws?token=...`). The token is validated against the worker's session store (`getSession()`, in-process) before the upgrade completes. Invalid or missing tokens result in `401 Unauthorized` and socket destruction.

The WebSocket protocol supports these message types:

| Direction       | Type                    | Purpose                                                    |
|-----------------|-------------------------|------------------------------------------------------------|
| Client -> Server | `ping` (raw string)    | Heartbeat keepalive, server responds with `pong`           |
| Client -> Server | `user:message`         | Chat message with optional `conversationId` and attachments |
| Client -> Server | `user:stop`            | Cancel an in-progress AI generation                        |
| Client -> Server | `user:clear-context`   | Reset conversation context                                 |
| Client -> Server | `whisper:transcribe`   | Voice transcription request (forwarded to the worker API)  |
| Client -> Server | `settings:save`        | Save settings over WS (see 6.3)                            |
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

Where `hmrServer` is the supervisor's `http.Server` instance. This means the HMR WebSocket shares the same port as the supervisor (7400 by default) rather than running on the Vite port (7402). This is critical for relay operation -- the browser connects to WebSocket on the same origin the page was loaded from. Without this, HMR would break when accessed through the Morphy Relay because the browser would try to connect to `localhost:7402` directly.

The `server.on('upgrade')` handler routes upgrade requests:

- If the URL starts with `/app/ws`, it is handled by the App API WebSocket proxy.
- If the URL starts with `/bloby/ws`, it is handled by the Morphy chat WebSocket.
- All other upgrade requests fall through to Vite's own upgrade listener (which Vite attached to the server when `hmr.server` was set).

No explicit `clientPort` is configured for HMR: as the comment in `vite-dev.ts` notes, the browser connects on the same origin the page is served from, so HMR works both locally and through the Morphy Relay (`<handle>.morphyagent.com:443`).

### 6.3 WebSocket Through the Relay Carrier

For self-hosted bots, the public path is the Morphy Relay carrier: `supervisor/relay-tunnel.ts` holds one persistent outbound WSS connection to the bot's Durable Object at the edge, which muxes browser HTTP and WebSocket traffic down that single connection and replays each stream against the local supervisor port. Both the chat WebSocket (`/bloby/ws`) and Vite HMR ride the carrier transparently; the path is verified end-to-end (page load, chat WS, HMR live-reload, uploads, mid-session restart).

Historical note: the retired relay + Cloudflare Tunnel chain could not reliably forward HTTP POST requests from an iframe (502 or timeout), a limitation documented in `supervisor/chat/ARCHITECTURE.md`. That is why `settings:save`, `whisper:transcribe`, and the push subscription messages were implemented as WebSocket messages rather than REST endpoints, and why `/app/api` calls from the chat iframe can ride the `/app/ws` socket. The carrier does not have this limitation, but these WebSocket paths remain in place and are still what the chat UI uses.

The WebSocket `ping`/`pong` heartbeat (client sends raw `"ping"` string, server responds `"pong"`) serves as an application-level keepalive so intermediate proxies (the Cloudflare edge in front of the Durable Object) do not time out idle connections. The carrier itself runs a separate protocol-level PING/PONG (`PING_MS`, every 15 seconds in `relay-tunnel.ts`) to detect a dead carrier socket and redial.
