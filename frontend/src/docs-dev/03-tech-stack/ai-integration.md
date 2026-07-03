---
title: "AI Integration"
---

### Claude Agent SDK

| Dependency                          | Version   |
| ----------------------------------- | --------- |
| **@anthropic-ai/claude-agent-sdk** | ^0.3.198  |

The primary AI integration, driven by the Claude harness (`supervisor/harnesses/claude.ts`) when `config.ai.provider === 'anthropic'`. The SDK is invoked via the `query()` function with:

- **`permissionMode: 'bypassPermissions'`** -- the agent runs with full tool access, no interactive approval.
- **Turn limits** -- one-shot background queries (pulse, cron, channel messages) default to `maxTurns: 50`. Live chat conversations are long-lived sessions with SDK auto-compaction (`autoCompactEnabled`) instead of a turn cap.
- **`cwd: workspace/`** -- the agent operates within the workspace directory.
- **System prompt** -- assembled by `worker/prompts/prompt-assembler.ts` from the per-harness base prompt (`worker/prompts/bloby-system-prompt.txt` for Claude) plus dynamic fragments, with `$BOT` and `$HUMAN` placeholder substitution.
- **Memory injection** -- `MYSELF.md`, `MYHUMAN.md`, `MEMORY.md`, `PULSE.json`, and `CRONS.json` are appended to the system prompt on every turn.
- **Conversation history** -- the most recent messages (the supervisor fetches up to 30) are injected into the system prompt for context continuity.
- **Skill support** -- `workspace/skills/` is mirrored into the SDK's project-skill root (`workspace/.claude/skills`) and enabled via the `skills` option.
- **MCP servers** -- loaded from `workspace/MCP.json` if present.
- **OAuth authentication** -- uses `CLAUDE_CODE_OAUTH_TOKEN` environment variable (not an API key).

The SDK streams responses via an async iterator, emitting `assistant` messages (with text and tool_use blocks), `tool_progress` updates, and `result` events.

### Multi-Provider Support

Four providers are supported (`config.ai.provider` in `shared/config.ts`): `anthropic`, `openai`, `pi`, and `ollama`. The first three are full agentic providers. `supervisor/bloby-agent.ts` is a thin dispatcher that picks the harness for the configured provider:

| Provider       | Harness                            | Runtime                                          | Auth                                   |
| -------------- | ---------------------------------- | ------------------------------------------------ | -------------------------------------- |
| **anthropic**  | `supervisor/harnesses/claude.ts`   | Claude Agent SDK                                 | `CLAUDE_CODE_OAUTH_TOKEN` (OAuth)      |
| **openai**     | `supervisor/harnesses/codex.ts`    | `codex app-server` subprocess (JSON-RPC over stdio, from **@openai/codex** ^0.142.5) | `~/.codex/auth.json` (ChatGPT subscription, paste-back OAuth) |
| **pi**         | `supervisor/harnesses/pi/`         | Pi session loop with the same tool surface       | `pi-auth.json`                         |

All three harnesses share the same surface (live conversations, one-shot queries, attachments, skills, MCP), so the dispatcher needs no provider-specific code. Codex model strings accept an optional effort suffix, `<id>:<effort>` with effort one of `low|medium|high|xhigh` (e.g. `gpt-5.6-sol:high`); the suffix is split off and passed as `effort` on `turn/start`.

For providers without a harness, the `shared/ai.ts` module implements a **zero-dependency** streaming abstraction using raw `fetch()` and SSE parsing:

| Provider       | Base URL                            | Auth mechanism       | Streaming     |
| -------------- | ----------------------------------- | -------------------- | ------------- |
| **OpenAI**     | `https://api.openai.com/v1` (configurable) | Bearer token  | SSE (`data:`) |
| **Anthropic**  | `https://api.anthropic.com/v1`      | `x-api-key` header   | SSE (`data:`) |
| **Ollama**     | `http://localhost:11434` (configurable)     | None          | NDJSON        |

The `AiProvider` interface is minimal:

```typescript
interface AiProvider {
  name: string;
  chat(
    messages: ChatMessage[],
    model: string,
    onToken: (token: string) => void,
    onDone: (full: string, usage?: { tokensIn: number; tokensOut: number }) => void,
    onError: (err: Error) => void,
    signal?: AbortSignal,
  ): void;
}
```

**Routing logic:** When the provider is `anthropic`, `openai`, or `pi`, messages are routed through the matching agent harness (full tool use). Only `ollama` uses the simpler `ai.chat()` path (no tool use, just streaming text).
