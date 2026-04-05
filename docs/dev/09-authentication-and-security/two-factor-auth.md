---
title: "Two-Factor Authentication"
---

## 4. Two-Factor Authentication (2FA)

### 4.1 TOTP Setup

TOTP is implemented using the `otpauth` library with the following parameters:

**File:** `worker/index.ts`, lines 33--41

```typescript
function generateTOTPSecret(): string {
  return crypto.randomBytes(20).toString('base64url')
    .replace(/[^A-Z2-7]/gi, '').slice(0, 32).toUpperCase();
}

function verifyTOTPCode(code: string, secret: string): boolean {
  const totp = new TOTP({ issuer: 'Bloby', algorithm: 'SHA1', digits: 6, period: 30, secret });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
```

TOTP configuration:

| Parameter | Value |
|---|---|
| Algorithm | SHA1 |
| Digits | 6 |
| Period | 30 seconds |
| Window | 1 (accepts codes from the immediately previous and next period) |
| Secret length | 32 characters (Base32 alphabet) |

### 4.2 Setup Endpoint

**File:** `worker/index.ts`, lines 425--454

`POST /api/portal/totp/setup` generates a new TOTP secret, creates a QR code, and returns both:

1. Authorization is verified via Bearer token, password, or during initial onboard (when no password is set).
2. A secret is generated and stored temporarily as `totp_pending_secret`.
3. An `otpauth://` URI is built: `otpauth://totp/{botName}?issuer=Bloby&algorithm=SHA1&digits=6&period=30&secret={secret}`.
4. A QR code data URI is generated via `QRCode.toDataURL()` at 256px width.
5. The response includes `{ secret, qrDataUri, otpauthUri }`.

### 4.3 Setup Verification

**File:** `worker/index.ts`, lines 456--495

`POST /api/portal/totp/verify-setup` completes the TOTP enrollment:

1. Verifies the submitted code against the pending secret.
2. On success, persists `totp_secret` and sets `totp_enabled` to `'true'`.
3. Generates 8 recovery codes (4-byte random hex each, line 44--48).
4. Hashes each recovery code with SHA-256 and stores the hash array as JSON in `totp_recovery_codes`.
5. Returns `{ success: true, recoveryCodes: [...] }` -- the only time plaintext codes are returned.

### 4.4 Recovery Codes

**File:** `worker/index.ts`, lines 43--62

```typescript
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex'));
  }
  return codes;
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toLowerCase()).digest('hex');
}

function verifyRecoveryCode(code: string, hashes: string[]): { valid: boolean; remaining: string[] } {
  const h = hashRecoveryCode(code);
  const idx = hashes.indexOf(h);
  if (idx === -1) return { valid: false, remaining: hashes };
  const remaining = [...hashes];
  remaining.splice(idx, 1);
  return { valid: true, remaining };
}
```

- 8 codes generated per TOTP setup.
- Each code is 8 hex characters (e.g., `a3f1b2c0`).
- Codes are stored as SHA-256 hashes.
- Each recovery code is single-use: once validated, its hash is removed from the stored array and the reduced set is persisted (line 557).

### 4.5 2FA Verification Flow

When TOTP is enabled, login is a two-phase process:

**Phase 1 -- Password** (`handleLogin`, `worker/index.ts`, lines 356--378):

After password verification, the server checks for a trusted device cookie. If no valid device is found, it creates a pending login token (32 random bytes, 5-minute expiry) stored in the `settings` table as `totp_pending_login:{pendingToken}`, and returns:

```json
{ "requiresTOTP": true, "pendingToken": "..." }
```

**Phase 2 -- TOTP code** (`GET /api/portal/login/totp`, `worker/index.ts`, lines 525--584):

The TOTP verification endpoint receives `pending`, `code`, and `trust` as query parameters. The flow:

1. Validates the pending token exists and has not expired.
2. Consumes the pending token (sets its value to empty string).
3. Attempts TOTP verification against the stored secret.
4. If the TOTP code is invalid, falls back to recovery code verification.
5. On success, creates a 7-day session and returns `{ token, expiresAt }`.

### 4.6 Trusted Devices

When the user checks "Trust this device for 90 days" (see `LoginScreen.tsx`, line 244), the TOTP verification endpoint creates a trusted device record:

**File:** `worker/index.ts`, lines 575--581

```typescript
if (trust === '1') {
  deleteExpiredDevices();
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const deviceExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  createTrustedDevice(deviceToken, 'Browser', deviceExpiry);
  res.setHeader('Set-Cookie',
    `bloby_device=${deviceToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=7776000; Path=/`);
}
```

The cookie attributes:

| Attribute | Value | Purpose |
|---|---|---|
| `HttpOnly` | Yes | Prevents JavaScript access |
| `Secure` | Yes | Transmitted only over HTTPS |
| `SameSite` | Strict | No cross-origin sending |
| `Max-Age` | 7776000 (90 days) | Cookie lifetime |
| `Path` | `/` | Available on all routes |

**Trusted devices table** (`worker/db.ts`, lines 42--50):

```sql
CREATE TABLE IF NOT EXISTS trusted_devices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Device management endpoints:

- `GET /api/portal/devices` -- lists all non-expired trusted devices.
- `DELETE /api/portal/devices/:id` -- removes a specific device.
- `POST /api/portal/devices/revoke` -- removes a device by ID (body param).

When TOTP is disabled (`POST /api/portal/totp/disable`, lines 497--523), all trusted devices are wiped via `deleteAllTrustedDevices()`.

### 4.7 TOTP Login Persistence Across App Suspension

The `LoginScreen` component persists the TOTP pending state in `sessionStorage` to survive mobile app suspension (e.g., switching to an authenticator app):

**File:** `supervisor/chat/src/components/LoginScreen.tsx`, lines 47--55

```typescript
function saveLoginState(token: string) {
  sessionStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify({
    pendingToken: token,
    expiresAt: Date.now() + 4.5 * 60 * 1000, // 4.5min client-side, 5min server-side
  }));
}
```

On mount, the component checks `sessionStorage` for a valid pending token and resumes the TOTP phase if one is found (lines 27--38).
