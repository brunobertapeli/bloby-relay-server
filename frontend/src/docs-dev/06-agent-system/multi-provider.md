---
title: "Multi-Provider Support"
---

## 3. Multi-Provider Support

### 3.1 AI Abstraction Layer

The file `shared/ai.ts` defines a provider-agnostic interface for streaming chat completions. It is used by the supervisor for non-Anthropic providers (OpenAI, Ollama) as a fallback path when the Claude Agent SDK is not applicable.

The core interface (lines 6-16):

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

The factory function `createProvider()` (line 18) dispatches based on a string identifier:

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

The supervisor determines which path to use in `supervisor/index.ts` (lines 446-604). The routing logic:

- **If the provider is `'anthropic'`** (line 446): the request goes through the Claude Agent SDK path (`startFluxyAgentQuery()`). This is the primary path with full agentic capabilities (tool use, file editing, shell access, multi-turn reasoning).

- **If the provider is anything else** (lines 580-604): the request goes through the `AiProvider.chat()` interface defined in `shared/ai.ts`. This is a simpler path -- it sends conversation history as a message array and streams token-by-token responses. There is no tool use, no file access, no agentic behavior.

The provider is re-read from the config on every message (line 438), so changes take effect immediately without restart:

```ts
const freshConfig = loadConfig();
const freshAi = (freshConfig.ai.provider && (freshConfig.ai.apiKey || freshConfig.ai.provider === 'ollama'))
  ? createProvider(freshConfig.ai.provider, freshConfig.ai.apiKey, freshConfig.ai.baseUrl)
  : null;
```

### 3.3 Anthropic Provider (Direct API)

The `anthropic()` function (lines 74-111) implements direct streaming against the Anthropic Messages API at `https://api.anthropic.com/v1/messages`. This path is used only when the `AiProvider` interface is needed (non-SDK path). It:

- Extracts system messages from the message array and passes them via the `system` field (lines 79-80).
- Uses SSE streaming with `stream: true`.
- Parses `content_block_delta` events for text tokens (line 96).
- Extracts usage from `message_start` and `message_delta` events (lines 100-105).
- Authenticates via the `x-api-key` header with `anthropic-version: 2023-06-01`.

### 3.4 OpenAI Provider

The `openai()` function (lines 48-72) connects to OpenAI-compatible endpoints. It:

- Defaults to `https://api.openai.com/v1` but accepts a custom `baseUrl` parameter, enabling support for any OpenAI-compatible API (Azure, local proxies, etc.).
- Sends all messages directly (including system messages) in the standard OpenAI format.
- Uses SSE streaming with `stream: true` and `stream_options: { include_usage: true }`.
- Parses `choices[0].delta.content` for text tokens (line 64).
- Authenticates via the `Authorization: Bearer` header.

### 3.5 Ollama Provider

The `ollama()` function (lines 113-141) connects to a local Ollama instance. It:

- Defaults to `http://localhost:11434` but accepts a custom `baseUrl`.
- Requires no authentication (no API key).
- Uses Ollama's native streaming format (newline-delimited JSON), not SSE.
- Reads the response body directly with a `ReadableStream` reader (lines 125-134).
- Extracts usage from the final message where `j.done === true` (line 134).

### 3.6 SSE Parser

All SSE-based providers share a common `readSSE()` utility (lines 29-44):

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

The implementation uses raw `fetch()` with zero external dependencies -- no SDK libraries for any provider. The entire file is 141 lines and self-contained.

---
