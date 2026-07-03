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

`SKILL.md` starts with YAML frontmatter holding two keys: `name` (must match the folder name) and `description` (tells Morphy when to use the skill). The rest of the file is the skill's instructions. Skills can also include optional extras: `skill.json` (marketplace metadata), `SCRIPT.md` (a customer-facing persona for channel business and assistant modes), and `references/`, `scripts/`, or `assets/` folders. On the OpenAI provider, a skill can also ship an optional `SKILL.json` (uppercase, separate from `skill.json`) with display metadata like `displayName`, `shortDescription`, icons, and `brandColor`.

Skills are picked up automatically at the start of each new conversation, so adding or removing one needs no restart. Each skill's name and description are always in context, and the full instructions are loaded only when the skill is actually used.

## MCP Servers

Morphy also supports MCP (Model Context Protocol) servers. Configure them in `workspace/MCP.json`. The file is a plain map from server name to config. Do not wrap it in an `mcpServers` key:

```json
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "my-mcp-server"],
    "env": {
      "API_KEY": "your-api-key"
    }
  }
}
```

`env` is optional. Use it to pass API keys and other secrets to the server process. Remote servers work too: give the entry `"type": "http"` and a `"url"` instead of a `command`, with optional `"headers"` for auth.

MCP servers give Morphy access to external tools and data sources (databases, APIs, services) through a standardized protocol. Like skills, changes to `MCP.json` take effect on the next conversation. No restart needed.

## Creating skills

You can ask Morphy to create skills for you. Just describe what capability you want to add and it will set up the skill folder.
