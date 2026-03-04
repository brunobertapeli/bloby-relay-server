---
title: "External Services"
---

### Cloudflare Tunnel

**Purpose**: Expose `localhost:3000` to the internet so the user can access their agent remotely.

**Binary management** (`supervisor/tunnel.ts`):

- Auto-downloads `cloudflared` to `~/.fluxy/bin/` on first run
- Validates binary by file size (minimum 10 MB -- a valid binary is 30-50 MB)
- Platform-specific download URLs (Linux amd64/arm64/arm, macOS amd64/arm64, Windows amd64/arm64)

**Two tunnel modes** (selected during `fluxy init`):

| Mode  | Command                                                          | URL Behavior                                     | Relay Needed                 |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------ | ---------------------------- |
| Quick | `cloudflared tunnel --url http://localhost:3000 --no-autoupdate` | Random `*.trycloudflare.com`, changes on restart | Optional (for stable domain) |
| Named | `cloudflared tunnel --config <path> run <name>`                  | User's own domain, permanent                     | No                           |

**Health watchdog** (lines 877-925 of `supervisor/index.ts`):

- Runs every 30 seconds
- Detects sleep/wake gaps (>60s between ticks)
- Periodic health check every 5th tick (every ~300s)
- Checks: (1) process alive, (2) local server reachable at `127.0.0.1:3000/api/health`
- On failure: kills and restarts cloudflared
- Quick tunnel: re-extracts new URL, updates relay if configured
- Named tunnel: restarts process, URL is unchanged

### Fluxy Relay (Optional)

**Purpose**: Provide a stable `username.fluxy.bot` domain that maps to the user's ephemeral Quick Tunnel URL. Not needed for Named Tunnel mode.

**Architecture**: Node.js + Express + `http-proxy` + MongoDB, hosted on Railway at `api.fluxy.bot`.

```plain
Request Flow Through Relay:

  Browser hits bruno.fluxy.bot
    |
    v
  Subdomain middleware extracts username + tier from hostname
    |
    v
  MongoDB lookup: { username: "bruno", tier: "premium" }
    -> tunnelUrl: "https://random-abc.trycloudflare.com"
    |
    v
  proxy.web(req, res, { target: tunnelUrl })
    -> Everything forwarded: headers, body, method
    |
    v
  Response streams back to browser
```

**Presence protocol**:

- Heartbeat: `POST /api/heartbeat` every 30 seconds (from `shared/relay.ts:77`)
- Stale threshold: 120 seconds with no heartbeat
- Graceful shutdown: `POST /api/disconnect` (from `shared/relay.ts:108`)

**Domain tiers**:

| Tier    | Subdomain Pattern       | Path Shortcut           | Cost  |
| ------- | ----------------------- | ----------------------- | ----- |
| Premium | `username.fluxy.bot`    | `fluxy.bot/username`    | $5/mo |
| Free    | `username.my.fluxy.bot` | `my.fluxy.bot/username` | Free  |

### Claude API (via Agent SDK)

**Purpose**: Power the AI agent with full tool access.

**Integration point**: `supervisor/fluxy-agent.ts` wraps the `@anthropic-ai/claude-agent-sdk` package (v0.2.50+).

**Authentication**: OAuth PKCE flow managed by `worker/claude-auth.ts`:

- Tokens stored in macOS Keychain (primary) or `~/.claude/.credentials.json` (fallback)
- Refresh tokens used to renew access tokens with a 5-minute expiry buffer
- Access token passed via `CLAUDE_CODE_OAUTH_TOKEN` environment variable

**Agent configuration**:

```typescript
// From supervisor/fluxy-agent.ts:192-211
query({
    prompt: sdkPrompt,
    options: {
        model, // e.g., claude-sonnet-4-20250514
        cwd: path.join(PKG_DIR, 'workspace'), // Agent can only modify workspace/
        permissionMode: 'bypassPermissions', // No confirmation prompts
        allowDangerouslySkipPermissions: true,
        maxTurns: 50, // Safety limit per query
        abortController, // User can send user:stop
        systemPrompt: enrichedPrompt, // Base + memory files + history
        plugins, // Auto-discovered skills
        mcpServers, // From workspace/MCP.json
    },
});
```

**Tool tracking**: After a query completes, `fluxy-agent.ts` checks whether `Write` or `Edit` tools were used. If so, the supervisor restarts the backend and fires HMR updates for the dashboard. This is tracked via a `usedTools` Set that accumulates tool names from `tool_use` blocks in the SDK response stream (line 233, line 274-276).

---
