---
title: "OAuth PKCE Flows"
---

## 6. OAuth PKCE Flows

Morphy supports two OAuth PKCE flows for authenticating with third-party AI providers. Both use the Authorization Code flow with PKCE (Proof Key for Code Exchange) using the S256 challenge method.

### 6.1 Claude OAuth (Anthropic)

**File:** `worker/claude-auth.ts`

**OAuth configuration** (`OAUTH_CONFIG`):

| Parameter | Value |
|---|---|
| Authorize URL | `https://claude.ai/oauth/authorize` |
| Token URL | `https://console.anthropic.com/v1/oauth/token` |
| Redirect URI | `https://console.anthropic.com/oauth/code/callback` |
| Client ID | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| Scopes | `org:create_api_key user:profile user:inference` |

**Flow:**

1. **Start** (`startClaudeOAuth`): Generates a 32-byte PKCE code verifier and computes `S256(code_verifier)` as the challenge. The verifier is stored in module-level state. The state parameter carries the verifier itself (legacy flow compatibility). Returns an authorization URL.

2. **Code Exchange** (`exchangeClaudeCode`): The user pastes an authorization code (potentially in `code#state` format). The function sends a JSON-encoded POST to the token endpoint with `grant_type=authorization_code`, the code, the verifier, and redirect URI. On success, credentials are stored.

3. **Token Refresh** (`refreshClaudeToken`): When the access token expires (checked by comparing `Date.now()` against `expiresAt`), the refresh token is used via `grant_type=refresh_token`.

4. **Credential Storage** (`storeCredentials`):
   - Written to `~/.claude/.credentials.json` in Claude Code's format: `{ claudeAiOauth: { accessToken, refreshToken, expiresAt } }`.
   - File permissions set to `0o600`.
   - On macOS, also written to the macOS Keychain under the service name `Claude Code-credentials`.
   - A legacy fallback is written to `~/.claude.json` for backward compatibility.
   - `expiresAt` is calculated as `Date.now() + (expires_in - 300) * 1000`, subtracting 5 minutes as a safety margin.

5. **Credential Reading** (`readOAuthBlock`): Platform-dependent:
   - **macOS:** Reads from macOS Keychain first; does not trust stale files.
   - **Linux/Windows:** Reads from `~/.claude/.credentials.json`.

**API routes** (`worker/index.ts`):

- `POST /api/auth/claude/start` -- initiates the flow, returns `{ success, authUrl }`.
- `POST /api/auth/claude/exchange` -- exchanges the pasted code for tokens.
- `GET /api/auth/claude/status` -- checks if a valid token exists, refreshing if expired.

### 6.2 Codex OAuth (OpenAI)

**File:** `worker/codex-auth.ts`

**OAuth configuration** (`OAUTH_CONFIG`):

| Parameter | Value |
|---|---|
| Authorize URL | `https://auth.openai.com/oauth/authorize` |
| Token URL | `https://auth.openai.com/oauth/token` |
| Redirect URI | `http://localhost:1455/auth/callback` (never actually served; see paste-back below) |
| Client ID | `app_EMoamEEZ73f0CkXaXp7hrann` |
| Scopes | `openid profile email offline_access` |

**Flow:**

1. **Start** (`startCodexOAuth`): Generates PKCE parameters (32-byte verifier, S256 challenge) and a UUID state, stored in module-level state, and returns the authorization URL. No local callback server is spawned: the dashboard is typically served remotely through the Morphy relay, so a browser-side `localhost:1455` callback could never reach the host running the supervisor.

2. **Paste-Back Exchange** (`exchangeCodexCode`): After authorizing, the user's browser redirects to the unreachable callback URL, but the address bar still contains the `code`. The user pastes the full URL, the bare query string, or just the raw code back into the wizard; `parsePastedInput` accepts all three forms. If a `state` is present it is validated against the stored UUID, then a `application/x-www-form-urlencoded` POST with `grant_type=authorization_code` is sent to the token endpoint.

3. **Device-Code Flow** (`startDeviceCodeLogin`): An alternative for headless or remote setups. Morphy requests a user code from OpenAI's device-auth endpoint, the user enters it at `https://auth.openai.com/codex/device`, and a background loop (`pollDeviceCode`) polls until approval, then exchanges the returned authorization code using the PKCE verifier supplied by the server. The wizard tracks progress via `GET /api/auth/codex/device/status`.

4. **Token Refresh** (`refreshTokens`): Uses `grant_type=refresh_token` (JSON-encoded POST). `getCodexAccessToken` refreshes automatically when the access token is within 5 minutes of its JWT `exp` claim.

5. **Credential Storage** (`storeTokens`):
   - Written to `~/.codex/auth.json` in Codex CLI's own on-disk shape (`auth_mode: "chatgpt"` plus a `tokens` block with `id_token`, `access_token`, `refresh_token`, `account_id`), so a spawned `codex app-server` can use it directly.
   - File permissions set to `0o600`.
   - `account_id` is extracted from the `id_token` JWT claims (`chatgpt_account_id`); the plan type is read from the same claims when reporting status.
   - Legacy `~/.codex/codedeck-auth.json` files are migrated into `auth.json` once (`migrateLegacyFile`) and then deleted.

6. **Cancellation** (`cancelCodexOAuth`, `cancelDeviceCodeLogin`): Clears the PKCE and state values; cancelling the device-code flow also invalidates the in-flight poll loop.

**API routes** (`worker/index.ts`):

- `POST /api/auth/codex/start` -- starts the paste-back flow, returns the authorization URL.
- `POST /api/auth/codex/exchange` -- exchanges the pasted URL or code for tokens.
- `POST /api/auth/codex/cancel` -- cancels the paste-back flow.
- `GET /api/auth/codex/status` -- checks if valid credentials exist, refreshing if expired.
- `POST /api/auth/codex/device/start` -- starts the device-code flow.
- `GET /api/auth/codex/device/status` -- reports device-code progress (pending/success/error).
- `POST /api/auth/codex/device/cancel` -- cancels the device-code flow.

### 6.3 Key Differences Between the Two OAuth Flows

| Aspect | Claude OAuth | Codex OAuth |
|---|---|---|
| Callback mechanism | User pastes code manually (`code#state`) | User pastes the callback URL or code; device-code flow available as an alternative |
| Token request format | JSON (`application/json`) | URL-encoded exchange, JSON refresh |
| Token refresh | Supported (`refreshClaudeToken`) | Supported (`refreshTokens`) |
| Credential location | `~/.claude/.credentials.json` + Keychain | `~/.codex/auth.json` (Codex CLI native format) |
| State parameter | Set to code verifier (legacy) | Random UUID |
| JWT decoding | No | Yes, extracts OpenAI account/plan claims from `id_token` |
