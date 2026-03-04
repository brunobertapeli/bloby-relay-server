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

### 5.2 Codex OAuth PKCE (Local Callback Server)

The Codex OAuth flow uses PKCE with a temporary local HTTP server to capture
the callback automatically. The user does not need to copy any code.

**Configuration:**

| Parameter | Value |
|---|---|
| Authorize URL | `https://auth.openai.com/oauth/authorize` |
| Token URL | `https://auth.openai.com/oauth/token` |
| Redirect URI | `http://localhost:1455/auth/callback` |
| Client ID | `app_EMoamEEZ73f0CkXaXp7hrann` |
| Scopes | `openid profile email offline_access` |
| Callback Port | `1455` |

**Flow walkthrough:**

```
1. Client calls POST /api/auth/codex/start
   |
   +--> Worker generates:
   |    - code_verifier: 32 random bytes, base64url
   |    - code_challenge: SHA-256(code_verifier), base64url
   |    - state: crypto.randomUUID()
   |
   +--> Starts http.Server on 127.0.0.1:1455
   |    Listening for GET /auth/callback
   |    Returns authUrl with query params.
   |
2. Client opens authUrl in browser
   |
   +--> User signs in at auth.openai.com
   |    OpenAI redirects to http://localhost:1455/auth/callback?code=...&state=...
   |
3. Callback server receives redirect
   |
   +--> Validates state matches stored oauthState
   |    Responds with HTML success page:
   |      "Authenticated! You can close this tab."
   |    Stops callback server.
   |
   +--> Calls exchangeCode(code) asynchronously:
   |    Sends POST to TOKEN_URL with form-urlencoded body:
   |    grant_type=authorization_code&client_id=...&code=...
   |    &redirect_uri=...&code_verifier=...
   |    Note: Uses application/x-www-form-urlencoded (not JSON)
   |
4. Token response received
   |
   +--> storeCredentials() writes to ~/.codex/codedeck-auth.json
   |    Decodes JWT access_token to extract:
   |    - chatgpt_account_id
   |    - chatgpt_plan_type
   |    File permissions set to 0600.
   |    code_verifier and oauthState are cleared.
```

**Credential storage format** (`~/.codex/codedeck-auth.json`):

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "refresh_token": "...",
  "id_token": "...",
  "expires_at": 1705312200000,
  "chatgpt_account_id": "...",
  "chatgpt_plan_type": "plus"
}
```

**Error handling in the callback:**

If the callback URL contains an `error` query param, or if the `state` does
not match, the callback server still responds with an HTML page (showing the
error) and shuts down, but does NOT exchange the code.

**Cancellation:**

Calling `POST /api/auth/codex/cancel` stops the callback server and clears
all PKCE state, effectively aborting the flow.
