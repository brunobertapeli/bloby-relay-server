---
title: Skills & Plugins
---

# Skills & Plugins

Skills extend what Morphy can do. They live inside your workspace.

## How they work

Each skill is a directory inside `workspace/skills/` with a `SKILL.md` file at its core:

```
workspace/skills/
└── my-skill/
    └── SKILL.md
```

`SKILL.md` starts with YAML frontmatter holding two keys: `name` (must match the folder name) and `description` (tells Morphy when to use the skill). The rest of the file is the skill's instructions. Skills can also include optional extras — `skill.json` (marketplace metadata), `SCRIPT.md` (a customer-facing persona for channel business modes), and `references/`, `scripts/`, or `assets/` folders.

Skills are automatically picked up when Morphy starts a new conversation. Each skill's name and description are always in context, and the full instructions are loaded only when the skill is actually used.

## MCP Servers

Morphy also supports MCP (Model Context Protocol) servers. Configure them in `workspace/MCP.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}
```

MCP servers give Morphy access to external tools and data sources — databases, APIs, services — through a standardized protocol.

## Creating skills

You can ask Morphy to create skills for you. Just describe what capability you want to add and it will set up the skill folder.
