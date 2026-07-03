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

Morphy ships with six built-in skills: four channel skills (they teach the agent how to behave on an external surface), one device integration, and one meta-skill for authoring more skills.

#### 2.3.1 whatsapp

**Directory**: `workspace/skills/whatsapp/`

Gives the agent a WhatsApp number, built on Baileys (no Meta Business API needed). Covers QR-code pairing, messaging, voice-note transcription, and the personal (channel) and business modes. The agent's plain text response IS the WhatsApp reply -- the supervisor delivers it, no API calls needed.

#### 2.3.2 telegram

**Directory**: `workspace/skills/telegram/`

Gives the agent its own Telegram bot. The user creates a free bot via Telegram's @BotFather and pastes the token into a connect page; the agent then holds the token locally and long-polls Telegram directly, with no relay or middle server in the message path. Covers messaging, voice notes, photos, and channel/business/assistant modes. In business mode, Telegram user ids in the `admins` array get the full system prompt while everyone else gets the customer persona from the active skill's SCRIPT.md.

#### 2.3.3 alexa

**Directory**: `workspace/skills/alexa/`

A voice channel through the public **Morphy** skill in the Alexa store. Users enable the skill once in the Alexa app, pair their Alexa to a specific Morphy with a 6-digit code, then say "Alexa, ask Morphy ...". Because Alexa is strictly request/response with a hard latency budget, the skill teaches a voice-first response style and a three-pattern decision tree: fast direct answer, chat-deferred (finish the work later and surface it in chat), or Home-Assistant-announce-deferred.

#### 2.3.4 mac

**Directory**: `workspace/skills/mac/`

Drives the Morphy native macOS companion app (menu bar + MacBook notch). Activates on the `[Mac]` message tag, and when the user asks to get or install the Mac app (the DMG download links and setup walkthrough live in this skill). Each turn the agent replies with a concise spoken line (TTS) and can optionally drive the Mac's action registry via a `<mac_actions>` JSON array: render a notch card, point the mascot at something on screen, or spotlight a control. Custom hand-written HTML cards use `<notch_html>`; proactive pushes (PULSE/cron) wrap the same registry in `<mac_push>`. Card presets and reusable snippets ship in the skill's `presets/` and `frequentSnippets/` folders.

#### 2.3.5 plaud

**Directory**: `workspace/skills/plaud/`

Plaud Note voice-recorder integration. Pairs the user's Plaud account (email OTP, or paste-token for Google/Apple identities), pulls recordings off Plaud's cloud into `workspace/files/audio/plaud/`, and routes transcription through either the Morphy Marketplace audio-to-text service (pay-per-minute) or the user's own provider (Groq, OpenAI Whisper, Mistral Voxtral, or local).

#### 2.3.6 create-skill

**Directory**: `workspace/skills/create-skill/`

A meta-skill that teaches the agent how to author new skills (and sharpen existing ones) the Morphy way. It triggers when the user wants to teach the agent a repeatable capability -- "turn this into a skill", "make a skill for X", "save this workflow" -- and walks a capture-intent / draft / test / sharpen loop. It also covers packaging a skill (optionally with live widgets and pages) as a blueprint to sell on the marketplace.

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
- **Pair with crons**: Skills become powerful when combined with scheduled triggers. A skill that defines a report format + a daily cron = an automated daily report, delivered over whichever channel skill the user prefers.

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

MCP loading lives inside the harnesses (`supervisor/bloby-agent.ts` is only the harness dispatcher and contains no MCP code):

- **Claude harness** (`supervisor/harnesses/claude.ts`): `loadMcpServers()` reads `workspace/MCP.json` from disk each time a conversation session or one-shot query is built. It accepts the canonical object map, or the legacy array merged via `Object.assign({}, ...mcpConfig)`. The result is passed straight to the Claude Agent SDK as the `mcpServers` option:

```typescript
const options = {
    // ...
    systemPrompt,
    mcpServers, // from loadMcpServers()
    agents,
    skills,
};
```

- **Codex harness** (`supervisor/harnesses/codex.ts`): `loadMcpServersForCodex()` reads the same file (additionally accepting a `{ "mcpServers": { ... } }` wrapper), and `buildMcpConfigArgs()` translates each entry into `codex app-server -c mcp_servers.<name>.<field>=...` spawn flags, because codex sources MCP from its own config layer rather than a per-query parameter. Both stdio entries (`command`/`args`/`env`) and streamable-HTTP entries (`url`/`headers`) are supported; non-string values are coerced to strings where codex's config requires them.

- **Pi harness**: no MCP support.

If `MCP.json` does not exist or is empty, no MCP servers are loaded and the agent runs with its default tool set (file read/write/edit, bash, etc.).

#### Use Cases for MCP

- **GitHub integration**: Connect a GitHub MCP server so the agent can create issues, open PRs, and read repository data.
- **Database access**: Expose a Postgres or MySQL server through MCP so the agent can run SQL queries.
- **External APIs**: Wrap any REST API in an MCP server to give the agent access to third-party services.
- **Custom tools**: Build domain-specific tools (deployment, monitoring, CI/CD) and expose them through MCP.

Like skills, MCP configuration is re-read from disk when a session is built (Claude harness) or when the codex app-server is spawned for a conversation, so changes to `MCP.json` take effect on the next new session without restarting Morphy.

---
