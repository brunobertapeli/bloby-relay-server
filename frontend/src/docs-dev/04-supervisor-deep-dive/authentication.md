---
title: "Authentication"
---

### 4.1 Token Validation

The supervisor implements a token-based auth system with a 60-second in-memory cache
(`tokenCache` in `supervisor/index.ts`). Tokens are session tokens looked up in-process
via `getSession()` from `worker/db.ts` (a SQLite read, no HTTP hop). The cache avoids
hitting the database on every request:

```typescript
// supervisor/index.ts
const tokenCache = new Map<string, number>(); // token → expiry timestamp
const TOKEN_CACHE_TTL = 60_000; // 60s
```

### 4.2 Auth Enforcement

Auth is enforced once a portal password is set. `isAuthRequired()` reads the
`portal_pass` setting directly (cached for 30 seconds). When enabled:

- **HTTP requests**: Secure by default. EVERY `/api/*` route requires a valid token
  except a small public pre-login allowlist; a new route is therefore gated unless
  someone explicitly adds it to the list. The token is extracted from the
  `Authorization: Bearer <token>` header. Internal supervisor-to-worker calls bypass
  the gate with a per-process `x-internal` secret.
- **WebSocket connections**: Auth for `/bloby/ws` is checked during the upgrade
  handshake via a `token` query parameter in the URL. `/app/ws` is not gated by the
  supervisor (the user's backend handles its own auth).

The public allowlist lives in `PUBLIC_PRELOGIN_ROUTES` (plus method-specific
`PUBLIC_PRELOGIN_PREFIXES`) and covers the pre-login surface: login, TOTP, onboarding
status, health check, non-secret settings, channel pairing, and provider OAuth flow
endpoints. `POST /api/onboard` is special-cased: open only on genuine first run (no
password yet, checked uncached), token-required afterward.
