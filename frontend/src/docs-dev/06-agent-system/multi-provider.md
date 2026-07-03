---
title: "Multi-Provider Support"
---

## 3. Multi-Provider Support

### 3.1 AI Abstraction Layer

The file `shared/ai.ts` defines a provider-agnostic interface for streaming chat completions. It is the supervisor's fallback path for providers that do not have an agent harness (in practice, Ollama). Providers with a harness (Anthropic, OpenAI, Pi) never reach this layer for chat; see Section 3.2.

The core interface:

```ts
export interface AiProvider {
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

The factory function `createProvider()` dispatches based on a string identifier:

```ts
export function createProvider(provider: string, apiKey: string, baseUrl?: string): AiProvider | null {
  switch (provider) {
    case 'openai':    return openai(apiKey, baseUrl);
    case 'anthropic': return anthropic(apiKey);
    case 'ollama':    return ollama(baseUrl);
    default:          return null;
  }
}
```

### 3.2 Provider Routing in the Supervisor

The supervisor determines which path to use in its `user:message` WebSocket handler in `supervisor/index.ts`. The routing logic:

- **If the provider is `'anthropic'`, `'openai'`, or `'pi'`**: the request goes through the agent harness dispatcher in `supervisor/bloby-agent.ts`, which maps each provider to a harness (its `HARNESSES` map). All three harness paths have full agentic capabilities: tool use, file editing, shell access, skills, MCP servers, and multi-turn reasoning.
  - `anthropic` maps to the Claude Agent SDK harness (`supervisor/harnesses/claude.ts`).
  - `openai` maps to the Codex harness (`supervisor/harnesses/codex.ts`), which runs a long-lived `codex app-server` subprocess and talks to it over JSON-RPC 2.0 on stdio. Credentials come from `~/.codex/auth.json`.
  - `pi` maps to the Pi harness (`supervisor/harnesses/pi/`).

- **If the provider is anything else** (in practice, `'ollama'`): the request goes through the `AiProvider.chat()` interface defined in `shared/ai.ts`. This is a simpler path -- it sends conversation history as a message array and streams token-by-token responses. There is no tool use, no file access, no agentic behavior.

The provider is re-read from the config on every message, so changes take effect immediately without restart:

```ts
const freshConfig = loadConfig();
const freshAi = (freshConfig.ai.provider && (freshConfig.ai.apiKey || freshConfig.ai.provider === 'ollama'))
  ? createProvider(freshConfig.ai.provider, freshConfig.ai.apiKey, freshConfig.ai.baseUrl)
  : null;
```

### 3.3 Anthropic Provider (Direct API)

The `anthropic()` function implements direct streaming against the Anthropic Messages API at `https://api.anthropic.com/v1/messages`. It exists only for the generic `AiProvider` interface; chat routing for provider `'anthropic'` always takes the Claude harness path instead (Section 3.2). It:

- Extracts system messages from the message array and passes them via the `system` field.
- Uses SSE streaming with `stream: true`.
- Parses `content_block_delta` events for text tokens.
- Extracts usage from `message_start` and `message_delta` events.
- Authenticates via the `x-api-key` header with `anthropic-version: 2023-06-01`.

### 3.4 OpenAI Provider

The `openai()` function connects to OpenAI-compatible endpoints. Like the `anthropic()` function above, it serves the generic interface only; chat routing for provider `'openai'` takes the Codex harness path (Section 3.2). It:

- Defaults to `https://api.openai.com/v1` but accepts a custom `baseUrl` parameter, enabling support for any OpenAI-compatible API (Azure, local proxies, etc.).
- Sends all messages directly (including system messages) in the standard OpenAI format.
- Uses SSE streaming with `stream: true` and `stream_options: { include_usage: true }`.
- Parses `choices[0].delta.content` for text tokens.
- Authenticates via the `Authorization: Bearer` header.

### 3.5 Ollama Provider

The `ollama()` function connects to a local Ollama instance. This is the one provider that actually exercises the fallback chat path at runtime. It:

- Defaults to `http://localhost:11434` but accepts a custom `baseUrl`.
- Requires no authentication (no API key).
- Uses Ollama's native streaming format (newline-delimited JSON), not SSE.
- Reads the response body directly with a `ReadableStream` reader.
- Extracts usage from the final message where `j.done === true`.

### 3.6 SSE Parser

All SSE-based providers share a common `readSSE()` utility:

```ts
async function readSSE(res: Response, onLine: (line: string) => void, signal?: AbortSignal) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') onLine(line.slice(6));
    }
  }
}
```

The implementation uses raw `fetch()` with zero external dependencies -- no SDK libraries for any provider. The entire file is small and self-contained.

---
