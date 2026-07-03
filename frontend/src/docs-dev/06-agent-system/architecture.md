---
title: "Agent Architecture"
---

## 1. Agent Architecture

### 1.1 Harness Dispatch and the Claude Agent SDK

`supervisor/bloby-agent.ts` is a thin dispatcher: it picks the right harness implementation based on `cfg.ai.provider` and forwards every call, so the supervisor, channels, and scheduler keep importing from `./bloby-agent.js` unchanged.

- `anthropic` (or empty/default) -> Claude Agent SDK harness (`supervisor/harnesses/claude.ts`)
- `openai` -> Codex app-server harness (`supervisor/harnesses/codex.ts`)
- `pi` -> Pi harness (`supervisor/harnesses/pi/`)

Cleanup operations (`endAllConversations`, `endConversation`) fan out to every harness, so a conversation started under a previously active provider cannot outlive a provider switch.

The primary path is the Claude harness, built on the `@anthropic-ai/claude-agent-sdk` package:

```ts
import { query, type SDKMessage, type SDKUserMessage, type Options } from '@anthropic-ai/claude-agent-sdk';
```

The harness wraps the SDK's `query()` function with Morphy-specific prompt assembly, streaming I/O, and lifecycle management, re-emitting SDK messages as Morphy's internal event protocol (`bot:token`, `bot:tool`, `bot:response`, `bot:turn-complete`, `bot:error`, `bot:done`).

### 1.2 Session Management

Morphy uses a **long-lived query** model for live conversations (the dashboard chat and admin WhatsApp). `startConversation()` creates a single `query()` whose prompt is an async input queue; `pushMessage()` pushes each user message into that queue, and the agent processes messages as they arrive. The session stays alive between turns, so the model keeps its own working context instead of being rebuilt per message.

Context at conversation start is injected into the system prompt:

1. Memory and config files (MYSELF.md, MYHUMAN.md, MEMORY.md, PULSE.json, CRONS.json), read from the workspace by `readMemoryFiles()`.
2. Recent messages from the database, appended as a `# Recent Conversation` section.

Because the query is long-lived, its context grows every turn. Two mechanisms keep it bounded: the SDK's auto-compaction (enabled via `settings: { autoCompactEnabled: true }`), and proactive session recycling in the supervisor. Each `bot:turn-complete` event carries `contextTokens` and `contextWindow`; when an idle session crosses the recycle threshold, the supervisor ends it, and the next user message starts a fresh session with recent history and memory re-injected.

One-shot queries (customer WhatsApp, scheduler pulse/cron) keep the classic request-response shape: `startBlobyAgentQuery()` runs one `query()` per message. The `activeQueries` map tracks in-flight one-shots by conversation ID, each with its own `AbortController`; `stopBlobyAgentQuery()` aborts the controller and removes the entry. Live conversations are tracked separately in the `liveConversations` map and ended via `endConversation()`.

### 1.3 Query Lifecycle

The lifecycle of a live conversation in `supervisor/harnesses/claude.ts`:

1. **OAuth token retrieval** -- `getClaudeAccessToken()` from `worker/claude-auth.ts`. If the token is expired, it attempts a refresh using the stored refresh token.
2. **System prompt construction** -- `assembleSystemPrompt()` from `worker/prompts/prompt-assembler.ts`, then memory files, channel config, and recent conversation history are appended (`buildConversationOptions()`).
3. **Skill discovery** -- `mirrorSkillsInto()` from `supervisor/harnesses/skills.ts` mirrors each `workspace/skills/<name>` folder (defined by a `SKILL.md` with `name` + `description` frontmatter) into `workspace/.claude/skills/<name>` as a symlink -- the Agent SDK's project-skill discovery root -- and the skill names are passed via the SDK's `skills` option. The SDK lists each skill's name+description in context and lazy-loads the SKILL.md body through its native Skill tool.
4. **MCP server loading** -- `loadMcpServers()` reads `workspace/MCP.json` for external tool servers.
5. **SDK invocation** -- a single `query()` fed by the async input queue. A pre-warmed CLI subprocess (`supervisor/cli-warmup.ts`) is claimed when its options match, so the first message skips CLI startup latency.
6. **Streaming loop** -- `for await (const msg of claudeQuery)`, dispatching events via the `onMessage` callback. Each SDK `result` message marks a turn boundary and emits `bot:turn-complete` with a `usedFileTools` flag plus context-size data.
7. **Cleanup** -- when the loop ends, the conversation is removed from `liveConversations`, `bot:conversation-ended` fires, and a fresh subprocess is pre-warmed for the next conversation.

One-shot queries follow the same assembly steps but run a single `query()` per prompt, emit `bot:done` with a `usedFileTools` flag from a `finally` block, and are guarded by a 5-minute watchdog that aborts a hung CLI subprocess.

### 1.4 SDK Options

The options assembled by `buildConversationOptions()` (live conversations) and the one-shot path:

| Option | Value | Purpose |
|--------|-------|---------|
| `model` | User-configured model string | Which Claude model to use |
| `effort` | `'high'` | Deep reasoning, more token-efficient than the CLI default |
| `cwd` | `WORKSPACE_DIR` | Agent's working directory |
| `permissionMode` | `'bypassPermissions'` | Skip all permission prompts |
| `allowDangerouslySkipPermissions` | `true` | Required for bypass mode |
| `systemPrompt` | Enriched prompt string | Full system prompt with memory |
| `skills` | Mirrored workspace skill names | Skills from `workspace/skills/` (via the `workspace/.claude/skills` symlink mirror) |
| `mcpServers` | From `MCP.json` | External tool servers |
| `agents` | `buildAgents()` (live only) | Background sub-agent definitions |
| `agentProgressSummaries` | `true` (live only) | Sub-agent progress events |
| `settings` | `{ autoCompactEnabled: true }` (live only) | Summarize older history when context fills |
| `maxTurns` | Default `50` (one-shot only) | Maximum agentic turns per query |
| `abortController` | Per-conversation/per-query | Allows cancellation |

The environment is augmented with `CLAUDE_CODE_OAUTH_TOKEN` (the Claude OAuth token) and `CLAUDE_CODE_BUBBLEWRAP` set to `'1'`.

---
