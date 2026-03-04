---
title: Skills & Plugins
---

# Skills & Plugins

Skills are plugins that extend what Fluxy can do. They live inside your workspace.

## How they work

Each skill is a directory inside `workspace/skills/` with a plugin manifest:

```
workspace/skills/
└── my-skill/
    └── .claude-plugin/
        └── plugin.json
```

Skills are automatically discovered and loaded when Fluxy starts a new conversation. They appear as additional capabilities the agent can use.

## MCP Servers

Fluxy also supports MCP (Model Context Protocol) servers. Configure them in `workspace/MCP.json`:

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

MCP servers give Fluxy access to external tools and data sources — databases, APIs, services — through a standardized protocol.

## Creating skills

You can ask Fluxy to create skills for you. Just describe what capability you want to add and it will set up the plugin structure.
