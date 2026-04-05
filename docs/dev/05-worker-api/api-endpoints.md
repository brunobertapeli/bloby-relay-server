---
title: "API Endpoints"
---

All endpoints are prefixed with `/api`. Responses are JSON unless stated
otherwise.

---

### 4.1 Health

#### `GET /api/health`

Returns the server health status.

- **Authentication**: None
- **Request body**: None
- **Response**:

  ```json
  { "status": "ok" }
  ```

---

### 4.2 Conversations

#### `GET /api/conversations`

Lists all conversations, ordered by `updated_at` descending, limited to 50.

- **Authentication**: None
- **Request body**: None
- **Response**: Array of conversation objects.

  ```json
  [
    {
      "id": "a1b2c3d4e5f67890",
      "title": "My Chat",
      "model": "claude-sonnet-4-20250514",
      "session_id": null,
      "created_at": "2025-01-15 10:30:00",
      "updated_at": "2025-01-15 12:00:00"
    }
  ]
  ```

#### `GET /api/conversations/:id`

Returns a single conversation with all its messages.

- **Authentication**: None
- **Path params**: `id` -- conversation ID
- **Response**:

  ```json
  {
    "id": "a1b2c3d4e5f67890",
    "messages": [
      {
        "id": "...",
        "conversation_id": "a1b2c3d4e5f67890",
        "role": "user",
        "content": "Hello",
        "tokens_in": null,
        "tokens_out": null,
        "model": null,
        "audio_data": null,
        "attachments": null,
        "created_at": "2025-01-15 10:30:00"
      }
    ]
  }
  ```

  Note: This returns ALL messages for the conversation (no pagination). Use
  the paginated messages endpoints for large conversations.

#### `POST /api/conversations`

Creates a new conversation.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "title": "Optional title",
    "model": "optional-model-id"
  }
  ```

  Both fields are optional and default to `null`.
- **Response**: The created conversation row (with generated `id`,
  `created_at`, `updated_at`).
- **Internals**: Uses `INSERT ... RETURNING *` to return the full row.

#### `DELETE /api/conversations/:id`

Deletes a conversation and all its messages (cascading delete via FK).

- **Authentication**: None
- **Path params**: `id` -- conversation ID
- **Response**:

  ```json
  { "ok": true }
  ```

---

### 4.3 Messages

#### `POST /api/conversations/:id/messages`

Adds a new message to a conversation.

- **Authentication**: None
- **Path params**: `id` -- conversation ID
- **Request body**:

  ```json
  {
    "role": "user",
    "content": "Hello, world!",
    "meta": {
      "tokens_in": 10,
      "tokens_out": 50,
      "model": "claude-sonnet-4-20250514",
      "audio_data": "<base64>",
      "attachments": "[{\"name\":\"file.pdf\",\"url\":\"/api/files/documents/file.pdf\"}]"
    }
  }
  ```

  - `role` (required): One of `"user"`, `"assistant"`, `"system"`.
  - `content` (required): The message text.
  - `meta` (optional): Object with token counts, model name, audio data,
    and/or attachment JSON.
- **Response**: The created message row.
- **Error**: `400` if `role` or `content` is missing.

  ```json
  { "error": "Missing role or content" }
  ```

- **Side effect**: Updates the parent conversation's `updated_at` timestamp.

#### `GET /api/conversations/:id/messages`

Returns messages for a conversation with cursor-based pagination.

- **Authentication**: None
- **Path params**: `id` -- conversation ID
- **Query params**:
  - `before` (optional): Message ID cursor. If provided, returns messages
    with `id < before`.
  - `limit` (optional): Number of messages to return. Defaults to `20`,
    capped at `100`.
- **Response**: Array of message objects, ordered ascending by `id` (when
  using `before`) or `created_at` (when not).
- **Behavior**:
  - If `before` is provided: returns `limit` messages older than the given ID
    (cursor-based backward pagination via `getMessagesBefore()`).
  - If `before` is omitted: returns the most recent `limit` messages (via
    `getRecentMessages()`).

#### `GET /api/conversations/:id/messages/recent`

Returns the most recent messages for a conversation.

- **Authentication**: None
- **Path params**: `id` -- conversation ID
- **Query params**:
  - `limit` (optional): Defaults to `20`, capped at `100`.
- **Response**: Array of message objects, ordered by `created_at` ascending.
- **Internals**: Executes a subquery that selects the last N messages ordered
  descending, then re-orders ascending. This gives you the "tail" of the
  conversation in chronological order.

---

### 4.4 Settings

#### `GET /api/settings`

Returns all settings as a flat key-value object.

- **Authentication**: None
- **Response**:

  ```json
  {
    "user_name": "Bruno",
    "agent_name": "Bloby",
    "portal_pass": "<scrypt hash>",
    "onboard_complete": "true",
    "vapid_public_key": "...",
    "totp_enabled": "false"
  }
  ```

  **Warning**: This endpoint returns ALL settings including sensitive ones
  like password hashes, TOTP secrets, and VAPID private keys. It is intended
  for internal use by the supervisor and should not be exposed to untrusted
  clients.

#### `PUT /api/settings/:key`

Sets a single setting value.

- **Authentication**: None
- **Path params**: `key` -- the setting key
- **Request body**:

  ```json
  { "value": "new-value" }
  ```

- **Response**:

  ```json
  { "ok": true }
  ```

- **Internals**: Uses `INSERT ... ON CONFLICT DO UPDATE` (upsert).

---

### 4.5 Context (Current Conversation)

These endpoints manage the "currently active conversation" state, which is
shared across all connected devices.

#### `GET /api/context/current`

Returns the ID of the currently active conversation.

- **Authentication**: None
- **Response**:

  ```json
  { "conversationId": "a1b2c3d4e5f67890" }
  ```

  Returns `null` if no conversation is active.

#### `POST /api/context/set`

Sets the currently active conversation.

- **Authentication**: None
- **Request body**:

  ```json
  { "conversationId": "a1b2c3d4e5f67890" }
  ```

- **Response**:

  ```json
  { "ok": true }
  ```

- **Internals**: Stores the value in the `current_conversation` setting key.
  If `conversationId` is falsy, the setting is not updated (existing value
  is preserved).

#### `POST /api/context/clear`

Clears the currently active conversation.

- **Authentication**: None
- **Response**:

  ```json
  { "ok": true }
  ```

- **Internals**: Sets the `current_conversation` setting to an empty string.

---

### 4.6 Portal Authentication

#### `POST /api/portal/login`

Authenticates with username and password via JSON body.

- **Authentication**: None (this IS the login)
- **Request body**:

  ```json
  {
    "username": "admin",
    "password": "secret123"
  }
  ```

- **Response** (success, no TOTP):

  ```json
  {
    "token": "<128 hex chars>",
    "expiresAt": "2025-01-22T10:30:00.000Z"
  }
  ```

- **Response** (success, TOTP required):

  ```json
  {
    "requiresTOTP": true,
    "pendingToken": "<64 hex chars>"
  }
  ```

  The `pendingToken` is valid for 5 minutes. The client must complete
  authentication via `GET /api/portal/login/totp`.
- **Response** (TOTP enabled but trusted device cookie present):
  Session token is issued directly, bypassing TOTP. The `bloby_device`
  cookie is read and validated against the `trusted_devices` table. If
  the device is trusted, `last_seen` is updated.
- **Error**: `400` if password is missing or no password is set. `401` if
  password is incorrect.
- **Internals**: Expired sessions are purged before creating a new one.
  Sessions expire after 7 days.

#### `GET /api/portal/login`

Same as `POST /api/portal/login` but credentials are passed via HTTP Basic
Authentication header. This exists because the relay proxy does not forward
POST bodies.

- **Authentication**: `Authorization: Basic <base64(username:password)>`
- **Response**: Same as the POST variant.
- **Error**: `400` if Authorization header is missing or malformed.

#### `POST /api/portal/validate-token`

Validates a session token.

- **Authentication**: None
- **Request body**:

  ```json
  { "token": "<session token>" }
  ```

- **Response**:

  ```json
  { "valid": true }
  ```

  or `{ "valid": false }`.

#### `GET /api/portal/validate-token`

Same as the POST variant, but the token is passed as a query parameter.

- **Query params**: `token` -- the session token
- **Response**: Same as POST variant.

#### `POST /api/portal/verify-password`

Verifies a password without creating a session.

- **Authentication**: None
- **Request body**:

  ```json
  { "password": "secret123" }
  ```

- **Response**:

  ```json
  { "valid": true }
  ```

  Returns `{ "valid": false, "error": "No password set" }` if no portal
  password has been configured.

---

### 4.7 TOTP Two-Factor Authentication

#### `GET /api/portal/totp/status`

Returns whether TOTP 2FA is enabled.

- **Authentication**: None
- **Response**:

  ```json
  { "enabled": true }
  ```

#### `POST /api/portal/totp/setup`

Generates a new TOTP secret and QR code for the user to scan with their
authenticator app.

- **Authentication**: One of:
  - `Authorization: Bearer <session_token>` (existing session)
  - `password` field in request body (verified against stored hash)
  - No auth required if no portal password has been set yet (initial onboard)
- **Request body** (optional):

  ```json
  { "password": "secret123" }
  ```

- **Response**:

  ```json
  {
    "secret": "JBSWY3DPEHPK3PXP...",
    "qrDataUri": "data:image/png;base64,...",
    "otpauthUri": "otpauth://totp/Bloby:Bloby?secret=...&issuer=Bloby&algorithm=SHA1&digits=6&period=30"
  }
  ```

- **Error**: `401` if not authorized. `500` if QR code generation fails.
- **Internals**: The secret is stored temporarily in the `totp_pending_secret`
  setting until confirmed via `/totp/verify-setup`. The TOTP label uses the
  `agent_name` setting (defaults to `"Bloby"`).

#### `POST /api/portal/totp/verify-setup`

Validates the TOTP code from the authenticator app to confirm setup.

- **Authentication**: Same as `/totp/setup` (Bearer token, password, or
  initial onboard).
- **Request body**:

  ```json
  {
    "code": "123456",
    "password": "secret123"
  }
  ```

  `password` is optional if a Bearer token is provided.
- **Response** (success):

  ```json
  {
    "success": true,
    "recoveryCodes": [
      "a1b2c3d4",
      "e5f67890",
      "..."
    ]
  }
  ```

  Eight 8-character hex recovery codes are generated and returned. Their
  SHA-256 hashes are stored in the `totp_recovery_codes` setting.
- **Error**: `401` if not authorized. `400` if code is missing, no setup is
  in progress, or the code is invalid.
- **Internals**: On success, the pending secret is promoted to
  `totp_secret`, `totp_enabled` is set to `"true"`, and the pending secret
  is cleared. The TOTP `validate()` call uses a `window` of 1 (accepts the
  current and one adjacent time step).

#### `POST /api/portal/totp/disable`

Disables TOTP 2FA entirely.

- **Authentication**: Requires both the portal password AND a valid TOTP code.
- **Request body**:

  ```json
  {
    "password": "secret123",
    "code": "123456"
  }
  ```

- **Response**:

  ```json
  { "success": true }
  ```

- **Error**: `400` if password or code is missing, or if 2FA is not enabled,
  or if the TOTP code is invalid. `401` if password is wrong.
- **Side effects**: Clears `totp_enabled`, `totp_secret`,
  `totp_recovery_codes`, and `totp_pending_secret`. Deletes ALL trusted
  devices from the database.

#### `GET /api/portal/login/totp`

Completes a TOTP-guarded login. The client must have already obtained a
`pendingToken` from the login endpoint.

- **Authentication**: None (the pending token acts as proof of password
  verification).
- **Query params**:
  - `pending` (required): The pending login token from the login response.
  - `code` (required): A 6-digit TOTP code or an 8-character recovery code.
  - `trust` (optional): Set to `"1"` to create a trusted device (skips TOTP
    for 90 days on this browser).
- **Response** (success):

  ```json
  {
    "token": "<128 hex chars>",
    "expiresAt": "2025-01-22T10:30:00.000Z"
  }
  ```

  If `trust=1`, the response also includes a `Set-Cookie` header:

  ```
  Set-Cookie: bloby_device=<64 hex chars>; HttpOnly; Secure; SameSite=Strict; Max-Age=7776000; Path=/
  ```

  (`Max-Age=7776000` = 90 days).
- **Error**: `400` if pending token or code is missing, or if 2FA is not
  configured. `401` if the pending token is expired or the code is invalid.
- **Internals**:
  1. Validates the pending token against `totp_pending_login:<token>` setting.
  2. Immediately clears the pending token (one-time use).
  3. First attempts TOTP validation. If that fails, attempts recovery code
     validation. A used recovery code is removed from the stored hash list.
  4. On success, creates a 7-day session and optionally a 90-day trusted
     device.

---

### 4.8 Trusted Devices

#### `GET /api/portal/devices`

Lists all non-expired trusted devices.

- **Authentication**: None (should be behind portal auth in production)
- **Response**: Array of device objects.

  ```json
  [
    {
      "id": "a1b2c3d4e5f67890",
      "label": "Browser",
      "last_seen": "2025-01-15 10:30:00",
      "created_at": "2025-01-10 08:00:00"
    }
  ]
  ```

#### `DELETE /api/portal/devices/:id`

Removes a trusted device by its database ID.

- **Authentication**: None
- **Path params**: `id` -- the device database ID (not the token)
- **Response**:

  ```json
  { "ok": true }
  ```

#### `POST /api/portal/devices/revoke`

Alternative to `DELETE /api/portal/devices/:id` using a POST body.

- **Authentication**: None
- **Request body**:

  ```json
  { "id": "a1b2c3d4e5f67890" }
  ```

- **Response**:

  ```json
  { "ok": true }
  ```

- **Error**: `400` if `id` is missing.

---

### 4.9 Onboarding

#### `GET /api/onboard/status`

Returns the current onboarding state, combining data from settings and
config. This is the primary endpoint the dashboard uses to determine what
setup steps remain.

- **Authentication**: None
- **Response**:

  ```json
  {
    "userName": "Bruno",
    "agentName": "Bloby",
    "portalUser": "admin",
    "portalConfigured": true,
    "whisperEnabled": false,
    "whisperKey": "",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "handle": {
      "username": "bruno",
      "tier": "free",
      "url": "https://bruno.bloby.bot"
    },
    "tunnelMode": "quick",
    "tunnelDomain": "",
    "tunnelUrl": "https://abc123.trycloudflare.com",
    "totpEnabled": false
  }
  ```

  `handle` is `null` if no relay handle is registered. `portalConfigured` is
  `true` if a portal password hash exists (does not reveal the hash).

#### `POST /api/onboard`

Saves the full onboarding configuration. This is the primary "save
everything" endpoint called when the user completes the setup wizard.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "userName": "Bruno",
    "agentName": "Bloby",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "sk-...",
    "baseUrl": "https://custom.api.endpoint",
    "portalUser": "admin",
    "portalPass": "secret123",
    "whisperEnabled": true,
    "whisperKey": "sk-whisper-..."
  }
  ```

  All fields are optional. Missing fields default to empty strings or
  `false`.
- **Response**:

  ```json
  { "ok": true }
  ```

- **Internals** (execution order):
  1. Reads old `agent_name` and `user_name` for BLOBY.md placeholder
     replacement.
  2. Saves `user_name`, `agent_name`, `onboard_complete` to settings.
  3. Hashes and saves `portal_pass` (scrypt with random 16-byte salt).
  4. Saves `portal_user` (lowercased and trimmed).
  5. Saves whisper configuration.
  6. Reads `workspace/BLOBY.md` and replaces old bot/human name strings
     with the new ones, handling both initial `$BOT`/`$HUMAN` placeholders
     and re-onboard name changes.
  7. Re-reads `config.json` from disk to preserve any relay data written by
     handle registration that may have occurred concurrently.
  8. Updates `ai.provider`, `ai.model`, and `ai.baseUrl` in the config.
  9. If no `apiKey` was provided, reads the OAuth access token from the
     appropriate provider's credential file (Codex for OpenAI, Claude for
     Anthropic).
  10. Writes the updated config to disk.

---

### 4.10 Handle Registration (Relay)

These endpoints manage the user's vanity URL handle (e.g.
`username.bloby.bot`) through the Bloby relay server.

#### `GET /api/handle/check/:username`

Checks if a username is available for registration.

- **Authentication**: None
- **Path params**: `username` -- desired handle
- **Response**:

  ```json
  { "available": true, "valid": true }
  ```

  On network error:

  ```json
  { "available": false, "valid": false, "error": "Could not reach relay server" }
  ```

#### `GET /api/handle/status`

Returns the current handle registration status.

- **Authentication**: None
- **Response**:

  ```json
  {
    "registered": true,
    "username": "bruno",
    "tier": "free",
    "url": "https://bruno.bloby.bot"
  }
  ```

  `registered` is `false` if no relay token exists in the config.

#### `POST /api/handle/register`

Registers a new handle with the relay server.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "username": "bruno",
    "tier": "free"
  }
  ```

- **Response**:

  ```json
  { "ok": true, "url": "https://bruno.bloby.bot" }
  ```

- **Error**: `400` if `username` or `tier` is missing, or if registration
  fails (username taken, invalid format, etc.).
- **Side effects**:
  1. Calls `registerHandle()` on the relay server.
  2. Saves the relay token, tier, URL, and username to `config.json`.
  3. If a tunnel URL already exists, immediately pushes it to the relay and
     starts the heartbeat.

#### `POST /api/handle/change`

Changes an existing handle to a new username.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "username": "new-name",
    "tier": "free"
  }
  ```

- **Response**:

  ```json
  { "ok": true, "url": "https://new-name.bloby.bot" }
  ```

- **Error**: `400` if fields are missing or if the new registration fails.
- **Side effects**:
  1. Stops the heartbeat.
  2. Releases the old handle (using the stored relay token). If no token
     exists, the old handle is orphaned in the relay database.
  3. Registers the new handle.
  4. Updates `config.json`.
  5. Pushes the tunnel URL to the new handle and restarts the heartbeat.

---

### 4.11 Codex OAuth (OpenAI)

#### `POST /api/auth/codex/start`

Initiates the OpenAI/Codex OAuth PKCE flow.

- **Authentication**: None
- **Request body**: None
- **Response**:

  ```json
  {
    "success": true,
    "authUrl": "https://auth.openai.com/oauth/authorize?response_type=code&client_id=...&redirect_uri=http://localhost:1455/auth/callback&scope=openid+profile+email+offline_access&code_challenge=...&code_challenge_method=S256&state=...&id_token_add_organizations=true&codex_cli_simplified_flow=true"
  }
  ```

- **Error**: If port 1455 is busy:

  ```json
  { "success": false, "error": "Port 1455 is busy. Close other Codex instances." }
  ```

- **Internals**: Starts a temporary HTTP server on `127.0.0.1:1455` that
  listens for the OAuth callback. See section 5.2 for the full flow.

#### `POST /api/auth/codex/cancel`

Cancels an in-progress Codex OAuth flow.

- **Authentication**: None
- **Request body**: None
- **Response**:

  ```json
  { "ok": true }
  ```

- **Side effects**: Stops the callback server and clears the PKCE state.

#### `GET /api/auth/codex/status`

Returns the current Codex authentication status.

- **Authentication**: None
- **Response** (authenticated):

  ```json
  { "authenticated": true, "plan": "plus" }
  ```

- **Response** (not authenticated):

  ```json
  { "authenticated": false }
  ```

- **Response** (expired):

  ```json
  { "authenticated": false, "error": "Token expired" }
  ```

- **Internals**: Reads `~/.codex/codedeck-auth.json` and checks if the
  access token exists and has not expired.

---

### 4.12 Claude OAuth (Anthropic)

#### `POST /api/auth/claude/start`

Initiates the Claude OAuth PKCE flow.

- **Authentication**: None
- **Request body**: None
- **Response**:

  ```json
  {
    "success": true,
    "authUrl": "https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https://console.anthropic.com/oauth/code/callback&scope=org:create_api_key+user:profile+user:inference&code_challenge=...&code_challenge_method=S256&state=..."
  }
  ```

- **Internals**: Unlike the Codex flow, this does NOT start a local callback
  server. The user manually copies the authorization code from the browser
  and pastes it back. See section 5.1 for full flow.

#### `POST /api/auth/claude/exchange`

Exchanges an authorization code for tokens.

- **Authentication**: None
- **Request body**:

  ```json
  { "code": "auth_code_here" }
  ```

  The code may be in the format `code#state` (legacy). The `#state` suffix
  is parsed and used if present; otherwise the stored code verifier is used
  as the state.
- **Response** (success):

  ```json
  { "success": true }
  ```

- **Response** (failure):

  ```json
  { "success": false, "error": "Authentication failed (401). Please try again." }
  ```

  Also returns `{ "success": false, "error": "No code provided" }` if the
  code field is missing.

#### `GET /api/auth/claude/status`

Returns the current Claude authentication status.

- **Authentication**: None
- **Response**:

  ```json
  { "authenticated": true }
  ```

  or:

  ```json
  { "authenticated": false, "error": "Token expired" }
  ```

- **Internals**: Checks the stored access token's expiry. If expired,
  automatically attempts a token refresh using the stored refresh token.
  Returns `authenticated: true` only if a valid (or freshly refreshed)
  access token exists.

---

### 4.13 Push Notifications

#### `GET /api/push/vapid-public-key`

Returns the VAPID public key needed by clients to subscribe to push
notifications.

- **Authentication**: None
- **Response**:

  ```json
  { "publicKey": "BNibx..." }
  ```

- **Error**: `500` if VAPID keys have not been generated.

#### `POST /api/push/subscribe`

Registers a push subscription.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BNcR...",
      "auth": "tBH..."
    }
  }
  ```

- **Response**:

  ```json
  { "ok": true }
  ```

- **Error**: `400` if `endpoint`, `keys.p256dh`, or `keys.auth` is missing.
- **Internals**: Uses upsert -- if the endpoint already exists, the keys are
  updated.

#### `DELETE /api/push/unsubscribe`

Removes a push subscription.

- **Authentication**: None
- **Request body**:

  ```json
  { "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
  ```

- **Response**:

  ```json
  { "ok": true }
  ```

- **Error**: `400` if `endpoint` is missing.

#### `POST /api/push/send`

Sends a push notification to all registered subscriptions.

- **Authentication**: None
- **Request body**:

  ```json
  {
    "title": "New Message",
    "body": "Bloby says hello",
    "tag": "chat",
    "url": "/chat"
  }
  ```

  All fields are optional.
  - `title` defaults to `"Bloby"`.
  - `body` defaults to `""`.
  - `tag` defaults to `"bloby"`.
  - `url` defaults to `"/"`.
- **Response**:

  ```json
  { "sent": 3, "total": 5 }
  ```

  `sent` is the count of successfully delivered notifications. `total` is
  the count of subscriptions attempted.
- **Internals**: Uses `Promise.allSettled()` to send to all subscriptions in
  parallel. Subscriptions that return HTTP 410 (Gone) or 404 are
  automatically removed from the database.

#### `GET /api/push/status`

Checks if a specific endpoint is currently subscribed.

- **Authentication**: None
- **Query params**: `endpoint` -- the push endpoint URL
- **Response**:

  ```json
  { "subscribed": true }
  ```

  Returns `{ "subscribed": false }` if the endpoint is not found or if
  the query param is missing.

---

### 4.14 Whisper Transcription

#### `POST /api/whisper/transcribe`

Transcribes audio using the OpenAI Whisper API.

- **Authentication**: None (but requires Whisper to be enabled and an API
  key to be configured in settings)
- **Request body**:

  ```json
  { "audio": "<base64-encoded audio data>" }
  ```

  The audio can optionally include a data URL prefix (e.g.
  `data:audio/webm;base64,...`), which is stripped automatically.
- **Response**:

  ```json
  { "transcript": "Hello, this is a test." }
  ```

- **Error**:
  - `400` if Whisper is not enabled or API key is missing.
  - `400` if no audio data is provided.
  - `502` if the OpenAI Whisper API returns an error.
  - `500` if transcription fails for any other reason.
- **Internals**:
  1. Reads `whisper_enabled` and `whisper_key` from settings.
  2. Decodes the base64 audio into a binary buffer.
  3. Constructs a `multipart/form-data` request body manually (no library).
  4. Sends to `https://api.openai.com/v1/audio/transcriptions` with the
     `whisper-1` model.
  5. Returns the `text` field from the API response.

---

### 4.15 Static Files

#### `GET /api/files/*`

Serves static files from the `workspace/files/` directory.

- **Authentication**: None
- **Examples**:
  - `GET /api/files/audio/recording-123.webm`
  - `GET /api/files/images/photo.png`
  - `GET /api/files/documents/report.pdf`
- **Response**: The raw file with appropriate MIME type headers (handled by
  `express.static`).
