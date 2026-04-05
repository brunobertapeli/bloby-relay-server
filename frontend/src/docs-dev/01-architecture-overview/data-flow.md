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
  |
  v
ws-client.ts sends over WebSocket connection
  (auto-reconnect with exponential backoff: 1s -> 2s -> 4s -> 8s cap)
  (auth token passed as ?token= query parameter on connect)
```

### Step 2: Supervisor receives message

```plain
blobyWss 'message' event fires               supervisor/index.ts:384
  |
  v
Parse JSON, check msg.type === 'user:message'
  |
  v
Re-read config (loadConfig()) to pick up post-onboard changes
  |
  v
Check provider === 'anthropic'?
  /                    \
YES                    NO
|                       |
v                       v
Agent SDK path         ai.chat() with simple
(full tool access)     message history
                       (no tools, no file access)
```

### Step 3: Agent SDK execution (Anthropic path)

```plain
Save user message to DB:
  POST /api/conversations/{id}/messages (via workerApi)
  |
  v
Fetch agent/user names + recent messages (in parallel):
  GET /api/onboard/status         -> { agentName, userName }
  GET /api/conversations/{id}/messages/recent?limit=20
  |
  v
startBlobyAgentQuery()            supervisor/bloby-agent.ts:116
  |
  v
Build enriched system prompt:
  base prompt (worker/prompts/bloby-system-prompt.txt)
  + MYSELF.md content
  + MYHUMAN.md content
  + MEMORY.md content
  + PULSE.json content
  + CRONS.json content
  + Recent conversation history (up to 20 messages)
  |
  v
Claude Agent SDK query():
  model:            from config (e.g., claude-sonnet-4-20250514)
  cwd:              workspace/
  permissionMode:   bypassPermissions
  maxTurns:         50
  plugins:          auto-discovered from workspace/skills/
  mcpServers:       loaded from workspace/MCP.json
  env:              CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_BUBBLEWRAP=1
```

### Step 4: Streaming response back to client

```plain
for await (const msg of claudeQuery):
  |
  +-- msg.type === 'assistant'
  |     +-- block.type === 'text'     -> broadcastBloby('bot:token', { token })
  |     +-- block.type === 'tool_use' -> broadcastBloby('bot:tool', { name, input })
  |
  +-- msg.type === 'tool_progress'    -> broadcastBloby('bot:tool', { status: 'running' })
  |
  +-- msg.type === 'result'           -> broadcastBloby('bot:response', { content })
  |
  v
finally:
  Check if Write or Edit tools were used
  onMessage('bot:done', { usedFileTools: true/false })
  |
  v
Supervisor receives bot:done callback:
  +-- If usedFileTools OR pendingBackendRestart:
  |     resetBackendRestarts()
  |     stopBackend()
  |     spawnBackend(backendPort)
  |
  +-- If pendingUpdate:
  |     runDeferredUpdate()   (detached process: node cli.js update)
  |
  +-- Save assistant response to DB:
       POST /api/conversations/{id}/messages
```

### Step 5: Multi-device sync

All connected WebSocket clients receive every event via `broadcastBloby()`. When a user sends a message, `broadcastBlobyExcept(sender, ...)` sends a `chat:sync` event to all OTHER connected clients with the user message. The assistant response streams to ALL clients (including the sender).

Reconnecting clients receive a `chat:state` event containing the current stream buffer so they can catch up on any tokens they missed during disconnection (line 373-381).

---
