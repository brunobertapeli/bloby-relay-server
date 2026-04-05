---
title: "Schema"
---

The complete schema is defined as a single SQL string constant (`SCHEMA`) in
`worker/db.ts`. All tables use `CREATE TABLE IF NOT EXISTS`, making the schema
idempotent -- it can be re-executed safely on every startup.

### 3.1 conversations

Stores chat conversation metadata. Each conversation may contain many messages.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  title      TEXT,
  model      TEXT,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `lower(hex(randomblob(8)))` | 16-character lowercase hex string (8 random bytes). Auto-generated. |
| `title` | TEXT | nullable | `NULL` | Human-readable conversation title. |
| `model` | TEXT | nullable | `NULL` | AI model identifier used for the conversation (e.g., `gpt-4o`, `claude-sonnet-4-20250514`). |
| `session_id` | TEXT | nullable | `NULL` | Agent SDK session ID for stateful multi-turn conversations. Added by migration. |
| `created_at` | DATETIME | | `CURRENT_TIMESTAMP` | Row creation timestamp. |
| `updated_at` | DATETIME | | `CURRENT_TIMESTAMP` | Last modification timestamp. Updated whenever a message is added. |

**Indexes:** None beyond the primary key.

**Foreign keys:** None. This is a root entity.

**Notes:**

- The `session_id` column is not part of the original `CREATE TABLE` statement.
  It was added by migration (see Section 5) and will be present via `ALTER TABLE`
  on existing databases.
- `updated_at` is explicitly bumped to `CURRENT_TIMESTAMP` each time a message
  is inserted via `addMessage()`.

---

### 3.2 messages

Stores individual chat messages within conversations.

```sql
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  model           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `lower(hex(randomblob(8)))` | 16-character lowercase hex ID. |
| `conversation_id` | TEXT | NOT NULL, FOREIGN KEY | -- | References `conversations(id)`. Cascade delete ensures messages are removed when the parent conversation is deleted. |
| `role` | TEXT | NOT NULL, CHECK | -- | One of `'user'`, `'assistant'`, or `'system'`. Enforced by CHECK constraint. |
| `content` | TEXT | NOT NULL | -- | The message body (plain text, markdown, or structured content). |
| `tokens_in` | INTEGER | nullable | `NULL` | Input token count for this message (populated for assistant responses). |
| `tokens_out` | INTEGER | nullable | `NULL` | Output token count for this message. |
| `model` | TEXT | nullable | `NULL` | Model that generated this message (for assistant messages). |
| `audio_data` | TEXT | nullable | `NULL` | Base64-encoded audio data for voice messages. Added by migration. |
| `attachments` | TEXT | nullable | `NULL` | JSON string containing persistent file attachment metadata. Added by migration. |
| `created_at` | DATETIME | | `CURRENT_TIMESTAMP` | Insertion timestamp. |

**Indexes:**

```sql
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
```

This composite index is the primary query accelerator. It covers:

- Fetching all messages for a conversation ordered by time (`getMessages`)
- Fetching recent messages for a conversation (`getRecentMessages`)
- Conversation-scoped ordering

**Foreign keys:**

| Column | References | On Delete |
|---|---|---|
| `conversation_id` | `conversations(id)` | `CASCADE` |

**Notes:**

- `audio_data` and `attachments` are migration-added columns (not in the
  original CREATE TABLE). See Section 5.
- The `role` CHECK constraint restricts values at the database level, preventing
  invalid roles from being stored regardless of application logic.

---

### 3.3 settings

Generic key-value store for application settings and configuration values.

```sql
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | -- | Setting identifier. Must be unique. |
| `value` | TEXT | NOT NULL | -- | Setting value (always stored as text, parsed by the application as needed). |
| `updated_at` | DATETIME | | `CURRENT_TIMESTAMP` | Last update timestamp. Updated on upsert. |

**Indexes:** Primary key index only.

**Foreign keys:** None.

**Known keys used by the application:**

| Key | Description | Example Value |
|---|---|---|
| `user_name` | Human user's display name | `"Bruno"` |
| `agent_name` | AI agent's display name | `"Bloby"` |
| `onboard_complete` | Whether onboarding wizard has been completed | `"true"` |
| `portal_user` | Portal login username | `"admin"` |
| `portal_pass` | Scrypt-hashed portal password | `"<salt>:<hash>"` |
| `vapid_public_key` | Web Push VAPID public key | Base64url string |
| `vapid_private_key` | Web Push VAPID private key | Base64url string |
| `whisper_enabled` | Whether Whisper speech-to-text is enabled | `"true"` / `"false"` |
| `whisper_key` | OpenAI API key for Whisper transcription | `"sk-..."` |
| `current_conversation` | ID of the currently active conversation (shared across devices) | `"a1b2c3d4e5f67890"` |
| `totp_enabled` | Whether TOTP two-factor authentication is enabled | `"true"` / `"false"` |
| `totp_secret` | TOTP shared secret (base32-encoded) | `"JBSWY3DPEHPK3PXP..."` |
| `totp_pending_secret` | Temporary secret during TOTP setup (before verification) | Same format as `totp_secret` |
| `totp_recovery_codes` | JSON array of SHA-256 hashed recovery codes | `'["abc123...","def456..."]'` |
| `totp_pending_login:<token>` | Expiry timestamp for a pending TOTP login challenge | ISO 8601 datetime string |

---

### 3.4 sessions

Stores active authentication sessions for the portal.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `token` | TEXT | PRIMARY KEY | -- | 128-character hex string (64 random bytes). Used as a bearer token. |
| `created_at` | DATETIME | | `CURRENT_TIMESTAMP` | Session creation time. |
| `expires_at` | DATETIME | NOT NULL | -- | Absolute expiry time. Sessions are valid for 7 days from creation. |

**Indexes:** Primary key index only.

**Foreign keys:** None.

**Notes:**

- Expired sessions are cleaned up lazily -- `deleteExpiredSessions()` is called
  during login, not on a timer.
- Session validation checks `expires_at > datetime('now')` at query time,
  ensuring expired tokens are never returned even if cleanup has not run.

---

### 3.5 push_subscriptions

Stores Web Push API subscription endpoints for browser push notifications.

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth  TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-incremented | Numeric row identifier. |
| `endpoint` | TEXT | NOT NULL, UNIQUE | -- | The push service URL provided by the browser's Push API. |
| `keys_p256dh` | TEXT | NOT NULL | -- | P-256 Diffie-Hellman public key for message encryption. |
| `keys_auth` | TEXT | NOT NULL | -- | Authentication secret for the push subscription. |
| `created_at` | DATETIME | | `CURRENT_TIMESTAMP` | Subscription registration time. |

**Indexes:** Implicit unique index on `endpoint`.

**Foreign keys:** None.

**Notes:**

- The UNIQUE constraint on `endpoint` enables upsert behavior -- when a
  subscription is re-registered from the same browser, the keys are updated
  rather than creating a duplicate row.
- Invalid/expired subscriptions (HTTP 410 or 404 from push service) are removed
  automatically when a push send fails.

---

### 3.6 trusted_devices

Stores trusted browser devices that have completed 2FA verification, allowing
them to bypass TOTP on subsequent logins.

```sql
CREATE TABLE IF NOT EXISTS trusted_devices (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  token      TEXT NOT NULL UNIQUE,
  label      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Default | Description |
|---|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | `lower(hex(randomblob(8)))` | 16-character hex identifier for management operations (listing, deletion). |
| `token` | TEXT | NOT NULL, UNIQUE | -- | 64-character hex token stored in an HttpOnly cookie (`bloby_device`). |
| `label` | TEXT | nullable | `NULL` | Human-readable device label (e.g., `"Browser"`). |
| `created_at` | DATETIME | | `CURRENT_TIMESTAMP` | When the device was first trusted. |
| `expires_at` | DATETIME | NOT NULL | -- | Absolute expiry. Trusted devices are valid for 90 days. |
| `last_seen` | DATETIME | | `CURRENT_TIMESTAMP` | Updated each time the device token is used for a login. |

**Indexes:**

```sql
CREATE INDEX IF NOT EXISTS idx_td_token ON trusted_devices(token);
```

This index accelerates token lookups during login, which is the primary query
path for this table.

**Foreign keys:** None.

**Notes:**

- Expired devices are cleaned up by `deleteExpiredDevices()`, called during TOTP
  login flow.
- The `id` is used for device management (listing/revocation), while `token` is
  the secret value stored in the browser cookie.
