---
title: "System Prompt"
---

## 2. System Prompt Construction

The system prompt is built in two stages: a base prompt assembled per harness (with placeholder replacement and dynamic fragments), then enrichment with memory files, channel config, and conversation history.

### 2.1 Base Prompt

There is one base prompt file per harness, all under `worker/prompts/`:

| Harness | `ai.provider` | Base prompt file |
|---|---|---|
| Claude (Agent SDK) | `anthropic` | `bloby-system-prompt.txt` |
| Codex (app-server) | `openai` | `bloby-system-prompt-codex.txt` |
| Pi | `pi` | `bloby-system-prompt-pi.txt` |

Assembly happens in `assembleSystemPrompt()` in `worker/prompts/prompt-assembler.ts`, imported by every harness (`supervisor/harnesses/claude.ts`, `codex.ts`, `pi/index.ts`). It does three things:

1. **Reads the base prompt** for the active harness. If a harness-specific file is missing or empty it falls back to `bloby-system-prompt.txt`; if nothing is readable, a minimal one-line fallback is used.

2. **Replaces placeholders.** `$BOT` and `$HUMAN` become the user-configured agent and user names:

```ts
return raw.replace(/\$BOT/g, botName).replace(/\$HUMAN/g, humanName);
```

The names come from the in-process worker API (`/api/onboard/status`), fetched by the supervisor before each query.

3. **Applies dynamic fragments.** Swappable sections of the base prompt are wrapped in `<!-- dynamic:target --> ... <!-- /dynamic:target -->` markers. `prompt-fragments.json` defines the fragments (`replace`, `remove`, or `append`, ordered by `priority`), and `prompt-conditions.ts` maps each fragment id to an async condition function evaluated at query time. Condition results can supply variables that are interpolated into fragment content via `{{variable}}` placeholders; for `replace`/`remove` the first matching fragment per target wins, and leftover marker comments are stripped from the final prompt. Example: the `workspace-security` marker is swapped depending on whether the official Workspace Lock blueprint, a custom lock, or no lock is installed. The full playbook is `DYNAMIC-PROMPTS.md`.

The three base files start as identical copies and are tuned independently per model. The fragment machinery is shared: a marker must exist in each base file a fragment should affect.

### 2.2 Prompt Structure

The Claude base prompt (`bloby-system-prompt.txt`) is organized into these major sections:

1. **Identity** -- Establishes who the agent is, that it has full machine access, and communicates through a chat bubble. It is explicitly told it is not a CLI tool but an agent with a home.

2. **Context** -- Tells the agent its memory files are already injected into the system prompt and should not be re-read with tools. It should still WRITE to memory files to persist information.

3. **Memory System** -- Rules for the memory file hierarchy: daily notes (`memory/YYYY-MM-DD.md`), `MEMORY.md`, `MYSELF.md`, `MYHUMAN.md`. Includes the golden rule: "Before ending any interaction, write down anything worth remembering."

4. **PULSE and CRON** -- Instructions for handling `<PULSE/>` and `<CRON>id</CRON>` trigger messages from the scheduler. Covers config file editing, quiet hours, importance rating, and the `<Message>` output tag. Includes **Self-Update** (version check plus the supervisor's update control endpoint, which queues the update until the turn ends) and **Task Files** (`tasks/{cron-id}.md` files that extend cron task definitions with detailed instructions).

5. **How You Work** -- The agent owns the work (sub-agents report to it, not the human), background-work etiquette, skills, channel surface tags and channel discipline, proactive sends, the marketplace and payments, dashboard linking.

6. **Coding Excellence** -- Action orientation, read-before-modify, simplicity rules, the stop-looping hard rule, parallel operations, security awareness.

7. **Workspace Architecture** -- Frontend (React + Vite + Tailwind), Backend (Express), Database (SQLite), routing rules (the `/app/api` prefix stripping), build rules (never run builds manually), package installation, backend lifecycle (auto-restart), MCP servers (`MCP.json`), sacred directories the agent must never modify (`supervisor/`, `worker/`, `shared/`, `bin/`), workspace security (a dynamic section, see 2.1), and the modular mini-app philosophy.

8. **Personality and Conduct** -- Communication style, internal vs. external action rules, error handling philosophy.

9. **Relationship Awareness** -- Reading the room, the first-encounter message, evolving the relationship naturally.

10. **Idle Behavior** -- What to do when nothing is asked of it.

11. **Self-Evolution** -- The agent is told its memory files, identity, and operating manual are all its own to evolve.

### 2.3 Memory Injection

After `assembleSystemPrompt()` returns, each harness appends the memory file contents. The code lives in each harness (shown here from `supervisor/harnesses/claude.ts`; `codex.ts` and `pi/index.ts` append the identical block):

```
---
# Your Memory Files

## MYSELF.md
...
## MYHUMAN.md
...
## MEMORY.md
...

---
# Your Config Files

## PULSE.json
...
## CRONS.json
...
```

The `readMemoryFiles()` helper reads all five files from the workspace directory:

```ts
function readMemoryFiles() {
  return {
    myself: readMemoryFile('MYSELF.md'),
    myhuman: readMemoryFile('MYHUMAN.md'),
    memory: readMemoryFile('MEMORY.md'),
    pulse: readMemoryFile('PULSE.json'),
    crons: readMemoryFile('CRONS.json'),
  };
}
```

Each file is read synchronously from `WORKSPACE_DIR`. If a file is missing or empty, `'(empty)'` is returned. If any channels are configured (`channels` in the config), a `# Channel Config` section with the channels JSON is appended as well. One exception: one-shot queries that carry a `supportPrompt` (the customer-facing support persona) use that prompt as-is, skipping the assembled base and the memory/channel blocks.

### 2.4 Conversation History Injection

If recent messages exist, they are appended as a final section:

```ts
if (recentMessages?.length) {
  systemPrompt += `\n\n---\n# Recent Conversation\n${formatConversationHistory(recentMessages)}`;
}
```

The `formatConversationHistory()` helper produces a simple `role: content` format:

```ts
function formatConversationHistory(messages: RecentMessage[]): string {
  if (!messages.length) return '';
  return messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}
```

The supervisor fetches messages from the in-process worker API at `/api/conversations/{id}/messages/recent?limit=30`, filters them to `user`/`assistant` roles, and drops the newest entry: the current user message is excluded from the history because it is sent as the harness prompt itself, not injected into the system prompt.

### 2.5 Context Enrichment

Unlike some agent frameworks, Morphy does not explicitly inject the current timestamp or tool availability list into the system prompt. The agent discovers the current time by running shell commands (e.g., `date`), and tool availability is determined by the active harness's built-in tool set plus any configured MCP servers and installed skills.

The working directory context is provided implicitly. Every harness runs the agent with the workspace as its working directory; in the Claude harness this is the `cwd` option of the SDK query:

```ts
cwd: WORKSPACE_DIR,
```

`WORKSPACE_DIR` (defined in `shared/paths.ts`) defaults to the `workspace/` directory under the package install, overridable with the `MORPHY_WORKSPACE` environment variable. The agent's file operations and shell commands execute relative to it.

---
