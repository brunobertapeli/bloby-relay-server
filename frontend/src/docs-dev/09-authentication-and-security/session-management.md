---
title: "Session Management"
---

## 3. Session Management

### 3.1 Session Token Generation

Session tokens are 64 cryptographically random bytes encoded as hexadecimal (128 characters):

```typescript
const token = crypto.randomBytes(64).toString('hex');
```

**File:** `worker/index.ts`. Tokens are created in `handleLogin` (both the plain-password path and the trusted-device path) and in the TOTP login endpoint (`GET /api/portal/login/totp`).

### 3.2 Session Storage in SQLite

Sessions are stored in the `sessions` table:

**File:** `worker/db.ts`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

Database functions for session CRUD (all in `worker/db.ts`):

| Function | Purpose |
|---|---|
| `createSession(token, expiresAt)` | Inserts a new session row |
| `getSession(token)` | Retrieves a session only if `expires_at > datetime('now')` |
| `deleteSession(token)` | Deletes a specific session |
| `deleteExpiredSessions()` | Purges all sessions where `expires_at <= datetime('now')` |

The `getSession` query is the primary validation check:

```typescript
export function getSession(token: string) {
  return db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
}
```

### 3.3 Session Validation in Middleware

The worker runs in-process (the supervisor mounts `createWorkerApp()` from `worker/index.ts` directly), so the supervisor validates tokens by querying SQLite itself: it imports `getSession` from `worker/db.ts` and calls it synchronously. There is no HTTP hop.

**File:** `supervisor/index.ts`, `validateToken()`

```typescript
async function validateToken(token: string): Promise<boolean> {
  const cached = tokenCache.get(token);
  if (cached && cached > Date.now()) return true;

  try {
    const session = getSession(token);
    if (session) {
      tokenCache.set(token, Date.now() + TOKEN_CACHE_TTL);
      return true;
    }
    tokenCache.delete(token);
    return false;
  } catch {
    return false;
  }
}
```

The supervisor maintains an in-memory token cache (`Map<string, number>`) with a 60-second TTL (`TOKEN_CACHE_TTL`) to avoid a database query on every request.

The worker still exposes `/api/portal/validate-token` (GET and POST) as a pre-login endpoint; clients use it to check whether a stored token is still valid. It is on the supervisor's `PUBLIC_PRELOGIN_ROUTES` allowlist, but the supervisor's own middleware does not call it.

### 3.4 Session Expiry and Cleanup

- **Session lifetime:** 7 days from creation (`Date.now() + 7 * 24 * 60 * 60 * 1000`).
- **Cleanup:** `deleteExpiredSessions()` is called at the start of each successful login (in `handleLogin` and in the TOTP login endpoint), which purges any sessions where `expires_at` has passed. There is no background cron; cleanup is login-triggered.
- **Validation:** `getSession()` includes `expires_at > datetime('now')` in its WHERE clause, so expired sessions are never returned even if cleanup hasn't run.

### 3.5 Client-Side Token Storage

**File:** `supervisor/chat/src/lib/auth.ts`

The client stores the session token in `localStorage` under the key `bloby_token`:

```typescript
const TOKEN_KEY = 'bloby_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
```

The `authFetch` wrapper attaches tokens as `Bearer` headers and handles 401 responses by clearing the token and invoking a registered failure callback:

```typescript
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && token) {
    clearAuthToken();
    authFailureCallback?.();
  }
  return res;
}
```
