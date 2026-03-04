---
title: "OAuth PKCE Flows"
---

## 6. OAuth PKCE Flows

Fluxy supports two OAuth PKCE flows for authenticating with third-party AI providers. Both use the Authorization Code flow with PKCE (Proof Key for Code Exchange) using the S256 challenge method.

### 6.1 Claude OAuth (Anthropic)

**File:** `worker/claude-auth.ts`

**OAuth configuration** (lines 16--22):

| Parameter | Value |
|---|---|
| Authorize URL | `https://claude.ai/oauth/authorize` |
| Token URL | `https://console.anthropic.com/v1/oauth/token` |
| Redirect URI | `https://console.anthropic.com/oauth/code/callback` |
| Client ID | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| Scopes | `org:create_api_key user:profile user:inference` |

**Flow:**

1. **Start** (`startClaudeOAuth`, lines 31--50): Generates a 32-byte PKCE code verifier and computes `S256(code_verifier)` as the challenge. The verifier is stored in module-level state. The state parameter carries the verifier itself (legacy flow compatibility). Returns an authorization URL.

2. **Code Exchange** (`exchangeClaudeCode`, lines 52--94): The user pastes an authorization code (potentially in `code#state` format). The function sends a JSON-encoded POST to the token endpoint with `grant_type=authorization_code`, the code, the verifier, and redirect URI. On success, credentials are stored.

3. **Token Refresh** (`refreshClaudeToken`, lines 189--215): When the access token expires (checked by comparing `Date.now()` against `expiresAt`), the refresh token is used via `grant_type=refresh_token`.

4. **Credential Storage** (`storeCredentials`, lines 217--282):
   - Written to `~/.claude/.credentials.json` in Claude Code's format: `{ claudeAiOauth: { accessToken, refreshToken, expiresAt } }`.
   - File permissions set to `0o600`.
   - On macOS, also written to the macOS Keychain under the service name `Claude Code-credentials`.
   - A legacy fallback is written to `~/.claude.json` for backward compatibility.
   - `expiresAt` is calculated as `Date.now() + (expires_in - 300) * 1000`, subtracting 5 minutes as a safety margin.

5. **Credential Reading** (`readOAuthBlock`, lines 154--183): Platform-dependent:
   - **macOS:** Reads from macOS Keychain first; does not trust stale files.
   - **Linux/Windows:** Reads from `~/.claude/.credentials.json`.

**API routes** (`worker/index.ts`, lines 192--205):

- `POST /api/auth/claude/start` -- initiates the flow, returns `{ success, authUrl }`.
- `POST /api/auth/claude/exchange` -- exchanges the pasted code for tokens.
- `GET /api/auth/claude/status` -- checks if a valid token exists, refreshing if expired.

### 6.2 Codex OAuth (OpenAI)

**File:** `worker/codex-auth.ts`

**OAuth configuration** (lines 16--23):

| Parameter | Value |
|---|---|
| Authorize URL | `https://auth.openai.com/oauth/authorize` |
| Token URL | `https://auth.openai.com/oauth/token` |
| Redirect URI | `http://localhost:1455/auth/callback` |
| Client ID | `app_EMoamEEZ73f0CkXaXp7hrann` |
| Scopes | `openid profile email offline_access` |
| Callback Port | 1455 |

**Flow:**

1. **Start** (`startCodexOAuth`, lines 108--167): Generates PKCE parameters (32-byte verifier, S256 challenge) and a UUID state. Critically, it spins up a **temporary local HTTP server** on port 1455 to capture the OAuth callback.

2. **Callback Server** (lines 118--140): The local server listens at `/auth/callback`, extracts the `code` and `state` from query parameters, validates the state, renders a success/failure HTML page, and calls `exchangeCode()`.

3. **Code Exchange** (`exchangeCode`, lines 72--104): Sends a `application/x-www-form-urlencoded` POST (not JSON) to the token endpoint.

4. **Credential Storage** (`storeCredentials`, lines 41--70):
   - Written to `~/.codex/codedeck-auth.json`.
   - File permissions set to `0o600`.
   - JWT claims from the access token are decoded to extract `chatgpt_account_id` and `chatgpt_plan_type`.
   - `expires_at` is calculated with the same 5-minute safety margin as Claude.

5. **Cancellation** (`cancelCodexOAuth`, lines 169--173): Stops the callback server and clears PKCE state.

**API routes** (`worker/index.ts`, lines 176--188):

- `POST /api/auth/codex/start` -- starts OAuth and launches the callback server.
- `POST /api/auth/codex/cancel` -- cancels the flow and stops the callback server.
- `GET /api/auth/codex/status` -- checks if valid credentials exist.

### 6.3 Key Differences Between the Two OAuth Flows

| Aspect | Claude OAuth | Codex OAuth |
|---|---|---|
| Callback mechanism | User pastes code manually | Local HTTP server on port 1455 captures redirect |
| Token request format | JSON (`application/json`) | URL-encoded (`application/x-www-form-urlencoded`) |
| Token refresh | Supported (`refreshClaudeToken`) | Not implemented |
| Credential location | `~/.claude/.credentials.json` + Keychain | `~/.codex/codedeck-auth.json` |
| State parameter | Set to code verifier (legacy) | Random UUID |
| JWT decoding | No | Yes, extracts OpenAI account/plan claims |
