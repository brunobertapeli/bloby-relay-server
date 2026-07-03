---
title: "Agent Tools"
---

## 4. Agent Tools

### 4.1 Built-in Claude Agent SDK Tools

When the agent runs through the Claude Agent SDK path (provider `anthropic`, the default -- see `supervisor/harnesses/claude.ts`), it has access to the full Claude Code tool set. These are the tools provided by the SDK itself (not explicitly defined in Morphy's codebase). The agent can:

- **Read** -- Read file contents from disk
- **Write** -- Write/create files
- **Edit** -- Make targeted edits to existing files
- **Bash** -- Execute arbitrary shell commands
- **Glob** -- Find files by pattern
- **Grep** -- Search file contents

The system prompt (`worker/prompts/bloby-system-prompt.txt`, assembled by `worker/prompts/prompt-assembler.ts`) instructs the agent on how to use these tools in context:

> "Always read code before changing it. Understand what exists."
> "Run independent tool calls in parallel. Don't serialize what can run concurrently."

### 4.2 File Tool Tracking

The agent system tracks which tools were used during each turn. In the Claude harness (`supervisor/harnesses/claude.ts`), a `usedTools` set accumulates tool names inside the streaming loop:

```ts
const usedTools = new Set<string>();
// ... later, inside the streaming loop:
} else if (block.type === 'tool_use') {
  usedTools.add(block.name);
  onMessage('bot:tool', { conversationId, name: block.name, input: block.input });
}
```

At each turn boundary, the system checks whether file-modifying tools were used:

```ts
const FILE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const usedFileTools = FILE_TOOLS.some((t) => usedTools.has(t));
```

Live conversations emit this flag on `bot:turn-complete` (then clear `usedTools` for the next turn); one-shot queries emit it on `bot:done` at cleanup. The flag drives the auto-restart behavior: if the agent wrote or edited files, the supervisor restarts the user's backend after the turn ends (the `bot:turn-complete` handler in `supervisor/index.ts`; the scheduler does the same on `bot:done` for pulse/cron turns).

### 4.3 Skills

Skills live in `workspace/skills/<name>/`, each defined by a `SKILL.md` whose YAML frontmatter carries two mandatory keys: `name` (must equal the folder name) and `description` (the routing/trigger text).

In the Claude harness (`supervisor/harnesses/claude.ts`), the shared helper `mirrorSkillsInto()` from `supervisor/harnesses/skills.ts` mirrors each `workspace/skills/<name>` folder into `workspace/.claude/skills/<name>` as a symlink -- the Agent SDK's project-skill discovery root -- and prunes stale links for uninstalled skills. The resulting skill names are passed to the SDK via the `skills` option as an explicit allowlist.

The SDK lists each skill's name and description in the agent's context and lazy-loads the full `SKILL.md` body through its native Skill tool only when the skill is actually used (progressive disclosure). Customer-facing one-shot runs (`supportPrompt`) pass `skills: []` so customers never see skills.

### 4.4 MCP Servers (External Tools)

MCP (Model Context Protocol) servers extend the agent's tool set with external capabilities. Configuration is read from `workspace/MCP.json` by the Claude harness's `loadMcpServers()` helper:

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
