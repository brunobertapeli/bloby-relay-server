---
title: "Password Authentication"
---

## 2. Password Authentication

### 2.1 Password Hashing (scrypt)

Passwords are hashed using Node.js's built-in `crypto.scryptSync` with a 16-byte random salt and a 64-byte derived key.

**File:** `worker/index.ts`, lines 18--28

```typescript
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === test;
}
```

The stored format is `<salt_hex>:<hash_hex>`. The salt is unique per password, so identical passwords produce different stored values.

Password hashing occurs during onboarding when the portal password is first set:

**File:** `worker/index.ts`, lines 617--619

```typescript
if (portalPass) {
  setSetting('portal_pass', hashPassword(portalPass));
}
```

### 2.2 Login Flow

Bloby supports two login methods to accommodate relay proxies that may not forward POST bodies:

**POST login** (`POST /api/portal/login`) -- credentials in JSON body (`worker/index.ts`, lines 389--392):

```typescript
app.post('/api/portal/login', (req, res) => {
  const { username, password } = req.body;
  handleLogin(username, password, req, res);
});
```

**GET login** (`GET /api/portal/login`) -- credentials via HTTP Basic `Authorization` header (`worker/index.ts`, lines 395--402):

```typescript
app.get('/api/portal/login', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Basic ')) { ... }
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const sep = decoded.indexOf(':');
  handleLogin(decoded.slice(0, sep), decoded.slice(sep + 1), req, res);
});
```

The shared `handleLogin` function (`worker/index.ts`, lines 349--386) executes the following logic:

1. Verify the password is provided and a stored password exists.
2. Call `verifyPassword()` against the stored `portal_pass` setting.
3. If TOTP is enabled, check for a trusted device cookie (`bloby_device`). If a valid trusted device is found, skip TOTP and issue a session immediately. Otherwise, return `{ requiresTOTP: true, pendingToken }` to trigger the 2FA flow.
4. If TOTP is not enabled (or device is trusted), clean up expired sessions, generate a 64-byte random token, create a session with a 7-day expiry, and return `{ token, expiresAt }`.

```typescript
deleteExpiredSessions();
const token = crypto.randomBytes(64).toString('hex');
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
createSession(token, expiresAt);
res.json({ token, expiresAt });
```

### 2.3 Client-Side Login

The `LoginScreen` component (`supervisor/chat/src/components/LoginScreen.tsx`, lines 61--89) sends credentials using the GET login path with a Base64-encoded `Authorization: Basic` header:

```typescript
const credentials = btoa(`admin:${password}`);
const res = await fetch('/api/portal/login', {
  headers: { 'Authorization': `Basic ${credentials}` },
  credentials: 'include',
});
```

The `credentials: 'include'` option ensures cookies (specifically the `bloby_device` trusted device cookie) are sent with the request.
