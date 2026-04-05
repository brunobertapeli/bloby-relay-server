---
title: "AI Integration"
---

### Claude Agent SDK

| Dependency                          | Version   |
| ----------------------------------- | --------- |
| **@anthropic-ai/claude-agent-sdk** | ^0.2.50   |

The primary AI integration. Used when `config.ai.provider === 'anthropic'`. The SDK is invoked via the `query()` function with:

- **`permissionMode: 'bypassPermissions'`** -- the agent runs with full tool access, no interactive approval.
- **`maxTurns: 50`** -- limits agentic loops.
- **`cwd: workspace/`** -- the agent operates within the workspace directory.
- **System prompt** -- loaded from `worker/prompts/bloby-system-prompt.txt` with `$BOT` and `$HUMAN` placeholder substitution.
- **Memory injection** -- `MYSELF.md`, `MYHUMAN.md`, `MEMORY.md`, `PULSE.json`, and `CRONS.json` are appended to the system prompt on every turn.
- **Conversation history** -- the last 20 messages are injected into the system prompt for context continuity.
- **Plugin support** -- auto-discovers skill plugins in `workspace/skills/` (folders containing `.claude-plugin/plugin.json`).
- **MCP servers** -- loaded from `workspace/MCP.json` if present.
- **OAuth authentication** -- uses `CLAUDE_CODE_OAUTH_TOKEN` environment variable (not an API key).

The SDK streams responses via an async iterator, emitting `assistant` messages (with text and tool_use blocks), `tool_progress` updates, and `result` events.

### Multi-Provider Support

The `shared/ai.ts` module implements a **zero-dependency** provider abstraction using raw `fetch()` and SSE parsing:

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

**Routing logic:** When the provider is `anthropic`, messages are routed through the Claude Agent SDK (with full tool use). For `openai` and `ollama`, the simpler `ai.chat()` path is used (no tool use, just streaming text).
