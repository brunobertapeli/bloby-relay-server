---
title: "Authentication"
---

### 4.1 Token Validation

The supervisor implements a token-based auth system with a 60-second in-memory cache
(lines 145-168). Tokens are validated against the worker's
`/api/portal/validate-token` endpoint. The cache avoids hitting the worker on every
request:

```typescript
// supervisor/index.ts, lines 145-146
const tokenCache = new Map<string, number>(); // token -> expiry timestamp
const TOKEN_CACHE_TTL = 60_000; // 60s
```

### 4.2 Auth Enforcement

Auth is enforced only when the portal is configured (checked via
`/api/onboard/status`, cached for 30 seconds at lines 170-183). When enabled:

- **HTTP requests**: Only mutation methods (POST, PUT, DELETE) on non-exempt routes
  require auth (line 273). GET/HEAD requests are always allowed. The token is
  extracted from the `Authorization: Bearer <token>` header (line 277).
- **WebSocket connections**: Auth is checked during the upgrade handshake via a
  `token` query parameter in the URL (lines 643-653).

Exempt routes are listed in `AUTH_EXEMPT_ROUTES` (lines 185-207) and include login,
onboarding, health check, and OAuth flow endpoints.
