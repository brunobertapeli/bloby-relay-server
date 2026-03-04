---
title: "Authentication Flow"
---

## 8. Authentication Flow

### 8.1 Claude OAuth PKCE

The agent's primary authentication mechanism uses OAuth 2.0 with PKCE (Proof Key for Code Exchange), implemented in `worker/claude-auth.ts`.

The flow:

1. `startClaudeOAuth()` generates a PKCE code verifier and code challenge.
2. A URL is returned pointing to `https://claude.ai/oauth/authorize`.
3. The user authenticates and receives a code.
4. `exchangeClaudeCode()` exchanges the code for access and refresh tokens at `https://console.anthropic.com/v1/oauth/token`.
5. Tokens are stored in `~/.claude/.credentials.json` (and macOS Keychain on macOS).

Token refresh is handled transparently. `getClaudeAccessToken()` (line 121 of `claude-auth.ts`) checks if the token is expired and attempts a refresh before returning null.

The access token is injected into the SDK environment as `CLAUDE_CODE_OAUTH_TOKEN` (line 207 of `supervisor/fluxy-agent.ts`).

---
