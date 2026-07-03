---
title: "Security Considerations"
---

## 9. Security Considerations

### 9.1 Tunnel Exposure

Morphy is designed to be accessed over the public internet through the Morphy relay. The supervisor holds one persistent outbound WSS connection (the "carrier", `supervisor/relay-tunnel.ts`) to a per-bot Durable Object at the Cloudflare edge, authenticated with short-lived Ed25519 tickets minted by the relay control plane (`fetchTicket` in `shared/relay.ts`). Browser traffic flows browser -> Cloudflare Worker -> Durable Object -> carrier -> local supervisor.

- `tunnel.mode` (`shared/config.ts`) is `'relay'` (default for self-hosted) or `'off'` (managed/hosted instances, reached directly). Legacy cloudflared `quick`/`named` configs are migrated to `'relay'` automatically on load.
- The public URL is stable and derived from the handle: `<handle>.open.morphyagent.com` (free tier) or `<handle>.morphyagent.com` (premium). A reconnect is a redial of the same Durable Object: no URL rotation, no re-registration.
- Every request replayed down the carrier carries the real client IP in `cf-connecting-ip` plus an `x-morphy-tunnel` marker (client-supplied copies are stripped), so the supervisor's loopback guards can keep internal control endpoints unreachable from the public path.

When exposed via the relay, any traffic from the internet reaches the supervisor's HTTP server. This makes the authentication layer critical: without a portal password set, the entire API (conversations, settings, AI queries, file access) is publicly accessible.

**Handle registration** (`registerHandle` in `shared/relay.ts`, called from the `/api/handle/*` routes in `worker/index.ts`) associates a handle with this instance on the relay control plane. The returned relay token (stored in `config.relay.token`) authenticates the instance to the relay, including carrier ticket minting. No tunnel URL is registered or stored; the carrier's URL is derived from the handle and tier.

### 9.2 Token Storage on Client

Session tokens are stored in `localStorage` (`supervisor/chat/src/lib/auth.ts`). This means:

- Tokens survive page reloads and browser restarts.
- Tokens are accessible to any JavaScript running on the same origin.
- Tokens are **not** sent automatically by the browser (they must be explicitly attached via `authFetch`), which provides CSRF protection.
- The `bloby_device` trusted device cookie is `HttpOnly` and `Secure`, so it is not accessible to JavaScript and is only sent over HTTPS.

### 9.3 CORS Policy

No explicit CORS headers or middleware are configured in either the worker or supervisor. Since the supervisor serves the frontend on the same origin as the API, the default same-origin policy applies. Cross-origin requests to the API will be blocked by the browser unless the request qualifies as "simple" (no preflight).

### 9.4 Cache Control

API responses are explicitly configured to prevent caching:

**File:** `worker/index.ts` (the `/api` middleware)

```typescript
app.use('/api', (_, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
```

This prevents relay servers, CDNs, and browsers from caching API responses, which could otherwise serve stale authenticated content or error pages.

### 9.5 Rate Limiting

There is no rate limiting implemented on any endpoint. Login attempts, TOTP verification, and API requests can be made at any rate. This is a known area for improvement, particularly for:

- `POST /api/portal/login` and `GET /api/portal/login` (password brute force).
- `GET /api/portal/login/totp` (TOTP code brute force -- mitigated somewhat by the 5-minute pending token expiry and single-use consumption).

### 9.6 Directory Traversal Protection

The supervisor protects against directory traversal when serving static files from the Morphy chat distribution:

**File:** `supervisor/index.ts` (static file handler)

```typescript
const fullPath = path.join(DIST_CHAT, filePath);
if (!fullPath.startsWith(DIST_CHAT)) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

### 9.7 Credential File Permissions

Both OAuth flows set file permissions to `0o600` (owner read/write only) on credential files:

- Claude: `~/.claude/.credentials.json` (`worker/claude-auth.ts`)
- Codex: `~/.codex/auth.json` (`worker/codex-auth.ts`; the legacy `~/.codex/codedeck-auth.json` layout is migrated to `auth.json` and deleted on first load)

These `chmod` calls are wrapped in try/catch to handle platforms where they may fail (notably Windows).

### 9.8 Request Body Size Limit

The Express JSON parser is configured with a 10MB limit:

**File:** `worker/index.ts`

```typescript
app.use(express.json({ limit: '10mb' }));
```

This applies to all API routes and prevents excessive memory consumption from large payloads.
