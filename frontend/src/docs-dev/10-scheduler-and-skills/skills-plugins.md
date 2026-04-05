---
title: "Skills & Plugins"
---

## Part 2: Skills / Plugins

### 2.1 Skills Architecture

Bloby uses a directory-based plugin system rooted at `workspace/skills/`. Each subdirectory is a self-contained skill (plugin) that extends the agent's knowledge and capabilities. Skills are **not** code that executes independently -- they are prompt-injection plugins that provide the Claude Agent SDK with additional instructions, context, and behavior patterns.

Skills are auto-discovered at query time. In `supervisor/bloby-agent.ts`, every directory under `workspace/skills/` that contains a `.claude-plugin/plugin.json` file is registered as a local plugin:

```typescript
const skillsDir = path.join(PKG_DIR, 'workspace', 'skills');
const plugins: { type: 'local'; path: string }[] = [];
try {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (
            entry.isDirectory() &&
            fs.existsSync(
                path.join(
                    skillsDir,
                    entry.name,
                    '.claude-plugin',
                    'plugin.json',
                ),
            )
        ) {
            plugins.push({
                type: 'local' as const,
                path: path.join(skillsDir, entry.name),
            });
        }
    }
} catch {}
```

These plugins are then passed to the Claude Agent SDK `query()` call:

```typescript
const claudeQuery = query({
    prompt: sdkPrompt,
    options: {
        // ...
        plugins: plugins.length ? plugins : undefined,
    },
});
```

This means skills are loaded fresh on every agent query. Adding or removing a skill directory takes effect on the next message or scheduled trigger -- no restart required.

### 2.2 Skill Directory Structure

Each skill follows a fixed directory layout:

```plain
workspace/skills/{skill-name}/
  .claude-plugin/
    plugin.json          Plugin manifest (name, version, description)
  skills/
    {skill-name}/
      SKILL.md           Skill instructions in Markdown with YAML front matter
```

#### plugin.json

The plugin manifest. Minimal required fields:

```json
{
    "name": "skill-name",
    "version": "1.0.0",
    "description": "One-line description of what this skill does."
}
```

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

The `description` in the YAML front matter is critical -- it tells the Claude Agent SDK when this skill is relevant to the current conversation. The agent uses it for skill selection.

### 2.3 Built-in Skills

Bloby ships with three built-in skills.

#### 2.3.1 code-reviewer

**Directory**: `workspace/skills/code-reviewer/`

**Purpose**: Reviews code changes and provides improvement suggestions across the Bloby full-stack (React + Tailwind frontend, Express + SQLite backend).

**Plugin manifest** (`plugin.json`):

```json
{
    "name": "code-reviewer",
    "version": "1.0.0",
    "description": "Reviews code changes and provides improvement suggestions."
}
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

**Plugin manifest** (`plugin.json`):

```json
{
    "name": "daily-standup",
    "version": "1.0.0",
    "description": "Generates daily standup summaries from recent workspace activity."
}
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

**Purpose**: Helps manage and understand the Bloby workspace structure -- project layout, file organization, code navigation, and scaffolding.

**Plugin manifest** (`plugin.json`):

```json
{
    "name": "workspace-helper",
    "version": "1.0.0",
    "description": "Helps manage and understand the Bloby workspace structure."
}
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

Follow these steps to add a custom skill to Bloby:

#### Step 1: Create the directory structure

```plain
workspace/skills/{your-skill-name}/
  .claude-plugin/
    plugin.json
  skills/
    {your-skill-name}/
      SKILL.md
```

The outer directory name and the inner `skills/{name}/` directory name should match.

#### Step 2: Write `plugin.json`

Create `.claude-plugin/plugin.json`:

```json
{
    "name": "your-skill-name",
    "version": "1.0.0",
    "description": "One-line description of what this skill does."
}
```

#### Step 3: Write `SKILL.md`

Create `skills/{your-skill-name}/SKILL.md` with YAML front matter and Markdown body:

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

#### Step 4: Verify

Send a message to Bloby that matches your skill's activation criteria. The skill is auto-discovered on each query -- no restart needed. Check the supervisor logs for plugin loading:

```plain
Loaded MCP server(s): [...]  // if MCP is configured
```

The Claude Agent SDK log output will show the plugins being loaded.

#### Tips for Effective Skills

- **Be specific in the description**: The `description` field in YAML front matter is the agent's primary signal for skill selection. Vague descriptions lead to the skill being ignored or over-applied.
- **Structure output formats**: Give the agent a template to follow. This produces consistent, predictable output.
- **Include rules**: Constraints like "keep it concise" or "never modify files outside workspace/" prevent the agent from going off-track.
- **Pair with crons**: Skills become powerful when combined with scheduled triggers. A `code-reviewer` skill + a daily cron = automated code review reports.

### 2.5 MCP Configuration (MCP.json)

File path: `workspace/MCP.json` (optional -- does not exist by default)

Bloby supports the **Model Context Protocol (MCP)** for connecting external tool servers to the agent. MCP servers give the agent access to external APIs, databases, services, or any custom tooling exposed through the MCP standard.

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
