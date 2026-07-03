---
title: "Authentication Flow"
---

## 8. Authentication Flow

### 8.1 Claude OAuth PKCE

The Anthropic provider authenticates with OAuth 2.0 with PKCE (Proof Key for Code Exchange), implemented in `worker/claude-auth.ts`.

The flow:

1. `startClaudeOAuth()` generates a PKCE code verifier and code challenge.
2. A URL is returned pointing to `https://claude.ai/oauth/authorize`.
3. The user authenticates and receives a code, which they paste back into the Morphy dashboard (no local callback server).
4. `exchangeClaudeCode()` exchanges the code for access and refresh tokens at `https://console.anthropic.com/v1/oauth/token`.
5. Tokens are stored in `~/.claude/.credentials.json`. On macOS they are also written to the Keychain, which is treated as the source of truth there.

Token refresh is handled transparently. `getClaudeAccessToken()` (in `claude-auth.ts`) returns a valid access token, refreshing it first if expired, and returns null only when no usable credentials exist.

The Claude harness (`supervisor/harnesses/claude.ts`) injects the access token into the Agent SDK environment as `CLAUDE_CODE_OAUTH_TOKEN`.

### 8.2 Codex OAuth (OpenAI Provider)

The OpenAI provider uses the same paste-back pattern, implemented in `worker/codex-auth.ts`. `startCodexOAuth()` builds a PKCE authorization URL on `https://auth.openai.com`; the browser redirect targets an unreachable `localhost:1455` callback, so the user pastes the redirect URL (or the code inside it) back into the wizard and `exchangeCodexCode()` performs the token exchange.

Credentials are stored in `~/.codex/auth.json` in the exact shape the Codex CLI writes, so the spawned `codex app-server` process reads them directly. Access tokens are refreshed proactively, shortly before expiry.

The Pi harness keeps its own credential bundle in `~/.morphy/pi-auth.json`, separate from the main config.

---
