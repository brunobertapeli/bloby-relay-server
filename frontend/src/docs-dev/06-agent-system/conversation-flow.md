---
title: "Conversation Flow"
---

## 6. Conversation Flow

### 6.1 End-to-End Message Flow

A user message follows this path from browser to agent response:

```
Browser  -->  WsClient  -->  Supervisor WebSocket  -->  Agent Harness  -->  Provider API
                                                            |
                                                       [streaming]
                                                            |
Browser  <--  WsClient  <--  Supervisor WebSocket  <--  Events
```

The harness dispatcher (`supervisor/bloby-agent.ts`) picks the agent runtime from `ai.provider`: `anthropic` runs the Claude Agent SDK harness (`supervisor/harnesses/claude.ts`), `openai` runs the Codex app-server harness (`supervisor/harnesses/codex.ts`), and `pi` runs the Pi harness. Every harness implements the same `Harness` contract (`supervisor/harnesses/types.ts`) and translates its native events into one shared vocabulary, so the flow below applies to all providers. Harness-specific details use the Claude harness as the reference implementation.

### 6.2 Step 1: WebSocket Message Received

The client-side `WsClient` class (`supervisor/chat/src/lib/ws-client.ts`) maintains a persistent WebSocket connection with automatic reconnection (exponential backoff from 1s to 8s max). Messages are sent as JSON with a `{ type, data }` envelope.

When the user types a message, the `useBlobyChat` hook calls `ws.send('user:message', payload)` with the content plus optional attachments and voice audio. The payload carries the client's conversation ID, but the server intentionally ignores it: the supervisor is the authority on which database conversation each socket belongs to, so stale browser state can never write into a deleted conversation.

### 6.3 Step 2: Supervisor Message Handling

The supervisor's WebSocket handler (`supervisor/index.ts`) receives the raw message, parses it, and handles `user:message` events.

For any provider with an agent harness (`anthropic`, `openai`, `pi`), a comprehensive async flow begins:

1. **Attachment saving**: If the message includes file attachments, they are saved to disk via `saveAttachment()` from `supervisor/file-saver.ts`, bounded by per-message count and total-size caps. Each file gets a timestamped filename with random suffix (e.g., `20260303_143521_a1b2c3.png`) and is stored under `workspace/files/images/` or `workspace/files/documents/`. Voice clips are persisted via `saveAudio()` so chat can replay them after a refresh.

2. **Conversation management**:
   - Checks if the WebSocket client already has a tracked conversation ID.
   - If not, looks up the current conversation from the worker API (`/api/context/current`). The worker runs in-process: `workerApi()` calls the supervisor's own HTTP server, where `createWorkerApp()` from `worker/index.ts` is mounted.
   - If none exists, creates a new conversation via `POST /api/conversations`.
   - Saves the user message to the database via `POST /api/conversations/{id}/messages`.
   - Broadcasts the user message to other connected clients via `broadcastBlobyExcept()` as a `chat:sync` event.

3. **Name and history resolution**: Fetches the configured agent and user names from `/api/onboard/status`, and the last 30 messages from the conversation (excluding the current one) for history injection.

### 6.4 Step 3: Context Assembly

Before the agent is invoked, the context is assembled (described in Section 2):

1. Base system prompt built by `worker/prompts/prompt-assembler.ts` from the harness's prompt file (`bloby-system-prompt.txt` for Claude, with `-codex` and `-pi` variants) with `$BOT`/`$HUMAN` replaced.
2. Memory files (MYSELF.md, MYHUMAN.md, MEMORY.md, PULSE.json, CRONS.json) appended.
3. Recent conversation history injected when the live session starts. The current message is excluded; it arrives as the prompt itself.

### 6.5 Step 4: Agent Invocation

Dashboard chat uses the dispatcher's live-conversation API rather than one query per message. If no live session exists for the conversation, one is started; the message is then pushed into it:

```ts
if (!hasConversation(convId)) {
  await startConversation(convId, freshConfig.ai.model,
    createSharedChatOnMessage(convId, freshConfig.ai.model, botName, waState),
    { botName, humanName }, recentMessages);
}
channelManager.pushWithRouting(convId, { surface: 'chat', ... }, content, attachments, savedFiles);
```

`pushWithRouting()` records a routing target for the turn, then calls the dispatcher's `pushMessage()`. In the Claude harness, `startConversation()`:

1. Obtains a valid Claude OAuth token (with automatic refresh if expired).
2. Constructs the enriched system prompt and loads sub-agent definitions.
3. Mirrors workspace skills into the SDK's project-skill root and loads MCP servers.
4. Calls the Claude Agent SDK `query()` with an async input queue as its prompt, optionally claiming a pre-warmed subprocess.
5. Enters the streaming loop. Each `pushMessage()` feeds a user message into the queue and emits `bot:typing`.

The one-shot API (`startBlobyAgentQuery()` / `stopBlobyAgentQuery()`) still exists alongside this, but it is used by the scheduler (pulse/cron) and customer channels, not by dashboard chat.

### 6.6 Step 5: Streaming Response

The streaming loop in the Claude harness handles the SDK message types:

**`assistant` messages**: Contain content blocks. Text blocks are accumulated into `fullText` and streamed as `bot:token` events. Tool-use blocks are tracked and emitted as `bot:tool` events with the tool name and input.

**`result` messages**: Signal the end of a turn. If text was accumulated, a `bot:response` event is emitted with the full content; if the result indicates an error, a `bot:error` event is emitted. The harness then emits `bot:turn-complete` with `usedFileTools`, context-usage stats, and whether the session is idle.

**`tool_progress` messages**: Indicate that a tool is currently running. Emitted as `bot:tool` with status `'running'`.

In the supervisor, the shared event handler buffers streaming tokens for reconnecting clients:

```ts
if (type === 'bot:token' && eventData.token && isDashboardTurn) {
  currentStreamBuffer += eventData.token;
}
```

When a new client connects while streaming is active, it receives the entire buffer via a `chat:state` message.

### 6.7 Step 6: Database Persistence

When the agent completes its response (`bot:response` event), the supervisor saves the assistant message to the database (in `createSharedChatOnMessage()`, with a timeout so a hung write cannot swallow the reply broadcast):

```ts
await workerApi(`/api/conversations/${convId}/messages`, 'POST', {
  role: 'assistant', content: eventData.content, meta: { model },
}, 15000);
```

If the write fails, a `chat:persist-error` event is broadcast so clients can flag the unsaved message. The database schema (in `worker/db.ts`) stores messages in a `messages` table with columns for `conversation_id`, `role`, `content`, `tokens_in`, `tokens_out`, `model`, `audio_data`, and `attachments`.

### 6.8 Step 7: Post-Turn Actions

When `bot:turn-complete` fires (handled in `createSharedChatOnMessage()` in `supervisor/index.ts`):

1. The `agentQueryActive` flag is cleared and the stream buffer is reset.
2. If the agent used Write or Edit tools (`usedFileTools`), or if the file watcher detected changes during the turn (`pendingBackendRestart`), the backend is restarted.
3. Any queued self-update (from a `.update` trigger file or the update API, routed through `queueUpdate()`) is flushed via `flushPendingUpdate()`.
4. If the harness reports the session idle and context usage has crossed the recycle threshold, the live session is ended; the next message starts a fresh one that re-injects recent history and memory.
5. The `bot:turn-complete` event is NOT forwarded to the client -- it is consumed by the supervisor, which broadcasts `bot:idle` instead.

### 6.9 Event Protocol Summary

| Event | Direction | Purpose |
|-------|-----------|---------|
| `user:message` | Client -> Server | User sends a message |
| `user:stop` | Client -> Server | Cancel the in-flight turn (ends the live session) |
| `user:stop-task` | Client -> Server | Stop a running sub-agent task |
| `user:clear-context` | Client -> Server | Clear conversation context |
| `bot:typing` | Server -> Client | Agent is starting to think |
| `bot:token` | Server -> Client | Incremental text chunk |
| `bot:tool` | Server -> Client | Tool invocation or progress |
| `bot:response` | Server -> Client | Complete response text |
| `bot:idle` | Server -> Client | Turn finished, agent is idle |
| `bot:error` | Server -> Client | Error occurred |
| `chat:sync` | Server -> Client | Cross-device message sync |
| `chat:conversation-created` | Server -> Client | New conversation ID assigned |
| `chat:state` | Server -> Client | Current streaming state (for reconnection) |
| `chat:cleared` | Server -> Client | Context was cleared |
| `chat:persist-error` | Server -> Client | A message failed to persist to the database |

---
