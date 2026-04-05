---
title: "Conversation Flow"
---

## 6. Conversation Flow

### 6.1 End-to-End Message Flow

A user message follows this path from browser to agent response:

```
Browser  -->  WsClient  -->  Supervisor WebSocket  -->  Agent SDK  -->  Claude API
                                                          |
                                                     [streaming]
                                                          |
Browser  <--  WsClient  <--  Supervisor WebSocket  <--  Events
```

### 6.2 Step 1: WebSocket Message Received

The client-side `WsClient` class (`supervisor/chat/src/lib/ws-client.ts`) maintains a persistent WebSocket connection with automatic reconnection (exponential backoff from 1s to 8s max -- line 19). Messages are sent as JSON with a `{ type, data }` envelope (line 89-97).

When the user types a message, the `useBlobyChat` hook (line 211) calls `ws.send('user:message', payload)` with the content, optional attachments, and current conversation ID.

### 6.3 Step 2: Supervisor Message Handling

The supervisor's WebSocket handler (`supervisor/index.ts`, line 384) receives the raw message, parses it, and handles `user:message` events (line 431).

For the Anthropic provider path (line 446), a comprehensive async flow begins:

1. **Attachment saving** (lines 450-459): If the message includes file attachments, they are saved to disk via `saveAttachment()` from `supervisor/file-saver.ts`. Each file gets a timestamped filename with random suffix (e.g., `20260303_143521_a1b2c3.png`) and is stored under `workspace/files/images/` or `workspace/files/documents/`.

2. **Conversation management** (lines 461-501):
   - Checks if the WebSocket client already has a tracked conversation ID.
   - If not, looks up the current conversation from the worker API (`/api/context/current`).
   - If none exists, creates a new conversation via `POST /api/conversations`.
   - Saves the user message to the database via `POST /api/conversations/{id}/messages`.
   - Broadcasts the user message to other connected clients via `broadcastBlobyExcept()`.

3. **Name resolution** (lines 503-526): Fetches the configured agent and user names from `/api/onboard/status`, and the last 20 messages from the conversation for history injection.

### 6.4 Step 3: Context Assembly

Before the agent is invoked, the context is assembled (described in Section 2):

1. Base system prompt read from `bloby-system-prompt.txt` with `$BOT`/`$HUMAN` replaced.
2. Memory files (MYSELF.md, MYHUMAN.md, MEMORY.md, PULSE.json, CRONS.json) appended.
3. Recent conversation history (up to 19 previous messages, excluding the current one) appended.

### 6.5 Step 4: Agent Invocation

The `startBlobyAgentQuery()` function is called (line 532 of `supervisor/index.ts`):

```ts
startBlobyAgentQuery(convId, content, freshConfig.ai.model, (type, eventData) => {
  // event handler
}, data.attachments, savedFiles, { botName, humanName }, recentMessages);
```

The function:

1. Obtains a valid Claude OAuth token (with automatic refresh if expired).
2. Constructs the enriched system prompt.
3. Auto-discovers skill plugins and MCP servers.
4. Calls the Claude Agent SDK `query()` function.
5. Enters the streaming loop.

### 6.6 Step 5: Streaming Response

The streaming loop in `startBlobyAgentQuery()` (lines 215-258) handles three SDK message types:

**`assistant` messages** (line 219): Contain content blocks. Text blocks are accumulated into `fullText` and emitted token-by-token via `bot:token`. Tool-use blocks are tracked and emitted as `bot:tool` events with the tool name and input.

**`result` messages** (line 240): Signal the end of the agent's response. If text was accumulated, a `bot:response` event is emitted with the full content. If the result indicates an error, a `bot:error` event is emitted.

**`tool_progress` messages** (line 251): Indicate that a tool is currently running. Emitted as `bot:tool` with status `'running'`.

In the supervisor, the streaming tokens are buffered for reconnecting clients (line 534):

```ts
if (type === 'bot:token' && eventData.token) {
  currentStreamBuffer += eventData.token;
}
```

When a new client connects while streaming is active, it receives the entire buffer via a `chat:state` message (lines 373-381).

### 6.7 Step 6: Database Persistence

When the agent completes its response (`bot:response` event), the supervisor saves the assistant message to the database (lines 559-569 of `supervisor/index.ts`):

```ts
await workerApi(`/api/conversations/${convId}/messages`, 'POST', {
  role: 'assistant', content: eventData.content, meta: { model: freshConfig.ai.model },
});
```

The database schema (in `worker/db.ts`) stores messages in a `messages` table with columns for `conversation_id`, `role`, `content`, `tokens_in`, `tokens_out`, `model`, `audio_data`, and `attachments`.

### 6.8 Step 7: Post-Turn Actions

When `bot:done` fires (lines 539-556 of `supervisor/index.ts`):

1. The `agentQueryActive` flag is cleared.
2. If the agent used Write or Edit tools (`usedFileTools`), or if the file watcher detected changes during the turn (`pendingBackendRestart`), the backend is restarted.
3. If a `.update` trigger file was created during the turn (`pendingUpdate`), a deferred self-update is launched.
4. The `bot:done` event is NOT forwarded to the client -- it is consumed by the supervisor.

### 6.9 Event Protocol Summary

| Event | Direction | Purpose |
|-------|-----------|---------|
| `user:message` | Client -> Server | User sends a message |
| `user:stop` | Client -> Server | Cancel in-flight query |
| `user:clear-context` | Client -> Server | Clear conversation context |
| `bot:typing` | Server -> Client | Agent is starting to think |
| `bot:token` | Server -> Client | Incremental text token |
| `bot:tool` | Server -> Client | Tool invocation or progress |
| `bot:response` | Server -> Client | Complete response text |
| `bot:error` | Server -> Client | Error occurred |
| `chat:sync` | Server -> Client | Cross-device message sync |
| `chat:conversation-created` | Server -> Client | New conversation ID assigned |
| `chat:state` | Server -> Client | Current streaming state (for reconnection) |
| `chat:cleared` | Server -> Client | Context was cleared |

---
