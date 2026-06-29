---
title: "Skills & Plugins"
---

## Part 2: Skills / Plugins

### 2.1 Skills Architecture

Morphy uses a directory-based skill system rooted at `workspace/skills/`. Each subdirectory is a self-contained skill that extends the agent's knowledge and capabilities. Skills are **not** code that executes independently -- they are Markdown instructions that give the agent additional context and behavior patterns.

A skill is defined by a single required file: `workspace/skills/{skill-name}/SKILL.md`, whose YAML front matter carries two mandatory keys -- `name` (must equal the folder name) and `description` (the routing/trigger text that tells the agent when the skill applies).

The shared plumbing lives in `supervisor/harnesses/skills.ts`:

- `mirrorSkillsInto()` -- mirrors `workspace/skills/{name}` into a harness-specific root as symlinks (idempotent) and prunes stale links for uninstalled skills.
- `parseSkillFrontmatter()` -- extracts `name` and `description` from a SKILL.md front matter block.
- `buildSkillsIndex()` -- builds a compact name+description index for system-prompt injection.

Each harness consumes the same on-disk layout its own way:

| Harness    | File                              | Mechanism                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Claude** | `supervisor/harnesses/claude.ts`  | Mirrors skills into `workspace/.claude/skills/` (the Agent SDK's project-skill discovery root) and passes the explicit skill-name list via the SDK's `skills` option. The SDK lists each skill's name+description in context and lazy-loads the SKILL.md body through its native Skill tool. Customer-facing one-shot runs (`supportPrompt`) pass `skills: []` so customers never see skills. |
| **Codex**  | `supervisor/harnesses/codex.ts`   | Mirrors skills into `workspace/.codex/skills/` (codex's repo-scope root) and primes each thread via the `skills/list` JSON-RPC call; codex's native router handles routing.                                                                                                                                                      |
| **Pi**     | `supervisor/harnesses/pi/index.ts` | No native skill machinery -- `buildSkillsIndex()` appends a compact name+description index block (`# Installed Skills`) to the system prompt, and the agent reads `skills/{name}/SKILL.md` on demand.                                                                                                                            |

The design principle in all three is **progressive disclosure**: each skill's name and description are always in context, but the full SKILL.md body is loaded only when the skill is actually used.

Adding or removing a skill directory takes effect on the next session -- no restart required.

### 2.2 Skill Directory Structure

Each skill is a flat folder named after the skill:

```plain
workspace/skills/{skill-name}/
  SKILL.md             Skill definition -- YAML front matter + Markdown instructions (required)
  skill.json           Morphy marketplace metadata (optional)
  SCRIPT.md            Customer-facing persona for channel business/assistant modes (optional)
  references/          Supporting documents (optional)
  scripts/             Helper scripts (optional)
  assets/              Static assets (optional)
```

#### skill.json

Optional Morphy marketplace metadata. When present, its `description` must stay in sync with the SKILL.md front matter.

#### SKILL.md

The skill definition file. Uses YAML front matter for metadata followed by Markdown instructions:

```markdown
---
name: skill-name
description: When to activate this skill and what it does. This description
    helps the agent decide whether to apply this skill to the current query.
---

# Skill Title

## Overview

What this skill is and what it helps with.

## When to Activate

Trigger conditions -- what user messages should invoke this skill.

## Instructions

Detailed behavior, checklists, output formats, rules.
```

Both front matter keys are mandatory: `name` must equal the skill's folder name, and `description` is critical -- it is the routing text that tells the agent when this skill is relevant to the current conversation. All three harnesses keep it in context for skill selection.

### 2.3 Built-in Skills

Morphy ships with three built-in skills.

#### 2.3.1 code-reviewer

**Directory**: `workspace/skills/code-reviewer/`

**Purpose**: Reviews code changes and provides improvement suggestions across the Morphy full-stack (React + Tailwind frontend, Express + SQLite backend).

**Front matter** (`SKILL.md`):

```yaml
name: code-reviewer
description: Reviews code changes and provides improvement suggestions.
```

**Activation triggers**: User asks to "review", "check", or "audit" code; requests feedback on changes; asks about code quality or best practices.

**What it does**:

The skill provides the agent with a structured review checklist covering:

- **Frontend (React + Tailwind)**: Component structure, performance (unnecessary re-renders, missing memoization), accessibility (semantic HTML, ARIA, keyboard nav), styling consistency, error handling (boundaries, loading states, fallbacks).
- **Backend (Express + SQLite)**: Route structure (HTTP methods, status codes), input validation and sanitization, database safety (parameterized queries), security (no exposed secrets, auth checks), performance (N+1 queries, indexes).

**Output format**: The agent structures its response into three sections:

- **Issues** -- Bugs or potential problems with severity ratings.
- **Suggestions** -- Improvements with rationale.
- **Praise** -- Things done well to reinforce good patterns.

#### 2.3.2 daily-standup

**Directory**: `workspace/skills/daily-standup/`

**Purpose**: Generates daily standup summaries by analyzing recent file changes, git history, and workspace activity.

**Front matter** (`SKILL.md`):

```yaml
name: daily-standup
description: Generates daily standup summaries from recent workspace activity.
```

**Activation triggers**: User asks for a "standup", "daily update", or "progress report"; asks "what changed recently?" or "what did I work on?"; wants a summary of recent activity.

**What it does**:

The skill instructs the agent to:

1. Check `git log` for recent commits (last 24 hours or since last standup).
2. Check modified files using `git status` and `git diff`.
3. Identify patterns: new features, bug fixes, refactors, documentation.

**Output format** -- a structured standup report:

```plain
### Daily Standup -- {date}

**Completed:**
- List of completed work items based on commits and changes

**In Progress:**
- Uncommitted changes or partially completed work

**Blockers:**
- Any issues identified from error logs or failing tests

**Next Steps:**
- Suggested priorities based on the current state of the project
```

**Rules**: Keep it concise (2-3 bullet points per section), skip trivial changes, use plain language, link to specific files when helpful.

This skill pairs naturally with the cron system. A cron like `{ "id": "morning-standup", "schedule": "0 9 * * 1-5", ... }` can trigger a daily standup automatically every weekday at 9 AM.

#### 2.3.3 workspace-helper

**Directory**: `workspace/skills/workspace-helper/`

**Purpose**: Helps manage and understand the Morphy workspace structure -- project layout, file organization, code navigation, and scaffolding.

**Front matter** (`SKILL.md`):

```yaml
name: workspace-helper
description: Helps manage and understand the Morphy workspace structure.
```

**Activation triggers**: User asks about the project layout, file organization, where things are, how the workspace is structured; needs help navigating the codebase; asks to scaffold new components, pages, or API routes.

**What it does**:

The skill provides the agent with a complete map of the workspace:

```plain
workspace/
  client/                 React + Vite + Tailwind frontend
    index.html            HTML shell, PWA manifest
    src/
      main.tsx            React DOM entry
      App.tsx             Root component with error boundary
      components/         UI components
  backend/
    index.ts              Express server (port 3004, accessed at /app/api/*)
  .env                    Environment variables for the backend
  app.db                  SQLite database for workspace data
  files/                  Uploaded file storage (audio, images, documents)
```

It encodes key architectural rules:

- Frontend is served by Vite with HMR -- changes picked up instantly.
- Backend runs on port 3004, proxied through `/app/api/*` -- the prefix is stripped, so routes are defined as `/health` not `/app/api/health`.
- Backend auto-restarts on file changes.
- Only files inside `workspace/` may be modified. Never touch `supervisor/`, `worker/`, `shared/`, or `bin/`.

It also provides scaffolding instructions for adding new pages (component + route in App.tsx + Tailwind) and new API routes (route in backend/index.ts + frontend calls at `/app/api/{route}`).

### 2.4 How to Create a New Skill

Follow these steps to add a custom skill to Morphy:

#### Step 1: Create the directory structure

```plain
workspace/skills/{your-skill-name}/
  SKILL.md
```

That single file is all a skill needs. Optional extras (`skill.json`, `SCRIPT.md`, `references/`, `scripts/`, `assets/`) can be added later.

#### Step 2: Write `SKILL.md`

Create `workspace/skills/{your-skill-name}/SKILL.md` with YAML front matter and Markdown body. The `name` must equal the folder name:

```markdown
---
name: your-skill-name
description: Detailed description of when to use this skill and what it does.
    The agent reads this description to decide when to activate the skill,
    so be specific about trigger conditions.
---

# Your Skill Name

## Overview

What this skill is and what problem it solves.

## When to Activate

- List the user messages or situations that should trigger this skill
- Be specific -- this helps the agent match queries to skills

## Instructions

Detailed instructions for the agent. Include:

- Step-by-step procedures
- Checklists
- Output format templates
- Rules and constraints

## Examples (optional)

Show the agent what good output looks like.
```

#### Step 3: Verify

Send a message to Morphy that matches your skill's activation criteria. Skills are picked up automatically on the next session -- no restart needed. All three harnesses see the same folder: Claude and Codex via their `workspace/.claude/skills` / `workspace/.codex/skills` symlink mirrors, Pi via the `# Installed Skills` index in its system prompt.

#### Tips for Effective Skills

- **Be specific in the description**: The `description` field in YAML front matter is the agent's primary signal for skill selection. Vague descriptions lead to the skill being ignored or over-applied.
- **Structure output formats**: Give the agent a template to follow. This produces consistent, predictable output.
- **Include rules**: Constraints like "keep it concise" or "never modify files outside workspace/" prevent the agent from going off-track.
- **Pair with crons**: Skills become powerful when combined with scheduled triggers. A `code-reviewer` skill + a daily cron = automated code review reports.

### 2.5 MCP Configuration (MCP.json)

File path: `workspace/MCP.json` (optional -- does not exist by default)

Morphy supports the **Model Context Protocol (MCP)** for connecting external tool servers to the agent. MCP servers give the agent access to external APIs, databases, services, or any custom tooling exposed through the MCP standard.

#### Configuration Format

The file is a JSON object where each key is a server name and each value describes how to launch that server:

```json
{
    "server-name": {
        "command": "npx",
        "args": ["-y", "@some-org/mcp-server"],
        "env": {
            "API_KEY": "your-api-key"
        }
    },
    "another-server": {
        "command": "python",
        "args": ["-m", "my_mcp_server"],
        "env": {}
    }
}
```

| Field     | Type     | Description                                                         |
| --------- | -------- | ------------------------------------------------------------------- |
| `command` | string   | The executable to run (e.g. `npx`, `node`, `python`, a binary path) |
| `args`    | string[] | Command-line arguments passed to the command                        |
| `env`     | object   | Environment variables set for the server process                    |

#### Legacy Array Format

A legacy array format is also supported for backward compatibility:

```json
[
  { "server-name": { "command": "...", "args": [...], "env": {...} } }
]
```

Array entries are merged into a single object via `Object.assign({}, ...mcpConfig)`.

#### How MCP Servers Are Loaded

In `supervisor/bloby-agent.ts`, MCP configuration is read from disk on every agent query:

```typescript
let mcpServers: Record<string, any> | undefined;
try {
    const mcpConfigPath = path.join(WORKSPACE_DIR, 'MCP.json');
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    if (
        mcpConfig &&
        typeof mcpConfig === 'object' &&
        !Array.isArray(mcpConfig) &&
        Object.keys(mcpConfig).length
    ) {
        mcpServers = mcpConfig;
    } else if (Array.isArray(mcpConfig) && mcpConfig.length) {
        mcpServers = Object.assign({}, ...mcpConfig);
    }
} catch {}
```

The loaded servers are passed to the Claude Agent SDK:

```typescript
const claudeQuery = query({
    prompt: sdkPrompt,
    options: {
        // ...
        mcpServers,
    },
});
```

If `MCP.json` does not exist or is empty, no MCP servers are loaded and the agent runs with its default tool set (file read/write/edit, bash, etc.).

#### Use Cases for MCP

- **GitHub integration**: Connect a GitHub MCP server so the agent can create issues, open PRs, and read repository data.
- **Database access**: Expose a Postgres or MySQL server through MCP so the agent can run SQL queries.
- **External APIs**: Wrap any REST API in an MCP server to give the agent access to third-party services.
- **Custom tools**: Build domain-specific tools (deployment, monitoring, CI/CD) and expose them through MCP.

Like skills, MCP configuration is re-read on every query, so changes to `MCP.json` take effect on the next agent interaction without a restart.

---
