---
title: "Agent Tools"
---

## 4. Agent Tools

### 4.1 Built-in Claude Agent SDK Tools

When the agent runs through the Claude Agent SDK path, it has access to the full Claude Code tool set. These are the tools provided by the SDK itself (not explicitly defined in Bloby's codebase). The agent can:

- **Read** -- Read file contents from disk
- **Write** -- Write/create files
- **Edit** -- Make targeted edits to existing files
- **Bash** -- Execute arbitrary shell commands
- **Glob** -- Find files by pattern
- **Grep** -- Search file contents

The system prompt instructs the agent on how to use these tools in context (lines 206-229 of `bloby-system-prompt.txt`):

> "Always read code before changing it. Understand what exists."
> "Run independent tool calls in parallel. Don't serialize what can run concurrently."

### 4.2 File Tool Tracking

The agent system tracks which tools were used during a query. In `startBlobyAgentQuery()`, a `usedTools` set accumulates tool names (lines 148, 232-234):

```ts
const usedTools = new Set<string>();
// ... later, inside the streaming loop:
} else if (block.type === 'tool_use') {
  usedTools.add(block.name);
  onMessage('bot:tool', { conversationId, name: block.name, input: block.input });
}
```

At cleanup (lines 274-276), the system checks whether file-modifying tools were used:

```ts
const FILE_TOOLS = ['Write', 'Edit'];
const usedFileTools = FILE_TOOLS.some((t) => usedTools.has(t));
onMessage('bot:done', { conversationId, usedFileTools });
```

This flag drives the auto-restart behavior: if the agent wrote or edited files, the supervisor restarts the backend after the turn ends (line 544-549 of `supervisor/index.ts`).

### 4.3 Skill Plugins

The agent auto-discovers local skill plugins in `workspace/skills/` (lines 162-171 of `supervisor/bloby-agent.ts`):

```ts
const skillsDir = path.join(PKG_DIR, 'workspace', 'skills');
const plugins: { type: 'local'; path: string }[] = [];
for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (entry.isDirectory() && fs.existsSync(
    path.join(skillsDir, entry.name, '.claude-plugin', 'plugin.json')
  )) {
    plugins.push({ type: 'local' as const, path: path.join(skillsDir, entry.name) });
  }
}
```

Any directory under `workspace/skills/` that contains a `.claude-plugin/plugin.json` file is loaded as a local plugin and passed to the SDK.

### 4.4 MCP Servers (External Tools)

MCP (Model Context Protocol) servers extend the agent's tool set with external capabilities. Configuration is read from `workspace/MCP.json` (lines 173-190):

```ts
const mcpConfigPath = path.join(WORKSPACE_DIR, 'MCP.json');
const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
```

The config supports two formats:

- **Object format** (preferred): `{ "server-name": { command, args, env } }`
- **Legacy array format**: `[{ "server-name": { command, args, env } }]` -- entries are merged via `Object.assign()`.

When MCP servers are configured, their tools appear alongside the agent's built-in tools. Common examples from the system prompt:

- **Playwright** for browser automation
- **Fetch** for HTTP requests

---
