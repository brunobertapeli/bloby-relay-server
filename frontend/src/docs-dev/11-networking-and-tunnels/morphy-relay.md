---
title: "Morphy Relay"
---

The Morphy Relay is the cloud control plane that provides permanent, human-readable domain names (e.g., `username.morphyagent.com`). It does not sit in the data path: browser traffic on a bot's subdomain is served by the Cloudflare edge Worker and the bot's Durable Object, which multiplex it down the agent's persistent carrier socket (see the Carrier page). The relay handles everything around that connection: handle registration, carrier-ticket minting, wallet reporting, and disconnects.

All relay client logic lives in `shared/relay.ts`. The relay API base URL is `https://api.morphyagent.com/api`.

### 4.1 Registration Flow

The `registerHandle(username, tier, walletAddress?)` function sends a `POST /api/register` request. On success, the relay returns:

```ts
{ token: string; relayUrl: string }
```

- `token` -- a bearer token used for all subsequent relay API calls (ticket minting, wallet reporting, disconnect, release).
- `relayUrl` -- the assigned URL (e.g., `https://username.morphyagent.com`).

These values are stored in `config.relay.token` and `config.relay.url` by the caller (`worker/index.ts`).

Before registration, `checkAvailability(username)` can be called to verify the username is available. It returns an array of handle tiers with pricing and availability information:

```ts
{
  valid: boolean;
  error?: string;
  handles: { tier: string; url: string; paid: boolean; price: number; available: boolean }[];
}
```

Purchased premium handles use a separate flow: `claimReservedHandle(handle, hash, walletAddress?)` sends `POST /api/handle/claim-reserved` with the handle and its activation code, and returns the same `{ token, relayUrl }` shape.

### 4.2 Carrier Tickets

The `fetchTicket(token)` function sends `POST /api/edge/ticket` with the bearer token and returns `{ ticket, expiresIn }`. The ticket is a short-lived Ed25519-signed credential (roughly 5 minutes) that the agent presents when dialing its Durable Object carrier. The relay holds the private signing key; the edge Worker verifies tickets with the public key only. `RelayTunnel` caches the last good ticket for about 4 minutes and re-mints on demand, so ticket minting is cheap and frequent.

### 4.3 Presence (No Heartbeat)

There is no agent-side heartbeat in relay mode. Presence is the live carrier socket itself: the bot's Durable Object notifies the relay (`POST /api/edge/presence`) when the carrier connects or drops, which keeps the handle's online status accurate in real time. The comment in `shared/relay.ts` states it directly: relay-mode presence is the live carrier socket, so there is no heartbeat to stop.

### 4.4 Disconnect Handling

On graceful shutdown, `disconnect(token)` sends a best-effort `POST /api/disconnect` with the bearer token -- if it fails (network error, timeout), the carrier drop will mark the handle offline anyway.

The supervisor's shutdown sequence in `supervisor/index.ts` calls:

```ts
const latestConfig = loadConfig();
if (latestConfig.relay?.token) {
  await disconnect(latestConfig.relay.token);
}
// ...
relayTunnel?.close();
```

The persisted `config.tunnelUrl` holds the carrier's derived URL (`relayTunnel.publicUrl`), which is stable forever and never rotates, so a graceful shutdown leaves it untouched: there is no stale URL to clear. (`loadConfig()` in `shared/config.ts` strips only the old random `tunnelUrl` carried by a legacy `quick`/`named` config.)

### 4.5 Releasing a Handle

`releaseHandle(token)` sends `DELETE /api/handle` to permanently release the username. This is a destructive operation -- the handle becomes available for others to claim. The handle-change flow in `worker/index.ts` releases the old handle before registering the new one.

### 4.6 When Relay Is Used vs. When It Is Not

The relay client is used whenever `config.relay.token` is present. In `tunnel.mode: 'relay'` (the default), the token is required to mint carrier tickets -- without one, the supervisor logs that the carrier will connect after onboarding, and only local access works until a handle is registered.

When tunnel mode is `'off'` (managed/hosted bots), no carrier is opened and the bot is reached directly. These bots never register or send presence, so `reportWallet(token, walletAddress)` (`POST /api/wallet`) is called fire-and-forget on boot -- it is the only way a managed bot's wallet address reaches the relay dashboard:

```ts
if (config.tunnel.mode === 'off') {
  if (config.relay?.token && config.wallet?.address) {
    reportWallet(config.relay.token, config.wallet.address).catch(() => {});
  }
}
```
