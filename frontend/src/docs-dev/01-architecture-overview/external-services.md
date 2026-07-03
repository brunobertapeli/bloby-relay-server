---
title: "External Services"
---

### Morphy Carrier (Cloudflare edge)

**Purpose**: Expose the supervisor (`127.0.0.1:7400` by default) to the internet at a stable URL, with no inbound ports and no third-party binary. Replaces the cloudflared tunnels used by earlier releases (removed 2026-07-02).

**How it works** (`supervisor/relay-tunnel.ts`):

- Opens ONE long-lived outbound WSS carrier to the bot's own Cloudflare Durable Object at `wss://<host>/__morphy/carrier`, where `<host>` is `username.open.morphyagent.com` (free) or `username.morphyagent.com` (premium)
- Authenticates with a short-lived Ed25519-signed ticket minted by the control plane (`fetchTicket()` in `shared/relay.ts`; tickets expire in ~5 minutes and the last good one is cached)
- The Cloudflare Worker + per-bot Durable Object mux all browser traffic (HTTP, chat WebSocket, Vite HMR) down the carrier; `relay-tunnel.ts` demuxes each stream and replays it against the local supervisor
- Every replayed request carries the real client IP in `cf-connecting-ip` plus an `x-morphy-tunnel` marker (client-supplied copies are stripped), so the supervisor's loopback guards still apply to public traffic

**Tunnel modes** (`tunnel.mode` in config):

| Mode              | Behavior                                              | URL                                            |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `relay` (default) | Persistent carrier into the bot's Durable Object      | Stable `username[.open].morphyagent.com`       |
| `off`             | No tunnel; managed/hosted bots are reached directly   | Bot's own origin                               |

The legacy cloudflared `quick`/`named` modes were removed; `loadConfig()` in `shared/config.ts` migrates old configs to `relay` automatically and deletes any stale random `tunnelUrl`.

**Liveness and reconnection**:

- Protocol-level ping/pong on the carrier (ping every 15s; a missed pong for 30s forces a redial)
- A reconnect is just a redial of the same Durable Object with backoff -- no URL rotation, no re-registration, no DNS propagation
- A wake/network-change hook calls `reconnectNow()` for an immediate teardown + redial after sleep
- Response bodies stream down in bounded frames with backpressure: the local response pauses when the socket buffer passes a high-water mark and resumes once it drains

### Morphy Relay (Control Plane)

**Purpose**: Account and handle management at `api.morphyagent.com` (Node.js + Express + MongoDB, hosted on Railway). It no longer proxies any bot traffic -- the data plane for self-hosted bots is the Cloudflare Worker + one Durable Object per bot described above.

**What the agent calls it for** (`shared/relay.ts`):

- `registerHandle` / `checkAvailability` / `claimReservedHandle` / `releaseHandle` -- handle lifecycle (registration, availability checks, activating a purchased premium handle)
- `fetchTicket` -- mints the Ed25519 carrier tickets
- `reportWallet` -- links the agent's wallet address to the dashboard
- `disconnect` -- best-effort "mark me offline" on graceful shutdown

```plain
Request Flow (self-hosted bot):

  Browser hits bruno.morphyagent.com
    |
    v
  Cloudflare Worker resolves the handle to the bot's Durable Object
    (idFromName("tier:username") IS the routing table -- no DB lookup)
    |
    v
  DO frames the request down the bot's persistent carrier WSS
    |
    v
  relay-tunnel.ts replays it to the local supervisor (127.0.0.1:7400)
    |
    v
  Response streams back up the carrier to the browser
```

**Presence protocol**:

- Connection-based: the Durable Object POSTs `/api/edge/presence` to the relay when the carrier connects or drops
- No heartbeat: presence IS the live carrier socket (`shared/relay.ts` notes "there is no heartbeat to stop")
- Graceful shutdown: `POST /api/disconnect` best-effort marks the bot offline

**Domain tiers**:

| Tier    | Subdomain Pattern               | Path Shortcut                   | Cost        |
| ------- | ------------------------------- | ------------------------------- | ----------- |
| Premium | `username.morphyagent.com`      | `morphyagent.com/username`      | $5 one-time |
| Free    | `username.open.morphyagent.com` | `open.morphyagent.com/username` | Free        |

### Claude API (via Agent SDK)

**Purpose**: Power the AI agent with full tool access.

**Integration point**: `supervisor/harnesses/claude.ts` wraps the `@anthropic-ai/claude-agent-sdk` package (v0.3.x). The dispatcher in `supervisor/bloby-agent.ts` selects this harness when `ai.provider` is `anthropic`.

**Authentication**: OAuth PKCE flow managed by `worker/claude-auth.ts`:

- Tokens stored in macOS Keychain (primary) or `~/.claude/.credentials.json` (fallback)
- Refresh tokens used to renew access tokens with a 5-minute expiry buffer
- Access token passed via `CLAUDE_CODE_OAUTH_TOKEN` environment variable

**Agent configuration**:

```typescript
// From buildConversationOptions() in supervisor/harnesses/claude.ts
query({
    prompt: sdkPrompt,
    options: {
        model, // e.g., claude-sonnet-5
        effort: 'high', // Deep reasoning, more token-efficient than the CLI default
        cwd: WORKSPACE_DIR, // Agent can only modify workspace/
        permissionMode: 'bypassPermissions', // No confirmation prompts
        allowDangerouslySkipPermissions: true,
        systemPrompt, // Assembled base prompt + memory files + history
        mcpServers, // From workspace/MCP.json
        skills, // Workspace skill names (mirrored into workspace/.claude/skills)
        settings: { autoCompactEnabled: true }, // Summarize old history, never hit the context wall
        env: { CLAUDE_CODE_OAUTH_TOKEN: oauthToken, CLAUDE_CODE_BUBBLEWRAP: '1' },
    },
});
// One-shot pulse/cron queries add maxTurns (default 50) and an abortController.
```

**Tool tracking**: The harness accumulates tool names from `tool_use` blocks in the SDK response stream into a `usedTools` Set (edits made inside sub-agents count too). At the end of a turn it reports `usedFileTools` (any of `Write`, `Edit`, `MultiEdit`, `NotebookEdit`) on the `bot:turn-complete` event; if true, the supervisor restarts the backend and the dashboard picks up the changes via HMR.

**Other model providers**: When `ai.provider` is `openai`, the Codex harness (`supervisor/harnesses/codex.ts`) spawns a long-lived `codex app-server` subprocess (JSON-RPC 2.0 over stdio) with the same agentic tool access. Its OAuth is a paste-back flow (`worker/codex-auth.ts`, no local callback server) and credentials live at `~/.codex/auth.json`, read by codex itself. The `pi` provider has its own harness under `supervisor/harnesses/pi/`.

---
