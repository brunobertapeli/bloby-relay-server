---
title: "Middleware"
---

### 2.1 JSON body parsing

```ts
app.use(express.json({ limit: '10mb' }));
```

All routes accept JSON bodies up to 10 MB. The `/api/whisper/transcribe`
endpoint applies a second `express.json({ limit: '10mb' })` explicitly on its
own route definition (redundant but harmless).

### 2.2 Cache-control headers (anti-caching)

Applied to every path under `/api`:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

This prevents browsers, CDNs, and the Morphy relay from caching API
responses. Without this, stale 502 errors could persist after the agent
restarts.

### 2.3 Static file serving

```ts
app.use('/api/files', express.static(paths.files));
```

The `workspace/files/` directory tree is served as static assets under
`/api/files/`. Sub-directories include `audio/`, `images/`, and `documents/`.

### 2.4 Authentication Model

API authentication is secure by default and enforced by the supervisor,
which mounts the Worker app in-process. Once a portal password is set,
**every** `/api` route requires a valid `Authorization: Bearer
<session_token>` header (checked against the `sessions` table via
`getSession()`) unless the route is on the explicit pre-login allowlist
(`PUBLIC_PRELOGIN_ROUTES` in `supervisor/index.ts`): health, onboarding
status, portal login/validate, the secret-stripped `GET /api/settings`,
provider OAuth routes under `/api/auth/`, handle availability, and channel
onboarding. New routes are therefore gated by default.

Additional patterns used by individual routes:

- **Password verification**: A plaintext password in the request body is
  verified against the scrypt hash stored in the `portal_pass` setting.
- **First-run bypass**: Before `portal_pass` is set, the gate is open so
  onboarding and TOTP setup can complete; those endpoints also self-protect
  in-handler once a password exists.
- **Trusted device cookie**: The `bloby_device` cookie is checked against the
  `trusted_devices` table to bypass TOTP on recognized browsers.
- **Internal calls**: The supervisor's own requests carry a per-process
  `x-internal` secret and bypass the gate.

Session tokens are 64-byte hex strings (128 hex characters) with a 7-day
expiry. Trusted device tokens are 32-byte hex strings with a 90-day expiry.
