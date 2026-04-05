---
title: "Bloby Relay"
---

The Bloby Relay is an optional cloud service that provides permanent, human-readable domain names (e.g., `username.bloby.bot`). It acts as a reverse proxy at the DNS level -- when a browser requests `username.bloby.bot`, the relay forwards the request to the user's current Cloudflare Tunnel URL.

All relay client logic lives in `shared/relay.ts`. The relay API base URL is `https://api.bloby.bot/api`.

### 4.1 Registration Flow

The `registerHandle(username, tier)` function sends a `POST /api/register` request with `{ username, tier }`. On success, the relay returns:

```ts
{ token: string; relayUrl: string }
```

- `token` -- a bearer token used for all subsequent relay API calls (heartbeat, tunnel updates, disconnect).
- `relayUrl` -- the assigned URL (e.g., `https://username.bloby.bot`).

These values are stored in `config.relay.token` and `config.relay.url` by the caller.

Before registration, `checkAvailability(username)` can be called to verify the username is available. It returns an array of handle tiers with pricing and availability information:

```ts
{
  valid: boolean;
  error?: string;
  handles: { tier: string; url: string; paid: boolean; price: number; available: boolean }[];
}
```

### 4.2 Updating the Tunnel URL

When a tunnel starts or restarts (and therefore gets a new ephemeral URL), `updateTunnelUrl(token, tunnelUrl)` sends a `PUT /api/tunnel` request. This tells the relay to forward traffic for this handle to the new tunnel URL.

### 4.3 Heartbeat Mechanism

The `startHeartbeat(token, tunnelUrl?)` function starts a periodic heartbeat to keep the handle registered as "online":

- **Interval**: 30 seconds (`setInterval(beat, 30_000)`)
- **First beat**: fires immediately (calls `beat()` before the interval)
- **Payload**: `POST /api/heartbeat` with an `Authorization: Bearer <token>` header. If `tunnelUrl` is provided, it is included in the JSON body.
- **Failure handling**: silent catch -- if a heartbeat fails, the next one retries automatically. There is no exponential backoff or failure counter.
- **Lifecycle**: `stopHeartbeat()` clears the interval timer. It is called during shutdown and before restarting heartbeats (to avoid duplicates).

If the relay does not receive heartbeats for a server-defined timeout period, it marks the handle as offline and stops forwarding traffic.

### 4.4 Disconnect Handling

On graceful shutdown, `disconnect(token)` is called:

1. Stops the heartbeat timer via `stopHeartbeat()`.
2. Sends `POST /api/disconnect` with the bearer token.
3. The request is best-effort -- if it fails (network error, timeout), the comment notes that "heartbeat timeout will mark offline" eventually.

The supervisor's shutdown sequence in `supervisor/index.ts` calls:

```ts
stopHeartbeat();
const latestConfig = loadConfig();
if (latestConfig.relay?.token) {
  await disconnect(latestConfig.relay.token);
}
```

It also clears the persisted `tunnelUrl` from the config to prevent stale URLs from being reused on next startup:

```ts
delete latestConfig.tunnelUrl;
saveConfig(latestConfig);
```

### 4.5 Releasing a Handle

`releaseHandle(token)` sends `DELETE /api/handle` to permanently release the username. This is a destructive operation -- the handle becomes available for others to claim.

### 4.6 When Relay Is Used vs. When It Is Not

The relay is only used when **both** conditions are met:

1. `config.tunnel.mode === 'quick'` -- a Cloudflare Quick Tunnel is active.
2. `config.relay.token` is present -- the user has registered a handle.

Named tunnels do not use the relay because they already have a stable domain. When tunnel mode is `'off'`, there is no tunnel to relay to.

The relay integration point in `supervisor/index.ts`:

```ts
if (config.relay?.token) {
  await updateTunnelUrl(config.relay.token, tunnelUrl);
  startHeartbeat(config.relay.token, tunnelUrl);
}
```
