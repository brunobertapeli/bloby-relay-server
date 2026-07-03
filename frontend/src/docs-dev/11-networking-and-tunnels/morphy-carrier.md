---
title: "The Morphy Carrier"
---

The Morphy Carrier is a persistent, encrypted outbound WebSocket connection from the local machine to the Cloudflare edge. A Cloudflare Worker routes each bot's subdomain to a per-bot Durable Object, and the Durable Object multiplexes browser HTTP and WebSocket traffic down the agent's carrier socket to the local supervisor. This eliminates the need for port forwarding, static IPs, or firewall rules.

Earlier versions shipped the `cloudflared` binary and exposed the bot through Cloudflare Quick or Named Tunnels. That path was removed in v0.3.8: there is no external binary to download, no child process to babysit, and no random URL. Legacy `quick` and `named` configs are migrated automatically (see 3.2).

All carrier logic lives in `supervisor/relay-tunnel.ts` (the `RelayTunnel` class).

### 3.1 The Carrier Connection

`RelayTunnel` opens one long-lived outbound WSS connection to the bot's Durable Object at `wss://<host>/__morphy/carrier`, where `<host>` is derived from the registered handle and tier:

- Standard tier: `username.open.morphyagent.com`
- Premium tier: `username.morphyagent.com`

Because the host is derived, `publicUrl` is stable forever. A reconnect is just a redial of the same Durable Object -- no random URL, no relay re-registration, no DNS propagation. The supervisor persists `config.tunnelUrl` once and never rotates it.

`connect(timeoutMs)` (default 15 seconds) resolves `true` when the first connection opens, or `false` if it has not opened in time. Either way, background reconnects continue -- the bot comes online as soon as the network allows. There is no fallback transport: the carrier dials WSS on port 443 to Cloudflare, and if that is blocked, essentially all HTTPS is blocked.

### 3.2 Tunnel Modes and Legacy Migration

`config.tunnel.mode` (`shared/config.ts`) has exactly two values:

- `'relay'` (the default) -- the persistent carrier described on this page. Requires a relay token to mint tickets; before onboarding, the supervisor logs that the carrier will connect after registration.
- `'off'` -- no tunnel at all. Managed/hosted bots run this way and are reached directly.

The legacy `'quick'` and `'named'` modes were removed along with `cloudflared`. `loadConfig()` force-migrates any stored `quick` or `named` config to `{ mode: 'relay' }` and deletes the stale random `tunnelUrl`, so a bot updating to a cloudflared-free build never tries to spawn a binary that no longer ships. The mode can also be switched at runtime (off/relay) via the dashboard's `tunnel:switch` WebSocket message.

### 3.3 Ed25519 Carrier Tickets

The carrier authenticates with a short-lived ticket instead of a long-lived secret on the wire. Before dialing, `RelayTunnel.getTicket()` calls `fetchTicket(token)` (`shared/relay.ts`), which mints a ticket from the relay via `POST /api/edge/ticket` using the long-lived relay token. The ticket is Ed25519-signed: the relay holds the private key, and the edge Worker verifies with the public key only, so no edge component can mint credentials.

Tickets expire in roughly 5 minutes. The client caches the last good ticket for about 4 minutes and presents it as an `Authorization: Bearer` header on the WebSocket handshake.

### 3.4 Stream Multiplexing and Backpressure

The Durable Object and the client speak a small binary frame protocol (6-byte header: type, flags, stream id). Frame types cover the handshake (`HELLO`/`HELLO_ACK`), liveness (`PING`/`PONG`), and per-stream lifecycle (`OPEN`, `RESP`, `DATA`, `CLOSE`, `RESET`).

For each browser request the DO sends an `OPEN` frame; the client replays it against the local server:

- **HTTP streams** issue an `http.request` to `127.0.0.1:<config.port>` and stream the response back in `DATA` frames of at most 64 KB. `accept-encoding` is forced to `identity` locally so Cloudflare re-compresses fresh at the edge.
- **WebSocket streams** (chat, Vite HMR) open a local `ws://127.0.0.1:<port>` connection and relay frames in both directions, buffering any frames that arrive before the local socket opens.

Backpressure is handled by watermarks: when the carrier socket's `bufferedAmount` exceeds 8 MB, the local response is paused; it resumes once the buffer drains below 1 MB.

Every replayed request is stamped with the real client IP in `cf-connecting-ip` and an unconditional `x-morphy-tunnel` marker, after stripping any client-supplied copies of those headers. The supervisor's loopback guards reject requests carrying either marker, so control endpoints stay unreachable from the public path even though carrier traffic arrives on `127.0.0.1`.

### 3.5 Liveness and the Wake Watchdog

There is no URL rotation to recover from, so health handling is much simpler than in the cloudflared era:

1. **Ping/pong** -- the client pings every 15 seconds (`PING_MS`). If no pong has arrived for 30 seconds (`PONG_TIMEOUT_MS`), it tears the connection down and redials immediately.
2. **Reconnect backoff** -- failed dials retry with jittered exponential backoff, capped at 30 seconds.
3. **Wake watchdog** -- the supervisor (`supervisor/index.ts`) runs a 30-second `setInterval`. If more than 60 seconds elapsed since the last tick, the machine likely slept or changed networks, and the watchdog calls `reconnectNow()` to force an immediate redial rather than waiting out the pong deadline.

The watchdog does nothing else: no process restarts, no URL updates, no relay notifications. The Durable Object reports presence to the relay on connect and drop, so online status follows the socket automatically.

### 3.6 Readiness Probes

Before dialing the carrier, the supervisor runs a readiness probe loop (up to 30 attempts, 1 second apart). It fetches `http://127.0.0.1:<port>/api/health` with a 3-second timeout. This ensures the local server is healthy before replayed requests can arrive, so early traffic does not 502. If all 30 probes fail, the supervisor proceeds anyway and dials the carrier regardless.
