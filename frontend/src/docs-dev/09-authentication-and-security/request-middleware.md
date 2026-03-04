---
title: "Request Middleware"
---

## 8. Request Authentication Middleware

### 8.1 Auth-Exempt Routes

The supervisor defines an explicit allowlist of routes that do not require authentication:

**File:** `supervisor/index.ts`, lines 185--207

```typescript
const AUTH_EXEMPT_ROUTES = [
  'POST /api/portal/login',
  'GET /api/portal/login',
  'POST /api/portal/validate-token',
  'GET /api/portal/validate-token',
  'GET /api/onboard/status',
  'GET /api/health',
  'POST /api/onboard',
  'GET /api/push/vapid-public-key',
  'GET /api/push/status',
  'POST /api/auth/claude/start',
  'POST /api/auth/claude/exchange',
  'GET /api/auth/claude/status',
  'POST /api/auth/codex/start',
  'POST /api/auth/codex/cancel',
  'GET /api/auth/codex/status',
  'POST /api/portal/totp/setup',
  'POST /api/portal/totp/verify-setup',
  'POST /api/portal/totp/disable',
  'GET /api/portal/totp/status',
  'GET /api/portal/login/totp',
  'POST /api/portal/devices/revoke',
];
```

### 8.2 Protected Routes

All non-exempt mutation routes (POST, PUT, DELETE) under `/api` are protected:

**File:** `supervisor/index.ts`, lines 271--284

```typescript
const method = req.method || 'GET';
if (method !== 'GET' && method !== 'HEAD' && !isExemptRoute(method, req.url || '')) {
  const needsAuth = await isAuthRequired();
  if (needsAuth) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !(await validateToken(token))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }
}
```

Key behavior:

- **GET and HEAD requests are never auth-checked** at the supervisor level -- they are treated as read-only.
- **Auth is conditional:** `isAuthRequired()` checks whether a portal password has been configured (the `portalConfigured` field from `/api/onboard/status`). This result is cached for 30 seconds (line 173).
- The token is extracted from the `Authorization: Bearer <token>` header.

### 8.3 Auth Check on Individual Worker Endpoints

Some worker endpoints perform their own authorization checks independent of the supervisor middleware:

- `POST /api/portal/totp/setup` (lines 427--439): Accepts Bearer token, password, or allows during initial onboard.
- `POST /api/portal/totp/verify-setup` (lines 457--469): Same pattern.
- `POST /api/portal/totp/disable` (lines 497--523): Requires both correct password and valid TOTP code.
