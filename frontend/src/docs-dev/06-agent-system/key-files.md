---
title: "Key Files"
---

## Appendix: Key File Paths

| File | Purpose |
|------|---------|
| `supervisor/bloby-agent.ts` | Agent SDK integration and context assembly |
| `supervisor/scheduler.ts` | Pulse and Cron scheduler |
| `supervisor/index.ts` | Supervisor process: HTTP server, WebSocket, routing |
| `supervisor/file-saver.ts` | Attachment persistence to disk |
| `shared/ai.ts` | Multi-provider AI abstraction layer |
| `shared/config.ts` | Configuration loading and persistence |
| `shared/paths.ts` | Canonical path definitions |
| `worker/index.ts` | Worker process: Express API server |
| `worker/db.ts` | SQLite database schema and queries |
| `worker/claude-auth.ts` | Claude OAuth PKCE flow |
| `worker/prompts/bloby-system-prompt.txt` | Base system prompt template |
| `workspace/MYSELF.md` | Agent identity file |
| `workspace/MYHUMAN.md` | User profile file |
| `workspace/MEMORY.md` | Curated long-term memory |
| `workspace/PULSE.json` | Pulse scheduler configuration |
| `workspace/CRONS.json` | Cron task definitions |
| `workspace/MCP.json` | MCP server configuration |
| `workspace/memory/YYYY-MM-DD.md` | Daily note files |
| `workspace/tasks/{id}.md` | Detailed cron task instructions |
| `workspace/skills/` | Auto-discovered skill plugins |
