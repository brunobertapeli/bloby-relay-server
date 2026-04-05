---
title: "System Prompt"
---

## 2. System Prompt Construction

The system prompt is built in two stages: a base prompt with placeholder replacement, then enrichment with memory files and conversation history.

### 2.1 Base Prompt

The base prompt lives at `worker/prompts/bloby-system-prompt.txt` (381 lines). It is read by `readSystemPrompt()` in `supervisor/bloby-agent.ts` (line 98):

```ts
function readSystemPrompt(botName = 'Bloby', humanName = 'Human'): string {
  const raw = fs.readFileSync(PROMPT_FILE, 'utf-8').trim();
  return raw.replace(/\$BOT/g, botName).replace(/\$HUMAN/g, humanName);
}
```

The `$BOT` and `$HUMAN` placeholders are replaced with the user-configured agent and user names, fetched from the worker API's `/api/onboard/status` endpoint (lines 507-512 of `supervisor/index.ts`).

The prompt path is resolved relative to `import.meta.dirname` (line 14):

```ts
const PROMPT_FILE = path.join(import.meta.dirname, '..', 'worker', 'prompts', 'bloby-system-prompt.txt');
```

If the file is missing or empty, a minimal fallback is used (lines 103-108).

### 2.2 Prompt Structure

The system prompt (`bloby-system-prompt.txt`) is organized into these major sections:

1. **Identity** -- Establishes who the agent is, that it has full machine access, and communicates through a chat bubble. It is explicitly told it is not a CLI tool but an agent with a home.

2. **Context** -- Tells the agent its memory files are already injected into the system prompt and should not be re-read with tools. It should still WRITE to memory files to persist information.

3. **Memory System** -- Detailed rules for the memory file hierarchy (see Section 5 below). Includes the golden rule: "Before ending any interaction, write down anything worth remembering."

4. **PULSE and CRON** -- Instructions for handling `<PULSE/>` and `<CRON>id</CRON>` trigger messages from the scheduler. Covers config file editing, quiet hours, importance rating, and the `<Message>` output tag.

5. **Self-Update** -- How the agent checks for and triggers its own updates via `touch ~/.bloby/workspace/.update`.

6. **Task Files** -- How `tasks/{cron-id}.md` files extend cron task definitions with detailed instructions.

7. **Coding Excellence** -- Action orientation, read-before-modify, simplicity rules, parallel operations, security awareness.

8. **Workspace Architecture** -- Frontend (React + Vite + Tailwind), Backend (Express), Database (SQLite), routing rules (the `/app/api` prefix stripping), build rules (never run builds manually), backend lifecycle (auto-restart).

9. **MCP Servers** -- How `MCP.json` configures external tool servers (Playwright, Fetch, etc.).

10. **Sacred Files** -- Directories the agent must never modify (`supervisor/`, `worker/`, `shared/`, `bin/`).

11. **Personality and Conduct** -- Communication style, internal vs. external action rules, error handling philosophy.

12. **Self-Evolution** -- The agent is told its memory files, identity, and operating manual are all its own to evolve.

### 2.3 Memory Injection

After the base prompt is read and placeholders are replaced, `startBlobyAgentQuery()` appends memory file contents (line 139):

```ts
enrichedPrompt += `\n\n---\n# Your Memory Files\n\n## MYSELF.md\n${memoryFiles.myself}` +
  `\n\n## MYHUMAN.md\n${memoryFiles.myhuman}\n\n## MEMORY.md\n${memoryFiles.memory}` +
  `\n\n---\n# Your Config Files\n\n## PULSE.json\n${memoryFiles.pulse}` +
  `\n\n## CRONS.json\n${memoryFiles.crons}`;
```

The `readMemoryFiles()` function (line 45) reads all five files from `WORKSPACE_DIR`:

```ts
function readMemoryFiles() {
  return {
    myself:  readMemoryFile('MYSELF.md'),
    myhuman: readMemoryFile('MYHUMAN.md'),
    memory:  readMemoryFile('MEMORY.md'),
    pulse:   readMemoryFile('PULSE.json'),
    crons:   readMemoryFile('CRONS.json'),
  };
}
```

Each file is read synchronously. If a file is missing or empty, `'(empty)'` is returned (lines 35-42).

### 2.4 Conversation History Injection

If recent messages exist, they are appended as a final section (lines 141-143):

```ts
if (recentMessages?.length) {
  enrichedPrompt += `\n\n---\n# Recent Conversation\n${formatConversationHistory(recentMessages)}`;
}
```

The `formatConversationHistory()` function (line 56) produces a simple `role: content` format:

```ts
function formatConversationHistory(messages: RecentMessage[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}
```

Messages are fetched from the database via the worker API at `/api/conversations/{id}/messages/recent?limit=20` (line 509 of `supervisor/index.ts`). The current user message is excluded from the history (it is sent as the SDK prompt, not injected into the system prompt -- lines 515-524).

### 2.5 Context Enrichment

Unlike some agent frameworks, Bloby does not explicitly inject the current timestamp or tool availability list into the system prompt. The agent discovers the current time by running shell commands (e.g., `date`), and tool availability is determined by the Claude Agent SDK's built-in tool set plus any configured MCP servers and skill plugins.

The working directory context is provided implicitly via the `cwd` option in the SDK query (line 196):

```ts
cwd: path.join(PKG_DIR, 'workspace'),
```

This means the agent's file operations and shell commands execute relative to the `workspace/` directory.

---
