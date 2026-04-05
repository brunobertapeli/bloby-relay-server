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

This prevents browsers, CDNs, and the Cloudflare relay from caching API
responses. Without this, stale 502 errors can persist after a Worker restart.

### 2.3 Static file serving

```ts
app.use('/api/files', express.static(paths.files));
```

The `workspace/files/` directory tree is served as static assets under
`/api/files/`. Sub-directories include `audio/`, `images/`, and `documents/`.

### 2.4 Authentication Model

The Worker does **not** apply blanket authentication middleware across all
routes. Individual routes that require authentication check for it inline.
The typical patterns are:

- **Bearer token**: The `Authorization: Bearer <session_token>` header is
  checked against the `sessions` table via `getSession()`.
- **Password verification**: A plaintext password in the request body is
  verified against the scrypt hash stored in the `portal_pass` setting.
- **Onboarding bypass**: During initial setup (before `portal_pass` is set),
  certain TOTP setup endpoints allow unauthenticated access.
- **Trusted device cookie**: The `bloby_device` cookie is checked against the
  `trusted_devices` table to bypass TOTP on recognized browsers.

Session tokens are 64-byte hex strings (128 hex characters) with a 7-day
expiry. Trusted device tokens are 32-byte hex strings with a 90-day expiry.
