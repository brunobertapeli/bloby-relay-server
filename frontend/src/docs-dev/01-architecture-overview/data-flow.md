---
title: "Data Flow"
---

This traces the full path of a user message from phone to agent response.

### Step 1: User sends message (client)

```plain
User types message in chat SPA (supervisor/chat/)
  |
  v
useBlobyChat.ts sends via WebSocket:
  { type: 'user:message', data: { content: "Hello", conversationId: "abc123" } }
  (the server ignores the client-supplied conversationId -- it resolves
   the conversation itself so stale browser state cannot target a deleted one)
  |
  v
ws-client.ts sends over WebSocket connection
  (auto-reconnect with exponential backoff: 1s -> 2s -> 4s -> 8s cap)
  (auth token passed as ?token= query parameter on connect)
```

### Step 2: Supervisor receives message

```plain
blobyWss 'message' event fires               supervisor/index.ts
  |
  v
Parse JSON, check msg.type === 'user:message'
  |
  v
Re-read config (loadConfig()) to pick up post-onboard changes
  |
  v
Provider has an agent harness? (anthropic / openai / pi)
  /                        \
YES                        NO (e.g. ollama)
|                           |
v                           v
Harness dispatcher          ai.chat() with simple
(supervisor/bloby-agent.ts) message history
  anthropic -> Claude Agent SDK harness    (no tools, no file access)
  openai    -> Codex app-server harness
  pi        -> Pi harness
(every harness has full agentic tool access)
```

### Step 3: Agent harness execution

```plain
Save user message to DB:
  POST /api/conversations/{id}/messages (via workerApi, in-process)
  |
  v
Fetch agent/user names + recent messages (in parallel):
  GET /api/onboard/status         -> { agentName, userName }
  GET /api/conversations/{id}/messages/recent?limit=30
  |
  v
startConversation() + pushMessage()       supervisor/bloby-agent.ts
  (dispatched to the active provider's harness in supervisor/harnesses/)
  |
  v
Build enriched system prompt (per harness):
  base prompt assembled by worker/prompts/prompt-assembler.ts
    (bloby-system-prompt.txt / -codex.txt / -pi.txt + dynamic fragments)
  + MYSELF.md content
  + MYHUMAN.md content
  + MEMORY.md content
  + PULSE.json content
  + CRONS.json content
  + Recent conversation history
  |
  v
Claude harness (supervisor/harnesses/claude.ts) -- Agent SDK query():
  model:            from config (e.g., claude-sonnet-5)
  cwd:              workspace/
  permissionMode:   bypassPermissions
  skills:           workspace/skills/ mirrored into workspace/.claude/skills/
  mcpServers:       loaded from workspace/MCP.json
  env:              CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_BUBBLEWRAP=1

Codex harness (supervisor/harnesses/codex.ts) -- one long-lived
  `codex app-server` subprocess per conversation, JSON-RPC 2.0 over
  stdio, same tool access; codex reads its own credentials from
  ~/.codex/auth.json
```

### Step 4: Streaming response back to client

```plain
for await (const msg of claudeQuery):     (Claude harness shown; the
  |                                        other harnesses emit the
  |                                        same bot:* events)
  +-- msg.type === 'assistant'
  |     +-- block.type === 'text'     -> onMessage('bot:token', { token })
  |     +-- block.type === 'tool_use' -> onMessage('bot:tool', { name, input })
  |
  +-- msg.type === 'tool_progress'    -> onMessage('bot:tool', { status: 'running' })
  |
  +-- msg.type === 'result'           -> onMessage('bot:response', { content })
  |                                      onMessage('bot:turn-complete', { usedFileTools })
  |
  v
Supervisor's shared onMessage handler broadcasts every event
to all connected chat surfaces via broadcastBloby()
  |
  v
On bot:response:
  Save assistant reply to DB:
    POST /api/conversations/{id}/messages
  |
On bot:turn-complete:
  +-- If usedFileTools OR pendingBackendRestart:
  |     restart the user backend (serialized stop -> spawn)
  |
  +-- flushPendingUpdate()
        (a queued self-update runs now, as a detached process:
         node cli.js update)
```

### Step 5: Multi-device sync

All connected WebSocket clients receive every event via `broadcastBloby()`. When a user sends a message, `broadcastBlobyExcept(sender, ...)` sends a `chat:sync` event to all OTHER connected clients with the user message. The assistant response streams to ALL clients (including the sender).

Reconnecting clients receive a `chat:state` event containing the current stream buffer so they can catch up on any tokens they missed during disconnection.

---
