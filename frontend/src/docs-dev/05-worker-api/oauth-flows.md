---
title: "OAuth Flows"
---

### 5.1 Claude OAuth PKCE (Manual Code Entry)

The Claude OAuth flow uses PKCE (Proof Key for Code Exchange) with a manual
code-copy step. Claude's OAuth redirect goes to Anthropic's console, which
displays the code for the user to copy.

**Configuration:**

| Parameter | Value |
|---|---|
| Authorize URL | `https://claude.ai/oauth/authorize` |
| Token URL | `https://console.anthropic.com/v1/oauth/token` |
| Redirect URI | `https://console.anthropic.com/oauth/code/callback` |
| Client ID | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` |
| Scopes | `org:create_api_key user:profile user:inference` |

**Flow walkthrough:**

```
1. Client calls POST /api/auth/claude/start
   |
   +--> Worker generates:
   |    - code_verifier: 32 random bytes, base64url
   |    - code_challenge: SHA-256(code_verifier), base64url
   |    Stores code_verifier in module-level variable.
   |    Returns authUrl with query params.
   |
2. Client opens authUrl in browser
   |
   +--> User signs in at claude.ai
   |    Anthropic console displays authorization code
   |    User copies the code
   |
3. Client calls POST /api/auth/claude/exchange with { code }
   |
   +--> Worker parses code (may be "code#state" format)
   |    Sends POST to TOKEN_URL with JSON body:
   |    {
   |      grant_type: "authorization_code",
   |      client_id, code, state,
   |      redirect_uri, code_verifier
   |    }
   |    Note: Uses JSON content type (not form-urlencoded)
   |
4. Token response received
   |
   +--> storeCredentials() writes tokens to:
   |    - ~/.claude/.credentials.json (claudeAiOauth block)
   |    - macOS Keychain (if on Darwin)
   |    - ~/.claude.json (legacy format)
   |    File permissions set to 0600.
   |    code_verifier is cleared.
```

**Credential storage format** (`~/.claude/.credentials.json`):

```json
{
  "claudeAiOauth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": 1705312200000
  }
}
```

The `expiresAt` field is computed as `now + (expires_in - 300) * 1000`,
subtracting 5 minutes as a safety buffer.

**Credential reading priority:**

- macOS: Keychain (`security find-generic-password -s "Claude Code-credentials"`)
  is the source of truth. If the Keychain has no valid entry, the file is
  not trusted.
- Linux/Windows: `~/.claude/.credentials.json` is the source of truth.

**Token refresh:**

The `getClaudeAuthStatus()` function automatically attempts a refresh if the
access token is expired and a refresh token is available. The refresh uses
`grant_type: "refresh_token"` against the same token URL.

---

### 5.2 Codex OAuth PKCE (Paste-Back)

The Codex OAuth flow uses PKCE with a paste-back step and no local callback
server. The dashboard is typically served remotely (through the Morphy
relay), so a browser-side `localhost:1455` callback could never reach the
host running the Worker. Instead, the user's browser lands on the
unreachable callback URL and the user pastes that URL (or just the code)
back into the wizard.

**Configuration:**

| Parameter | Value |
|---|---|
| Authorize URL | `https://auth.openai.com/oauth/authorize` |
| Token URL | `https://auth.openai.com/oauth/token` |
| Redirect URI | `http://localhost:1455/auth/callback` (never served locally) |
| Client ID | `app_EMoamEEZ73f0CkXaXp7hrann` |
| Scopes | `openid profile email offline_access` |

**Flow walkthrough:**

```
1. Client calls POST /api/auth/codex/start
   |
   +--> Worker generates:
   |    - code_verifier: 32 random bytes, base64url
   |    - code_challenge: SHA-256(code_verifier), base64url
   |    - state: crypto.randomUUID()
   |    No local server is started.
   |    Returns authUrl with query params.
   |
2. Client opens authUrl in browser
   |
   +--> User signs in at auth.openai.com
   |    OpenAI redirects to http://localhost:1455/auth/callback?code=...&state=...
   |    The page fails to load, but the URL bar contains the code.
   |    User copies the full URL (or just the code).
   |
3. Client calls POST /api/auth/codex/exchange with { code }
   |
   +--> parsePastedInput() accepts the full callback URL, a bare
   |    query string, or the raw code. If a state is present it
   |    must match the stored oauthState.
   |    Sends POST to TOKEN_URL with form-urlencoded body:
   |    grant_type=authorization_code&client_id=...&code=...
   |    &redirect_uri=...&code_verifier=...
   |    Note: Uses application/x-www-form-urlencoded (not JSON)
   |
4. Token response received
   |
   +--> storeTokens() writes ~/.codex/auth.json in the exact shape
   |    the Codex CLI itself writes, so a spawned `codex app-server`
   |    reads it directly. account_id is extracted from the
   |    id_token JWT claims.
   |    File permissions set to 0600.
   |    code_verifier and oauthState are cleared.
```

**Credential storage format** (`~/.codex/auth.json`):

```json
{
  "OPENAI_API_KEY": null,
  "auth_mode": "chatgpt",
  "tokens": {
    "id_token": "eyJ...",
    "access_token": "eyJ...",
    "refresh_token": "...",
    "account_id": "..."
  },
  "last_refresh": "2026-05-03T12:34:56.789Z"
}
```

The legacy `~/.codex/codedeck-auth.json` (flat token layout) is migrated
into `auth.json` automatically on the first status check, then deleted.

**Token refresh:**

Access-token expiry is read from the JWT `exp` claim with a 5-minute leeway.
`getCodexAuthStatus()` and `getCodexAccessToken()` refresh automatically via
`grant_type: "refresh_token"` against the same token URL.

**Error handling:**

A state mismatch or a failed token exchange returns `{ success: false,
error }`. Authorization codes are single-use: on failure the user restarts
the flow and pastes a fresh code.

**Cancellation:**

Calling `POST /api/auth/codex/cancel` clears the stored PKCE state
(`code_verifier` and `oauthState`), aborting the flow.

---

### 5.3 Codex Device-Code Login (Preferred for Headless Dashboards)

An alternative to paste-back that avoids copying URLs entirely.

```
1. Client calls POST /api/auth/codex/device/start
   |
   +--> Worker POSTs to auth.openai.com/api/accounts/deviceauth/usercode
   |    Receives { device_auth_id, user_code, interval }
   |    Returns { userCode, verificationUrl } to the wizard
   |    and starts a background poll loop.
   |
2. User opens https://auth.openai.com/codex/device
   |    and types the user_code there.
   |
3. Worker polls deviceauth/token every ~5s (15-minute timeout)
   |    403/404 = still pending
   |    2xx = { authorization_code, code_verifier }
   |
4. Worker exchanges the code at the token URL
   |    (redirect_uri = auth.openai.com/deviceauth/callback)
   |    and stores tokens in ~/.codex/auth.json via storeTokens().
```

The wizard polls `GET /api/auth/codex/device/status`, which reports
`{ state: idle | pending | success | error, userCode, verificationUrl,
expiresInSec, error }`. `POST /api/auth/codex/device/cancel` aborts the
flow; the poll loop is generation-stamped, so a cancelled or superseded
login stops on its next tick.
