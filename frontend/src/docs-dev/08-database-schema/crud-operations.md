---
title: "CRUD Operations"
---

Every database function is exported from `worker/db.ts` and imported by
`worker/index.ts` for use in Express route handlers. The module uses a
singleton `db` connection (module-level variable).

### 4.1 Connection Lifecycle

#### `initDb(): void`

Opens the database connection, sets pragmas, executes the schema DDL, and runs
migrations.

- **Parameters:** None
- **Return type:** `void`
- **Called by:** `worker/index.ts` at startup (line 74)
- **SQL executed:**
  1. `PRAGMA journal_mode = WAL`
  2. `PRAGMA foreign_keys = ON`
  3. Full `SCHEMA` string (all CREATE TABLE/INDEX statements)
  4. Migration ALTER TABLE statements (conditionally)

#### `closeDb(): void`

Closes the database connection. Called on `SIGTERM`.

- **Parameters:** None
- **Return type:** `void`
- **Called by:** `SIGTERM` handler in `worker/index.ts` (line 810)

---

### 4.2 Conversations

#### `createConversation(title?: string, model?: string): any`

Creates a new conversation record.

- **Parameters:**
  - `title` (optional) -- Conversation title
  - `model` (optional) -- AI model name
- **Return type:** The inserted row (all columns) via `RETURNING *`
- **SQL:**

  ```sql
  INSERT INTO conversations (title, model) VALUES (?, ?) RETURNING *
  ```

- **Called by:** `POST /api/conversations`

#### `listConversations(limit = 50): any[]`

Lists conversations ordered by most recently updated, with a configurable limit.

- **Parameters:**
  - `limit` (default: 50) -- Maximum number of rows to return
- **Return type:** Array of conversation rows
- **SQL:**

  ```sql
  SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?
  ```

- **Called by:** `GET /api/conversations`

#### `deleteConversation(id: string): void`

Deletes a conversation and all its messages (via CASCADE).

- **Parameters:**
  - `id` -- Conversation ID
- **Return type:** `void` (result of `.run()`)
- **SQL:**

  ```sql
  DELETE FROM conversations WHERE id = ?
  ```

- **Called by:** `DELETE /api/conversations/:id`
- **Note:** The `ON DELETE CASCADE` foreign key on `messages.conversation_id`
  ensures all child messages are automatically deleted.

---

### 4.3 Messages

#### `addMessage(convId, role, content, meta?): any`

Inserts a message and updates the parent conversation's `updated_at` timestamp.

- **Parameters:**
  - `convId: string` -- Parent conversation ID
  - `role: string` -- One of `'user'`, `'assistant'`, `'system'`
  - `content: string` -- Message body
  - `meta` (optional object):
    - `tokens_in?: number`
    - `tokens_out?: number`
    - `model?: string`
    - `audio_data?: string`
    - `attachments?: string`
- **Return type:** The inserted row via `RETURNING *`
- **SQL (two statements, executed sequentially):**

  ```sql
  INSERT INTO messages (conversation_id, role, content, tokens_in,
    tokens_out, model, audio_data, attachments)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  ```

  ```sql
  UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
  ```

- **Called by:** `POST /api/conversations/:id/messages`
- **Note:** These two statements are not wrapped in an explicit transaction.
  Each runs as an implicit auto-commit transaction.

#### `getMessages(convId: string): any[]`

Returns all messages for a conversation in chronological order.

- **Parameters:**
  - `convId` -- Conversation ID
- **Return type:** Array of message rows
- **SQL:**

  ```sql
  SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
  ```

- **Called by:** `GET /api/conversations/:id`

#### `getRecentMessages(convId: string, limit = 20): any[]`

Returns the N most recent messages for a conversation, ordered chronologically.
Uses a subquery pattern to select the last N rows by descending order, then
re-sorts ascending.

- **Parameters:**
  - `convId` -- Conversation ID
  - `limit` (default: 20) -- Number of recent messages
- **Return type:** Array of message rows
- **SQL:**

  ```sql
  SELECT * FROM (
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC LIMIT ?
  ) sub ORDER BY created_at ASC
  ```

- **Called by:** `GET /api/conversations/:id/messages/recent`,
  `GET /api/conversations/:id/messages` (when no `before` cursor)

#### `getMessagesBefore(convId: string, beforeId: string, limit = 20): any[]`

Cursor-based backward pagination. Returns messages with `id < beforeId`,
ordered ascending.

- **Parameters:**
  - `convId` -- Conversation ID
  - `beforeId` -- Cursor message ID (exclusive upper bound)
  - `limit` (default: 20) -- Page size
- **Return type:** Array of message rows
- **SQL:**

  ```sql
  SELECT * FROM (
    SELECT * FROM messages
    WHERE conversation_id = ? AND id < ?
    ORDER BY id DESC LIMIT ?
  ) sub ORDER BY id ASC
  ```

- **Called by:** `GET /api/conversations/:id/messages` (when `before` query
  param is present)
- **Note:** This uses `id`-based ordering rather than `created_at`-based
  ordering, which means pagination is based on the lexicographic order of the
  hex IDs, not timestamps.

---

### 4.4 Settings

#### `getSetting(key: string): string | undefined`

Retrieves a single setting value by key.

- **Parameters:**
  - `key` -- Setting key
- **Return type:** `string | undefined`
- **SQL:**

  ```sql
  SELECT value FROM settings WHERE key = ?
  ```

- **Called by:** Extensively throughout `worker/index.ts` -- authentication,
  onboarding, TOTP, push notifications, Whisper, current conversation context.

#### `setSetting(key: string, value: string): void`

Upserts a setting. Inserts if the key does not exist; updates if it does
(via `ON CONFLICT ... DO UPDATE`).

- **Parameters:**
  - `key` -- Setting key
  - `value` -- Setting value
- **Return type:** `void`
- **SQL:**

  ```sql
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = CURRENT_TIMESTAMP
  ```

- **Called by:** Onboarding, VAPID key generation, TOTP setup, portal config,
  Whisper config, current conversation context.

#### `getAllSettings(): Record<string, string>`

Returns all settings as a flat key-value object.

- **Parameters:** None
- **Return type:** `Record<string, string>` (plain object)
- **SQL:**

  ```sql
  SELECT key, value FROM settings
  ```

- **Post-processing:** Converts the array of `{key, value}` rows to an object
  via `Object.fromEntries()`.
- **Called by:** `GET /api/settings`, `GET /api/onboard/status`

---

### 4.5 Auth Sessions

#### `createSession(token: string, expiresAt: string): void`

Creates a new authentication session.

- **Parameters:**
  - `token` -- 128-character hex bearer token
  - `expiresAt` -- ISO 8601 expiry timestamp (typically now + 7 days)
- **Return type:** `void`
- **SQL:**

  ```sql
  INSERT INTO sessions (token, expires_at) VALUES (?, ?)
  ```

- **Called by:** Login handlers (password login, TOTP login)

#### `getSession(token: string): { token, created_at, expires_at } | undefined`

Validates a session token. Returns the session only if it has not expired.

- **Parameters:**
  - `token` -- Bearer token to validate
- **Return type:** Session object or `undefined`
- **SQL:**

  ```sql
  SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')
  ```

- **Called by:** `POST /api/portal/validate-token`,
  `GET /api/portal/validate-token`, TOTP setup authorization checks.

#### `deleteSession(token: string): void`

Deletes a specific session (logout).

- **Parameters:**
  - `token` -- Session token to delete
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM sessions WHERE token = ?
  ```

- **Called by:** Not directly exposed via route, available for logout flows.

#### `deleteExpiredSessions(): void`

Garbage-collects expired sessions.

- **Parameters:** None
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM sessions WHERE expires_at <= datetime('now')
  ```

- **Called by:** Login handlers, before creating a new session.

---

### 4.6 Agent SDK Session IDs

#### `getSessionId(convId: string): string | null`

Retrieves the Agent SDK session ID for a conversation.

- **Parameters:**
  - `convId` -- Conversation ID
- **Return type:** `string | null`
- **SQL:**

  ```sql
  SELECT session_id FROM conversations WHERE id = ?
  ```

- **Called by:** Agent/chat logic when resuming a stateful conversation.

#### `saveSessionId(convId: string, sessionId: string): void`

Stores the Agent SDK session ID on a conversation.

- **Parameters:**
  - `convId` -- Conversation ID
  - `sessionId` -- Agent SDK session identifier
- **Return type:** `void`
- **SQL:**

  ```sql
  UPDATE conversations SET session_id = ? WHERE id = ?
  ```

- **Called by:** Agent/chat logic after starting or resuming a session.

---

### 4.7 Push Subscriptions

#### `addPushSubscription(endpoint, p256dh, auth): void`

Upserts a Web Push subscription. If the endpoint already exists, updates the
encryption keys.

- **Parameters:**
  - `endpoint: string` -- Push endpoint URL
  - `p256dh: string` -- P-256 DH public key
  - `auth: string` -- Auth secret
- **Return type:** `void`
- **SQL:**

  ```sql
  INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth)
  VALUES (?, ?, ?)
  ON CONFLICT(endpoint) DO UPDATE SET
    keys_p256dh = excluded.keys_p256dh,
    keys_auth = excluded.keys_auth
  ```

- **Called by:** `POST /api/push/subscribe`

#### `removePushSubscription(endpoint: string): void`

Removes a push subscription by endpoint.

- **Parameters:**
  - `endpoint` -- Push endpoint URL
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM push_subscriptions WHERE endpoint = ?
  ```

- **Called by:** `DELETE /api/push/unsubscribe`, post-send cleanup (on 410/404).

#### `getAllPushSubscriptions(): PushSubscription[]`

Returns all registered push subscriptions.

- **Parameters:** None
- **Return type:** `Array<{ id, endpoint, keys_p256dh, keys_auth }>`
- **SQL:**

  ```sql
  SELECT * FROM push_subscriptions
  ```

- **Called by:** `POST /api/push/send`

#### `getPushSubscriptionByEndpoint(endpoint: string): PushSubscription | undefined`

Looks up a single subscription by endpoint.

- **Parameters:**
  - `endpoint` -- Push endpoint URL
- **Return type:** Subscription object or `undefined`
- **SQL:**

  ```sql
  SELECT * FROM push_subscriptions WHERE endpoint = ?
  ```

- **Called by:** `GET /api/push/status`

---

### 4.8 Trusted Devices (2FA)

#### `createTrustedDevice(token, label, expiresAt): any`

Creates a new trusted device record, typically after a successful TOTP login
where the user checked "trust this device."

- **Parameters:**
  - `token: string` -- 64-character hex device token
  - `label: string` -- Device label (e.g., `"Browser"`)
  - `expiresAt: string` -- ISO 8601 expiry (typically now + 90 days)
- **Return type:** The inserted row via `RETURNING *`
- **SQL:**

  ```sql
  INSERT INTO trusted_devices (token, label, expires_at)
  VALUES (?, ?, ?) RETURNING *
  ```

- **Called by:** `GET /api/portal/login/totp` (when `trust=1`)

#### `getTrustedDevice(token: string): TrustedDevice | undefined`

Validates a device token, returning the device only if it has not expired.

- **Parameters:**
  - `token` -- Device token (from cookie)
- **Return type:** Device object or `undefined`
- **SQL:**

  ```sql
  SELECT * FROM trusted_devices
  WHERE token = ? AND expires_at > datetime('now')
  ```

- **Called by:** Login handlers, when checking the `bloby_device` cookie.

#### `updateDeviceLastSeen(token: string): void`

Updates the `last_seen` timestamp for a trusted device.

- **Parameters:**
  - `token` -- Device token
- **Return type:** `void`
- **SQL:**

  ```sql
  UPDATE trusted_devices SET last_seen = CURRENT_TIMESTAMP WHERE token = ?
  ```

- **Called by:** Login handler, after confirming a trusted device.

#### `listTrustedDevices(): TrustedDevice[]`

Lists all non-expired trusted devices, ordered by most recently seen.

- **Parameters:** None
- **Return type:** `Array<{ id, label, last_seen, created_at }>`
- **SQL:**

  ```sql
  SELECT id, label, last_seen, created_at FROM trusted_devices
  WHERE expires_at > datetime('now')
  ORDER BY last_seen DESC
  ```

- **Called by:** `GET /api/portal/devices`
- **Note:** The `token` column is intentionally excluded from the result set for
  security -- the management API should not expose device secrets.

#### `deleteTrustedDevice(id: string): void`

Revokes a specific trusted device by its public `id`.

- **Parameters:**
  - `id` -- Device ID (the public identifier, not the token)
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM trusted_devices WHERE id = ?
  ```

- **Called by:** `DELETE /api/portal/devices/:id`,
  `POST /api/portal/devices/revoke`

#### `deleteExpiredDevices(): void`

Garbage-collects expired devices.

- **Parameters:** None
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM trusted_devices WHERE expires_at <= datetime('now')
  ```

- **Called by:** TOTP login flow, before creating a new trusted device.

#### `deleteAllTrustedDevices(): void`

Revokes all trusted devices (used when disabling 2FA entirely).

- **Parameters:** None
- **Return type:** `void`
- **SQL:**

  ```sql
  DELETE FROM trusted_devices
  ```

- **Called by:** `POST /api/portal/totp/disable`
