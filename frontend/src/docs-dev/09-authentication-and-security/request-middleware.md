---
title: "Request Middleware"
---

## 8. Request Authentication Middleware

### 8.1 Public Pre-Login Allowlist

The supervisor is secure by default: once a portal password is set, **every** `/api` route requires a valid Bearer token unless it appears on an explicit public allowlist. The allowlist covers only the pre-login surface (login, onboarding, health, non-secret config) plus channel-onboarding endpoints:

**File:** `supervisor/index.ts` (`PUBLIC_PRELOGIN_ROUTES`, `PUBLIC_PRELOGIN_PREFIXES`)

```typescript
const PUBLIC_PRELOGIN_ROUTES = [
  'GET /api/health',
  'GET /api/onboard/status',
  'GET /api/settings',                 // secrets already stripped (worker denylist)
  'GET /api/push/vapid-public-key',
  'GET /api/portal/login',
  'POST /api/portal/login',
  'GET /api/portal/validate-token',
  'POST /api/portal/validate-token',
  'GET /api/portal/login/totp',
  'GET /api/portal/totp/status',
  'POST /api/portal/totp/setup',        // self-protected in-handler
  'POST /api/portal/totp/verify-setup', // self-protected in-handler
  'POST /api/portal/totp/disable',      // self-protected (password + valid code)
  'POST /api/portal/verify-password',
  // ...plus WhatsApp/Telegram/Alexa channel-onboarding routes
];

const PUBLIC_PRELOGIN_PREFIXES = [
  'POST /api/auth/',   // provider OAuth setup/status
  'GET /api/auth/',
  'DELETE /api/auth/',
  'GET /api/handle/',  // handle availability checks (registration POSTs stay gated)
];
```

`isPublicRoute(method, url)` matches the exact `METHOD /path` pairs first, then the method-specific prefixes. A `HEAD` request to a public `GET` route is treated as public. A newly added `/api` route is therefore gated by default; it can only be exposed by explicitly adding it to this list.

### 8.2 Protected Routes

All non-public `/api` routes (including `GET` data reads such as conversations, context, wallet, and devices) are protected:

**File:** `supervisor/index.ts` (the `/api` gate in the request handler)

```typescript
if (!isInternal) {
  const method = req.method || 'GET';
  if (!isPublicRoute(method, req.url || '')) {
    const isOnboard = method === 'POST' && (req.url || '').split('?')[0] === '/api/onboard';
    const needsAuth = isOnboard ? !!getSetting('portal_pass') : await isAuthRequired();
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
}
```

Key behavior:

- **Secure by default:** the gate no longer skips `GET`/`HEAD`. Reads and writes alike require a token once a password is set; only the allowlist above is exempt.
- **Internal bypass:** the supervisor's own in-process calls to the worker carry a per-process secret in the `x-internal` header and skip the gate.
- **Auth is conditional:** `isAuthRequired()` checks whether a portal password has been configured (the `portal_pass` setting). The result is cached for 30 seconds; valid tokens are cached for 60 seconds (`validateToken`).
- **First-run onboarding:** `POST /api/onboard` is open only while no `portal_pass` exists. It reads the setting directly rather than through the 30-second cache, so the gate closes the instant onboarding sets a password.
- The token is extracted from the `Authorization: Bearer <token>` header.

### 8.3 Auth Check on Individual Worker Endpoints

Some worker routes (`worker/index.ts`, mounted in-process via `createWorkerApp()`) are on the public allowlist but perform their own authorization checks in-handler:

- `POST /api/portal/totp/setup`: Accepts Bearer token, password, or allows during initial onboard (no password stored yet).
- `POST /api/portal/totp/verify-setup`: Same pattern.
- `POST /api/portal/totp/disable`: Requires both correct password and valid TOTP code.
