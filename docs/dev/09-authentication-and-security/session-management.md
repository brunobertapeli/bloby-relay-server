---
title: "Session Management"
---

## 3. Session Management

### 3.1 Session Token Generation

Session tokens are 64 cryptographically random bytes encoded as hexadecimal (128 characters):

```typescript
const token = crypto.randomBytes(64).toString('hex');
```

**File:** `worker/index.ts`, line 366 and line 383.

### 3.2 Session Storage in SQLite

Sessions are stored in the `sessions` table:

**File:** `worker/db.ts`, lines 30--34

```sql
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

Database functions for session CRUD:

| Function | File | Lines | Purpose |
|---|---|---|---|
| `createSession(token, expiresAt)` | `worker/db.ts` | 118--119 | Inserts a new session row |
| `getSession(token)` | `worker/db.ts` | 121--123 | Retrieves a session only if `expires_at > datetime('now')` |
| `deleteSession(token)` | `worker/db.ts` | 124--126 | Deletes a specific session |
| `deleteExpiredSessions()` | `worker/db.ts` | 127--129 | Purges all sessions where `expires_at <= datetime('now')` |

The `getSession` query is the primary validation check:

```typescript
export function getSession(token: string) {
  return db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
}
```

### 3.3 Session Validation in Middleware

The supervisor validates tokens by calling the worker's `/api/portal/validate-token` endpoint:

**File:** `supervisor/index.ts`, lines 148--168

```typescript
async function validateToken(token: string): Promise<boolean> {
  const cached = tokenCache.get(token);
  if (cached && cached > Date.now()) return true;

  try {
    const res = await fetch(`http://127.0.0.1:${workerPort}/api/portal/validate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json() as { valid: boolean };
    if (data.valid) {
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

The supervisor maintains an in-memory token cache (`Map<string, number>`) with a 60-second TTL (line 146) to avoid hitting the worker on every request.

### 3.4 Session Expiry and Cleanup

- **Session lifetime:** 7 days from creation (`Date.now() + 7 * 24 * 60 * 60 * 1000`).
- **Cleanup:** `deleteExpiredSessions()` is called at the start of each successful login (lines 365, 381, 569), which purges any sessions where `expires_at` has passed. There is no background cron; cleanup is login-triggered.
- **Validation:** `getSession()` includes `expires_at > datetime('now')` in its WHERE clause, so expired sessions are never returned even if cleanup hasn't run.

### 3.5 Client-Side Token Storage

**File:** `supervisor/chat/src/lib/auth.ts`, lines 1--38

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

The `authFetch` wrapper (lines 22--38) attaches tokens as `Bearer` headers and handles 401 responses by clearing the token and invoking a registered failure callback:

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
