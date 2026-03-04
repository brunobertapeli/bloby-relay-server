---
title: "Security Considerations"
---

## 9. Security Considerations

### 9.1 Tunnel Exposure

Fluxy is designed to be accessed over the public internet via Cloudflare tunnels. The supervisor manages two tunnel modes:

- **Quick tunnel** (`supervisor/index.ts`, lines 783--835): A temporary Cloudflare tunnel with a random subdomain. The URL changes on restart.
- **Named tunnel** (`supervisor/index.ts`, lines 837--874): A persistent Cloudflare tunnel with a fixed domain.

When exposed via a tunnel, any traffic from the internet reaches the supervisor's HTTP server. This makes the authentication layer critical: without a portal password set, the entire API (conversations, settings, AI queries, file access) is publicly accessible.

**Relay registration** (`worker/index.ts`, lines 207--312) associates a handle (e.g., `username.fluxy.bot`) with the tunnel URL via an external relay server, making the instance discoverable. The relay token (stored in `config.relay.token`) authenticates the Fluxy instance with the relay server.

### 9.2 Token Storage on Client

Session tokens are stored in `localStorage` (`supervisor/chat/src/lib/auth.ts`, line 9). This means:

- Tokens survive page reloads and browser restarts.
- Tokens are accessible to any JavaScript running on the same origin.
- Tokens are **not** sent automatically by the browser (they must be explicitly attached via `authFetch`), which provides CSRF protection.
- The `fluxy_device` trusted device cookie is `HttpOnly` and `Secure`, so it is not accessible to JavaScript and is only sent over HTTPS.

### 9.3 CORS Policy

No explicit CORS headers or middleware are configured in either the worker or supervisor. Since the supervisor serves the frontend on the same origin as the API, the default same-origin policy applies. Cross-origin requests to the API will be blocked by the browser unless the request qualifies as "simple" (no preflight).

### 9.4 Cache Control

API responses are explicitly configured to prevent caching:

**File:** `worker/index.ts`, lines 108--114

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

The supervisor protects against directory traversal when serving static files from the Fluxy chat distribution:

**File:** `supervisor/index.ts`, lines 311--316

```typescript
const fullPath = path.join(DIST_FLUXY, filePath);
if (!fullPath.startsWith(DIST_FLUXY)) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

### 9.7 Credential File Permissions

Both OAuth flows set file permissions to `0o600` (owner read/write only) on credential files:

- Claude: `~/.claude/.credentials.json` (`claude-auth.ts`, line 247)
- Codex: `~/.codex/codedeck-auth.json` (`codex-auth.ts`, line 68)

These `chmod` calls are wrapped in try/catch to handle platforms where they may fail (notably Windows).

### 9.8 Request Body Size Limit

The Express JSON parser is configured with a 10MB limit:

**File:** `worker/index.ts`, line 105

```typescript
app.use(express.json({ limit: '10mb' }));
```

This applies to all API routes and prevents excessive memory consumption from large payloads.
