---
title: "Agent Architecture"
---

## 1. Agent Architecture

### 1.1 Claude Agent SDK Integration

The primary agent path uses the `@anthropic-ai/claude-agent-sdk` package. The integration lives in `supervisor/bloby-agent.ts` and wraps the SDK's `query()` function with Bloby-specific context assembly, streaming I/O, and lifecycle management.

Key import (line 6):

```ts
import { query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
```

The SDK is invoked in `startBlobyAgentQuery()` (line 116) with a call to `query()` (line 192) that returns an async iterable of SDK messages. The function iterates over these messages, extracting text blocks, tool-use blocks, and result events, then re-emits them as Bloby's internal event protocol (`bot:token`, `bot:tool`, `bot:response`, `bot:error`, `bot:done`).

### 1.2 Session Management

Bloby uses a **fresh-context-per-turn** model. There is no persistent Agent SDK session carried across turns. The file header (lines 1-4) states this explicitly:

```
Fresh context per turn -- memory files and conversation history
are injected into the system prompt.
```

Each invocation of `startBlobyAgentQuery()` creates a brand-new `query()` call. Continuity is achieved by:

1. Injecting the last 20 messages from the database into the system prompt as a `# Recent Conversation` section (line 142).
2. Injecting memory files (MYSELF.md, MYHUMAN.md, MEMORY.md, PULSE.json, CRONS.json) into the system prompt (line 139).

The `activeQueries` map (line 25) tracks in-flight queries by conversation ID so they can be cancelled:

```ts
const activeQueries = new Map<string, ActiveQuery>();
```

Each query gets its own `AbortController` (line 132). Cancellation is exposed via `stopBlobyAgentQuery()` (line 281), which aborts the controller and removes the entry from the map.

### 1.3 Query Lifecycle

The lifecycle of a single agent query in `startBlobyAgentQuery()` (lines 116-277):

1. **OAuth token retrieval** -- `getClaudeAccessToken()` from `worker/claude-auth.ts` (line 126). If the token is expired, it attempts a refresh using the stored refresh token.
2. **System prompt construction** -- `readSystemPrompt()` + memory file injection (lines 133-143).
3. **Plugin discovery** -- scans `workspace/skills/` for directories containing `.claude-plugin/plugin.json` (lines 163-171).
4. **MCP server loading** -- reads `workspace/MCP.json` for external tool servers (lines 175-190).
5. **SDK invocation** -- `query()` with assembled options (lines 192-211).
6. **Streaming loop** -- `for await (const msg of claudeQuery)` (line 215), dispatching events via the `onMessage` callback.
7. **Cleanup** -- removes from `activeQueries`, checks if file tools were used, emits `bot:done` with a `usedFileTools` flag (lines 272-277).

### 1.4 SDK Options

The options passed to `query()` (lines 192-211):

| Option | Value | Purpose |
|--------|-------|---------|
| `model` | User-configured model string | Which Claude model to use |
| `cwd` | `PKG_DIR/workspace` | Agent's working directory |
| `permissionMode` | `'bypassPermissions'` | Skip all permission prompts |
| `allowDangerouslySkipPermissions` | `true` | Required for bypass mode |
| `maxTurns` | `50` | Maximum agentic turns per query |
| `abortController` | Per-query AbortController | Allows cancellation |
| `systemPrompt` | Enriched prompt string | Full system prompt with memory |
| `plugins` | Auto-discovered skill plugins | Local plugins from `workspace/skills/` |
| `mcpServers` | From `MCP.json` | External tool servers |

The environment is augmented with `CLAUDE_CODE_OAUTH_TOKEN` (the Claude OAuth token) and `CLAUDE_CODE_BUBBLEWRAP` set to `'1'` (line 206-209).

---
